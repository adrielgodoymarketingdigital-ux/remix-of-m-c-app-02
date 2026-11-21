// CRM de leads — FASE 1D (degrau "teste" lê o teste certo) — prova num
// Postgres 17 LOCAL (PGlite, WebAssembly). Não toca produção. Dados 100%
// fictícios.
//
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-1d.mjs              # suíte
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-1d.mjs --mutantes   # + mutantes
//
// Carrega as migrations REAIS da fase 1 (SQL 1, 2 e 3) e da 1C, grava dados,
// roda a conferência 1D, aplica a 1D duas vezes e cobre: cadastro com
// free_trial_ends_at futuro, vencido, cancelado, cancelado e vencido, só
// trial_started_at, nenhum dos dois, pagante; quem fica fora da coorte (loja
// chamou primeiro, já era cliente, fora do período); funil e funil por
// anúncio antes/depois (só "testes" muda); função nova; privilégios (anon /
// authenticated / PUBLIC com os privilégios padrão do Supabase); assinaturas
// iguais; texto das funções = 1C + linhas "-- 1D"; rollback (volta
// exatamente à 1C).
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
];
const MIG_1C = ANTERIORES[3];
const ORIG = {
  mig: ler("supabase/migrations/20261121140000_crm_leads_1d_teste.sql"),
  rollback: ler("scripts/crm-leads/rollback-1d.sql"),
};
const META_ADS = ler("supabase/migrations/20261024130000_meta_ads_cache.sql");
const CONFERIR = ler("scripts/crm-leads/1d-0-conferir-producao.sql");
const VERIFICAR = ler("scripts/crm-leads/1d-1-verificar.sql");

// Mesma réplica mínima do teste da fase 1 (teste-pglite.mjs), lida de lá,
// mais as 2 colunas de teste do plano free como estão em produção
// (20260202041229 e 20260224000000).
const t1 = ler("scripts/crm-leads/teste-pglite.mjs");
const BASE = t1.slice(t1.indexOf("const BASE = `") + 14, t1.indexOf("`;", t1.indexOf("const BASE = `")));
const COLUNAS_TESTE = `
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS trial_canceled boolean DEFAULT false;
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS free_trial_ends_at timestamptz DEFAULT NULL;`;
const PADRAO_SUPABASE = "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;";

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(900), COMUM = U(901);
const FUNCS = ["admin_crm_funil", "admin_crm_funil_por_anuncio"];
const tirar1D = (s) => s.split("\n").filter((l) => !l.includes("-- 1D")).join("\n");
const bloco = (t, nome) => { const i = t.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`); return t.slice(i, t.indexOf("\n$$;\n", i) + 5); };

// Casos (todos ingeridos como "o cliente escreveu primeiro", salvo 8):
//  1 teste free no prazo                  (anúncio A)
//  2 teste free vencido, sem pagar        (anúncio A)
//  3 teste free no prazo, cancelado
//  4 só trial_started_at (liberado pelo admin)
//  5 nenhum dos dois
//  6 teste free vencido e PAGANTE (PIX)
//  7 teste free vencido e cancelado, sem pagar (conta nos dois)
//  8 a loja chamou primeiro (fora da coorte), com teste
//  9 já era cliente (cadastro de 10 dias antes), com teste
// 10 1º contato há 60 dias (fora do período), com teste
const CASOS = {
  1: { teste: "now() + interval '10 days'" },
  2: { teste: "now() - interval '1 day'" },
  3: { teste: "now() + interval '10 days'", cancelado: true },
  4: { admin: true },
  5: {},
  6: { teste: "now() - interval '2 days'", paga: true },
  7: { teste: "now() - interval '3 days'", cancelado: true },
  8: { teste: "now() + interval '10 days'", loja: true },
  9: { teste: "now() + interval '10 days'", antigo: true },
  10: { teste: "now() + interval '10 days'", minAtras: 60 * 24 * 60 },
};

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
  const tel = (n) => `55119900001${String(n).padStart(2, "0")}`;
  const defs = async (nomes) => Object.fromEntries((await q(`
    SELECT p.proname, p.prosrc, pg_get_function_arguments(p.oid) a, pg_get_function_result(p.oid) r,
           p.prosecdef, p.provolatile, p.proretset, p.proconfig, p.proacl::text acl
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1)`, [nomes])).map((x) => [x.proname, x]));
  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, typeof x === "bigint" || /^\d+$/.test(String(x)) ? Number(x) : x]));
  const funil = async (ini = 7) => num((await q(`SELECT * FROM admin_crm_funil(current_date - ${ini}, current_date)`))[0]);
  const porAd = async () => (await q("SELECT * FROM admin_crm_funil_por_anuncio(current_date - 7, current_date)")).map(num);
  const teste = async (a = "current_date - 7", b = "current_date") => num((await q(`SELECT * FROM admin_crm_funil_teste(${a}, ${b})`))[0]);

  try {
    await db.exec(BASE);
    await db.exec(COLUNAS_TESTE);
    await db.exec(PADRAO_SUPABASE);
    await db.exec(META_ADS);
    for (const sql of ANTERIORES) await db.exec(sql);
    const antes = await defs(FUNCS);

    // ---------------- dados ----------------
    await db.exec(`INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');`);
    for (const [n, c] of Object.entries(CASOS)) {
      const criado = c.antigo ? "now() - interval '10 days'" : c.minAtras ? `now() - interval '${c.minAtras - 5} minutes'` : "now() - interval '5 minutes'";
      await db.exec(`INSERT INTO profiles (user_id, celular, created_at) VALUES ('${U(n)}', '11 99000-01${String(n).padStart(2, "0")}', ${criado});`);
      await db.exec(`INSERT INTO assinaturas (user_id, plano_tipo, status, trial_started_at, free_trial_ends_at, trial_canceled)
        VALUES ('${U(n)}', 'free', 'active', ${c.admin ? "now() - interval '1 day'" : "NULL"}, ${c.teste ?? "NULL"}, ${c.cancelado ? "true" : "false"});`);
      if (c.paga) await db.exec(`INSERT INTO pagamentos_pix VALUES ('${U(n)}', 'paid', now() - interval '1 hour', 4990);`);
    }
    await como("service_role");
    for (const [n, c] of Object.entries(CASOS)) {
      const min = c.minAtras ?? 60;
      const referral = Number(n) <= 2 ? { referral: { ad_id: "120000000000001", titulo: "Anúncio A (ficticio)" } } : {};
      await ingerir([{ telefone: tel(n), wa_message_id: `m${n}`, direcao: c.loja ? "saida" : "entrada",
        autor: c.loja ? "automacao" : "lead", tipo: "texto", texto: "oi", enviada_em: iso(min), ...referral }]);
      await q(`SELECT public.crm_vincular_usuario('${tel(n)}', '${U(n)}')`);
    }

    await como("authenticated", ADMIN);
    const fAntes = await funil();
    const adAntes = await porAd();
    ok(fAntes.cadastros === 7 && fAntes.testes === 1 && fAntes.assinantes === 1,
       `antes da 1D: 7 cadastros, "testes" só vê trial_started_at = 1 (${fAntes.testes}), 1 assinante`);
    ok(/does not exist/.test(await erro("SELECT * FROM admin_crm_funil_teste(current_date - 7, current_date)")), "antes da 1D a função nova não existe");

    // ---------------- conferência, aplicação 2x, verificação ----------------
    await db.exec("RESET ROLE");
    const conf = await tudoOk(CONFERIR, "1d-0-conferir-producao (antes)");
    const info9 = conf.find((l) => l.item.startsWith("9."))?.encontrado ?? "";
    ok(info9 === "cadastros 7 · teste hoje no card (trial_started_at) 1 · com teste depois da 1D 6 · em teste agora 1 · prazo do teste já passou 3 · cancelados 2",
       `conferência informa a situação dos 30 dias (${info9})`);
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "1d-1-verificar");
    await db.exec(s.mig);
    if (comVerificacao) {
      const v = await tudoOk(VERIFICAR, "1d-1-verificar (depois da 2ª aplicação: idempotente)");
      const info7 = v.find((l) => l.item.startsWith("7."))?.encontrado ?? "";
      ok(info7 === "cadastros 7 · com teste (coluna testes) 6 · em teste agora 1 · prazo do teste já passou 3 · cancelados 2", `verificação informa (${info7})`);
    }

    // ---------------- assinaturas e texto das funções ----------------
    const depois = await defs(FUNCS);
    for (const n of FUNCS) {
      const a = antes[n], b = depois[n];
      ok(a.a === b.a && a.r === b.r && a.prosecdef === b.prosecdef && a.provolatile === b.provolatile
         && a.proretset === b.proretset && JSON.stringify(a.proconfig) === JSON.stringify(b.proconfig) && a.acl === b.acl,
         `${n}: parâmetros, retorno, volatilidade, SECURITY DEFINER, search_path e privilégios iguais (${b.a} -> ${b.r.slice(0, 50)}...)`);
      ok(tirar1D(b.prosrc) === a.prosrc && b.prosrc !== a.prosrc, `${n}: texto = versão da 1C + só linhas "-- 1D"`);
    }

    // ---------------- funil: só "testes" muda ----------------
    await como("authenticated", ADMIN);
    const fDepois = await funil();
    ok(fDepois.testes === 6, `"testes" conta free_trial_ends_at OU trial_started_at: 1,2,3,4,6,7 = 6 (${fDepois.testes})`);
    const semTestes = (o) => JSON.stringify({ ...o, testes: null });
    ok(semTestes(fAntes) === semTestes(fDepois), `funil: todas as outras colunas iguais (${JSON.stringify(fDepois)})`);
    const adDepois = await porAd();
    const resumo = (l) => l.map((x) => `${x.ad_id || "sem"}:${x.conversas}/${x.cadastros}/${x.testes}/${x.assinantes}`).join(" ");
    ok(resumo(adDepois) === "sem:6/5/4/1 120000000000001:2/2/2/0", `funil por anúncio: testes por linha (${resumo(adDepois)})`);
    ok(JSON.stringify(adAntes.map((x) => ({ ...x, testes: null }))) === JSON.stringify(adDepois.map((x) => ({ ...x, testes: null }))),
       "funil por anúncio: todas as outras colunas iguais");
    ok(adDepois.reduce((s, x) => s + x.testes, 0) === fDepois.testes, "soma dos testes por anúncio = testes do funil");

    // ---------------- função nova ----------------
    const t = await teste();
    ok(JSON.stringify(t) === JSON.stringify({ teste_ativo_agora: 1, teste_acabou_sem_pagar: 2, teste_cancelado: 2, assinantes: 1 }),
       `função nova: em teste 1 (caso 1), acabou sem pagar 2 (2 e 7), cancelado 2 (3 e 7), assinantes 1 (6) — ${JSON.stringify(t)}`);
    ok(t.assinantes === fDepois.assinantes, "assinantes da função nova = assinantes do funil (mesma regra)");
    // trial_canceled NULL (coluna sem NOT NULL) conta como não cancelado
    await db.exec(`RESET ROLE; UPDATE assinaturas SET trial_canceled = NULL WHERE user_id = '${U(1)}';`);
    await como("authenticated", ADMIN);
    ok((await teste()).teste_ativo_agora === 1, "trial_canceled nulo = não cancelado");
    // prazo acabando exatamente agora: <= now() já é "acabou". Na MESMA
    // transação (now() é o início dela), senão o relógio anda e o limite some.
    await db.exec(`RESET ROLE; BEGIN; UPDATE assinaturas SET free_trial_ends_at = now() WHERE user_id = '${U(1)}';`);
    await db.exec(`SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: ADMIN, role: "authenticated" })}', true); SET LOCAL ROLE authenticated;`);
    const tAgora = await teste();
    await db.exec("ROLLBACK");
    ok(tAgora.teste_ativo_agora === 0 && tAgora.teste_acabou_sem_pagar === 3, "prazo = agora: sai de 'em teste' e entra em 'acabou sem pagar'");
    await como("authenticated", ADMIN);
    ok((await teste()).teste_ativo_agora === 1, "depois do ROLLBACK o caso 1 volta a estar em teste");
    const [vazio] = await q("SELECT * FROM admin_crm_funil_teste(current_date - 400, current_date - 300)");
    ok(Object.values(vazio).every((x) => Number(x) === 0), "período sem leads: zeros (1 linha)");
    const t60 = await teste("current_date - 61", "current_date - 59");
    ok(t60.teste_ativo_agora === 1 && t60.assinantes === 0, "lead de 60 dias atrás entra só no período dele");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_teste(current_date, current_date - 1)")), "função nova recusa período invertido");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_teste(current_date - 401, current_date)")), "função nova recusa mais de 400 dias");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_teste(NULL, current_date)")), "função nova recusa data nula");
    const [{ r: retorno }] = await q("SELECT pg_get_function_result('public.admin_crm_funil_teste(date, date)'::regprocedure) r");
    ok(retorno === "TABLE(teste_ativo_agora bigint, teste_acabou_sem_pagar bigint, teste_cancelado bigint, assinantes bigint)",
       "função nova devolve só 4 contagens (sem nome, e-mail, telefone ou id)");

    // ---------------- privilégios ----------------
    await como("authenticated", COMUM);
    for (const fn of ["admin_crm_funil_teste", "admin_crm_funil", "admin_crm_funil_por_anuncio"]) {
      ok(/Apenas administradores/.test(await erro(`SELECT * FROM ${fn}(current_date - 7, current_date)`)), `${fn} recusa authenticated não-admin`);
    }
    await como("anon");
    for (const fn of ["admin_crm_funil_teste", "admin_crm_funil", "admin_crm_funil_por_anuncio"]) {
      ok(/permission denied/.test(await erro(`SELECT * FROM ${fn}(current_date - 7, current_date)`)), `anon não executa ${fn}`);
    }
    await como("postgres");
    ok(/Apenas administradores/.test(await erro("SELECT * FROM admin_crm_funil_teste(current_date - 7, current_date)")), "sem usuário (SQL Editor) a função nova recusa");
    await db.exec("RESET ROLE");
    ok((await q(`SELECT count(*)::int c FROM pg_proc p, aclexplode(p.proacl) a
                  WHERE p.oid = 'public.admin_crm_funil_teste(date, date)'::regprocedure AND a.grantee = 0`))[0].c === 0,
       "função nova sem EXECUTE para PUBLIC");
    const [{ dfn }] = await q(`SELECT p.prosecdef AND p.provolatile = 's' AND p.proconfig @> ARRAY['search_path=public'] AS dfn
                                 FROM pg_proc p WHERE p.oid = 'public.admin_crm_funil_teste(date, date)'::regprocedure`);
    ok(dfn === true, "função nova: SECURITY DEFINER, STABLE e search_path fixo");

    // ---------------- rollback ----------------
    await db.exec(s.rollback);
    const rb = await defs(FUNCS);
    for (const n of FUNCS) {
      ok(rb[n].prosrc === antes[n].prosrc && rb[n].r === antes[n].r && rb[n].a === antes[n].a && rb[n].acl === antes[n].acl,
         `rollback: ${n} volta exatamente à versão da 1C (texto, assinatura, privilégios)`);
    }
    ok((await q("SELECT to_regprocedure('public.admin_crm_funil_teste(date, date)') IS NULL AS x"))[0].x === true, "rollback: função nova removida");
    await tudoOk(CONFERIR, "1d-0-conferir-producao (depois do rollback, pronto para reaplicar)");
    await como("authenticated", ADMIN);
    ok(JSON.stringify(await funil()) === JSON.stringify(fAntes), "rollback: funil volta ao resultado da 1C");
    await db.exec("RESET ROLE");
    await db.exec(s.rollback);
    ok(true, "rollback rodado 2 vezes não dá erro");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "1d-1-verificar (reaplicada depois do rollback)");
    await como("authenticated", ADMIN);
    ok((await funil()).testes === 6 && (await teste()).teste_acabou_sem_pagar === 2, "reaplicada: mesmos números");
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
  const foraDasFuncoes = sc.replace(/\$\$[\s\S]*?\$\$/g, "");
  ok(/^\s*BEGIN;/m.test(sc) && /COMMIT;\s*$/.test(sc), "migration em BEGIN/COMMIT");
  ok(/SET LOCAL lock_timeout = '3s';/.test(ORIG.mig) && /SET LOCAL statement_timeout = '60s';/.test(ORIG.mig), "lock_timeout 3s e statement_timeout 60s");
  ok(!/\b(ALTER\s+TABLE|CREATE\s+TABLE|DROP|TRUNCATE|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(foraDasFuncoes), "nenhuma tabela criada, alterada ou gravada; nenhum DROP");
  const criadas = [...sc.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
  ok(JSON.stringify(criadas) === JSON.stringify(["admin_crm_funil", "admin_crm_funil_por_anuncio", "admin_crm_funil_teste"]),
     `só as 2 funções do funil + a nova (${criadas.join(", ")})`);
  ok(!/_zerar_catalogo|admin_mkt_origens|crm_ingerir_mensagens|FUNCTION public\._crm_pagantes|crm_estagios|crm_usuarios|crm_automacoes|crm_configuracoes/i.test(sc),
     "sem _zerar_catalogo, admin_mkt_origens, ingestão, _crm_pagantes (só chamada) ou CRM antigo");
  for (const nome of FUNCS) {
    ok(tirar1D(bloco(ORIG.mig, nome)) === bloco(MIG_1C, nome), `migration: ${nome} = 1C + linhas "-- 1D"`);
    ok(bloco(ORIG.mig, nome).split("\n").filter((l) => l.includes("-- 1D")).length === 1, `migration: ${nome} tem 1 linha "-- 1D"`);
    ok(bloco(ORIG.rollback, nome) === bloco(MIG_1C, nome), `rollback: ${nome} = cópia exata da 1C`);
  }
  ok(ORIG.rollback.includes("NÃO RODE — SÓ EM EMERGÊNCIA") && /DROP FUNCTION IF EXISTS public\.admin_crm_funil_teste\(date, date\);/.test(ORIG.rollback),
     "rollback marcado NÃO RODE e remove a função nova");
  ok(!/telefone|email|e164|\bnome\b/i.test(bloco(ORIG.mig, "admin_crm_funil_teste")), "função nova não lê telefone, e-mail nem nome");
  ok(!/\b(55)?\d{2}9\d{4}\d{4}\b/.test((ORIG.mig + CONFERIR + VERIFICAR + ORIG.rollback).replace(/990000\d{3}/g, "")), "nenhum celular com cara de real");
  ok(!/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i.test((CONFERIR + VERIFICAR).replace(/--.*$/gm, "").replace(/'[^']*'/g, "")),
     "conferência e verificação são só leitura");
  return falhas;
}

// ---------------------------------------------------------------------------
// Mutantes: cada um TEM que derrubar a suíte. Rodam sem a verificação 1D
// (ela compara o md5 do texto e mataria qualquer mutante sem provar nada):
// quem tem que pegar é o comportamento.
// ---------------------------------------------------------------------------
const LINHA_1D = "      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at IS NOT NULL UNION ALL  -- 1D: teste de quem se cadastrou sozinho (plano free)\n";
const MUTANTES = [
  { nome: "funil sem a linha 1D (testes só trial_started_at)", de: LINHA_1D, para: "", so: 1 },
  { nome: "funil por anúncio sem a linha 1D", de: LINHA_1D, para: "", so: 2 },
  { nome: "funil contando só free_trial_ends_at (perde o liberado pelo admin)",
    de: LINHA_1D + "      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_started_at IS NOT NULL))::bigint,",
    para: LINHA_1D.replace(" UNION ALL", "") + "      ))::bigint,", so: 1 },
  { nome: "em teste sem olhar o cancelamento", de: "AND t.free_trial_ends_at > now() AND t.trial_canceled IS NOT TRUE", para: "AND t.free_trial_ends_at > now()" },
  { nome: "em teste com o prazo invertido", de: "t.free_trial_ends_at > now() AND", para: "t.free_trial_ends_at < now() AND" },
  { nome: "acabou sem pagar contando pagante", de: "\n      AND NOT EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid))::bigint,", para: ")::bigint," },
  { nome: "acabou com < em vez de <= (prazo = agora some)", de: "t.free_trial_ends_at <= now())", para: "t.free_trial_ends_at < now())" },
  { nome: "cancelado invertido", de: "AND t.trial_canceled IS TRUE))::bigint,", para: "AND t.trial_canceled IS NOT TRUE))::bigint," },
  { nome: "assinantes = todos da coorte", de: "    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid))::bigint\n  FROM coorte c;", para: "    count(*)::bigint\n  FROM coorte c;" },
  { nome: "coorte sem o filtro 'o cliente escreveu primeiro'",
    de: "     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim\n       AND l.primeiro_contato_direcao = 'entrada'\n       AND pr.created_at",
    para: "     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim\n       AND pr.created_at" },
  { nome: "coorte sem o filtro de cadastro novo (entra quem já era cliente)",
    de: "\n       AND pr.created_at >= l.primeiro_contato_em - interval '24 hours'\n  ),\n  pag AS (\n    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c)) p",
    para: "\n  ),\n  pag AS (\n    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c)) p" },
  { nome: "coorte sem o limite do período",
    de: "     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim\n       AND l.primeiro_contato_direcao = 'entrada'\n       AND pr.created_at",
    para: "     WHERE true\n       AND l.primeiro_contato_direcao = 'entrada'\n       AND pr.created_at" },
  { nome: "tirar o has_role da função nova",
    de: "  IF NOT public.has_role(auth.uid(), 'admin') THEN\n    RAISE EXCEPTION 'Apenas administradores podem executar esta função';\n  END IF;\n  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN\n    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';\n  END IF;\n  v_ini := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';\n  v_fim := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';\n\n  RETURN QUERY\n  WITH coorte AS (\n    -- Mesma",
    para: "  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN\n    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';\n  END IF;\n  v_ini := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';\n  v_fim := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';\n\n  RETURN QUERY\n  WITH coorte AS (\n    -- Mesma" },
  { nome: "tirar o REVOKE de anon da função nova", de: "REVOKE ALL ON FUNCTION public.admin_crm_funil_teste(date, date)       FROM PUBLIC, anon;", para: "" },
  { nome: "REVOKE só de anon (PUBLIC continua)", de: "REVOKE ALL ON FUNCTION public.admin_crm_funil_teste(date, date)       FROM PUBLIC, anon;",
    para: "REVOKE ALL ON FUNCTION public.admin_crm_funil_teste(date, date)       FROM anon;" },
  { nome: "rollback sem apagar a função nova", alvo: "rollback", de: "DROP FUNCTION IF EXISTS public.admin_crm_funil_teste(date, date);", para: "" },
  { nome: "rollback devolvendo o funil com a linha 1D", alvo: "rollback",
    de: "      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_started_at IS NOT NULL))::bigint,",
    para: LINHA_1D.replace("  -- 1D: teste de quem se cadastrou sozinho (plano free)", "") + "      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_started_at IS NOT NULL))::bigint," },
];

function aplicarMutante(m) {
  const s = { ...ORIG };
  const alvo = m.alvo ?? "mig";
  const antes = s[alvo];
  if (m.so) {
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
    for (const x of f.slice(0, 2)) console.log(`        · ${x.slice(0, 120)}`);
  }
  console.log(`(${MUTANTES.length} mutantes)`);
}
if (process.argv.includes("--hashes")) {
  const db = new PGlite();
  await db.exec(BASE); await db.exec(COLUNAS_TESTE); await db.exec(META_ADS);
  for (const sql of ANTERIORES) await db.exec(sql);
  await db.exec(ORIG.mig);
  console.log((await db.query(`SELECT proname, md5(regexp_replace(prosrc, '\\s+', ' ', 'g')) h FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'admin_crm_funil%' ORDER BY 1`)).rows);
  await db.close();
}
const total = falhasEst.length + falhas.length + falhasMut;
console.log(total === 0 ? "\nTUDO OK" : `\n${total} FALHA(S)`);
process.exit(total ? 1 : 0);
