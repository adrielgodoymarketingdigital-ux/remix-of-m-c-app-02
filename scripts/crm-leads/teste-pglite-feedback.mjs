// CRM — PESQUISA DE FEEDBACK COM PAGANTES — prova num Postgres 17 LOCAL
// (PGlite, WebAssembly). Não toca produção. Dados 100% fictícios.
//
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-feedback.mjs              # suíte
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-feedback.mjs --mutantes   # + mutantes
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-feedback.mjs --hashes     # md5 do feedback-1
//
// Carrega as migrations REAIS da fase 1 (SQL 1, 2 e 3), da 1C e da 1D, roda a
// conferência, aplica a migration duas vezes e cobre a elegibilidade
// (pagante ativo com pagamento real; opt-out por telefone e por vínculo;
// admin; conta de teste; funcionário; sem celular / fixo / estrangeiro;
// telefone repetido entre contas; já contatado nesta campanha, também por
// outra conta com o mesmo telefone; plano free; assinatura inativa, vencida,
// bloqueada ou sem pagamento), a PAUSA entre campanhas (dentro, fora, só
// 'enviado' conta, vale para o telefone), ordem e limite, o registro
// (idempotente, enviado_em nunca muda, 'falhou' -> 'enviado', rejeições por
// item, lote grande), privilégios, scripts de consulta, rollback exato.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const ANTERIORES = [
  ler("supabase/migrations/20261121120000_crm_leads_1_estrutura.sql"),
  ler("supabase/migrations/20261121120010_crm_leads_2_gravacao.sql"),
  ler("supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql"),
  ler("supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql"),
  ler("supabase/migrations/20261121140000_crm_leads_1d_teste.sql"),
];
const ORIG = {
  mig: ler("supabase/migrations/20261122130000_crm_feedback_pagantes.sql"),
  rollback: ler("scripts/crm-leads/rollback-feedback.sql"),
};
const META_ADS = ler("supabase/migrations/20261024130000_meta_ads_cache.sql");
const CONFERIR = ler("scripts/crm-leads/feedback-0-conferir-producao.sql");
const VERIFICAR = ler("scripts/crm-leads/feedback-1-verificar.sql");
const CANDIDATOS = ler("scripts/crm-leads/feedback-0-candidatos-teste.sql");
const QUEM_RECEBEU = ler("scripts/crm-leads/feedback-2-quem-recebeu.sql");

const t1 = ler("scripts/crm-leads/teste-pglite.mjs");
const BASE = t1.slice(t1.indexOf("const BASE = `") + 14, t1.indexOf("`;", t1.indexOf("const BASE = `")));
const COLUNAS_TESTE = `
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS trial_canceled boolean DEFAULT false;
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS free_trial_ends_at timestamptz DEFAULT NULL;
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS data_fim timestamptz DEFAULT NULL;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;`;
const PADRAO_SUPABASE = `
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`;

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const CEL = (n) => `1199${String(n).padStart(7, "0")}`;          // celular fictício cru
const E164 = (n) => `+55${CEL(n)}`;
const DEPENDENCIAS = ["_crm_pagantes", "_crm_profile_elegivel", "crm_normalizar_telefone"];
const NOVAS = ["crm_pagantes_contato", "crm_contato_registrar"];
const ADMIN = U(5);

async function suite(s, { silencioso = false, comVerificacao = true } = {}) {
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
  const tudoOk = async (sql, nome) => {
    const linhas = await q(sql);
    const ruins = linhas.filter((l) => l.ok !== true);
    ok(linhas.length > 0 && ruins.length === 0, `${nome}: ${linhas.length} linhas ok${ruins.length ? " — FALHOU: " + ruins.map((r) => `${r.item} [${r.encontrado}]`).join(" | ") : ""}`);
    return linhas;
  };
  const defs = async (nomes) => JSON.stringify(await q(`
    SELECT p.proname, p.prosrc, pg_get_function_arguments(p.oid) a, pg_get_function_result(p.oid) r, p.prosecdef, p.proconfig, p.proacl::text acl
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1) ORDER BY p.proname`, [nomes]));
  const lista = async (campanha, limite = 50, pausa = 120, ids = null) => {
    const [{ r }] = await q("SELECT public.crm_pagantes_contato($1, $2, $3, $4::uuid[]) AS r", [campanha, limite, pausa, ids]);
    return { ids: r.itens.map((i) => i.user_id), itens: r.itens, total: Number(r.total_elegiveis), pausa: Number(r.excluidos_por_pausa) };
  };
  const registrar = async (campanha, itens) => (await q("SELECT public.crm_contato_registrar($1, $2::jsonb) AS r", [campanha, JSON.stringify(itens)]))[0].r;
  const linha = async (campanha, uid) => (await q(
    "SELECT resultado, enviado_em::text AS enviado_em, atualizado_em::text AS atualizado_em FROM crm_contato_campanha WHERE campanha = $1 AND destinatario_user_id = $2",
    [campanha, uid]))[0];
  const ids = (...ns) => ns.map(U);

  try {
    await db.exec(BASE);
    await db.exec(COLUNAS_TESTE);
    await db.exec(PADRAO_SUPABASE);
    await db.exec(META_ADS);
    for (const sql of ANTERIORES) await db.exec(sql);

    // ---------------- cadastros fictícios ----------------
    // pagante(n): assinatura ativa em plano pago + PIX pago há 40 dias
    const perfis = [];
    const ass = [];
    const pix = [];
    const pagante = (n, o = {}) => {
      perfis.push([n, o.cel === undefined ? CEL(n) : o.cel, o.nome ?? `Pessoa${n} Ficticia`]);
      ass.push([n, o.plano ?? "intermediario_mensal", o.status ?? "active", o.fim ?? null, o.bloq ?? false,
        o.cartao ? "credit_card" : "pix", o.cartao ? "pagarme" : "pagarme"]);
      if (o.pix !== false && !o.cartao) pix.push(n);
    };
    pagante(1, { nome: "MARIA silva" });
    pagante(2, { cartao: true, nome: "", cel: "(11) 99000-0002" });   // cartão Pagar.me; sem nome
    pagante(3);                                   // opt-out pelo telefone
    pagante(4);                                   // opt-out pelo vínculo (lead de outro número)
    pagante(5);                                   // admin
    pagante(6);                                   // conta de teste (tem linha demonstracao)
    pagante(7, { cel: null });                    // sem celular
    pagante(8, { nome: "  joão   pedro " });      // 8 e 9: mesmo telefone
    pagante(9, { cel: CEL(8), nome: "Zeca" });
    pagante(10);                                  // já recebeu NESTA campanha (há 300 dias)
    pagante(11, { plano: "trial" });              // plano free
    pagante(12, { status: "canceled" });          // assinatura inativa
    pagante(13, { pix: false });                  // ativa sem pagamento (cortesia)
    pagante(14, { fim: "now() - interval '1 day'" }); // vencida
    pagante(15, { bloq: true });                  // bloqueada pelo admin
    pagante(16);                                  // funcionário
    pagante(17, { cel: "1133334444" });           // fixo
    pagante(18, { cel: "+351912345678" });        // estrangeiro
    pagante(19);                                  // falhou NESTA campanha: entra, mas por último
    pagante(20);                                  // recebeu em OUTRA há 10 dias: pausa
    pagante(21);                                  // recebeu em OUTRA há 200 dias: fora da pausa de 120
    pagante(22);                                  // só falhou em OUTRA: entra
    pagante(23);                                  // elegível simples
    pagante(24);                                  // 24 e 25: mesmo telefone; 25 recebeu em OUTRA há 5 dias
    pagante(25, { cel: CEL(24), status: "canceled" });
    pagante(26, { cel: CEL(10) });                // mesmo telefone do 10 (já recebeu nesta campanha)
    pagante(27, { plano: "profissional_ultra_anual", fim: "now() + interval '300 days'" }); // Ultra anual: entra
    pagante(28, { status: "canceled" });          // recebeu NESTA campanha e cancelou...
    pagante(29, { cel: CEL(28) });                // ...e o 29 tem o mesmo telefone: fora desta campanha

    await db.exec(`
      INSERT INTO profiles (user_id, celular, nome) VALUES
        ${perfis.map(([n, c, nm]) => `('${U(n)}', ${c === null ? "NULL" : `'${c}'`}, '${nm}')`).join(",\n        ")};
      INSERT INTO assinaturas (user_id, plano_tipo, status, data_fim, bloqueado_admin, payment_method, payment_provider, data_inicio) VALUES
        ${ass.map(([n, pl, st, fim, bl, pm, pp]) => `('${U(n)}', '${pl}', '${st}', ${fim ?? "NULL"}, ${bl}, '${pm}', '${pp}', now() - interval '40 days')`).join(",\n        ")};
      INSERT INTO assinaturas (user_id, plano_tipo, status) VALUES ('${U(6)}', 'demonstracao', 'active');
      INSERT INTO pagamentos_pix (user_id, status, paid_at, valor_centavos) VALUES
        ${pix.map((n) => `('${U(n)}', 'paid', now() - interval '40 days', 3990)`).join(",\n        ")};
      INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');
      INSERT INTO loja_funcionarios VALUES ('${U(16)}');
      INSERT INTO crm_leads (telefone_e164, primeiro_contato_em, ultimo_contato_em, opt_out, opt_out_em, opt_out_origem)
        VALUES ('${E164(3)}', now(), now(), true, now(), 'admin');
      INSERT INTO crm_leads (telefone_e164, primeiro_contato_em, ultimo_contato_em, opt_out, opt_out_em, opt_out_origem, cadastro_user_id, vinculo_metodo)
        VALUES ('+5521988887777', now(), now(), true, now(), 'n8n', '${U(4)}', 'manual');
      -- lead SEM opt-out ligado ao 1: não pode tirar ninguém
      INSERT INTO crm_leads (telefone_e164, primeiro_contato_em, ultimo_contato_em, cadastro_user_id, vinculo_metodo)
        VALUES ('${E164(1)}', now(), now(), '${U(1)}', 'manual');`);

    const depsAntes = await defs(DEPENDENCIAS);

    // ---------------- conferência, aplicação 2x, verificação ----------------
    const conf = await tudoOk(CONFERIR, "feedback-0-conferir-producao (antes)");
    const funil = conf.find((l) => l.item.startsWith("7."))?.encontrado ?? "";
    ok(/^\d+ → \d+ → \d+ → \d+ → \d+ → \d+$/.test(funil), `conferência informa o funil da lista (${funil})`);
    ok(conf.find((l) => l.item.startsWith("8."))?.encontrado === "1", "conferência: 1 ativo sem pagamento real (cortesia)");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "feedback-1-verificar");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "feedback-1-verificar (depois da 2ª aplicação: idempotente)");
    ok(await defs(DEPENDENCIAS) === depsAntes, "dependências (_crm_pagantes, _crm_profile_elegivel, crm_normalizar_telefone) intactas");
    const conf2 = await q(CONFERIR);
    ok(conf2.filter((l) => !l.ok).map((l) => l.item.split(".")[0]).join(",") === "4,5",
      "conferência depois de aplicar acusa exatamente os itens 4 e 5 (já existem)");

    // Envios antigos (direto na tabela, como postgres)
    await db.exec(`INSERT INTO crm_contato_campanha (campanha, destinatario_user_id, resultado, enviado_em, atualizado_em) VALUES
      ('fb_nov', '${U(10)}', 'enviado', now() - interval '300 days', now() - interval '300 days'),
      ('fb_nov', '${U(19)}', 'falhou',  NULL,                         now() - interval '1 day'),
      ('fb_nov', '${U(28)}', 'enviado', now() - interval '300 days', now() - interval '300 days'),
      ('outra',  '${U(20)}', 'enviado', now() - interval '10 days',  now() - interval '10 days'),
      ('outra',  '${U(21)}', 'enviado', now() - interval '200 days', now() - interval '200 days'),
      ('outra',  '${U(22)}', 'falhou',  NULL,                         now() - interval '2 days'),
      ('outra',  '${U(25)}', 'enviado', now() - interval '5 days',   now() - interval '5 days');`);

    // ---------------- elegibilidade ----------------
    let r = await lista("fb_nov");
    const ESPERADO = ids(1, 2, 8, 21, 22, 23, 27, 19);
    ok(JSON.stringify(r.ids) === JSON.stringify(ESPERADO), `fb_nov: elegíveis 1,2,8,21,22,23,27 e o 19 (falhou) por último (${r.ids.map((x) => +x.slice(-4)).join(",")})`);
    ok(r.total === 8, `total_elegiveis = 8 (${r.total})`);
    ok(r.pausa === 2, `excluidos_por_pausa = 2: o 20 e o telefone do 24/25 (${r.pausa})`);
    const fora = { 3: "opt-out telefone", 4: "opt-out vínculo", 5: "admin", 6: "conta de teste", 7: "sem celular", 9: "telefone repetido",
      10: "já contatado nesta campanha", 11: "plano free", 12: "assinatura inativa", 13: "sem pagamento", 14: "vencida", 15: "bloqueada",
      16: "funcionário", 17: "fixo", 18: "estrangeiro", 20: "pausa", 24: "pausa pelo telefone", 25: "inativa", 26: "telefone já contatado nesta campanha",
      28: "inativa", 29: "telefone já contatado nesta campanha por conta que cancelou" };
    for (const [n, motivo] of Object.entries(fora)) ok(!r.ids.includes(U(+n)), `fora: ${n} (${motivo})`);
    const it1 = r.itens.find((i) => i.user_id === U(1));
    ok(JSON.stringify(Object.keys(it1).sort()) === '["primeira_palavra","telefone","user_id"]', "item só com user_id, primeira_palavra e telefone");
    ok(it1.telefone === E164(1) && it1.primeira_palavra === "MARIA", `telefone normalizado e 1ª palavra crua (${it1.primeira_palavra})`);
    ok(r.itens.find((i) => i.user_id === U(2))?.primeira_palavra === "" && r.itens.find((i) => i.user_id === U(2))?.telefone === E164(2),
      "nome vazio = '' e celular formatado normalizado");
    ok(r.itens.find((i) => i.user_id === U(8))?.primeira_palavra === "joão", "espaços sobrando: 1ª palavra 'joão' (do 8, menor user_id do telefone)");
    ok(new Set(r.itens.map((i) => i.telefone)).size === r.itens.length, "um telefone por pessoa");
    ok(JSON.stringify(await lista("fb_nov")) === JSON.stringify(r), "lote reproduzível (2 chamadas = mesmo resultado)");

    r = await lista("fb_nov", 2);
    ok(JSON.stringify(r.ids) === JSON.stringify(ids(1, 2)) && r.total === 8, "limite 2: os 2 primeiros por user_id; total continua 8");
    r = await lista("fb_nov", 7);
    ok(JSON.stringify(r.ids) === JSON.stringify(ids(1, 2, 8, 21, 22, 23, 27)), "limite 7: quem falhou (19) fica para o próximo lote");

    r = await lista("fb_dez");
    ok(JSON.stringify(r.ids) === JSON.stringify(ids(1, 2, 8, 10, 19, 21, 22, 23, 27, 29)),
      `outra campanha: 10 e 29 (300 dias) voltam, o 19 deixa de ser 'falhou' (${r.ids.map((x) => +x.slice(-4)).join(",")})`);
    ok(r.total === 10 && r.pausa === 2, `fb_dez: total 10, pausa 2 (${r.total}/${r.pausa})`);

    r = await lista("fb_nov", 50, 365);
    ok(!r.ids.includes(U(21)) && r.total === 7 && r.pausa === 3, `pausa 365: o 21 (200 dias) sai; total 7, pausa 3 (${r.total}/${r.pausa})`);
    r = await lista("fb_dez", 50, 365);
    ok(!r.ids.includes(U(10)) && !r.ids.includes(U(21)) && !r.ids.includes(U(29)) && r.pausa === 5, `fb_dez pausa 365: 10, 21 e 29 saem, pausa 5 (${r.pausa})`);
    r = await lista("fb_nov", 50, 30);
    ok(!r.ids.includes(U(20)) && !r.ids.includes(U(24)) && r.ids.includes(U(21)) && r.pausa === 2, "pausa 30: 20 (10 dias) e 24 (5 dias) continuam fora; 21 entra");
    ok(r.ids.includes(U(22)), "'falhou' em outra campanha não bloqueia (22)");

    r = await lista("fb_nov", 50, 120, [U(2), U(3), U(20)]);
    ok(JSON.stringify(r.ids) === JSON.stringify(ids(2)) && r.total === 1 && r.pausa === 1, `user_ids: só as contas pedidas, regras valendo (${r.ids.length}/${r.total}/${r.pausa})`);
    r = await lista("fb_nov", 50, 120, [U(99)]);
    ok(r.ids.length === 0 && r.total === 0 && r.pausa === 0, "user_ids sem ninguém elegível: lista vazia");

    for (const [args, nome] of [[["AB", 15, 120], "campanha curta"], [["Fb_nov", 15, 120], "campanha maiúscula"], [["fb_nov", 0, 120], "limite 0"],
      [["fb_nov", 51, 120], "limite 51"], [["fb_nov", 15, 29], "pausa 29"], [["fb_nov", 15, 366], "pausa 366"], [[null, 15, 120], "campanha nula"]]) {
      ok(/inválid/.test(await erro("SELECT public.crm_pagantes_contato($1, $2, $3)", args)), `recusa ${nome}`);
    }
    ok(/user_ids inválido/.test(await erro("SELECT public.crm_pagantes_contato('fb_nov', 15, 120, $1::uuid[])", [Array.from({ length: 11 }, (_, i) => U(i + 1))])), "recusa 11 user_ids");
    ok(/user_ids inválido/.test(await erro("SELECT public.crm_pagantes_contato('fb_nov', 15, 120, '{}'::uuid[])")), "recusa user_ids vazio");

    // ---------------- candidatos para teste (script) ----------------
    const cand = await q(CANDIDATOS);
    ok(cand.length > 0 && cand.length <= 10, `candidatos: ${cand.length} linhas (≤ 10)`);
    ok(cand.every((c) => JSON.stringify(Object.keys(c)) === '["user_id","dias_assinatura"]'), "candidatos: só user_id e dias_assinatura");
    const fbTeste = await lista("feedback_teste", 10);
    ok(JSON.stringify(cand.map((c) => c.user_id)) === JSON.stringify(fbTeste.ids), "candidatos = a lista da função (mesmas regras)");
    ok(cand.every((c) => c.dias_assinatura === 40), "dias_assinatura = dias desde o 1º pagamento (40)");

    // ---------------- registro ----------------
    await como("service_role");
    let g = await registrar("fb_nov", [{ user_id: U(1), resultado: "enviado" }, { user_id: U(2), resultado: "falhou" }]);
    ok(g.inseridos === 2 && g.atualizados === 0 && g.inalterados === 0 && g.rejeitadas.length === 0, `registro novo: 2 inseridos (${JSON.stringify(g)})`);
    await db.exec("RESET ROLE");
    let l1 = await linha("fb_nov", U(1));
    let l2 = await linha("fb_nov", U(2));
    ok(l1.resultado === "enviado" && l1.enviado_em !== null, "enviado grava enviado_em");
    ok(l2.resultado === "falhou" && l2.enviado_em === null, "falhou deixa enviado_em nulo");

    await db.exec(`UPDATE crm_contato_campanha SET enviado_em = now() - interval '3 days', atualizado_em = now() - interval '3 days'
                    WHERE campanha = 'fb_nov' AND destinatario_user_id = '${U(1)}'`);
    l1 = await linha("fb_nov", U(1));
    await como("service_role");
    g = await registrar("fb_nov", [{ user_id: U(1), resultado: "enviado" }]);
    ok(g.inalterados === 1 && g.inseridos === 0 && g.atualizados === 0, `reenviar 'enviado' = inalterado (${JSON.stringify(g)})`);
    g = await registrar("fb_nov", [{ user_id: U(1), resultado: "falhou" }]);
    ok(g.inalterados === 1, "'falhou' depois de 'enviado' = inalterado");
    await db.exec("RESET ROLE");
    const l1b = await linha("fb_nov", U(1));
    ok(l1b.enviado_em === l1.enviado_em && l1b.resultado === "enviado" && l1b.atualizado_em === l1.atualizado_em,
      "reenviar 'enviado' NÃO muda enviado_em (a pausa não estica) nem o resultado");

    await como("service_role");
    g = await registrar("fb_nov", [{ user_id: U(2), resultado: "enviado" }]);
    ok(g.atualizados === 1 && g.inseridos === 0, "'falhou' -> 'enviado' = atualizado");
    await db.exec("RESET ROLE");
    l2 = await linha("fb_nov", U(2));
    const [{ recente }] = await q(`SELECT enviado_em > now() - interval '1 minute' AS recente FROM crm_contato_campanha WHERE campanha = 'fb_nov' AND destinatario_user_id = '${U(2)}'`);
    ok(l2.resultado === "enviado" && recente === true, "'falhou' -> 'enviado' grava enviado_em = agora");

    await como("service_role");
    g = await registrar("fb_nov", [{ user_id: U(8), resultado: "falhou" }]);
    const g2 = await registrar("fb_nov", [{ user_id: U(8), resultado: "falhou" }]);
    ok(g.inseridos === 1 && g2.atualizados === 1, "'falhou' 2x: inserido e depois atualizado (sem duplicar)");
    await db.exec("RESET ROLE");
    const [{ n: linhas8 }] = await q(`SELECT count(*)::int n FROM crm_contato_campanha WHERE destinatario_user_id = '${U(8)}'`);
    ok(linhas8 === 1 && (await linha("fb_nov", U(8))).enviado_em === null, "1 linha só por (campanha, pessoa); falhou continua sem enviado_em");

    await como("service_role");
    g = await registrar("fb_nov", ["texto", { user_id: "abc", resultado: "enviado" }, { user_id: U(23), resultado: "lido" },
      { user_id: U(999), resultado: "enviado" }, { user_id: U(23), resultado: "enviado" }, { user_id: U(23), resultado: "falhou" },
      { user_id: U(27) }, { user_id: 27, resultado: "enviado" }]);
    ok(g.rejeitadas.map((x) => `${x.indice}:${x.erro}`).join(" ") === "0:nao_objeto 1:user_id_invalido 2:resultado_invalido "
      + "3:usuario_inexistente 5:duplicado_no_lote 6:resultado_invalido 7:user_id_invalido" && g.inseridos === 1, `rejeições por item; o bom grava (${JSON.stringify(g)})`);
    ok(/Lote grande/.test(await erro("SELECT public.crm_contato_registrar('fb_nov', $1::jsonb)",
      [JSON.stringify(Array.from({ length: 101 }, (_, i) => ({ user_id: U(i + 1), resultado: "enviado" })))])), "recusa lote de 101");
    ok(/campanha inválida/.test(await erro("SELECT public.crm_contato_registrar('A B', '[]'::jsonb)")), "registro recusa campanha inválida");
    ok(/Lote inválido/.test(await erro("SELECT public.crm_contato_registrar('fb_nov', '{}'::jsonb)")), "registro recusa lote que não é lista");
    await db.exec("RESET ROLE");
    ok(/crm_contato_campanha_enviado_em|check/i.test(await erro(`INSERT INTO crm_contato_campanha (campanha, destinatario_user_id, resultado) VALUES ('fb_nov', '${U(30)}', 'enviado')`)),
      "tabela recusa 'enviado' sem enviado_em");

    // ---------------- lista depois dos registros ----------------
    r = await lista("fb_nov");
    ok(JSON.stringify(r.ids) === JSON.stringify(ids(21, 22, 27, 8, 19)), `fb_nov depois: 1, 2 e 23 receberam; 8 e 19 (falharam) por último (${r.ids.map((x) => +x.slice(-4)).join(",")})`);
    ok(r.total === 5 && r.pausa === 2, `fb_nov depois: total 5, pausa 2 (quem já recebeu NESTA não conta como pausa) (${r.total}/${r.pausa})`);
    r = await lista("fb_dez");
    ok(!r.ids.includes(U(1)) && !r.ids.includes(U(2)) && !r.ids.includes(U(23)) && r.ids.includes(U(8)) && r.pausa === 5,
      `outra campanha: quem recebeu agora entra na pausa (1, 2, 23); quem falhou (8) não; pausa 5 (${r.pausa})`);
    await db.exec(`UPDATE crm_contato_campanha SET enviado_em = now() - interval '130 days' WHERE campanha = 'fb_nov' AND destinatario_user_id = '${U(1)}'`);
    r = await lista("fb_dez");
    ok(r.ids.includes(U(1)) && r.pausa === 4, "passou a pausa (130 dias): volta a entrar em outra campanha");
    ok(!(await lista("fb_nov")).ids.includes(U(1)), "…mas continua fora da campanha em que já recebeu");

    // ---------------- quem recebeu (script) ----------------
    const qr = await q(QUEM_RECEBEU);
    const COLS = '["campanha","recebidos","so_falhou","primeiro_envio","ultimo_envio","ja_liberadas","liberam_por_mes"]';
    ok(qr.length === 3 && qr.every((x) => JSON.stringify(Object.keys(x)) === COLS), `quem-recebeu: 3 linhas (fb_nov, outra, (todas)) e só as colunas de contagem/data`);
    ok(!JSON.stringify(qr).includes("0000-0000") && !JSON.stringify(qr).includes("+55"), "quem-recebeu: nenhum id ou telefone");
    const outra = qr.find((x) => x.campanha === "outra");
    const mesesOutra = (outra?.liberam_por_mes ?? "").split(" · ");
    const somaMeses = mesesOutra.slice(0, 6).reduce((a, x) => a + Number(x.split(": ")[1]), 0);
    ok(Number(outra?.recebidos) === 3 && Number(outra?.so_falhou) === 1 && Number(outra?.ja_liberadas) === 1 && somaMeses === 2
       && mesesOutra.length === 7 && mesesOutra[6] === "depois: 0",
      `outra: 3 receberam, 1 só falhou, 1 já liberada (21), 2 liberam nos próximos 6 meses (${JSON.stringify(outra)})`);
    const todas = qr.find((x) => x.campanha === "(todas)");
    ok(qr.at(-1)?.campanha === "(todas)" && Number(todas?.recebidos) === 8 && Number(todas?.so_falhou) === 3,
      `(todas): 8 pessoas receberam (10,28,1,2,23,20,21,25), 3 só falharam (19,8,22) (${JSON.stringify(todas)})`);

    // ---------------- privilégios ----------------
    for (const [papel, uid] of [["anon", null], ["authenticated", U(1)], ["authenticated", ADMIN]]) {
      await como(papel, uid);
      ok(/permission denied/.test(await erro("SELECT public.crm_pagantes_contato('fb_nov', 15, 120)")), `${papel}${uid === ADMIN ? " (admin)" : ""} não lista pagantes`);
      ok(/permission denied/.test(await erro(`SELECT public.crm_contato_registrar('fb_nov', '[{"user_id":"${U(23)}","resultado":"enviado"}]'::jsonb)`)), `${papel}${uid === ADMIN ? " (admin)" : ""} não registra`);
      ok(/permission denied/.test(await erro("SELECT * FROM public.crm_contato_campanha")), `${papel}${uid === ADMIN ? " (admin)" : ""} não lê a tabela`);
      ok(/permission denied/.test(await erro(`INSERT INTO public.crm_contato_campanha (campanha, destinatario_user_id, resultado) VALUES ('fb_nov', '${U(23)}', 'falhou')`)), `${papel} não grava na tabela`);
    }
    await como("service_role");
    ok((await erro("SELECT public.crm_pagantes_contato('fb_nov', 15, 120)")) === "", "service_role lista");
    await db.exec("RESET ROLE");

    // ---------------- "Começar do zero" não enxerga a tabela ----------------
    const [{ n: colsDono }] = await q(`SELECT count(*)::int n FROM pg_attribute WHERE attrelid = 'public.crm_contato_campanha'::regclass
      AND NOT attisdropped AND attname IN ('user_id', 'loja_user_id', 'proprietario_id')`);
    ok(colsDono === 0, "tabela sem coluna de dono (user_id/loja_user_id/proprietario_id)");

    // ---------------- rollback ----------------
    await db.exec(s.rollback);
    const [{ t, f1, f2 }] = await q(`SELECT to_regclass('public.crm_contato_campanha') t,
      to_regprocedure('public.crm_pagantes_contato(text, integer, integer, uuid[])') f1, to_regprocedure('public.crm_contato_registrar(text, jsonb)') f2`);
    ok(t === null && f1 === null && f2 === null, "rollback apaga a tabela e as 2 funções");
    ok(await defs(DEPENDENCIAS) === depsAntes, "rollback não mexe nas dependências");
    await tudoOk(CONFERIR, "feedback-0-conferir-producao (depois do rollback: volta ao estado inicial)");
    await db.exec(s.mig);
    const re = await lista("fb_nov");
    ok(re.total === 12 && re.pausa === 0, `reaplicar depois do rollback funciona, sem registro: todos voltam (${re.total}/${re.pausa})`);
  } catch (e) {
    ok(false, `exceção: ${e.message}`);
  } finally {
    await db.close();
  }
  return falhas;
}

// ---------------------------------------------------------------------------
// Verificações estáticas
// ---------------------------------------------------------------------------
function estaticas() {
  const falhas = [];
  const ok = (c, m) => { console.log(`${c ? "OK   " : "FALHA"} ${m}`); if (!c) falhas.push(m); };
  const sc = ORIG.mig.replace(/--.*$/gm, "");
  ok(/^\s*BEGIN;/m.test(sc) && /COMMIT;\s*$/.test(sc), "migration em BEGIN/COMMIT");
  ok(/SET LOCAL lock_timeout = '3s';/.test(ORIG.mig) && /SET LOCAL statement_timeout = '60s';/.test(ORIG.mig), "lock_timeout 3s e statement_timeout 60s");
  const criadas = [...sc.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
  ok(JSON.stringify(criadas) === JSON.stringify(NOVAS), `só cria as 2 funções novas (${criadas.join(", ")})`);
  ok([...sc.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map((m) => m[1]).join() === "crm_contato_campanha", "só cria a tabela nova");
  ok(!/ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?public\.(?!crm_contato_campanha\b)/i.test(sc) && !/\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sc),
    "não altera outra tabela; nenhum DROP/TRUNCATE/DELETE");
  ok(!/\bUPDATE\s+public\.(?!crm_contato_campanha)/i.test(sc) && !/INSERT INTO public\.(?!crm_contato_campanha)/i.test(sc), "só grava na tabela nova");
  ok(!/_zerar_catalogo|admin_mkt_|crm_ingerir|crm_registrar_opt_out\(|garantia|caixa|recibo/i.test(sc), "não toca _zerar_catalogo, ingestão, opt-out, garantias, caixa ou recibos");
  ok(!/^\s+user_id\s/m.test(sc.slice(sc.indexOf("CREATE TABLE"), sc.indexOf(");", sc.indexOf("CREATE TABLE")))), "coluna da tabela não se chama user_id");
  ok(!/\bemail\b/i.test(sc), "migration não lê e-mail");
  ok(ORIG.rollback.includes("NÃO RODE — SÓ EM EMERGÊNCIA") && /DROP TABLE IF EXISTS public\.crm_contato_campanha;/.test(ORIG.rollback)
     && NOVAS.every((n) => ORIG.rollback.includes(`DROP FUNCTION IF EXISTS public.${n}(`)), "rollback marcado NÃO RODE; apaga tabela e as 2 funções");
  ok(!/CREATE OR REPLACE|ALTER TABLE/i.test(ORIG.rollback.replace(/--.*$/gm, "")), "rollback não recria nem altera nada");
  ok(!/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i.test((CONFERIR + VERIFICAR + CANDIDATOS + QUEM_RECEBEU).replace(/--.*$/gm, "").replace(/'[^']*'/g, "")),
    "conferência, verificação, candidatos e quem-recebeu são só leitura");
  ok(!/\b(nome|email|celular|telefone)\b/i.test(CANDIDATOS.replace(/--.*$/gm, "")) && !/\b(nome|email|celular|telefone)\b/i.test(QUEM_RECEBEU.replace(/--.*$/gm, "")),
    "candidatos e quem-recebeu não citam nome, e-mail, celular nem telefone");
  ok(!/MD5_/.test(VERIFICAR), "feedback-1-verificar com os md5 preenchidos");
  return falhas;
}

// ---------------------------------------------------------------------------
// Mutantes: cada um TEM que derrubar a suíte (rodam sem a verificação por md5).
// ---------------------------------------------------------------------------
const MUTANTES = [
  { nome: "opt-out pelo telefone ignorado", de: "(EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.opt_out AND l.telefone_e164 = cel.tel)\n             OR ", para: "(" },
  { nome: "opt-out pelo vínculo ignorado", de: "\n             OR EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.opt_out AND l.cadastro_user_id = cel.uid)", para: "" },
  { nome: "opt-out sem olhar o opt_out (qualquer lead tira)", de: "WHERE l.opt_out AND l.cadastro_user_id = cel.uid", para: "WHERE l.cadastro_user_id = cel.uid" },
  { nome: "admin / conta de teste / funcionário entram", de: "     WHERE public._crm_profile_elegivel(pf.user_id)\n", para: "" },
  { nome: "telefone fixo entra (qualquer +55)", de: "WHERE tel ~ '^\\+55[1-9]{2}9[0-9]{8}$'", para: "WHERE tel ~ '^\\+55'" },
  { nome: "sem celular entra", de: "WHERE tel ~ '^\\+55[1-9]{2}9[0-9]{8}$'", para: "WHERE tel IS NULL OR tel ~ '^\\+55[1-9]{2}9[0-9]{8}$'" },
  { nome: "sem dedupe por telefone", de: "     GROUP BY a.tel\n", para: "     GROUP BY a.tel, a.uid\n" },
  { nome: "dedupe pega o maior user_id", de: "(array_agg(a.uid ORDER BY a.uid))[1] AS uid", para: "(array_agg(a.uid ORDER BY a.uid DESC))[1] AS uid" },
  { nome: "já contatado nesta campanha entra", de: "SELECT * FROM grupos g WHERE NOT g.optout AND NOT g.ja_nesta AND NOT g.em_pausa", para: "SELECT * FROM grupos g WHERE NOT g.optout AND NOT g.em_pausa" },
  { nome: "'já nesta campanha' só pela conta (não pelo telefone)", de: "WHERE k.campanha = p_campanha AND k.resultado = 'enviado'\n                      AND (k.uid = cel.uid OR k.tel = cel.tel)", para: "WHERE k.campanha = p_campanha AND k.resultado = 'enviado'\n                      AND k.uid = cel.uid" },
  { nome: "'falhou' nesta campanha bloqueia", de: "WHERE k.campanha = p_campanha AND k.resultado = 'enviado'\n", para: "WHERE k.campanha = p_campanha AND k.resultado IN ('enviado', 'falhou')\n" },
  { nome: "plano free entra (sem a lista de planos pagos)", de: "      JOIN precos pr ON pr.plano_tipo = a.plano_tipo::text\n     WHERE a.status::text = 'active'", para: "     WHERE a.status::text = 'active'" },
  { nome: "Ultra fora da lista de planos", de: "('profissional_mensal'), ('profissional_ultra_mensal'),\n           ('basico_anual'), ('intermediario_anual'), ('profissional_anual'), ('profissional_ultra_anual')\n  ),\n  ativos",
    para: "('profissional_mensal'),\n           ('basico_anual'), ('intermediario_anual'), ('profissional_anual')\n  ),\n  ativos" },
  { nome: "assinatura inativa entra", de: "     WHERE a.status::text = 'active'\n       AND (a.data_fim", para: "     WHERE true\n       AND (a.data_fim" },
  { nome: "assinatura vencida entra", de: "       AND (a.data_fim IS NULL OR a.data_fim > now())\n       AND (p_user_ids", para: "       AND (p_user_ids" },
  { nome: "sem exigir pagamento real", de: "SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT uid FROM ativos)) p", para: "SELECT uid FROM ativos" },
  { nome: "pausa ignorada", de: "SELECT * FROM grupos g WHERE NOT g.optout AND NOT g.ja_nesta AND NOT g.em_pausa", para: "SELECT * FROM grupos g WHERE NOT g.optout AND NOT g.ja_nesta" },
  { nome: "pausa só na mesma campanha", de: "WHERE k.resultado = 'enviado' AND k.enviado_em > now()", para: "WHERE k.campanha = p_campanha AND k.resultado = 'enviado' AND k.enviado_em > now()" },
  { nome: "'falhou' conta para a pausa", de: "WHERE k.resultado = 'enviado' AND k.enviado_em > now() - make_interval(days => p_pausa_dias)", para: "WHERE (k.resultado = 'falhou' OR k.enviado_em > now() - make_interval(days => p_pausa_dias))" },
  { nome: "pausa sem prazo (qualquer envio bloqueia para sempre)", de: "AND k.enviado_em > now() - make_interval(days => p_pausa_dias)", para: "" },
  { nome: "pausa com prazo fixo de 120 (ignora pausa_dias)", de: "AND k.enviado_em > now() - make_interval(days => p_pausa_dias)", para: "AND k.enviado_em > now() - interval '120 days'" },
  { nome: "pausa só pela conta (não pelo telefone)", de: "AND k.enviado_em > now() - make_interval(days => p_pausa_dias)\n                      AND (k.uid = cel.uid OR k.tel = cel.tel)", para: "AND k.enviado_em > now() - make_interval(days => p_pausa_dias)\n                      AND k.uid = cel.uid" },
  { nome: "excluidos_por_pausa conta quem já recebeu nesta", de: "(SELECT count(*) FROM grupos g WHERE NOT g.optout AND NOT g.ja_nesta AND g.em_pausa)", para: "(SELECT count(*) FROM grupos g WHERE NOT g.optout AND g.em_pausa)" },
  { nome: "total_elegiveis = tamanho do lote", de: "'total_elegiveis', (SELECT count(*) FROM elegiveis)", para: "'total_elegiveis', (SELECT count(*) FROM lote)" },
  { nome: "quem falhou não vai para o fim", de: "     ORDER BY e.falhou_antes, e.uid\n", para: "     ORDER BY e.uid\n" },
  { nome: "sem limite", de: "     LIMIT p_limite\n", para: "" },
  { nome: "filtro user_ids ignorado", de: "       AND (p_user_ids IS NULL OR a.user_id = ANY (p_user_ids))\n", para: "" },
  { nome: "limite aceita 0", de: "IF p_limite IS NULL OR p_limite < 1 OR p_limite > 50 THEN", para: "IF p_limite IS NULL OR p_limite < 0 OR p_limite > 50 THEN" },
  { nome: "pausa aceita menos de 30", de: "IF p_pausa_dias IS NULL OR p_pausa_dias < 30", para: "IF p_pausa_dias IS NULL OR p_pausa_dias < 1" },
  { nome: "reenviar 'enviado' muda enviado_em", de: "      WHERE c.resultado = 'falhou'\n    RETURNING", para: "    RETURNING" },
  { nome: "'falhou' -> 'enviado' não grava enviado_em (CHECK estoura)", de: "          enviado_em    = EXCLUDED.enviado_em,", para: "          enviado_em    = c.enviado_em," },
  { nome: "registro sem upsert (duplicata vira erro)", de: /ON CONFLICT \(campanha, destinatario_user_id\) DO UPDATE[\s\S]*?WHERE c\.resultado = 'falhou'\n/, para: "" },
  { nome: "atualizado contado como inserido", de: "    ELSIF v_inserido THEN", para: "    ELSIF true THEN" },
  { nome: "registro sem checar duplicado no lote", de: "IF v_uid = ANY (v_vistos) THEN", para: "IF false THEN" },
  { nome: "registro aceita usuário inexistente", de: "ELSIF NOT EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.user_id = v_uid) THEN", para: "ELSIF false THEN" },
  { nome: "registro sem limite de lote", de: "IF jsonb_array_length(p_itens) > 100 THEN", para: "IF false THEN" },
  { nome: "registro sem REVOKE de authenticated", de: "REVOKE ALL ON FUNCTION public.crm_contato_registrar(text, jsonb)                   FROM PUBLIC, anon, authenticated;", para: "REVOKE ALL ON FUNCTION public.crm_contato_registrar(text, jsonb)                   FROM anon;" },
  { nome: "lista sem REVOKE", de: "REVOKE ALL ON FUNCTION public.crm_pagantes_contato(text, integer, integer, uuid[]) FROM PUBLIC, anon, authenticated;", para: "" },
  { nome: "tabela sem REVOKE (privilégios padrão do Supabase)", de: "REVOKE ALL ON public.crm_contato_campanha FROM PUBLIC, anon, authenticated;", para: "" },
  { nome: "tabela sem RLS e com acesso", de: "REVOKE ALL ON public.crm_contato_campanha FROM PUBLIC, anon, authenticated;\nGRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contato_campanha TO service_role;\nALTER TABLE public.crm_contato_campanha ENABLE ROW LEVEL SECURITY;", para: "GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contato_campanha TO service_role;" },
  { nome: "rollback sem apagar a tabela", alvo: "rollback", de: "DROP TABLE IF EXISTS public.crm_contato_campanha;", para: "" },
  { nome: "rollback sem apagar a lista", alvo: "rollback", de: "DROP FUNCTION IF EXISTS public.crm_pagantes_contato(text, integer, integer, uuid[]);", para: "" },
];

function aplicarMutante(m) {
  const s = { ...ORIG };
  const alvo = m.alvo ?? "mig";
  const antes = s[alvo];
  s[alvo] = antes.replace(m.de, () => m.para);
  if (s[alvo] === antes) throw new Error(`mutante "${m.nome}" não achou o trecho`);
  return s;
}

if (process.argv.includes("--hashes")) {
  const db = new PGlite();
  await db.exec(BASE); await db.exec(COLUNAS_TESTE); await db.exec(META_ADS);
  for (const sql of ANTERIORES) await db.exec(sql);
  await db.exec(ORIG.mig);
  console.log((await db.query(`SELECT string_agg(md5(regexp_replace(prosrc, '\\s+', ' ', 'g')), ' / ' ORDER BY proname) h FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = ANY($1)`, [NOVAS])).rows[0].h);
  await db.close();
  process.exit(0);
}
const falhasEst = estaticas();
console.log("\n--- suíte ---");
const falhas = await suite(ORIG);
let falhasMut = 0;
if (process.argv.includes("--mutantes")) {
  console.log("\n--- mutantes (cada um precisa ser MORTO; sem a verificação por md5) ---");
  const base = await suite(ORIG, { silencioso: true, comVerificacao: false });
  console.log(base.length === 0 ? "OK    suíte sem a verificação passa sem mutação" : `FALHA suíte sem a verificação: ${base.join(" | ")}`);
  if (base.length) falhasMut++;
  for (const m of MUTANTES) {
    const f = await suite(aplicarMutante(m), { silencioso: true, comVerificacao: false });
    const morto = f.length > 0;
    if (!morto) falhasMut++;
    console.log(`${morto ? "MORTO" : "VIVO!"} ${m.nome}${morto ? ` — ${f.length} verificação(ões):` : ""}`);
    for (const x of f.slice(0, 2)) console.log(`        · ${x.slice(0, 120)}`);
  }
  console.log(`(${MUTANTES.length} mutantes)`);
}
const total = falhasEst.length + falhas.length + falhasMut;
console.log(total === 0 ? "\nTUDO OK" : `\n${total} FALHA(S)`);
process.exit(total ? 1 : 0);
