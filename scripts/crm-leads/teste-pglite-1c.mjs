// CRM de leads — FASE 1C (direção do 1º contato) — prova num Postgres 17
// LOCAL (PGlite, WebAssembly). Não toca produção. Dados 100% fictícios.
//
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-1c.mjs              # suíte
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-1c.mjs --mutantes   # + mutantes
//
// Carrega as migrations REAIS da fase 1 (SQL 1, 2 e 3, como estão em
// produção), grava dados com a ingestão ANTIGA, roda a conferência 1C, aplica
// a 1C duas vezes e cobre: backfill (entrada, saída, 1ª cortada, sem
// mensagem), ingestão nova (lead novo, mensagem mais antiga fora de ordem que
// inverte a direção, duplicada, inválida), funil antes/depois, funil por
// anúncio, função aditiva, privilégios (anon / authenticated / PUBLIC com os
// privilégios padrão do Supabase), assinaturas iguais, texto das funções =
// original + linhas "-- 1C", e rollback (volta exatamente às versões da fase 1).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const FASE1 = [
  ler("supabase/migrations/20261121120000_crm_leads_1_estrutura.sql"),
  ler("supabase/migrations/20261121120010_crm_leads_2_gravacao.sql"),
  ler("supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql"),
];
const ORIG = {
  mig: ler("supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql"),
  rollback: ler("scripts/crm-leads/rollback-1c-direcao.sql"),
};
const META_ADS = ler("supabase/migrations/20261024130000_meta_ads_cache.sql");
const CONFERIR = ler("scripts/crm-leads/1c-0-conferir-producao.sql");
const VERIFICAR = ler("scripts/crm-leads/1c-1-verificar.sql");

// Mesma réplica mínima do teste da fase 1 (teste-pglite.mjs), lida de lá.
const t1 = ler("scripts/crm-leads/teste-pglite.mjs");
const BASE = t1.slice(t1.indexOf("const BASE = `") + 14, t1.indexOf("`;", t1.indexOf("const BASE = `")));
// Privilégio padrão do Supabase: função nova em public nasce executável por
// anon e authenticated. Sem o REVOKE explícito, anon executaria.
const PADRAO_SUPABASE = "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;";

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(900), COMUM = U(901);
const FUNCS = ["crm_ingerir_mensagens", "admin_crm_funil", "admin_crm_funil_por_anuncio"];
const tirar1C = (s) => s.split("\n").filter((l) => !l.includes("-- 1C")).join("\n");

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
  const iso = (minAtras) => new Date(Date.now() - minAtras * 60_000).toISOString();
  const ingerir = async (itens) => (await q("SELECT public.crm_ingerir_mensagens($1::jsonb) AS r", [JSON.stringify(itens)]))[0].r;
  const msg = (tel, id, direcao, minAtras, extra = {}) => ({
    telefone: tel, wa_message_id: id, direcao, autor: direcao === "entrada" ? "lead" : "automacao",
    tipo: "texto", texto: direcao === "entrada" ? "oi" : "Boas-vindas (ficticio)", enviada_em: iso(minAtras), ...extra,
  });
  const direcoes = async () => Object.fromEntries((await q(
    "SELECT right(telefone_e164, 4) AS t, primeiro_contato_direcao AS d FROM crm_leads ORDER BY 1")).map((x) => [x.t, x.d]));
  const defs = async () => Object.fromEntries((await q(`
    SELECT p.proname, p.prosrc, pg_get_function_arguments(p.oid) a, pg_get_function_result(p.oid) r,
           p.prosecdef, p.provolatile, p.proretset, p.proconfig
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1)`, [FUNCS])).map((x) => [x.proname, x]));
  const funil = async (ini = 7) => {
    const [f] = await q(`SELECT * FROM admin_crm_funil(current_date - ${ini}, current_date)`);
    return Object.fromEntries(Object.entries(f).map(([k, x]) => [k, Number(x)]));
  };

  try {
    await db.exec(BASE);
    await db.exec(PADRAO_SUPABASE);
    await db.exec(META_ADS);
    for (const sql of FASE1) await db.exec(sql);
    const antes = await defs();

    // ---------------- dados gravados com a ingestão ANTIGA (fase 1) ----------------
    await db.exec(`
      INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');
      INSERT INTO profiles (user_id, celular, created_at) VALUES
        ('${U(2)}', '11 99000-0002', now() - interval '65 minutes'),   -- cadastro minutos antes das boas-vindas
        ('${U(1)}', '11 99000-0001', now() - interval '10 minutes');   -- escreveu primeiro e cadastrou
      INSERT INTO assinaturas (user_id, plano_tipo, trial_started_at) VALUES ('${U(2)}', 'trial', now()), ('${U(1)}', 'trial', now());
    `);
    await como("service_role");
    // 0001: escreveu primeiro (anúncio A), loja respondeu
    // 0002: boas-vindas automáticas primeiro (sem anúncio), ligado a cadastro, depois respondeu
    // 0003: só boas-vindas, sem cadastro
    // 0005: escreveu primeiro, sem anúncio (orgânico)
    // 0006: 35 mensagens; a 1ª (entrada) é cortada pelo limite de 30, a mais antiga que sobra é da loja
    await ingerir([
      msg("5511990000001", "a1", "entrada", 120, { referral: { ad_id: "120000000000001", titulo: "Anúncio A (ficticio)" } }),
      msg("5511990000001", "a2", "saida", 119),
      msg("5511990000002", "b1", "saida", 60),
      msg("5511990000002", "b2", "entrada", 50),
      msg("5511990000003", "c1", "saida", 40),
      msg("5511990000005", "e1", "entrada", 30),
    ]);
    await ingerir([msg("5511990000006", "f0", "entrada", 300),
      ...Array.from({ length: 34 }, (_, i) => msg("5511990000006", `f${i + 1}`, i % 2 ? "entrada" : "saida", 299 - i))]);
    // 0004: opt-out registrado por fora: lead sem nenhuma mensagem
    await q("SELECT public.crm_registrar_opt_out('11 99000-0004', 'n8n')");
    await q(`SELECT public.crm_vincular_usuario('11 99000-0002', '${U(2)}'), public.crm_vincular_usuario('11 99000-0001', '${U(1)}')`);

    await como("authenticated", ADMIN);
    const funilAntigo = await funil();
    ok(funilAntigo.conversas === 6 && funilAntigo.cadastros === 2,
       `antes da 1C o funil conta todo mundo, inclusive quem a loja chamou primeiro (${funilAntigo.conversas} conversas, ${funilAntigo.cadastros} cadastros)`);

    // ---------------- conferência, aplicação 2x, verificação ----------------
    await db.exec("RESET ROLE");
    const conf = await tudoOk(CONFERIR, "1c-0-conferir-producao (antes)");
    const info9 = conf.find((l) => l.item.startsWith("9."))?.encontrado ?? "";
    ok(info9 === "cliente escreveu primeiro 2 · loja chamou primeiro 2 · 1ª mensagem já cortada (vira desconhecida) 1 · sem mensagem (vira desconhecida) 1",
       `conferência informa a classificação do backfill (${info9})`);
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "1c-1-verificar");
    let d = await direcoes();
    ok(d["0001"] === "entrada" && d["0005"] === "entrada", "backfill: quem escreveu primeiro = entrada");
    ok(d["0002"] === "saida" && d["0003"] === "saida", "backfill: boas-vindas da loja primeiro = saida");
    ok(d["0006"] === null, "backfill: 1ª mensagem cortada = NULL (não adivinha pela mais antiga que sobrou)");
    ok(d["0004"] === null, "backfill: lead sem mensagem = NULL");
    const [{ at: atualizadoAntes }] = await q("SELECT max(atualizado_em)::text at FROM crm_leads");

    await db.exec(s.mig);
    ok(JSON.stringify(await direcoes()) === JSON.stringify(d), "aplicar a 1C de novo não muda nada (idempotente)");
    if (comVerificacao) await tudoOk(VERIFICAR, "1c-1-verificar (depois da 2ª aplicação)");
    ok((await q("SELECT max(atualizado_em)::text at FROM crm_leads"))[0].at === atualizadoAntes, "backfill não mexe em atualizado_em");

    // ---------------- assinaturas e texto das funções ----------------
    const depois = await defs();
    for (const n of FUNCS) {
      const a = antes[n], b = depois[n];
      ok(a.a === b.a && a.r === b.r && a.prosecdef === b.prosecdef && a.provolatile === b.provolatile
         && a.proretset === b.proretset && JSON.stringify(a.proconfig) === JSON.stringify(b.proconfig),
         `${n}: parâmetros, retorno, volatilidade, SECURITY DEFINER e search_path iguais (${b.a} -> ${b.r.slice(0, 60)}...)`);
      ok(tirar1C(b.prosrc) === a.prosrc && b.prosrc !== a.prosrc, `${n}: texto = versão da fase 1 + só linhas "-- 1C"`);
    }

    // ---------------- ingestão nova ----------------
    await como("service_role");
    await ingerir([msg("5511990000011", "h1", "entrada", 20), msg("5511990000012", "i1", "saida", 20)]);
    d = await direcoes();
    ok(d["0011"] === "entrada" && d["0012"] === "saida", "lead novo grava a direção da 1ª mensagem (entrada e saída)");
    // 0013: loja às -10; chega (fora de ordem) uma do cliente às -20 → entrada; depois uma da loja às -30 → saida;
    //       uma nova do cliente às -5 não muda nada
    await ingerir([msg("5511990000013", "j1", "saida", 10)]);
    await ingerir([msg("5511990000013", "j2", "entrada", 20)]);
    ok((await direcoes())["0013"] === "entrada", "mensagem mais antiga fora de ordem inverte saida → entrada");
    await ingerir([msg("5511990000013", "j3", "saida", 30)]);
    ok((await direcoes())["0013"] === "saida", "outra ainda mais antiga inverte entrada → saida");
    await ingerir([msg("5511990000013", "j4", "entrada", 5)]);
    ok((await direcoes())["0013"] === "saida", "mensagem mais nova não muda a direção");
    const r = await ingerir([msg("5511990000013", "j3", "entrada", 40)]);
    ok(r.duplicadas === 1 && (await direcoes())["0013"] === "saida", "duplicada (mesmo id) não mexe na direção");
    // backfill antigo: 0002 (saida) recebe uma do cliente mais antiga → entrada
    await ingerir([msg("5511990000002", "b0", "entrada", 70)]);
    ok((await direcoes())["0002"] === "entrada", "lead do backfill também inverte com mensagem mais antiga");
    // desconhecido (0006) com mensagem nova: continua desconhecido
    await ingerir([msg("5511990000006", "f99", "entrada", 1)]);
    ok((await direcoes())["0006"] === null, "desconhecido + mensagem mais nova continua desconhecido");
    const rj = await ingerir([{ ...msg("5511990000014", "k1", "entrada", 3), direcao: "lateral" }]);
    ok(rj.inseridas === 0 && JSON.stringify(rj.rejeitadas) === JSON.stringify([{ erro: "campo_invalido", indice: 0 }])
       && (await q("SELECT count(*)::int c FROM crm_leads WHERE telefone_e164 = '+5511990000014'"))[0].c === 0,
       "direção inválida: rejeitada e o lead não é criado (igual à fase 1)");
    ok(/primeiro_contato_direcao_check/.test(await erro("UPDATE crm_leads SET primeiro_contato_direcao = 'x' WHERE telefone_e164 = '+5511990000011'")),
       "CHECK recusa direção fora de entrada/saida");
    // volta 0002 para o estado do backfill (saida) para conferir o funil com os casos pedidos
    await db.exec("RESET ROLE; UPDATE crm_leads SET primeiro_contato_direcao = 'saida' WHERE telefone_e164 = '+5511990000002';");
    // reaplicar a migration agora (0002 tem direção gravada diferente da 1ª mensagem guardada): o backfill não mexe
    await db.exec(s.mig);
    ok((await direcoes())["0002"] === "saida", "reaplicar a 1C nunca sobrescreve uma direção já gravada");

    // ---------------- funil com a coorte nova ----------------
    // Período: entrada = 0001, 0005, 0011  |  saida = 0002 (cadastro), 0003, 0012, 0013  |  NULL = 0004, 0006
    await como("authenticated", ADMIN);
    const f = await funil();
    ok(f.conversas === 3 && f.conversas_anuncio === 1 && f.cadastros === 1 && f.testes === 1 && f.ja_clientes === 0,
       `funil só com quem escreveu primeiro: 3 conversas, 1 de anúncio, 1 cadastro (${JSON.stringify(f)})`);
    ok(f.opt_outs === 0, "opt-out do lead sem mensagem (desconhecido) fica fora do funil");
    const [ex] = await q("SELECT * FROM admin_crm_funil_excluidos(current_date - 7, current_date)");
    const exn = Object.fromEntries(Object.entries(ex).map(([k, x]) => [k, Number(x)]));
    ok(JSON.stringify(exn) === JSON.stringify({ loja_chamou_primeiro: 4, loja_chamou_primeiro_com_cadastro: 1, direcao_desconhecida: 2 }),
       `fora do funil: 4 a loja chamou primeiro (1 com cadastro), 2 desconhecidos (${JSON.stringify(exn)})`);
    const [{ c: total }] = await q(`SELECT count(*)::int c FROM crm_leads WHERE primeiro_contato_em >= (current_date - 7)::timestamp AT TIME ZONE 'America/Sao_Paulo'`);
    ok(f.conversas + exn.loja_chamou_primeiro + exn.direcao_desconhecida === total, `funil + fora do funil = todos os leads do período (${total})`);
    const [vazio] = await q("SELECT * FROM admin_crm_funil_excluidos(current_date - 400, current_date - 300)");
    ok(Object.values(vazio).every((x) => Number(x) === 0), "período sem leads: zeros (1 linha)");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_excluidos(current_date, current_date - 1)")), "função nova recusa período invertido");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_excluidos(current_date - 401, current_date)")), "função nova recusa mais de 400 dias");

    const porAd = await q("SELECT * FROM admin_crm_funil_por_anuncio(current_date - 7, current_date)");
    const resumo = porAd.map((x) => `${x.ad_id || "sem"}:${x.conversas}/${x.cadastros}`).join(" ");
    ok(porAd.length === 2 && resumo === "sem:2/0 120000000000001:1/1", `funil por anúncio só com quem escreveu primeiro (${resumo})`);

    // ---------------- privilégios ----------------
    await como("authenticated", COMUM);
    ok(/Apenas administradores/.test(await erro("SELECT * FROM admin_crm_funil_excluidos(current_date - 7, current_date)")), "função nova recusa authenticated não-admin");
    ok(/Apenas administradores/.test(await erro("SELECT * FROM admin_crm_funil(current_date - 7, current_date)")), "funil continua recusando não-admin");
    ok(/permission denied/.test(await erro("SELECT public.crm_ingerir_mensagens('[]'::jsonb)")), "authenticated continua sem executar a ingestão");
    ok((await q("SELECT count(*)::int c FROM crm_leads"))[0].c === 0, "não-admin continua lendo 0 leads (RLS)");
    await como("anon");
    for (const fn of ["admin_crm_funil_excluidos", "admin_crm_funil", "admin_crm_funil_por_anuncio"]) {
      ok(/permission denied/.test(await erro(`SELECT * FROM ${fn}(current_date - 7, current_date)`)), `anon não executa ${fn}`);
    }
    ok(/permission denied/.test(await erro("SELECT primeiro_contato_direcao FROM crm_leads")), "anon não lê a coluna nova");
    await como("postgres");
    ok(/Apenas administradores/.test(await erro("SELECT * FROM admin_crm_funil_excluidos(current_date - 7, current_date)")), "sem usuário (SQL Editor) a função nova recusa");
    await db.exec("RESET ROLE");
    ok((await q(`SELECT count(*)::int c FROM pg_proc p, aclexplode(p.proacl) a
                  WHERE p.oid = 'public.admin_crm_funil_excluidos(date, date)'::regprocedure AND a.grantee = 0`))[0].c === 0,
       "função nova sem EXECUTE para PUBLIC");

    // ---------------- rollback ----------------
    await db.exec(s.rollback);
    const rb = await defs();
    for (const n of FUNCS) ok(rb[n].prosrc === antes[n].prosrc && rb[n].r === antes[n].r, `rollback: ${n} volta exatamente à versão da fase 1`);
    ok((await q("SELECT to_regprocedure('public.admin_crm_funil_excluidos(date, date)') IS NULL AS x"))[0].x === true, "rollback: função nova removida");
    ok((await q(`SELECT count(*)::int c FROM information_schema.columns WHERE table_name = 'crm_leads' AND column_name = 'primeiro_contato_direcao'`))[0].c === 0
       && (await q("SELECT count(*)::int c FROM pg_constraint WHERE conname = 'crm_leads_primeiro_contato_direcao_check'"))[0].c === 0,
       "rollback: coluna e CHECK removidos");
    await tudoOk(CONFERIR, "1c-0-conferir-producao (depois do rollback, pronto para reaplicar)");
    await como("authenticated", ADMIN);
    const fRb = await funil();
    ok(fRb.conversas === total, `rollback: funil volta a contar todos (${fRb.conversas})`);
    await como("service_role");
    const rRb = await ingerir([msg("5511990000015", "l1", "entrada", 2)]);
    ok(rRb.inseridas === 1, "rollback: ingestão antiga continua gravando");
    await db.exec("RESET ROLE");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "1c-1-verificar (reaplicada depois do rollback)");
    d = await direcoes();
    ok(d["0015"] === "entrada" && d["0013"] === "saida" && d["0004"] === null, "reaplicada: backfill recupera pelas mensagens guardadas");
  } catch (e) {
    ok(false, `exceção: ${e.message}`);
  } finally {
    await db.close();
  }
  return falhas;
}

// ---------------------------------------------------------------------------
// Verificações estáticas (texto da migration e do rollback)
// ---------------------------------------------------------------------------
function estaticas() {
  const falhas = [];
  const ok = (c, m) => { console.log(`${c ? "OK   " : "FALHA"} ${m}`); if (!c) falhas.push(m); };
  const sc = ORIG.mig.replace(/--.*$/gm, "");
  ok(/^\s*BEGIN;/m.test(sc) && /COMMIT;\s*$/.test(sc), "migration em BEGIN/COMMIT");
  ok(/SET LOCAL lock_timeout = '3s';/.test(ORIG.mig) && /SET LOCAL statement_timeout = '60s';/.test(ORIG.mig), "lock_timeout 3s e statement_timeout 60s");
  const alter = [...sc.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([\w.]+)/gi)].map((m) => m[1]);
  ok(alter.length > 0 && alter.every((t) => t === "public.crm_leads"), `ALTER TABLE só em crm_leads (${[...new Set(alter)].join(", ")})`);
  ok(!/UPDATE\s+public\.(?!crm_leads\b)\w+/i.test(sc.replace(/\$\$[\s\S]*?\$\$/g, "")), "fora das funções, UPDATE só em crm_leads (backfill)");
  ok(/ADD COLUMN IF NOT EXISTS primeiro_contato_direcao text;/.test(sc), "coluna nula e sem default");
  ok(/NOT VALID/.test(sc) && /VALIDATE CONSTRAINT crm_leads_primeiro_contato_direcao_check/.test(sc), "CHECK NOT VALID + VALIDATE");
  ok(!/_zerar_catalogo|crm_estagios|crm_usuarios|crm_automacoes|crm_configuracoes|update_crm_stage|DROP\s/i.test(sc),
     "sem _zerar_catalogo, CRM antigo ou DROP");
  ok(!/(CREATE|ALTER|DROP|TRUNCATE|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(TABLE\s+)?(IF\s+(NOT\s+)?EXISTS\s+)?public\.meta_ads/i.test(sc)
     && (sc.match(/meta_ads/g) ?? []).length === 1, "Meta Ads só lida (1 menção: o FROM copiado da fase 1)");
  const fase1 = FASE1[1] + FASE1[2];
  for (const nome of FUNCS) {
    const bloco = (t) => { const i = t.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`); return t.slice(i, t.indexOf("\n$$;\n", i) + 5); };
    ok(tirar1C(bloco(ORIG.mig)) === bloco(fase1), `migration: ${nome} = fase 1 + linhas "-- 1C"`);
    ok(bloco(ORIG.rollback) === bloco(fase1), `rollback: ${nome} = cópia exata da fase 1`);
  }
  ok(ORIG.rollback.includes("NÃO RODE — SÓ EM EMERGÊNCIA") && ORIG.rollback.includes("PERDA DE DADO"), "rollback marcado NÃO RODE e avisa a perda de dado");
  ok(!/\b(55)?\d{2}9\d{4}\d{4}\b/.test((ORIG.mig + CONFERIR + VERIFICAR + ORIG.rollback).replace(/990000\d{3}/g, "")), "nenhum celular com cara de real");
  return falhas;
}

// ---------------------------------------------------------------------------
// Mutantes: cada um TEM que derrubar a suíte. Rodam sem a verificação 1C
// (ela compara o md5 do texto e mataria qualquer mutante sem provar nada):
// quem tem que pegar é o comportamento.
// ---------------------------------------------------------------------------
const FILTRO = "\n       AND l.primeiro_contato_direcao = 'entrada'  -- 1C: só quem escreveu primeiro";
const MUTANTES = [
  { nome: "tirar o filtro de direção do funil", de: FILTRO, para: "", so: 1 },
  { nome: "tirar o filtro de direção do funil por anúncio", de: FILTRO, para: "", so: 2 },
  { nome: "tirar o has_role da função nova",
    de: "  IF NOT public.has_role(auth.uid(), 'admin') THEN\n    RAISE EXCEPTION 'Apenas administradores podem executar esta função';\n  END IF;\n  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN\n    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';\n  END IF;\n  v_ini := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';\n  v_fim := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';\n\n  RETURN QUERY\n  SELECT\n    count(*) FILTER (WHERE l.primeiro_contato_direcao = 'saida')",
    para: "  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN\n    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';\n  END IF;\n  v_ini := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';\n  v_fim := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';\n\n  RETURN QUERY\n  SELECT\n    count(*) FILTER (WHERE l.primeiro_contato_direcao = 'saida')" },
  { nome: "tirar o REVOKE de anon da função nova",
    de: "REVOKE ALL ON FUNCTION public.admin_crm_funil_excluidos(date, date)   FROM PUBLIC, anon;", para: "" },
  { nome: "tirar a atualização por mensagem mais antiga",
    de: "CASE WHEN v_em < l.primeiro_contato_em THEN v_dir ELSE l.primeiro_contato_direcao END", para: "l.primeiro_contato_direcao" },
  { nome: "gravar a direção errada no lead novo",
    de: "        v_dir,  -- 1C: direção da 1ª mensagem (lead novo)",
    para: "        CASE v_dir WHEN 'entrada' THEN 'saida' ELSE 'entrada' END,  -- 1C: direção da 1ª mensagem (lead novo)" },
  { nome: "gravar a direção errada na mensagem mais antiga",
    de: "THEN v_dir ELSE l.primeiro_contato_direcao END", para: "THEN CASE v_dir WHEN 'entrada' THEN 'saida' ELSE 'entrada' END ELSE l.primeiro_contato_direcao END" },
  { nome: "backfill pela mensagem mais NOVA", de: "ORDER BY x.lead_id, x.enviada_em ASC, x.id ASC", para: "ORDER BY x.lead_id, x.enviada_em DESC, x.id DESC" },
  { nome: "backfill adivinhando quando a 1ª mensagem foi cortada", de: "   AND m.enviada_em = l.primeiro_contato_em\n", para: "" },
  { nome: "backfill sobrescrevendo quem já tem direção", de: "   AND l.primeiro_contato_direcao IS NULL;", para: ";" },
  { nome: "função nova contando desconhecido como loja", de: "count(*) FILTER (WHERE l.primeiro_contato_direcao = 'saida')::bigint,\n    count(*) FILTER (WHERE l.primeiro_contato_direcao = 'saida' AND",
    para: "count(*) FILTER (WHERE l.primeiro_contato_direcao IS DISTINCT FROM 'entrada')::bigint,\n    count(*) FILTER (WHERE l.primeiro_contato_direcao = 'saida' AND" },
  { nome: "rollback sem apagar a coluna", alvo: "rollback",
    de: "ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS primeiro_contato_direcao;", para: "" },
];

function aplicarMutante(m) {
  const s = { ...ORIG };
  const alvo = m.alvo ?? "mig";
  const antes = s[alvo];
  if (m.so) {
    // só a n-ésima ocorrência
    let n = 0;
    s[alvo] = antes.split(m.de).reduce((acc, parte, i) => (i === 0 ? parte : acc + (++n === m.so ? m.para : m.de) + parte), "");
  } else {
    s[alvo] = antes.replace(m.de, m.para);
  }
  if (s[alvo] === antes) throw new Error(`mutante "${m.nome}" não achou o trecho`);
  return s;
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
    for (const x of f.slice(0, 3)) console.log(`        · ${x.slice(0, 120)}`);
  }
}
const total = falhasEst.length + falhas.length + falhasMut;
console.log(total === 0 ? "\nTUDO OK" : `\n${total} FALHA(S)`);
process.exit(total ? 1 : 0);
