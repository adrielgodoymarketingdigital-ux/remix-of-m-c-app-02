// CRM de leads (fase 1) — prova das migrations num Postgres 17 LOCAL (PGlite,
// WebAssembly). Não toca produção. Dados 100% fictícios.
//
// Rodar (o PGlite não é dependência do projeto; 0.3.4 quebra em RAISE):
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite.mjs              # suíte
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite.mjs --mutantes   # + mutantes
//
// Cobre: conferência prévia e verificações (todas ok), idempotência, RLS e
// privilégios, ingestão (dedupe, rejeições, fora de ordem, first touch, corte
// em 30, opt-out permanente), vínculo (exato, DDD+8, ambíguo, inelegível),
// funil e funil por anúncio, gasto informado (só admin, sobreposição, remoção,
// rateio) com fonte Meta só das campanhas de WhatsApp, _crm_pagantes ×
// admin_mkt_origens (migration real), retenção, relatório, "Começar do zero"
// não enxerga as tabelas, verificações estáticas e rollbacks.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const ORIG = {
  sql1: ler("supabase/migrations/20261121120000_crm_leads_1_estrutura.sql"),
  sql2: ler("supabase/migrations/20261121120010_crm_leads_2_gravacao.sql"),
  sql3: ler("supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql"),
};
const META_ADS = ler("supabase/migrations/20261024130000_meta_ads_cache.sql");
const MKT_ORIGENS = ler("supabase/migrations/20261021130000_admin_mkt_origens.sql");
const CONFERIR = ler("scripts/crm-leads/0-conferir-producao.sql");
const VERIF = [1, 2, 3].map((n) => ler(`scripts/crm-leads/${n}-verificar-${["estrutura", "gravacao", "funil-admin"][n - 1]}.sql`));
const ROLLBACK = [1, 2, 3].map((n) => ler(`scripts/crm-leads/rollback-${n}-${["estrutura", "gravacao", "funil-admin"][n - 1]}.sql`));
const { casos: CASOS_TEL } = JSON.parse(ler("scripts/crm-leads/casos-telefone.json"));

// Réplica mínima das tabelas/funções que as migrations LEEM (colunas usadas).
const BASE = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, celular text, created_at timestamptz DEFAULT now(),
  utm_source text, utm_medium text, utm_campaign text, utm_content text, fbclid text);
CREATE TABLE public.loja_funcionarios (funcionario_user_id uuid);
CREATE TABLE public.empresa_usuarios (gerente_id uuid);
CREATE TABLE public.assinaturas (user_id uuid, plano_tipo text, status text, trial_started_at timestamptz,
  payment_method text, payment_provider text, data_inicio timestamptz, bloqueado_admin boolean DEFAULT false);
CREATE TABLE public.pagamentos_pix (user_id uuid, status text, paid_at timestamptz, valor_centavos int);
CREATE TABLE public.admin_notifications (tipo text, dados jsonb, created_at timestamptz);
-- CRM antigo (só para a conferência; nada da fase 1 toca nele)
CREATE TABLE public.crm_automacoes (id int); CREATE TABLE public.crm_configuracoes (id int);
CREATE TABLE public.crm_estagios (id int);   CREATE TABLE public.crm_usuarios (id int, user_id uuid);
`;

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(900), COMUM = U(901);

async function suite(sqls, { silencioso = false } = {}) {
  const db = new PGlite();
  const falhas = [];
  const ok = (cond, msg) => {
    if (!cond) falhas.push(msg);
    if (!silencioso) console.log(`${cond ? "OK   " : "FALHA"} ${msg}`);
  };
  const q = async (sql, p) => (await db.query(sql, p)).rows;
  const como = async (papel, uid) => {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: uid ?? "", role: papel })}', false);`);
    if (papel !== "postgres") await db.exec(`SET ROLE ${papel}`);
  };
  const erro = async (sql, p) => { try { await db.query(sql, p); return ""; } catch (e) { return e.message; } };
  const erroExec = async (sql) => { try { await db.exec(sql); return ""; } catch (e) { return e.message; } };
  const tudoOk = async (sql, nome) => {
    const linhas = await q(sql);
    const ruins = linhas.filter((l) => l.ok !== true);
    ok(linhas.length > 0 && ruins.length === 0, `${nome}: ${linhas.length} linhas ok${ruins.length ? " — FALHOU: " + ruins.map((r) => `${r.item} [${r.encontrado}]`).join(" | ") : ""}`);
  };
  const iso = (minAtras) => new Date(Date.now() - minAtras * 60_000).toISOString();

  try {
    await db.exec(BASE);
    await db.exec(META_ADS);
    await db.exec(MKT_ORIGENS);

    // ---------------- conferência, aplicação 2x e verificações ----------------
    await tudoOk(CONFERIR, "0-conferir-producao (antes)");
    await db.exec(sqls.sql1); await tudoOk(VERIF[0], "1-verificar-estrutura");
    await db.exec(sqls.sql2); await tudoOk(VERIF[1], "2-verificar-gravacao");
    await db.exec(sqls.sql3); await tudoOk(VERIF[2], "3-verificar-funil-admin");
    await db.exec(sqls.sql1); await db.exec(sqls.sql2); await db.exec(sqls.sql3);
    ok(true, "SQL 1, 2 e 3 aplicados 2x sem erro (idempotentes)");
    const conf2 = await q(CONFERIR);
    ok(conf2.filter((l) => !l.ok).map((l) => l.item.split(".")[0]).join(",") === "9,10,11",
      "conferência depois de aplicar acusa exatamente os itens 9, 10 e 11 (já existem)");

    // ---------------- telefone (mesmos casos do Deno) ----------------
    let difs = 0;
    for (const [ent, esp] of CASOS_TEL) {
      const [{ n }] = await q("SELECT public.crm_normalizar_telefone($1) AS n", [ent]);
      if (n !== esp) { difs++; if (!silencioso) console.log("   difere:", ent, n, esp); }
    }
    ok(difs === 0, `crm_normalizar_telefone bate com os ${CASOS_TEL.length} casos de casos-telefone.json`);

    // ---------------- cadastros fictícios ----------------
    await db.exec(`
      INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');
      INSERT INTO profiles (user_id, celular, created_at) VALUES
        ('${U(1)}', '1190000001', now()),                         -- celular antigo sem o 9
        ('${U(2)}', '(21) 99000-0009', now() - interval '2 days'),
        ('${U(3)}', '21990000009', now() - interval '3 days'),     -- 2 e 3: ambíguo
        ('${U(4)}', '11 99000-0002', now() - interval '400 days'), -- já era cliente
        ('${U(5)}', '31990000005', now()),                         -- funcionário: inelegível
        ('${U(6)}', '41 99000-0006', now());                       -- vínculo exato pelo n8n
      INSERT INTO loja_funcionarios VALUES ('${U(5)}');
      INSERT INTO assinaturas (user_id, plano_tipo, trial_started_at, payment_method, payment_provider, data_inicio) VALUES
        ('${U(1)}', 'basico_mensal', now(), 'credit_card', 'pagarme', now()),
        ('${U(6)}', 'trial', now(), NULL, NULL, NULL);
      INSERT INTO pagamentos_pix VALUES ('${U(4)}', 'paid', now(), 1990);
    `);

    // ---------------- RLS e privilégios ----------------
    await como("authenticated", COMUM);
    ok(/permission denied/.test(await erro("SELECT public.crm_ingerir_mensagens('[]'::jsonb)")), "authenticated não executa a ingestão");
    ok(/permission denied/.test(await erro("INSERT INTO crm_leads (telefone_e164, primeiro_contato_em, ultimo_contato_em) VALUES ('+5511990000077', now(), now())")), "authenticated não insere em crm_leads");
    ok(/permission denied/.test(await erro("SELECT * FROM public._crm_pagantes(ARRAY[]::uuid[])")), "authenticated não executa _crm_pagantes");
    ok(/Apenas administradores/.test(await erro("SELECT * FROM admin_crm_funil(current_date - 7, current_date)")), "funil recusa não-admin");
    ok(/Apenas administradores/.test(await erro("SELECT * FROM admin_crm_funil_por_anuncio(current_date - 7, current_date)")), "funil por anúncio recusa não-admin");
    ok(/Apenas administradores/.test(await erro("SELECT admin_crm_gasto_informar(current_date - 1, current_date, 10, NULL, NULL)")), "gasto: não-admin não informa");
    ok(/Apenas administradores/.test(await erro("SELECT admin_crm_gasto_remover(1)")), "gasto: não-admin não remove");
    await como("anon");
    ok(/permission denied/.test(await erro("SELECT * FROM crm_leads")), "anon não lê crm_leads");
    ok(/permission denied/.test(await erro("SELECT * FROM admin_crm_funil(current_date - 7, current_date)")), "anon não executa o funil");
    await como("authenticated", ADMIN);
    ok(/permission denied/.test(await erro("UPDATE crm_leads SET opt_out = false")), "nem o admin grava direto (só por função)");

    // ---------------- ingestão ----------------
    await como("service_role");
    const lote = [
      { telefone: "5511990000001", wa_jid: "551190000001@s.whatsapp.net", nome: "Lead Ficticio", wa_message_id: "m1", direcao: "entrada", tipo: "texto", texto: "oi, vi o anúncio", enviada_em: iso(60),
        referral: { ad_id: "120000000000001", titulo: "Anúncio A", tipo: "ad", ctwa_clid: "clid-ficticio" } },
      { telefone: "5511990000001", wa_message_id: "m1", direcao: "entrada", texto: "oi", enviada_em: iso(60) },
      { telefone: "5511990000001", wa_message_id: "m2", direcao: "saida", autor: "humano", texto: "Olá!", enviada_em: iso(59) },
      { telefone: "123", wa_message_id: "m3", direcao: "entrada", enviada_em: iso(1) },
      { telefone: "5511990000002", wa_message_id: "m4", direcao: "entrada", texto: "PARAR", enviada_em: iso(5) },
      { telefone: "5511990000003", wa_message_id: "m5", direcao: "saida", autor: "lead", enviada_em: iso(5) },
      { telefone: "5531990000005", wa_message_id: "m6", direcao: "entrada", texto: "oi", enviada_em: iso(10) },
      { telefone: "5541990000006", wa_message_id: "m7", direcao: "entrada", texto: "quanto custa", enviada_em: iso(10),
        referral: { ad_id: "120000000000001", titulo: "Anúncio A" } },
    ];
    const [{ r }] = await q("SELECT public.crm_ingerir_mensagens($1::jsonb) AS r", [JSON.stringify(lote)]);
    ok(r.inseridas === 5 && r.duplicadas === 1 && r.opt_outs === 1
       && JSON.stringify(r.rejeitadas) === JSON.stringify([{ erro: "telefone_invalido", indice: 3 }, { erro: "campo_invalido", indice: 5 }]),
       `ingestão: 5 inseridas, 1 duplicada, 1 opt-out, rejeições por índice (${JSON.stringify(r)})`);
    const [{ r: rdup }] = await q("SELECT public.crm_ingerir_mensagens($1::jsonb) AS r", [JSON.stringify(lote.slice(0, 3))]);
    ok(rdup.inseridas === 0 && rdup.duplicadas === 3, `reenvio do mesmo lote não duplica (${rdup.inseridas}/${rdup.duplicadas})`);
    await q("SELECT public.crm_ingerir_mensagens($1::jsonb)", [JSON.stringify([
      { telefone: "+5511990000001", wa_message_id: "m0", direcao: "entrada", texto: "antiga", enviada_em: iso(120), referral: { ad_id: "999", titulo: "Outro" } }])]);
    let [l1] = await q("SELECT * FROM crm_leads WHERE telefone_e164 = '+5511990000001'");
    ok(l1.origem_ad_id === "120000000000001" && l1.ultimo_falou === "loja" && l1.etapa === "em_conversa"
       && new Date(l1.primeiro_contato_em) < new Date(iso(100)),
       "fora de ordem: 1º anúncio fica, último a falar não regride, 1º contato recua");
    await q("SELECT public.crm_ingerir_mensagens($1::jsonb)", [JSON.stringify([
      { telefone: "5511990000002", wa_message_id: "m4b", direcao: "entrada", texto: "voltei", enviada_em: iso(1) }])]);
    ok((await q("SELECT opt_out FROM crm_leads WHERE telefone_e164 = '+5511990000002'"))[0].opt_out === true, "opt-out é permanente (mensagem nova não desliga)");
    await q("SELECT public.crm_registrar_opt_out('(11) 99000-0088', 'n8n')");
    ok((await q("SELECT opt_out FROM crm_leads WHERE telefone_e164 = '+5511990000088'"))[0]?.opt_out === true, "opt-out por fora cria o lead já bloqueado");
    await db.exec("RESET ROLE; DELETE FROM crm_leads WHERE telefone_e164 = '+5511990000088';");
    await como("service_role");
    const muitas = Array.from({ length: 35 }, (_, i) => ({ telefone: "5521990000009", wa_message_id: `x${i}`, direcao: "entrada", texto: `t${i}`, enviada_em: iso(200 - i) }));
    await q("SELECT public.crm_ingerir_mensagens($1::jsonb)", [JSON.stringify(muitas)]);
    const [{ c: c30, ult }] = await q(`SELECT count(*)::int c, max(texto) FILTER (WHERE wa_message_id = 'x34') ult FROM crm_lead_mensagens m
      JOIN crm_leads l ON l.id = m.lead_id WHERE l.telefone_e164 = '+5521990000009'`);
    ok(c30 === 30 && ult === "t34", `máximo de 30 mensagens por lead, ficam as mais novas (${c30})`);
    ok(/lote inválido/.test(await erro(`SELECT public.crm_ingerir_mensagens($1::jsonb)`, [JSON.stringify(Array.from({ length: 201 }, () => ({})))])), "lote de 201 recusado");

    // ---------------- vínculo ----------------
    const [{ v: vex }] = await q(`SELECT public.crm_vincular_usuario('41990000006', '${U(6)}') AS v`);
    const [{ v: vfu }] = await q(`SELECT public.crm_vincular_usuario('31990000005', '${U(5)}') AS v`);
    ok(vex === "vinculado" && vfu === "profile_inelegivel", `vínculo exato pelo n8n e funcionário recusado (${vex}/${vfu})`);
    const [{ v }] = await q("SELECT public.crm_vincular_cadastros(120) AS v");
    ok(v.vinculados === 2 && v.ambiguos_novos === 1, `vínculo em lote: 2 vinculados (DDD+8, sem o 9), 1 ambíguo, funcionário fora (${JSON.stringify(v)})`);
    const vinc = await q("SELECT telefone_e164 t, cadastro_user_id u, vinculo_metodo m, vinculo_ambiguo a FROM crm_leads ORDER BY 1");
    const por = Object.fromEntries(vinc.map((x) => [x.t, x]));
    ok(por["+5511990000001"].u === U(1) && por["+5531990000005"].u === null && por["+5521990000009"].a === true
       && por["+5541990000006"].m === "cadastro_n8n",
       "vínculos: celular antigo ligado, funcionário não, ambíguo marcado, exato preservado");

    // ---------------- funil ----------------
    await como("authenticated", ADMIN);
    ok((await q("SELECT count(*)::int c FROM crm_leads"))[0].c === 5, "admin lê os 5 leads (RLS)");
    await como("authenticated", COMUM);
    ok((await q("SELECT count(*)::int c FROM crm_leads"))[0].c === 0, "não-admin lê 0 leads (RLS)");
    await como("authenticated", ADMIN);
    const [f] = await q("SELECT * FROM admin_crm_funil(current_date - 7, current_date)");
    const fn = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, Number(x)]));
    ok(JSON.stringify(fn) === JSON.stringify({ conversas: 5, conversas_anuncio: 2, ja_clientes: 1, cadastros: 2, testes: 2, assinantes: 1,
       opt_outs: 1, gasto_meta_centavos: 0, gasto_meta_dias: 0, gasto_manual_centavos: 0, gasto_manual_lancamentos: 0 }),
       `funil ${JSON.stringify(fn)}`);
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil(current_date, current_date - 1)")), "funil recusa período invertido");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil(current_date - 401, current_date)")), "funil recusa mais de 400 dias");

    // ---------------- gasto informado ----------------
    const [{ id: g1 }] = await q("SELECT admin_crm_gasto_informar(current_date - 9, current_date, 100.00, '120000000000001', 'teste') AS id");
    ok(Number(g1) > 0, "admin informa gasto do anúncio A");
    ok(/sobrepõe/.test(await erro("SELECT admin_crm_gasto_informar(current_date - 3, current_date, 50, NULL, NULL)")), "gasto geral sobreposto a um de anúncio é recusado");
    ok(/sobrepõe/.test(await erro("SELECT admin_crm_gasto_informar(current_date - 3, current_date, 50, '120000000000001', NULL)")), "mesmo anúncio sobreposto é recusado");
    const [{ id: g2 }] = await q("SELECT admin_crm_gasto_informar(current_date - 4, current_date, 30.00, '120000000000002', NULL) AS id");
    ok(Number(g2) > 0, "outro anúncio no mesmo período é aceito");
    ok(/Período inválido/.test(await erro("SELECT admin_crm_gasto_informar(current_date, current_date + 1, 10, NULL, NULL)")), "gasto com data futura recusado");
    ok(/Valor inválido/.test(await erro("SELECT admin_crm_gasto_informar(current_date - 30, current_date - 20, 0, NULL, NULL)")), "gasto zero recusado");
    ok(/Valor inválido/.test(await erro("SELECT admin_crm_gasto_informar(current_date - 30, current_date - 20, 1.005, NULL, NULL)")), "gasto com 3 casas recusado");
    ok(/anúncio inválido/.test(await erro("SELECT admin_crm_gasto_informar(current_date - 30, current_date - 20, 1, 'a b', NULL)")), "ID de anúncio inválido recusado");
    let [fg] = await q("SELECT gasto_manual_centavos g, gasto_manual_lancamentos n FROM admin_crm_funil(current_date - 4, current_date)");
    ok(Number(fg.g) === 8000 && Number(fg.n) === 2, `rateio: A 5/10 de R$100 + B R$30 = R$80,00 (${fg.g}, ${fg.n} lançamentos)`);
    ok((await q(`SELECT admin_crm_gasto_remover(${g2}) r`))[0].r === true && (await q(`SELECT admin_crm_gasto_remover(${g2}) r`))[0].r === false,
       "remoção lógica (2ª vez = false)");
    [fg] = await q("SELECT gasto_manual_centavos g FROM admin_crm_funil(current_date - 4, current_date)");
    ok(Number(fg.g) === 5000, `removido não entra no funil (${fg.g})`);
    const [gm] = await q(`SELECT criado_por, removido_por FROM crm_gasto_manual WHERE id = ${g2}`);
    ok(gm.criado_por === ADMIN && gm.removido_por === ADMIN, "quem informou e quem removeu ficam gravados");
    const porAd = await q("SELECT * FROM admin_crm_funil_por_anuncio(current_date - 7, current_date)");
    const adA = porAd.find((x) => x.ad_id === "120000000000001");
    ok(porAd.length === 2 && Number(adA.conversas) === 2 && Number(adA.cadastros) === 2 && Number(adA.assinantes) === 1
       && Number(adA.gasto_manual_centavos) === 8000 && porAd.some((x) => x.ad_id === ""),
       `funil por anúncio (${porAd.map((x) => `${x.ad_id || "sem"}:${x.conversas}/${x.gasto_manual_centavos}`).join(" ")})`);

    // ---------------- gasto da Meta: só campanhas de WhatsApp ----------------
    await db.exec(`RESET ROLE;
      INSERT INTO meta_ads_insights_dia (ad_account_id, campaign_id, dia, gasto) VALUES
        ('1', '111', current_date - 1, 40.00), ('1', '111', current_date, 2.50), ('1', '222', current_date, 999.00);`);
    await como("authenticated", ADMIN);
    let [fm] = await q("SELECT gasto_meta_centavos g, gasto_meta_dias d FROM admin_crm_funil(current_date - 7, current_date)");
    ok(Number(fm.g) === 0 && Number(fm.d) === 0, "Meta sem campanha marcada como WhatsApp = 0");
    await db.exec(`RESET ROLE; INSERT INTO crm_campanhas_whatsapp (campaign_id) VALUES ('111');`);
    await como("authenticated", ADMIN);
    [fm] = await q("SELECT gasto_meta_centavos g, gasto_meta_dias d FROM admin_crm_funil(current_date - 7, current_date)");
    ok(Number(fm.g) === 4250 && Number(fm.d) === 2, `Meta só da campanha de WhatsApp: R$42,50 em 2 dias (${fm.g}/${fm.d})`);

    // ---------------- _crm_pagantes × admin_mkt_origens (migration real) ----------------
    await db.exec(`RESET ROLE;
      INSERT INTO profiles (user_id, created_at, utm_source)
        SELECT ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, now(), 'p' || n FROM generate_series(1, 13) n;
      INSERT INTO pagamentos_pix VALUES ('${U(101)}', 'paid', now(), 1990), ('${U(102)}', 'pending', NULL, 1990), ('${U(110)}', 'paid', now(), 1990);
      INSERT INTO assinaturas (user_id, plano_tipo, payment_method, payment_provider, data_inicio, bloqueado_admin, trial_started_at) VALUES
        ('${U(103)}', 'basico_mensal', 'credit_card', 'pagarme', now(), false, NULL),
        ('${U(104)}', 'free', 'credit_card', 'pagarme', now(), false, NULL),
        ('${U(105)}', 'basico_mensal', 'credit_card', 'stripe', now(), false, NULL),
        ('${U(110)}', 'basico_mensal', NULL, NULL, NULL, true, NULL),
        ('${U(111)}', 'trial', NULL, NULL, NULL, false, now()),
        ('${U(113)}', 'profissional_ultra_anual', 'credit_card', 'PagarMe', now(), false, NULL);
      INSERT INTO admin_notifications VALUES
        ('nova_assinatura', '{"user_id":"${U(106)}","stripe_subscription_id":"sub_ficticio"}', now()),
        ('nova_assinatura', '{"user_id":"${U(107)}","stripe_subscription_id":"sub_pending_x"}', now()),
        ('nova_assinatura_cartao', '{"user_id":"${U(108)}","valor_centavos":1990}', now()),
        ('nova_assinatura', '{"user_id":"${U(109)}","pagarme_order_id":null}', now()),
        ('outro_tipo', '{"user_id":"${U(112)}","valor_centavos":1990}', now());
    `);
    await como("authenticated", ADMIN);
    const viaMkt = (await q("SELECT fonte, pagantes FROM admin_mkt_origens(current_date - 1, current_date) WHERE fonte ~ '^p[0-9]+$'"))
      .filter((x) => Number(x.pagantes) > 0).map((x) => x.fonte).sort();
    await db.exec("RESET ROLE");
    const viaCrm = (await q(`SELECT 'p' || (right(user_id::text, 2)::int) AS fonte FROM _crm_pagantes(ARRAY(
        SELECT ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid FROM generate_series(1, 13) n))`))
      .map((x) => x.fonte).sort();
    ok(viaMkt.length === 5 && JSON.stringify(viaMkt) === JSON.stringify(viaCrm),
       `_crm_pagantes = admin_mkt_origens nos 13 cenários (${viaCrm.join(",")} × ${viaMkt.join(",")})`);

    // ---------------- relatório e retenção ----------------
    await como("service_role");
    const [{ rel }] = await q("SELECT public.crm_relatorio_diario((now() AT TIME ZONE 'America/Sao_Paulo')::date) AS rel");
    ok(rel.conversas_novas === 5 && rel.opt_outs_no_dia === 1 && rel.vinculos_ambiguos === 1 && !JSON.stringify(rel).includes("+55"),
       `relatório diário só com números (${JSON.stringify(rel)})`);
    await db.exec(`RESET ROLE; UPDATE crm_leads SET resumo = 'resumo ficticio', ultimo_contato_em = now() - interval '91 days',
      primeiro_contato_em = now() - interval '95 days' WHERE telefone_e164 = '+5521990000009';`);
    await como("service_role");
    const [{ ret }] = await q("SELECT public.crm_aplicar_retencao() AS ret");
    const [l9] = await q("SELECT resumo, opt_out, mensagens_apagadas_em FROM crm_leads WHERE telefone_e164 = '+5521990000009'");
    ok(ret.mensagens_apagadas === 30 && ret.leads_limpos === 1 && l9.resumo === null && l9.mensagens_apagadas_em !== null,
       `retenção 90 dias apaga mensagens e resumo, mantém o lead (${JSON.stringify(ret)})`);
    const [{ ret: ret2 }] = await q("SELECT public.crm_aplicar_retencao() AS ret");
    ok(ret2.mensagens_apagadas === 0 && ret2.leads_limpos === 0, "retenção de novo não faz nada");

    // ---------------- "Começar do zero" (mesma varredura de zerar_meus_dados) ----------------
    await db.exec("RESET ROLE");
    const vistas = await q(`SELECT k.relname FROM pg_class k JOIN pg_attribute a ON a.attrelid = k.oid AND NOT a.attisdropped
      WHERE k.relnamespace = 'public'::regnamespace AND k.relkind IN ('r','p') AND k.relname LIKE 'crm\\_%'
        AND k.relname NOT IN ('crm_automacoes','crm_configuracoes','crm_estagios','crm_usuarios')
        AND a.attname IN ('user_id','loja_user_id','proprietario_id')`);
    ok(vistas.length === 0, `"Começar do zero" não acha coluna de dono nas tabelas novas (${vistas.map((x) => x.relname)})`);

    // ---------------- rollbacks ----------------
    for (const rb of [ROLLBACK[2], ROLLBACK[1]]) await db.exec(rb);
    ok(/rollback-1 recusado/.test(await erroExec(ROLLBACK[0])), "rollback-1 recusa com leads gravados");
    await db.exec("ROLLBACK").catch(() => {});
    await db.exec(ROLLBACK[0].replace("'NAO';   -- <<< linha marcada", "'SIM';"));
    const sobra = await q(`SELECT count(*)::int c FROM pg_class WHERE relnamespace = 'public'::regnamespace
        AND relname IN ('crm_leads','crm_lead_mensagens','crm_gasto_manual','crm_campanhas_whatsapp')`);
    const sobraF = await q(`SELECT count(*)::int c FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND (proname LIKE 'crm\\_%' OR proname LIKE '\\_crm\\_%' OR proname LIKE 'admin\\_crm\\_%')`);
    const metaVivo = await q("SELECT count(*)::int c FROM meta_ads_insights_dia");
    ok(sobra[0].c === 0 && sobraF[0].c === 0 && metaVivo[0].c === 3, "rollbacks 3→2→1 removem tudo da fase 1 e não tocam meta_ads_insights_dia");
    await tudoOk(CONFERIR, "0-conferir-producao (depois do rollback, pronto para reaplicar)");
  } catch (e) {
    ok(false, `exceção: ${e.message}`);
  } finally {
    await db.close();
  }
  return falhas;
}

// ---------------------------------------------------------------------------
// Verificações estáticas (texto das migrations)
// ---------------------------------------------------------------------------
function estaticas() {
  const falhas = [];
  const tudo = ORIG.sql1 + ORIG.sql2 + ORIG.sql3;
  const ok = (c, m) => { console.log(`${c ? "OK   " : "FALHA"} ${m}`); if (!c) falhas.push(m); };
  const semComentario = tudo.replace(/--.*$/gm, "");
  const alter = [...semComentario.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([\w.]+)/gi)].map((m) => m[1]);
  ok(alter.every((t) => /^public\.crm_(leads|lead_mensagens|gasto_manual|campanhas_whatsapp)$/.test(t)),
     `ALTER TABLE só nas tabelas novas (${[...new Set(alter)].join(", ")})`);
  ok(!/(CREATE|ALTER|DROP|TRUNCATE|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(TABLE\s+)?(IF\s+(NOT\s+)?EXISTS\s+)?public\.meta_ads/i.test(semComentario),
     "nenhum DDL/DML em meta_ads_* (só leitura)");
  ok(!/crm_estagios|crm_usuarios|crm_automacoes|crm_configuracoes|trigger_crm_automacao|crm_stage|update_crm_stage/.test(semComentario),
     "nenhuma referência ao CRM antigo");
  ok(!/_zerar_catalogo|REFERENCES\s+public\.(profiles|assinaturas|auth)|REFERENCES\s+auth\./i.test(semComentario),
     "sem remendo no _zerar_catalogo e sem FK para tabela existente");
  ok(!/CREATE\s+(UNIQUE\s+)?INDEX[^;]*ON\s+public\.(?!crm_)/i.test(semComentario), "índices só nas tabelas novas");
  ok([ORIG.sql1, ORIG.sql2, ORIG.sql3].every((s) => /SET LOCAL lock_timeout = '3s';/.test(s) && /SET LOCAL statement_timeout = '60s';/.test(s)),
     "os 3 SQL têm lock_timeout e statement_timeout");
  ok(ROLLBACK.every((s) => s.includes("NÃO RODE — SÓ EM EMERGÊNCIA")), "rollbacks marcados NÃO RODE");
  ok(!/\b(55)?\d{2}9\d{4}\d{4}\b/.test(tudo.replace(/990000\d{3}|9[0-9]0000\d{3}/g, "")),
     "nenhum celular com cara de real nas migrations");
  return falhas;
}

// ---------------------------------------------------------------------------
// Mutantes: cada um TEM que derrubar a suíte
// ---------------------------------------------------------------------------
const MUTANTES = [
  { nome: "tirar has_role das funções do admin", arq: "sql3", de: /IF NOT public\.has_role\(auth\.uid\(\), 'admin'\) THEN/g, para: "IF false THEN" },
  { nome: "tirar o filtro de inelegíveis (funcionário)", arq: "sql2",
    de: "     AND NOT EXISTS (SELECT 1 FROM public.loja_funcionarios f WHERE f.funcionario_user_id = p_user_id)\n", para: "" },
  { nome: "tirar o corte em 30 mensagens", arq: "sql2", de: "x.rn > 30", para: "x.rn > 100000" },
  { nome: "tirar a deduplicação", arq: "sql1", de: "  CONSTRAINT crm_lead_mensagens_dedupe UNIQUE (lead_id, wa_message_id),\n", para: "",
    tambem: { arq: "sql2", de: "ON CONFLICT ON CONSTRAINT crm_lead_mensagens_dedupe DO NOTHING", para: "" } },
  { nome: "RLS de crm_leads aberta (USING true)", arq: "sql1",
    de: `CREATE POLICY "admin le crm_leads" ON public.crm_leads\n  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));`,
    para: `CREATE POLICY "admin le crm_leads" ON public.crm_leads\n  FOR SELECT TO authenticated USING (true);` },
  { nome: "não detectar PARAR", arq: "sql2", de: "IF v_dir = 'entrada' AND public.crm_eh_opt_out(v_texto) THEN", para: "IF false THEN" },
  { nome: "aceitar gasto sobreposto", arq: "sql3", de: "AND (g.ad_id IS NULL OR v_ad IS NULL OR g.ad_id = v_ad)", para: "AND false" },
  { nome: "pagante ignorando bloqueado_admin", arq: "sql3", de: "x.bloqueado_admin = true", para: "false" },
  { nome: "funil sem o filtro de campanhas de WhatsApp", arq: "sql3",
    de: "      JOIN public.crm_campanhas_whatsapp c ON c.campaign_id = i.campaign_id\n", para: "" },
  { nome: "@lid aceito como telefone", arq: "sql1",
    de: "IF lower(split_part(v_txt, '@', 2)) NOT IN ('s.whatsapp.net', 'c.us') THEN RETURN NULL; END IF;", para: "" },
];

function aplicarMutante(m) {
  const s = { ...ORIG };
  for (const passo of [m, m.tambem].filter(Boolean)) {
    const antes = s[passo.arq];
    s[passo.arq] = antes.replace(passo.de, passo.para);
    if (s[passo.arq] === antes) throw new Error(`mutante "${m.nome}" não achou o trecho em ${passo.arq}`);
  }
  return s;
}

const falhasEst = estaticas();
console.log("\n--- suíte ---");
const falhas = await suite(ORIG);
let falhasMut = 0;
if (process.argv.includes("--mutantes")) {
  console.log("\n--- mutantes (cada um precisa ser MORTO) ---");
  for (const m of MUTANTES) {
    const f = await suite(aplicarMutante(m), { silencioso: true });
    const morto = f.length > 0;
    if (!morto) falhasMut++;
    console.log(`${morto ? "MORTO" : "VIVO!"} ${m.nome}${morto ? ` — ${f.length} verificação(ões):` : ""}`);
    for (const x of f.slice(0, 4)) console.log(`        · ${x.slice(0, 110)}`);
  }
}
const total = falhasEst.length + falhas.length + falhasMut;
console.log(total === 0 ? "\nTUDO OK" : `\n${total} FALHA(S)`);
process.exit(total ? 1 : 0);
