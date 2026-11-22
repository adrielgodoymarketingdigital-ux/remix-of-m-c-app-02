// CRM de leads — RELATÓRIO DE MARKETING (crm_relatorio_marketing) — prova num
// Postgres 17 LOCAL (PGlite, WebAssembly). Não toca produção. Dados 100%
// fictícios (telefones +55119000000xx, uuids 0000…).
//
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-relatorio.mjs              # suíte
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-relatorio.mjs --mutantes   # + mutantes
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-relatorio.mjs --hashes     # md5 dos SQL 0 e 1
//
// A regra "o relatório não diverge do card" é provada assim: para cada
// período, roda as funções ADMIN reais (admin_mkt_cadastros_por_dia,
// admin_mkt_origens, admin_crm_funil, admin_crm_funil_teste,
// admin_crm_funil_por_anuncio, admin_crm_funil_gasto,
// admin_crm_funil_gasto_por_anuncio) como admin, passa o resultado pelas
// MESMAS funções TypeScript que a tela usa (src/lib/marketing/*.ts:
// preencherDias/somarTotais, totalOrigens, normalizarLinhaFunil,
// normalizarSituacaoTeste, custosComGastoAutomatico, normalizarLinhasAnuncio,
// linhasAnuncioComGasto, custoPor) e exige o MESMO número no relatório, para
// o período e para o anterior de mesmo tamanho.
// Períodos: vazio, virada de ano (semana seg–dom), mês cheio (misto), virada
// de mês, semana incompleta (qua–sex), 2 semanas com gasto misto, mês só
// automático, 1 dia, e os 3 últimos dias (teste de 14 dias em andamento).
//
// Duas rodadas: depois da 20261123120000 (anterior = mesmos N dias) e depois
// da 20261123130000 (mês de calendário inteiro -> mês de calendário anterior
// inteiro; o resto continua N dias). Nas duas, o período atual tem que dar o
// número do card e o anterior o das funções admin reais no intervalo da regra.
// Casos do mês: nov×out, mar×fev (2026 com 28 dias, 2024 bissexto com 29),
// jan×dez do ano anterior, mês incompleto (1–15), semana, personalizado que
// coincide com um mês, "mês" que não começa no dia 1, rateio do gasto
// informado entre meses de tamanhos diferentes. Depois, rollback da regra do
// mês (volta ao texto da 20261123120000) e o rollback geral.
//
// admin_mkt_origens é carregada como está em PRODUÇÃO: o mesmo corpo da
// migration sem as 4 linhas de comentário de dentro (md5 90777d71…).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const lib = (p) => import(pathToFileURL(join(raiz, p)).href);
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

// Funções do card (as mesmas da tela)
const { preencherDias, somarTotais, diasNoIntervalo, somarDias } = await lib("src/lib/marketing/cadastrosPorDia.ts");
const { totalOrigens } = await lib("src/lib/marketing/origens.ts");
const { normalizarLinhaFunil, custoPor } = await lib("src/lib/marketing/custoWhatsApp.ts");
const { normalizarSituacaoTeste, normalizarLinhasAnuncio } = await lib("src/lib/marketing/funilWhatsApp.ts");
const { normalizarGastoPeriodo, normalizarGastoPorAnuncio, custosComGastoAutomatico, linhasAnuncioComGasto } =
  await lib("src/lib/marketing/gastoMetaWhatsApp.ts");

/** Tira as linhas de comentário de dentro do corpo $$…$$ (é assim que admin_mkt_origens está em produção). */
function semComentariosNoCorpo(sql) {
  const i = sql.indexOf("AS $$"), j = sql.indexOf("$$;", i);
  return sql.slice(0, i) + sql.slice(i, j).split("\n").filter((l) => !/^\s*--/.test(l)).join("\n") + sql.slice(j);
}
const ANTERIORES = [
  ler("supabase/migrations/20261021120000_admin_mkt_cadastros_por_dia.sql"),
  semComentariosNoCorpo(ler("supabase/migrations/20261021130000_admin_mkt_origens.sql")), // como em produção
  ler("supabase/migrations/20261121120000_crm_leads_1_estrutura.sql"),
  ler("supabase/migrations/20261121120010_crm_leads_2_gravacao.sql"),
  ler("supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql"),
  ler("supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql"),
  ler("supabase/migrations/20261121140000_crm_leads_1d_teste.sql"),
  ler("supabase/migrations/20261122120000_crm_leads_2a_gasto_meta_anuncio.sql"),
  ler("supabase/migrations/20261122130000_crm_feedback_pagantes.sql"), // feedback: vem antes em produção; não toca as fontes
];
const ORIG = {
  mig: ler("supabase/migrations/20261123120000_crm_leads_relatorio_marketing.sql"),
  rollback: ler("scripts/crm-leads/rollback-relatorio.sql"),
  mes: ler("supabase/migrations/20261123130000_crm_leads_relatorio_mes_calendario.sql"),
  rollbackMes: ler("scripts/crm-leads/rollback-relatorio-mes.sql"),
};
const CONFERIR_MES = ler("scripts/crm-leads/relatorio-mes-0-conferir-producao.sql");
const VERIFICAR_MES = ler("scripts/crm-leads/relatorio-mes-1-verificar.sql");
const META_ADS = ler("supabase/migrations/20261024130000_meta_ads_cache.sql");
const CONFERIR = ler("scripts/crm-leads/relatorio-0-conferir-producao.sql");
const VERIFICAR = ler("scripts/crm-leads/relatorio-1-verificar.sql");

const t1 = ler("scripts/crm-leads/teste-pglite.mjs");
const BASE = t1.slice(t1.indexOf("const BASE = `") + 14, t1.indexOf("`;", t1.indexOf("const BASE = `")));
const COLUNAS_TESTE = `
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS trial_canceled boolean DEFAULT false;
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS free_trial_ends_at timestamptz DEFAULT NULL;`;
const PADRAO_SUPABASE = `
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`;

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(900);
const NOVAS = ["_crm_rel_cadastros", "_crm_rel_funil", "crm_relatorio_marketing"];
const FONTES = ["admin_mkt_cadastros_por_dia", "admin_mkt_origens", "_crm_pagantes", "admin_crm_funil", "admin_crm_funil_por_anuncio",
  "admin_crm_funil_teste", "admin_crm_funil_gasto", "admin_crm_funil_gasto_por_anuncio"];
const A = "120000000000001", B = "120000000000002", C = "120000000000003", D = "120000000000004", E = "120000000000005";

/** Mês de calendário inteiro -> o mês de calendário anterior inteiro; senão null. (Conta independente da do SQL.) */
function anteriorDoMes(inicio, fim) {
  const [a, m, d] = inicio.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); // dia 0 do mês seguinte
  if (d !== 1 || fim !== ultimo) return null;
  return { inicio: new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10), fim: somarDias(inicio, -1) };
}

/** JSON com as chaves em ordem (o jsonb reordena as chaves). */
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

/** bigint -> number, Date -> ISO (o que o PostgREST entrega ao app). */
const comoPostgrest = (linhas) => linhas.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) =>
  [k, typeof v === "bigint" ? Number(v) : v instanceof Date ? v.toISOString() : v])));

async function suite(s, { silencioso = false, comVerificacao = true } = {}) {
  const db = new PGlite();
  const falhas = [];
  const ok = (cond, msg) => {
    if (!cond) falhas.push(msg);
    if (!silencioso) console.log(`${cond ? "OK   " : "FALHA"} ${msg}`);
  };
  const q = async (sql, p) => comoPostgrest((await db.query(sql, p)).rows);
  const como = async (papel, uid) => {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: uid ?? "", role: papel })}', false);`);
    if (papel !== "postgres") await db.exec(`SET ROLE ${papel}`);
  };
  const erro = async (sql, p) => { try { await db.query(sql, p); return ""; } catch (e) { return `${e.code ?? ""} ${e.message}`; } };
  const tudoOk = async (sql, nome) => {
    const linhas = await q(sql);
    const ruins = linhas.filter((l) => l.ok !== true);
    ok(linhas.length > 0 && ruins.length === 0, `${nome}: ${linhas.length} linhas ok${ruins.length ? " — FALHOU: " + ruins.map((r) => `${r.item} [${r.encontrado}]`).join(" | ") : ""}`);
  };
  const defs = async (nomes) => JSON.stringify(await q(`
    SELECT p.proname, p.prosrc, pg_get_function_result(p.oid) r, p.prosecdef, p.proconfig, p.proacl::text acl
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1) ORDER BY 1`, [nomes]));

  /** Regra do período anterior em vigor (false = 20261123120000; true = 20261123130000). */
  let regraMes = false;
  /**
   * O que o card mostra para o período (funções admin + TS do card). O anterior
   * segue a regra em vigor; os números dele vêm das funções admin no intervalo.
   */
  const card = async (inicio, fim) => {
    await como("authenticated", ADMIN);
    const dias = diasNoIntervalo({ inicio, fim });
    const anterior = regraMes ? anteriorDoMes(inicio, fim) ?? { inicio: somarDias(inicio, -dias), fim: somarDias(inicio, -1) }
      : { inicio: somarDias(inicio, -dias), fim: somarDias(inicio, -1) };
    const r = async (fn, ini, f) => q(`SELECT * FROM public.${fn}($1::date, $2::date)`, [ini, f]);
    // useAdminMarketingCadastros: 1 chamada de anterior.inicio a fim, separada no client
    const cad = (await q("SELECT dia::text AS dia, cadastros, com_utm, meta FROM public.admin_mkt_cadastros_por_dia($1::date, $2::date)",
      [anterior.inicio, fim]));
    const tAt = somarTotais(preencherDias(cad, { inicio, fim }));
    const tAnt = somarTotais(preencherDias(cad, anterior));
    const receita = totalOrigens(await r("admin_mkt_origens", inicio, fim)).receitaCentavos;
    const funil = normalizarLinhaFunil((await r("admin_crm_funil", inicio, fim))[0]);
    const funilAnt = normalizarLinhaFunil((await r("admin_crm_funil", anterior.inicio, anterior.fim))[0]);
    const teste = normalizarSituacaoTeste(await r("admin_crm_funil_teste", inicio, fim));
    const testeAnt = normalizarSituacaoTeste(await r("admin_crm_funil_teste", anterior.inicio, anterior.fim));
    const g = normalizarGastoPeriodo(await r("admin_crm_funil_gasto", inicio, fim));
    const c = custosComGastoAutomatico(funil, g);
    const gAd = normalizarGastoPorAnuncio(await r("admin_crm_funil_gasto_por_anuncio", inicio, fim));
    const comMeta = gAd.some((x) => x.diasAuto > 0); // CardFunilWhatsApp: comMetaPorAnuncio
    const linhas = linhasAnuncioComGasto(normalizarLinhasAnuncio(await r("admin_crm_funil_por_anuncio", inicio, fim)), comMeta ? gAd : undefined);
    const fun = (f, t) => ({ conversas_iniciadas: f.conversas, cadastros: f.cadastros, em_teste_agora: t.emTesteAgora,
      teste_acabou_sem_pagar: t.acabouSemPagar, assinantes_pagos: f.assinantes });
    await db.exec("RESET ROLE");
    return {
      comMeta,
      rel: {
        periodo: { inicio, fim, dias },
        periodo_anterior: anterior,
        cadastros: { total: tAt.cadastros, com_utm: tAt.com_utm, vindos_meta: tAt.meta,
          anterior: { total: tAnt.cadastros, com_utm: tAnt.com_utm, vindos_meta: tAnt.meta } },
        funil_whatsapp: { ...fun(funil, teste), anterior: fun(funilAnt, testeAnt) },
        gasto: { total_centavos: c.gastoCentavos, meta_centavos: c.gastoAutoCentavos, manual_centavos: c.gastoInformadoCentavos,
          fonte: c.fonte, dias_com_gasto_meta: c.diasComGastoMeta, dias_no_periodo: dias,
          atualizado_em: g.atualizadoEm === null ? null : Date.parse(g.atualizadoEm) },
        custos: { por_conversa_centavos: c.porConversaCentavos, por_cadastro_centavos: c.porCadastroCentavos,
          por_assinante_centavos: c.porAssinanteCentavos },
        receita_estimada_centavos: receita,
      },
      porAnuncio: linhas.map((l) => ({ ad_id: l.adId === "" ? null : l.adId, rotulo: l.titulo, conversas: l.conversas,
        cadastros: l.cadastros, teste: l.testes, assinantes: l.assinantes, gasto_centavos: l.gastoCentavos,
        custo_por_conversa_centavos: custoPor(l.gastoCentavos, l.conversas) })),
    };
  };
  const relatorio = async (inicio, fim) => {
    await como("service_role");
    const [{ r }] = await q("SELECT public.crm_relatorio_marketing($1::date, $2::date) AS r", [inicio, fim]);
    await db.exec("RESET ROLE");
    return r;
  };
  const chaveAd = (x) => x.ad_id ?? "";
  const ordemCerta = (lista) => lista.every((x, i) => i === 0 || (() => {
    const a = lista[i - 1], b = x;
    const ga = a.gasto_centavos ?? -1, gb = b.gasto_centavos ?? -1;
    return ga > gb || (ga === gb && (a.conversas > b.conversas || (a.conversas === b.conversas && chaveAd(a) <= chaveAd(b))));
  })());
  /** Compara relatório × card num período; devolve o relatório para checagens extras. */
  const comparar = async (nome, inicio, fim) => {
    const esp = await card(inicio, fim);
    const rel = await relatorio(inicio, fim);
    const { por_anuncio: ads, amadurecendo, ...resto } = rel;
    const restoNorm = { ...resto, gasto: { ...resto.gasto, atualizado_em: resto.gasto.atualizado_em === null ? null : Date.parse(resto.gasto.atualizado_em) } };
    const igual = canon(restoNorm) === canon(esp.rel);
    ok(igual, `${nome} (${inicio}..${fim}): cadastros, funil, gasto, custos e receita = card${igual ? "" : `\n        relatório ${canon(restoNorm)}\n        card      ${canon(esp.rel)}`}`);
    const doCard = new Map(esp.porAnuncio.map((x) => [chaveAd(x), x]));
    const iguais = ads.filter((x) => doCard.has(chaveAd(x)));
    const extras = ads.filter((x) => !doCard.has(chaveAd(x)));
    const porAdIgual = iguais.length === esp.porAnuncio.length
      && iguais.every((x) => canon(x) === canon(doCard.get(chaveAd(x))));
    ok(porAdIgual, `${nome}: por anúncio = tabela do card (${esp.porAnuncio.length} linhas)${porAdIgual ? "" : `\n        relatório ${JSON.stringify(iguais)}\n        card      ${JSON.stringify(esp.porAnuncio)}`}`);
    ok(extras.every((x) => !esp.comMeta && x.conversas === 0 && x.gasto_centavos > 0),
      `${nome}: linha a mais só sem dado automático, anúncio sem conversa e com gasto informado (${extras.length})`);
    ok(ordemCerta(ads), `${nome}: por anúncio ordenado por gasto`);
    ok(Object.keys(amadurecendo).join() === "cadastros_em_teste" && Number.isInteger(amadurecendo.cadastros_em_teste), `${nome}: amadurecendo só com a contagem`);
    return rel;
  };

  try {
    await db.exec(BASE);
    await db.exec(COLUNAS_TESTE);
    await db.exec(PADRAO_SUPABASE);
    await db.exec(META_ADS);
    for (const sql of ANTERIORES) await db.exec(sql);
    const [{ h }] = await q("SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') h");
    const hoje = (n) => somarDias(h, n);

    // ---------------- dados fictícios ----------------
    await db.exec(`INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');`);
    // Cadastros (created_at em UTC; comentário = dia de Brasília)
    await db.exec(`INSERT INTO profiles (user_id, created_at, utm_source, fbclid) VALUES
      ('${U(1)}',  '2026-01-01T02:30:00Z', 'facebook', NULL),   -- 31/12 23:30
      ('${U(2)}',  '2026-01-01T03:30:00Z', 'google', NULL),     -- 01/01 00:30
      ('${U(3)}',  '2026-01-05T12:00:00Z', NULL, 'fbc-x'),      -- só fbclid
      ('${U(4)}',  '2026-01-10T11:30:00Z', 'ig_stories', NULL),
      ('${U(5)}',  '2026-01-10T12:00:00Z', 'facebook', NULL),   -- funcionário
      ('${U(6)}',  '2026-01-10T12:00:00Z', 'facebook', NULL),   -- gerente de filial
      ('${U(7)}',  '2026-01-10T12:00:00Z', 'facebook', NULL),   -- admin
      ('${U(8)}',  '2026-01-10T12:00:00Z', 'facebook', NULL),   -- demonstração
      ('${U(9)}',  '2026-01-14T12:00:00Z', '', NULL),           -- utm vazio; 23 h antes do contato
      ('${U(10)}', '2026-02-03T15:00:00Z', 'meta_ads', NULL),
      ('${U(11)}', '2026-02-01T02:59:59Z', 'instagram', NULL),  -- 31/01 23:59:59
      ('${U(20)}', '2025-06-01T12:00:00Z', NULL, NULL),         -- já era cliente
      ('${U(21)}', '2026-01-14T10:00:00Z', NULL, NULL),         -- 25 h antes do contato: já era cliente
      ('${U(31)}', now() - interval '1 day' + interval '10 minutes', 'fb', NULL),
      ('${U(32)}', now() - interval '1 day' + interval '10 minutes', NULL, NULL),
      ('${U(33)}', now() - interval '2 days' + interval '10 minutes', NULL, NULL),
      ('${U(34)}', now() - interval '2 days' + interval '10 minutes', NULL, NULL),
      ('${U(40)}', '2025-10-01T12:00:00Z', 'facebook', NULL),   -- 01/10/2025: só o mês inteiro de outubro pega
      ('${U(41)}', '2025-12-10T12:00:00Z', 'google', NULL),     -- 10/12/2025: só o mês inteiro de dezembro pega
      ('${U(42)}', '2024-01-31T12:00:00Z', 'facebook', NULL),   -- 31/01/2024: só os 31 dias antes de março/2024 pegam
      ('${U(43)}', '2024-02-29T12:00:00Z', 'instagram', NULL),  -- 29/02/2024 (bissexto)
      ('${U(44)}', '2024-03-10T12:00:00Z', NULL, 'fbc-y');
      INSERT INTO loja_funcionarios VALUES ('${U(5)}');
      INSERT INTO empresa_usuarios VALUES ('${U(6)}');
      INSERT INTO user_roles VALUES ('${U(7)}', 'admin');
      INSERT INTO assinaturas (user_id, plano_tipo, payment_method, payment_provider, data_inicio, bloqueado_admin, free_trial_ends_at, trial_canceled, trial_started_at) VALUES
        ('${U(1)}', 'free', NULL, NULL, NULL, false, '2026-01-14T12:00:00Z', false, NULL),
        ('${U(2)}', 'intermediario_mensal', 'credit_card', 'pagarme', '2026-01-01T05:00:00Z', false, '2026-01-15T03:30:00Z', false, NULL),
        ('${U(3)}', 'basico_mensal', 'credit_card', 'Pagarme', '2026-01-06T12:00:00Z', false, '2026-01-19T12:00:00Z', false, NULL),
        ('${U(4)}', 'free', NULL, NULL, NULL, true, '2026-01-24T11:30:00Z', false, NULL),
        ('${U(8)}', 'demonstracao', NULL, NULL, NULL, false, NULL, false, NULL),
        ('${U(9)}', 'free', NULL, NULL, NULL, false, '2026-01-28T12:00:00Z', false, NULL),
        ('${U(10)}', 'free', NULL, NULL, NULL, false, '2026-02-17T15:00:00Z', false, NULL),
        ('${U(11)}', 'free', NULL, NULL, NULL, false, '2026-02-14T03:00:00Z', false, NULL),
        ('${U(31)}', 'free', NULL, NULL, NULL, false, now() + interval '5 days', false, NULL),
        ('${U(32)}', 'free', NULL, NULL, NULL, false, now() + interval '3 days', true, NULL),
        ('${U(33)}', 'free', NULL, NULL, NULL, false, now() - interval '1 hour', false, NULL),
        ('${U(34)}', 'free', NULL, NULL, NULL, false, NULL, false, now() - interval '2 days');
      -- Pagamentos: U2 cartão (01/01 05:00) antes do PIX (02/01) -> 1º = cartão 3990;
      -- U3 PIX e cartão no MESMO instante -> desempate: PIX (2500); U4 bloqueado;
      -- U9 só gateway antigo (receita 0); U10 PIX 12990; U1 PIX pendente (não conta)
      INSERT INTO pagamentos_pix (user_id, status, paid_at, valor_centavos) VALUES
        ('${U(2)}', 'paid', '2026-01-02T12:00:00Z', 1990),
        ('${U(3)}', 'paid', '2026-01-06T12:00:00Z', 2500),
        ('${U(4)}', 'paid', '2026-01-11T12:00:00Z', 1990),
        ('${U(10)}', 'paid', '2026-02-10T12:00:00Z', 12990),
        ('${U(1)}', 'pending', NULL, 1990);
      INSERT INTO admin_notifications (tipo, dados, created_at) VALUES
        ('nova_assinatura', '{"user_id": "${U(9)}", "stripe_subscription_id": "sub_123"}', '2026-01-29T12:00:00Z'),
        ('nova_assinatura', '{"user_id": "${U(1)}", "stripe_subscription_id": "sub_pending_x"}', '2026-01-03T12:00:00Z');`);

    // Leads (1º contato em UTC; comentário = Brasília)
    const lead = (n, em, ad, titulo, direcao, uid) => `('+55119000000${String(n).padStart(2, "0")}', ${em}, ${em}, ${ad ? `'${ad}'` : "NULL"},
      ${titulo ? `'${titulo}'` : "NULL"}, ${direcao ? `'${direcao}'` : "NULL"}, ${uid ? `'${uid}'` : "NULL"}, ${uid ? "'telefone'" : "NULL"})`;
    await db.exec(`INSERT INTO crm_leads (telefone_e164, primeiro_contato_em, ultimo_contato_em, origem_ad_id, origem_ad_titulo,
        primeiro_contato_direcao, cadastro_user_id, vinculo_metodo) VALUES
      ${lead(1, "'2026-01-01T02:00:00Z'", A, "Anúncio A (fictício)", "entrada", U(1))},  -- 31/12 23:00
      ${lead(2, "'2026-01-01T03:10:00Z'", A, null, "entrada", U(2))},                    -- 01/01 00:10
      ${lead(3, "'2026-01-05T10:00:00Z'", B, "Anúncio B (fictício)", "entrada", U(3))},
      ${lead(4, "'2026-01-10T11:00:00Z'", A, null, "saida", null)},                      -- loja chamou primeiro: fora
      ${lead(5, "'2026-01-10T11:00:00Z'", null, null, "entrada", U(20))},                -- já era cliente
      ${lead(6, "'2026-01-10T11:00:00Z'", A, null, "entrada", U(4))},
      ${lead(7, "'2026-01-13T12:00:00Z'", C, "Anúncio C (fictício)", "entrada", null)},
      ${lead(8, "'2026-01-15T11:00:00Z'", A, null, "entrada", U(9))},
      ${lead(9, "'2026-01-15T11:00:00Z'", null, null, "entrada", U(21))},
      ${lead(10, "'2026-01-20T12:00:00Z'", null, null, null, null)},                    -- direção desconhecida: fora
      ${lead(11, "'2026-02-01T02:30:00Z'", B, null, "entrada", U(11))},                  -- 31/01 23:30
      ${lead(12, "'2026-02-03T14:00:00Z'", B, null, "entrada", U(10))},
      ${lead(13, "now() - interval '1 day'", D, "Anúncio D (fictício)", "entrada", U(31))},
      ${lead(14, "now() - interval '1 day'", D, null, "entrada", U(32))},
      ${lead(15, "now() - interval '2 days'", null, null, "entrada", U(33))},
      ${lead(16, "now() - interval '2 days'", D, null, "entrada", U(34))},
      ${lead(17, "'2025-11-03T12:00:00Z'", B, null, "entrada", null)},
      ${lead(18, "'2025-10-01T11:00:00Z'", A, null, "entrada", U(40))},
      ${lead(19, "'2025-12-10T11:00:00Z'", null, null, "entrada", U(41))},
      ${lead(20, "'2024-01-31T11:00:00Z'", D, null, "entrada", U(42))},
      ${lead(21, "'2024-02-29T11:00:00Z'", D, null, "entrada", U(43))},
      ${lead(22, "'2024-03-10T11:00:00Z'", D, null, "entrada", U(44))};`);

    // Gasto informado (dia = Brasília)
    //  M1 anúncio A 29–31/12 R$ 30,00 (1.000/dia)       M2 geral 02–04/01 R$ 10,00 (333,33/dia)
    //  M5 anúncio E 30/12–01/01 R$ 0,05 (1,67/dia)      M3 anúncio A 12–25/01 R$ 14,00 (100/dia)
    //  M4 geral 20–21/01 R$ 4,00 (200/dia)              M6 anúncio C 07–09/01 R$ 0,03 (1/dia)
    //  removido e em USD não contam
    await db.exec(`INSERT INTO crm_gasto_manual (inicio, fim, ad_id, valor, moeda, removido_em) VALUES
      ('2025-12-29', '2025-12-31', '${A}', 30.00, 'BRL', NULL),
      ('2026-01-02', '2026-01-04', NULL,   10.00, 'BRL', NULL),
      ('2025-12-30', '2026-01-01', '${E}',  0.05, 'BRL', NULL),
      ('2026-01-12', '2026-01-25', '${A}', 14.00, 'BRL', NULL),
      ('2026-01-20', '2026-01-21', NULL,    4.00, 'BRL', NULL),
      ('2026-01-07', '2026-01-09', '${C}',  0.03, 'BRL', NULL),
      ('2026-01-12', '2026-01-25', '${B}', 999.00, 'BRL', now()),
      ('2026-01-12', '2026-01-25', '${B}', 999.00, 'USD', NULL),
      ('2025-11-01', '2025-11-12', '${B}',   0.01, 'BRL', NULL),
      -- rateio entre meses de tamanhos diferentes (1 centavo/dia e R$ 1,00/dia)
      ('2024-02-26', '2024-03-03', '${D}',   0.07, 'BRL', NULL),  -- 4 dias em fev/2024 (29 dias), 3 em mar/2024
      ('2025-09-25', '2025-10-04', '${D}',  10.00, 'BRL', NULL);`);  // 6 dias em set (30), 4 em out (31)
    // Gasto automático (2A): A 13–14/01 (14/01 com gasto 0), B 20/01; fevereiro só automático (B e C; C sem conversa); USD não conta
    await db.exec(`INSERT INTO crm_gasto_meta_anuncio (ad_id, data, gasto_centavos, conversas_meta, moeda, atualizado_em) VALUES
      ('${A}', '2026-01-13', 700, 3, 'BRL', '2026-01-14T09:00:00Z'),
      ('${A}', '2026-01-14',   0, 0, 'BRL', '2026-01-15T09:00:00Z'),
      ('${B}', '2026-01-20', 302, 2, 'BRL', '2026-01-21T09:00:00Z'),
      ('${B}', '2026-02-02', 1234, 4, 'BRL', '2026-02-03T09:00:00Z'),
      ('${B}', '2026-02-03', 1001, 1, 'BRL', '2026-02-04T09:00:00Z'),
      ('${C}', '2026-02-05',  555, 1, 'BRL', '2026-02-06T09:00:00Z'),
      ('${B}', '2026-02-04', 99999, 9, 'USD', '2026-02-05T09:00:00Z');`);

    // ---------------- conferência, aplicação 2x, verificação ----------------
    const fontesAntes = await defs(FONTES);
    await tudoOk(CONFERIR, "relatorio-0-conferir-producao (antes)");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "relatorio-1-verificar");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "relatorio-1-verificar (2ª aplicação: idempotente)");
    ok(await defs(FONTES) === fontesAntes, "as 8 funções do card ficaram idênticas (código e privilégios)");

    // ---------------- relatório = card ----------------
    const vazio = await comparar("período vazio", "2025-06-02", "2025-06-08");
    ok(vazio.cadastros.total === 0 && vazio.funil_whatsapp.conversas_iniciadas === 0 && vazio.gasto.fonte === "nenhum"
       && vazio.gasto.total_centavos === null && vazio.custos.por_conversa_centavos === null && vazio.custos.por_assinante_centavos === null
       && vazio.por_anuncio.length === 0 && vazio.receita_estimada_centavos === 0,
       "período vazio: zeros, fonte 'nenhum', custos nulos, lista vazia");
    ok(vazio.cadastros.anterior.total === 1 && vazio.periodo_anterior.inicio === "2025-05-26",
       `período vazio: o anterior (26/05–01/06) tem o cadastro de 01/06 (${JSON.stringify(vazio.cadastros.anterior)})`);

    const ano = await comparar("virada de ano (semana seg–dom, só gasto informado)", "2025-12-29", "2026-01-04");
    ok(ano.gasto.fonte === "manual" && ano.gasto.meta_centavos === 0 && ano.gasto.total_centavos === 3000 + 1000 + 5,
       `virada de ano: só informado, R$ 30,00 + R$ 10,00 + R$ 0,05 (${ano.gasto.total_centavos})`);
    ok(ano.cadastros.total === 2 && ano.cadastros.vindos_meta === 1 && ano.cadastros.com_utm === 2,
       `virada de ano: 31/12 23:30 e 01/01 00:30 de Brasília contam (${JSON.stringify(ano.cadastros)})`);
    ok(ano.por_anuncio.some((x) => x.ad_id === E && x.conversas === 0 && x.gasto_centavos === 5),
       "virada de ano: anúncio E (gasto informado, sem conversa) entra na lista com o gasto");

    const jan = await comparar("mês cheio (janeiro, gasto misto)", "2026-01-01", "2026-01-31");
    ok(jan.periodo_anterior.inicio === "2025-12-01" && jan.periodo_anterior.fim === "2025-12-31" && jan.periodo.dias === 31,
       `janeiro: anterior de mesmo tamanho = 01–31/12 (${JSON.stringify(jan.periodo_anterior)})`);
    ok(jan.cadastros.total === 6 && jan.cadastros.com_utm === 3 && jan.cadastros.vindos_meta === 3,
       `janeiro: sem funcionário, gerente, admin e demonstração; 31/01 23:59:59 conta (${JSON.stringify(jan.cadastros)})`);
    ok(jan.receita_estimada_centavos === 3990 + 2500,
       `janeiro: receita = 1º pagamento (cartão de U2 antes do PIX; empate de U3 vai para o PIX; bloqueado e gateway = 0) (${jan.receita_estimada_centavos})`);
    ok(jan.funil_whatsapp.conversas_iniciadas === 8 && jan.funil_whatsapp.cadastros === 5 && jan.funil_whatsapp.assinantes_pagos === 3
       && jan.funil_whatsapp.teste_acabou_sem_pagar === 2 && jan.funil_whatsapp.em_teste_agora === 0,
       `janeiro: funil (saída e direção nula fora; já clientes fora dos cadastros) ${JSON.stringify(jan.funil_whatsapp)}`);
    ok(jan.gasto.fonte === "automatico" && jan.gasto.dias_com_gasto_meta === 3 && jan.gasto.meta_centavos === 1002,
       `janeiro: automático vence (3 dias, R$ 10,02) ${JSON.stringify(jan.gasto)}`);
    ok(jan.custos.por_assinante_centavos === Math.round(jan.gasto.total_centavos / 3), "janeiro: custo por assinante = gasto ÷ 3");

    await comparar("virada de mês (31/01–01/02)", "2026-01-31", "2026-02-01");
    await comparar("semana incompleta (qua–sex)", "2026-01-07", "2026-01-09");
    const misto = await comparar("2 semanas com gasto misto", "2026-01-12", "2026-01-25");
    const adA = misto.por_anuncio.find((x) => x.ad_id === A);
    ok(adA?.gasto_centavos === 700 + 12 * 100, `misto: anúncio A = 700 automático + 12 dias informados (13 e 14/01 descartados) (${adA?.gasto_centavos})`);
    ok(misto.gasto.manual_centavos === 12 * 100 + 200, `misto: informado efetivo = A em 12 dias + geral só em 21/01 (${misto.gasto.manual_centavos})`);
    const fev = await comparar("mês só automático (fevereiro)", "2026-02-01", "2026-02-28");
    ok(fev.gasto.fonte === "automatico" && fev.gasto.manual_centavos === 0 && fev.gasto.meta_centavos === 1234 + 1001 + 555,
       `fevereiro: só automático, USD fora (${fev.gasto.meta_centavos})`);
    ok(fev.por_anuncio.some((x) => x.ad_id === C && x.conversas === 0 && x.gasto_centavos === 555 && x.custo_por_conversa_centavos === null),
       "fevereiro: anúncio com gasto e sem conversa entra, custo por conversa nulo");
    ok(fev.gasto.atualizado_em !== null, "fevereiro: atualizado_em = última sincronização");
    await comparar("1 dia (31/12)", "2025-12-31", "2025-12-31");
    // M7: R$ 0,01 em 12 dias, 6 no período. Rateio exato (por anúncio, card) = 0,5 -> 1;
    // dia a dia (período, 2A) = 6 × 0,0833… -> 0. O relatório repete o card nos dois.
    const rateio = await comparar("rateio com meio centavo (só informado)", "2025-11-01", "2025-11-06");
    ok(rateio.por_anuncio.find((x) => x.ad_id === B)?.gasto_centavos === 1 && rateio.gasto.total_centavos === 0 && rateio.gasto.fonte === "manual",
       `rateio: por anúncio 1 centavo, período 0 (as duas fórmulas do card) (${JSON.stringify(rateio.gasto)})`);
    const agora = await comparar("últimos 3 dias (teste em andamento)", hoje(-2), h);
    ok(agora.funil_whatsapp.em_teste_agora === 1 && agora.amadurecendo.cadastros_em_teste === 2 && agora.funil_whatsapp.teste_acabou_sem_pagar === 1,
       `teste em andamento: em teste 1, amadurecendo 2 (inclui o cancelado), acabou sem pagar 1 (${JSON.stringify(agora.funil_whatsapp)} ${JSON.stringify(agora.amadurecendo)})`);

    // ---------------- só agregados ----------------
    const tudo = JSON.stringify([vazio, ano, jan, misto, fev, agora]);
    ok(!/00000000-0000-0000-0000-|\+5511|@|fbc-x|telefone|nome|email|user_id/i.test(tudo), "resposta sem uuid, telefone, e-mail, nome ou fbclid");
    ok(Object.keys(jan).sort().join() === "amadurecendo,cadastros,custos,funil_whatsapp,gasto,periodo,periodo_anterior,por_anuncio,receita_estimada_centavos",
       `chaves do relatório (${Object.keys(jan).sort().join()})`);
    ok(jan.por_anuncio.length > 0 && jan.por_anuncio.every((x) => Object.keys(x).sort().join()
       === "ad_id,assinantes,cadastros,conversas,custo_por_conversa_centavos,gasto_centavos,rotulo,teste"),
       "por anúncio: só ad_id, rótulo e números");

    // ---------------- validação de período ----------------
    await como("service_role");
    ok(/22023/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $2::date)", [hoje(-1), hoje(1)])), "recusa data futura");
    ok(/22023/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $2::date)", [hoje(-401), h])), "recusa mais de 400 dias");
    ok(!(await erro("SELECT public.crm_relatorio_marketing($1::date, $2::date)", [hoje(-400), h])), "aceita 401 dias (fim − início = 400, como o card)");
    ok(/22023/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $2::date)", [h, hoje(-1)])), "recusa fim antes do início");
    ok(/22023/.test(await erro("SELECT public.crm_relatorio_marketing(NULL, $1::date)", [h])), "recusa data nula");

    // ---------------- privilégios ----------------
    ok(/permission denied/.test(await erro("SELECT public._crm_rel_funil($1::date, $1::date)", [h])), "service_role não chama a interna do funil");
    ok(/permission denied/.test(await erro("SELECT public._crm_rel_cadastros($1::date, $1::date)", [h])), "service_role não chama a interna de cadastros");
    await como("authenticated", ADMIN);
    ok(/permission denied/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $1::date)", [h])), "admin logado (authenticated) não chama o relatório");
    ok(/permission denied/.test(await erro("SELECT public._crm_rel_funil($1::date, $1::date)", [h])), "authenticated não chama a interna");
    await como("anon");
    ok(/permission denied/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $1::date)", [h])), "anon não chama o relatório");
    await db.exec("RESET ROLE");
    // O EXECUTE do service_role vem do GRANT da migration, não só do padrão do Supabase:
    await db.exec("REVOKE EXECUTE ON FUNCTION public.crm_relatorio_marketing(date, date) FROM service_role;");
    await db.exec(s.mig);
    await como("service_role");
    ok(!(await erro("SELECT public.crm_relatorio_marketing($1::date, $1::date)", [h])), "reaplicar a migration devolve o EXECUTE ao service_role (GRANT explícito)");
    await db.exec("RESET ROLE");

    // Meses na regra antiga (mesmos N dias): só para provar que a regra nova é que muda
    const MESES = [
      ["novembro × outubro", "2025-11-01", "2025-11-30", "2025-10-01", "2025-10-31"],
      ["março × fevereiro (28 dias)", "2026-03-01", "2026-03-31", "2026-02-01", "2026-02-28"],
      ["março × fevereiro bissexto (29 dias)", "2024-03-01", "2024-03-31", "2024-02-01", "2024-02-29"],
      ["fevereiro bissexto × janeiro", "2024-02-01", "2024-02-29", "2024-01-01", "2024-01-31"],
      ["janeiro × dezembro do ano anterior", "2026-01-01", "2026-01-31", "2025-12-01", "2025-12-31"],
      ["fevereiro × janeiro (personalizado que coincide com o mês)", "2026-02-01", "2026-02-28", "2026-01-01", "2026-01-31"],
      ["outubro × setembro (gasto informado entre os dois)", "2025-10-01", "2025-10-31", "2025-09-01", "2025-09-30"],
    ];
    const NAO_MES = [
      ["mês incompleto (01–15/01)", "2026-01-01", "2026-01-15"],
      ["semana seg–dom", "2025-12-29", "2026-01-04"],
      ["“mês” que não começa no dia 1 (15/02–14/03)", "2026-02-15", "2026-03-14"],
      ["dezembro até o dia 30", "2025-12-01", "2025-12-30"],
    ];
    for (const [nome, ini, fim] of MESES) {
      const r = await comparar(`regra antiga: ${nome}`, ini, fim);
      ok(r.periodo_anterior.inicio === somarDias(ini, -diasNoIntervalo({ inicio: ini, fim })), `regra antiga: ${nome} compara com os mesmos N dias`);
    }

    // ---------------- 20261123130000: mês × mês de calendário anterior ----------------
    const relAntigo = await defs(["crm_relatorio_marketing"]);
    const internasAntes = await defs(["_crm_rel_cadastros", "_crm_rel_funil"]);
    const comentario = async () => (await q("SELECT obj_description('public.crm_relatorio_marketing(date, date)'::regprocedure, 'pg_proc') c"))[0].c;
    const comentarioAntigo = await comentario();
    if (comVerificacao) await tudoOk(CONFERIR_MES, "relatorio-mes-0-conferir-producao (antes)");
    await db.exec(s.mes);
    if (comVerificacao) await tudoOk(VERIFICAR_MES, "relatorio-mes-1-verificar");
    // 2ª aplicação com o EXECUTE bagunçado: a migration fecha authenticated e devolve service_role
    await db.exec("GRANT EXECUTE ON FUNCTION public.crm_relatorio_marketing(date, date) TO authenticated;"
      + " REVOKE EXECUTE ON FUNCTION public.crm_relatorio_marketing(date, date) FROM service_role;");
    await db.exec(s.mes);
    if (comVerificacao) await tudoOk(VERIFICAR_MES, "relatorio-mes-1-verificar (2ª aplicação: idempotente, privilégios refeitos)");
    ok(await defs(["_crm_rel_cadastros", "_crm_rel_funil"]) === internasAntes, "regra do mês: internas idênticas (código e privilégios)");
    ok(await defs(FONTES) === fontesAntes, "regra do mês: as 8 funções do card idênticas");
    ok(/mês de calendário anterior inteiro/.test(await comentario() ?? ""), "regra do mês: COMMENT descreve a regra nova");
    await como("authenticated", ADMIN);
    ok(/permission denied/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $1::date)", [h])), "regra do mês: authenticated não chama");
    await como("anon");
    ok(/permission denied/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $1::date)", [h])), "regra do mês: anon não chama");
    await como("service_role");
    ok(!(await erro("SELECT public.crm_relatorio_marketing($1::date, $1::date)", [h])), "regra do mês: service_role chama");
    ok(/permission denied/.test(await erro("SELECT public._crm_rel_funil($1::date, $1::date)", [h])), "regra do mês: internas continuam fechadas");
    ok(/22023/.test(await erro("SELECT public.crm_relatorio_marketing($1::date, $2::date)", [hoje(-1), hoje(1)])), "regra do mês: recusa data futura");
    await db.exec("RESET ROLE");

    regraMes = true;
    for (const [nome, ini, fim, aIni, aFim] of MESES) {
      const r = await comparar(`regra do mês: ${nome}`, ini, fim);
      ok(r.periodo_anterior.inicio === aIni && r.periodo_anterior.fim === aFim && r.periodo.dias === diasNoIntervalo({ inicio: ini, fim }),
         `regra do mês: ${nome} -> anterior ${aIni}..${aFim}, dias do atual (${JSON.stringify(r.periodo)} ${JSON.stringify(r.periodo_anterior)})`);
    }
    for (const [nome, ini, fim] of NAO_MES) {
      const r = await comparar(`regra do mês: ${nome}`, ini, fim);
      const n = diasNoIntervalo({ inicio: ini, fim });
      ok(r.periodo_anterior.inicio === somarDias(ini, -n) && r.periodo_anterior.fim === somarDias(ini, -1),
         `regra do mês: ${nome} continua com os mesmos ${n} dias antes (${JSON.stringify(r.periodo_anterior)})`);
    }
    // Todos os períodos da 1ª rodada de novo, na regra nova
    for (const [ini, fim] of [["2025-06-02", "2025-06-08"], ["2026-01-31", "2026-02-01"], ["2026-01-07", "2026-01-09"],
                              ["2026-01-12", "2026-01-25"], ["2025-12-31", "2025-12-31"], ["2025-11-01", "2025-11-06"], [hoje(-2), h]]) {
      await comparar(`regra do mês: ${ini}..${fim}`, ini, fim);
    }
    // Números conferidos à mão (o anterior tem outro tamanho que o atual)
    const nov = await relatorio("2025-11-01", "2025-11-30");
    ok(nov.cadastros.anterior.total === 1 && nov.funil_whatsapp.anterior.conversas_iniciadas === 1 && nov.funil_whatsapp.anterior.cadastros === 1,
       `novembro: o anterior (outubro inteiro) pega o cadastro e a conversa de 01/10 (${JSON.stringify(nov.cadastros.anterior)} ${JSON.stringify(nov.funil_whatsapp.anterior)})`);
    const mar24 = await relatorio("2024-03-01", "2024-03-31");
    ok(mar24.cadastros.anterior.total === 1 && mar24.funil_whatsapp.anterior.conversas_iniciadas === 1,
       `março/2024: o anterior (fevereiro bissexto, 29 dias) pega 29/02 e não 31/01 (${JSON.stringify(mar24.cadastros.anterior)})`);
    ok(mar24.gasto.manual_centavos === 3 && (await relatorio("2024-02-01", "2024-02-29")).gasto.manual_centavos === 4,
       "rateio entre meses: R$ 0,07 em 7 dias = 3 centavos em março/2024 e 4 em fevereiro/2024 (29 dias)");
    const out = await relatorio("2025-10-01", "2025-10-31");
    ok(out.gasto.manual_centavos === 400 && (await relatorio("2025-09-01", "2025-09-30")).gasto.manual_centavos === 600,
       `rateio entre meses: R$ 10,00 em 10 dias = R$ 4,00 em outubro (31 dias) e R$ 6,00 em setembro (30) (${out.gasto.manual_centavos})`);
    const dez = await relatorio("2025-12-01", "2025-12-30");
    ok(dez.periodo_anterior.inicio === "2025-11-01" && dez.periodo_anterior.fim === "2025-11-30",
       "dezembro até o dia 30: 30 dias antes = 01–30/11 (não é a regra do mês, mas coincide)");
    const jan15 = await relatorio("2026-01-01", "2026-01-15");
    ok(jan15.cadastros.anterior.total === 1, `mês incompleto 01–15/01: anterior 17–31/12 (só o de 31/12, não o de 10/12) (${JSON.stringify(jan15.cadastros.anterior)})`);
    regraMes = false;

    // ---------------- rollback da regra do mês ----------------
    await db.exec(s.rollbackMes);
    ok(await defs(["crm_relatorio_marketing"]) === relAntigo, "rollback do mês: crm_relatorio_marketing volta ao texto e aos privilégios da 20261123120000");
    ok(await comentario() === comentarioAntigo, "rollback do mês: COMMENT antigo de volta");
    ok((await q("SELECT count(*)::int n FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = ANY($1)", [NOVAS]))[0].n === 3,
       "rollback do mês: não apaga nenhuma função");
    ok(await defs(["_crm_rel_cadastros", "_crm_rel_funil"]) === internasAntes, "rollback do mês: internas intactas");
    if (comVerificacao) await tudoOk(VERIFICAR, "relatorio-1-verificar (depois do rollback do mês)");
    await comparar("depois do rollback do mês: novembro volta aos 30 dias antes", "2025-11-01", "2025-11-30");

    // ---------------- rollback ----------------
    await db.exec(s.rollback);
    ok((await q("SELECT count(*)::int n FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = ANY($1)", [NOVAS]))[0].n === 0,
       "rollback apaga as 3 funções novas");
    ok(await defs(FONTES) === fontesAntes, "rollback não mexe nas funções do card");
    await tudoOk(CONFERIR, "relatorio-0-conferir-producao (depois do rollback)");
  } catch (e) {
    ok(false, `exceção: ${e.message}`);
  } finally {
    await db.close();
  }
  return falhas;
}

function estaticas() {
  const falhas = [];
  const ok = (cond, msg) => { if (!cond) falhas.push(msg); console.log(`${cond ? "OK   " : "FALHA"} ${msg}`); };
  const sc = ORIG.mig.replace(/--.*$/gm, "");
  ok(/^\s*BEGIN;\s*SET LOCAL lock_timeout = '3s';\s*SET LOCAL statement_timeout = '60s';/m.test(sc) && /COMMIT;\s*$/.test(sc),
     "migration com BEGIN, lock_timeout 3s, statement_timeout e COMMIT");
  ok([...sc.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((m) => m[1]).join() === NOVAS.join(),
     "só cria as 3 funções novas (CREATE OR REPLACE)");
  ok(!/\b(ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b|CREATE TABLE|CREATE INDEX/i.test(sc), "não altera tabela nem dado; nenhum DROP");
  ok([...sc.matchAll(/\bGRANT\b[^;]*\bTO\s+([^;]+);/gi)].map((m) => m[1].trim()).join() === "service_role",
     "único GRANT: EXECUTE do relatório para service_role");
  ok(!/telefone|email|\bnome\b|wa_jid|resumo|texto/i.test(sc), "migration não lê telefone, e-mail, nome nem texto de lead");
  ok(ORIG.rollback.includes("NÃO RODE — SÓ EM EMERGÊNCIA") && NOVAS.every((n) => ORIG.rollback.includes(`DROP FUNCTION IF EXISTS public.${n}(`)),
     "rollback marcado NÃO RODE; apaga as 3 funções");
  ok(!/CREATE|ALTER|TABLE/i.test(ORIG.rollback.replace(/--.*$/gm, "")), "rollback não cria nem altera nada");
  ok(!/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i.test((CONFERIR + VERIFICAR + CONFERIR_MES + VERIFICAR_MES).replace(/--.*$/gm, "").replace(/'[^']*'/g, "")),
     "conferências e verificações (inclusive as do mês) são só leitura");
  ok(CONFERIR.includes("90777d7132e49d03e0959406bf4d5635") && VERIFICAR.includes("90777d7132e49d03e0959406bf4d5635")
     && !(CONFERIR + VERIFICAR).replace(/--.*$/gm, "").includes("d9e7a4aac4de5d5ca235a5017db53da8"),
     "admin_mkt_origens: esperado = md5 de produção nos 2 scripts (o do repositório só no comentário)");
  // migration do mês
  const funcao = (sql) => sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.crm_relatorio_marketing"), sql.indexOf("$$;\n", sql.indexOf("CREATE OR REPLACE FUNCTION public.crm_relatorio_marketing")) + 3);
  const mm = ORIG.mes.replace(/--.*$/gm, "");
  ok(/^\s*BEGIN;\s*SET LOCAL lock_timeout = '3s';\s*SET LOCAL statement_timeout = '60s';/m.test(mm) && /COMMIT;\s*$/.test(mm),
     "migration do mês com BEGIN, lock_timeout 3s, statement_timeout e COMMIT");
  ok([...mm.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((m) => m[1]).join() === "crm_relatorio_marketing",
     "migration do mês: só CREATE OR REPLACE de crm_relatorio_marketing");
  ok(!/\b(ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b|CREATE TABLE|FUNCTION public\._crm_rel_/i.test(mm),
     "migration do mês: nenhum DROP/ALTER/dado; não toca as internas");
  ok([...mm.matchAll(/\bGRANT\b[^;]*\bTO\s+([^;]+);/gi)].map((m) => m[1].trim()).join() === "service_role",
     "migration do mês: único GRANT para service_role");
  const antiga = funcao(ORIG.mig), nova = funcao(ORIG.mes);
  const trocaDe = "  v_aini := p_inicio - v_dias;\n";
  const semTroca = nova.replace(/  -- Período anterior\.[\s\S]*?  END IF;\n/, trocaDe);
  ok(semTroca === antiga && nova !== antiga, "migration do mês: função idêntica à da 20261123120000, exceto o cálculo de v_aini");
  ok(funcao(ORIG.rollbackMes) === antiga, "rollback do mês: função com o texto EXATO da 20261123120000");
  ok(!/\bDROP\b|CREATE TABLE|FUNCTION public\._crm_rel_/i.test(ORIG.rollbackMes.replace(/--.*$/gm, "")) && ORIG.rollbackMes.includes("NÃO RODE — SÓ EM EMERGÊNCIA"),
     "rollback do mês: marcado NÃO RODE, nenhum DROP, não toca as internas");
  return falhas;
}

// ---------------------------------------------------------------------------
// Mutantes: cada um TEM que derrubar a suíte (rodam sem a verificação 1, que
// compara o md5 e mataria qualquer mutante sem provar nada).
// ---------------------------------------------------------------------------
const MUTANTES = [
  { nome: "cadastros contam funcionário", de: "      AND NOT EXISTS (SELECT 1 FROM public.loja_funcionarios f WHERE f.funcionario_user_id = p.user_id)\n", para: "" },
  { nome: "cadastros contam demonstração", de: "          AND a.plano_tipo IN ('demonstracao', 'admin')", para: "          AND a.plano_tipo IN ('admin')" },
  { nome: "vindos_meta sem fbclid", de: "      (p.fbclid IS NOT NULL\n         OR p.utm_source", para: "      (p.utm_source" },
  { nome: "com_utm conta utm vazio", de: "(p.utm_source IS NOT NULL AND p.utm_source <> '')", para: "(p.utm_source IS NOT NULL)" },
  { nome: "cadastros em UTC (sem fuso de Brasília)", de: "    WHERE p.created_at >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo')\n      AND p.created_at <  ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')",
    para: "    WHERE p.created_at >= (p_inicio::timestamp AT TIME ZONE 'UTC')\n      AND p.created_at <  ((p_fim + 1)::timestamp AT TIME ZONE 'UTC')" },
  { nome: "funil em UTC (sem fuso de Brasília)", de: "  v_ini timestamptz := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';", para: "  v_ini timestamptz := p_inicio::timestamp AT TIME ZONE 'UTC';" },
  { nome: "receita pega o último pagamento", de: "ORDER BY ev.user_id, ev.ts, ev.ordem", para: "ORDER BY ev.user_id, ev.ts DESC, ev.ordem" },
  { nome: "receita: empate vai para o cartão", de: "ORDER BY ev.user_id, ev.ts, ev.ordem", para: "ORDER BY ev.user_id, ev.ts, ev.ordem DESC" },
  { nome: "receita conta bloqueado pelo admin", de: "      WHERE x.user_id = ev.user_id AND x.bloqueado_admin = true", para: "      WHERE false" },
  { nome: "funil conta quem a loja chamou primeiro", de: "     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim\n       AND l.primeiro_contato_direcao = 'entrada'\n  ),\n  pag AS (\n    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p\n  )\n  SELECT jsonb_build_object(",
    para: "     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim\n  ),\n  pag AS (\n    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p\n  )\n  SELECT jsonb_build_object(" },
  { nome: "funil: janela de 24 h vira 12 h", de: "interval '24 hours') AS novo_cadastro", para: "interval '12 hours') AS novo_cadastro" },
  { nome: "funil por anúncio conta quem a loja chamou primeiro", de: "       AND l.primeiro_contato_direcao = 'entrada'\n  ),\n  pag AS (\n    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p\n  ),\n  gasto_inf",
    para: "  ),\n  pag AS (\n    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p\n  ),\n  gasto_inf" },
  { nome: "em teste conta quem cancelou", de: "AND t.free_trial_ends_at > now() AND t.trial_canceled IS NOT TRUE)),", para: "AND t.free_trial_ends_at > now())),", },
  { nome: "acabou sem pagar conta pagante", de: "                             AND NOT EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid)),", para: ")," },
  { nome: "amadurecendo sem quem cancelou", de: "SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at > now()))\n  )",
    para: "SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at > now() AND t.trial_canceled IS NOT TRUE))\n  )" },
  { nome: "assinante = qualquer cadastro novo", de: "    'assinantes_pagos',    count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid)),", para: "    'assinantes_pagos',    count(*) FILTER (WHERE c.novo_cadastro)," },
  { nome: "período anterior com 1 dia a mais", de: "v_aini := p_inicio - v_dias;", para: "v_aini := p_inicio - v_dias - 1;" },
  { nome: "relatório aceita data futura", de: "OR p_fim - p_inicio > 400 OR p_fim > v_hoje THEN", para: "OR p_fim - p_inicio > 400 THEN" },
  { nome: "informado não some no dia automático do mesmo anúncio", de: "          AND (m.g_ad IS NULL OR x.a_ad = m.g_ad))", para: "          AND m.g_ad IS NULL)" },
  { nome: "informado geral não some no dia com automático", de: "          AND (m.g_ad IS NULL OR x.a_ad = m.g_ad))", para: "          AND x.a_ad = m.g_ad)" },
  { nome: "gasto automático em USD entra", de: "     WHERE a.data BETWEEN p_inicio AND p_fim AND a.moeda = 'BRL'\n  ),\n  manual_dia", para: "     WHERE a.data BETWEEN p_inicio AND p_fim\n  ),\n  manual_dia" },
  { nome: "informado vence o automático (fonte)", de: "CASE WHEN v_g.dias_auto > 0 THEN 'automatico' WHEN v_g.lancamentos > 0 THEN 'manual'", para: "CASE WHEN v_g.lancamentos > 0 THEN 'manual' WHEN v_g.dias_auto > 0 THEN 'automatico'" },
  { nome: "total automático sem o informado efetivo", de: "WHEN 'automatico' THEN v_g.auto_centavos + v_g.manual_centavos", para: "WHEN 'automatico' THEN v_g.auto_centavos" },
  { nome: "custo por cadastro divide por conversas", de: "THEN round(v_total::numeric / (v_fun->>'cadastros')::bigint)::bigint END,", para: "THEN round(v_total::numeric / (v_fun->>'conversas_iniciadas')::bigint)::bigint END," },
  { nome: "custo arredonda para baixo", de: "THEN round(v_total::numeric / (v_fun->>'assinantes_pagos')::bigint)::bigint END)", para: "THEN trunc(v_total::numeric / (v_fun->>'assinantes_pagos')::bigint)::bigint END)" },
  { nome: "por anúncio: sem automático usa o rateio da 2A", de: "WHEN NOT md.com_auto THEN CASE WHEN l.gasto_informado > 0 THEN l.gasto_informado END", para: "WHEN false THEN NULL" },
  { nome: "por anúncio soma informado no dia automático", de: "\n       AND NOT EXISTS (SELECT 1 FROM auto x WHERE x.a_ad = g.ad_id AND x.a_dia = greatest(g.inicio, p_inicio) + k)", para: "" },
  { nome: "por anúncio sem as linhas de gasto sem conversa", de: "     WHERE md.com_auto\n       AND NOT EXISTS", para: "     WHERE false\n       AND NOT EXISTS" },
  { nome: "por anúncio conta teste só pelo trial_started_at", de: "SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at IS NOT NULL UNION ALL\n        ", para: "" },
  { nome: "por anúncio ordenado por conversas", de: "ORDER BY t.gasto DESC NULLS LAST, t.conversas DESC, t.ad)", para: "ORDER BY t.conversas DESC, t.ad)" },
  { nome: "rótulo do orgânico trocado", de: "THEN 'Sem anúncio (orgânico / link direto)'", para: "THEN 'Orgânico'" },
  { nome: "relatório sem REVOKE de authenticated", de: "REVOKE ALL ON FUNCTION public.crm_relatorio_marketing(date, date) FROM PUBLIC, anon, authenticated;", para: "REVOKE ALL ON FUNCTION public.crm_relatorio_marketing(date, date) FROM PUBLIC, anon;" },
  { nome: "interna liberada para service_role", de: "REVOKE ALL ON FUNCTION public._crm_rel_funil(date, date)          FROM PUBLIC, anon, authenticated, service_role;", para: "REVOKE ALL ON FUNCTION public._crm_rel_funil(date, date)          FROM PUBLIC, anon, authenticated;" },
  { nome: "relatório sem GRANT para service_role", de: "GRANT EXECUTE ON FUNCTION public.crm_relatorio_marketing(date, date) TO service_role;", para: "" },
  { nome: "rollback sem apagar o relatório", alvo: "rollback", de: "DROP FUNCTION IF EXISTS public.crm_relatorio_marketing(date, date);", para: "" },
  // 20261123130000: mês × mês anterior
  { nome: "mês: regra do mês desligada (volta a N dias)", alvo: "mes", de: "  IF extract(day FROM p_inicio) = 1\n", para: "  IF false AND extract(day FROM p_inicio) = 1\n" },
  { nome: "mês: sem checar o último dia (mês incompleto vira mês)", alvo: "mes",
    de: "  IF extract(day FROM p_inicio) = 1\n     AND p_fim = (p_inicio::timestamp + interval '1 month')::date - 1 THEN", para: "  IF extract(day FROM p_inicio) = 1 THEN" },
  { nome: "mês: sem checar o dia 1 (15/02–14/03 vira mês)", alvo: "mes",
    de: "  IF extract(day FROM p_inicio) = 1\n     AND p_fim = (p_inicio::timestamp + interval '1 month')::date - 1 THEN", para: "  IF p_fim = (p_inicio::timestamp + interval '1 month')::date - 1 THEN" },
  { nome: "mês: anterior começa no dia 2", alvo: "mes", de: "v_aini := (p_inicio::timestamp - interval '1 month')::date;", para: "v_aini := (p_inicio::timestamp - interval '1 month')::date + 1;" },
  { nome: "mês: anterior = 30 dias", alvo: "mes", de: "v_aini := (p_inicio::timestamp - interval '1 month')::date;", para: "v_aini := p_inicio - 30;" },
  { nome: "mês: anterior = 31 dias", alvo: "mes", de: "v_aini := (p_inicio::timestamp - interval '1 month')::date;", para: "v_aini := p_inicio - 31;" },
  { nome: "mês: fim do anterior no 1º dia do atual", alvo: "mes", de: "  v_afim := p_inicio - 1;\n  -- Período anterior.", para: "  v_afim := p_inicio;\n  -- Período anterior." },
  { nome: "mês: periodo.dias = dias do anterior", alvo: "mes", de: "jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias', v_dias)", para: "jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias', v_afim - v_aini + 1)" },
  { nome: "mês: sem REVOKE (authenticated aberto continua aberto)", alvo: "mes", de: "\nREVOKE ALL ON FUNCTION public.crm_relatorio_marketing(date, date) FROM PUBLIC, anon, authenticated;", para: "" },
  { nome: "mês: sem GRANT para service_role", alvo: "mes", de: "\nGRANT EXECUTE ON FUNCTION public.crm_relatorio_marketing(date, date) TO service_role;", para: "" },
  { nome: "mês: COMMENT sem a regra nova", alvo: "mes", de: "mês de calendário inteiro compara com o mês de calendário anterior inteiro; outros períodos, com", para: "compara com" },
  { nome: "rollback do mês mantém a regra do mês", alvo: "rollbackMes", de: "  v_aini := p_inicio - v_dias;\n",
    para: "  IF extract(day FROM p_inicio) = 1 AND p_fim = (p_inicio::timestamp + interval '1 month')::date - 1 THEN\n    v_aini := (p_inicio::timestamp - interval '1 month')::date;\n  ELSE\n    v_aini := p_inicio - v_dias;\n  END IF;\n" },
  { nome: "rollback do mês sem o COMMENT antigo", alvo: "rollbackMes", de: "COMMENT ON FUNCTION public.crm_relatorio_marketing(date, date) IS", para: "SELECT" },
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
  const hsAntiga = (await db.query(`SELECT md5(regexp_replace(prosrc, '\\s+', ' ', 'g')) h FROM pg_proc WHERE proname = 'crm_relatorio_marketing'`)).rows[0].h;
  await db.exec(ORIG.mes);
  console.log("crm_relatorio_marketing antiga / mês:", hsAntiga, "/", (await db.query(`SELECT md5(regexp_replace(prosrc, '\\s+', ' ', 'g')) h FROM pg_proc WHERE proname = 'crm_relatorio_marketing'`)).rows[0].h);
  const hs = async (nomes) => (await db.query(`SELECT proname, md5(regexp_replace(prosrc, '\\s+', ' ', 'g')) h FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = ANY($1) ORDER BY proname`, [nomes])).rows;
  console.log("fontes:", JSON.stringify(await hs(FONTES)));
  console.log("fontes (string_agg):", (await hs(FONTES)).map((r) => r.h).join(" / "));
  console.log("novas (string_agg):", (await hs(NOVAS)).map((r) => r.h).join(" / "));
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
    for (const x of f.slice(0, 2)) console.log(`        · ${x.split("\n")[0].slice(0, 130)}`);
  }
  console.log(`(${MUTANTES.length} mutantes)`);
}
const total = falhasEst.length + falhas.length + falhasMut;
console.log(total === 0 ? "\nTUDO OK" : `\n${total} FALHA(S)`);
process.exit(total ? 1 : 0);
