// CRM de leads — FASE 2A (gasto da Meta por anúncio, automático) — prova num
// Postgres 17 LOCAL (PGlite, WebAssembly). Não toca produção. Dados 100%
// fictícios.
//
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-2a.mjs              # suíte
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-2a.mjs --mutantes   # + mutantes
//   PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-2a.mjs --hashes     # md5 do 2a-1
//
// Carrega as migrations REAIS da fase 1 (SQL 1, 2 e 3), da 1C e da 1D, grava
// dados, roda a conferência 2A, aplica a 2A duas vezes e cobre: automático e
// manual no mesmo anúncio/dia (só o automático vale), manual geral em dia com
// qualquer linha automática (ignorado), só manual, só automático, dia com
// gasto 0, dia sem gasto, moeda que não é BRL, linha fora do período, reenvio
// do mesmo dia (atualiza, conta como atualizado, mexe no atualizado_em),
// valores inválidos (rejeitados por item, os bons gravam), lote grande,
// privilégios (anon / authenticated não-admin / PUBLIC / tabela sem acesso
// direto), funções da 1D intactas e com o MESMO resultado com dado
// automático gravado, rollback exato.
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
  mig: ler("supabase/migrations/20261122120000_crm_leads_2a_gasto_meta_anuncio.sql"),
  rollback: ler("scripts/crm-leads/rollback-2a.sql"),
};
const META_ADS = ler("supabase/migrations/20261024130000_meta_ads_cache.sql");
const CONFERIR = ler("scripts/crm-leads/2a-0-conferir-producao.sql");
const VERIFICAR = ler("scripts/crm-leads/2a-1-verificar.sql");

const t1 = ler("scripts/crm-leads/teste-pglite.mjs");
const BASE = t1.slice(t1.indexOf("const BASE = `") + 14, t1.indexOf("`;", t1.indexOf("const BASE = `")));
const COLUNAS_TESTE = `
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS trial_canceled boolean DEFAULT false;
  ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS free_trial_ends_at timestamptz DEFAULT NULL;`;
// Privilégios padrão do Supabase: tabela e função nova nascem abertas para
// anon/authenticated. A 2A tem que fechar as duas coisas.
const PADRAO_SUPABASE = `
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`;

const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(900), COMUM = U(901);
const ANTIGAS = ["admin_crm_funil", "admin_crm_funil_por_anuncio", "admin_crm_funil_teste", "admin_crm_funil_excluidos",
  "admin_crm_gasto_informar", "admin_crm_gasto_remover", "crm_ingerir_mensagens", "_crm_pagantes"];
const NOVAS = ["crm_gravar_gasto_meta", "admin_crm_funil_gasto", "admin_crm_funil_gasto_por_anuncio"];
const A = "120000000000001", B = "120000000000002", C = "120000000000003", D = "120000000000004", E = "120000000000005";

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
  const defs = async (nomes) => Object.fromEntries((await q(`
    SELECT p.proname, p.prosrc, pg_get_function_arguments(p.oid) a, pg_get_function_result(p.oid) r,
           p.prosecdef, p.provolatile, p.proconfig, p.proacl::text acl
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1)`, [nomes])).map((x) => [x.proname, x]));
  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, k !== "ad_id" && (typeof x === "bigint" || /^\d+$/.test(String(x))) ? Number(x) : x]));
  const gravar = async (itens) => (await q("SELECT public.crm_gravar_gasto_meta($1::jsonb) AS r", [JSON.stringify(itens)]))[0].r;
  const P = "h - 9, h"; // período do card nos testes: D0..D9
  const gasto = async (per = P) => num((await q(`SELECT * FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date h) x, admin_crm_funil_gasto(${per})`))[0]);
  const gastoAd = async (per = P) => (await q(`SELECT g.* FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date h) x, admin_crm_funil_gasto_por_anuncio(${per}) g`)).map(num);
  const funilAntigo = async () => JSON.stringify(await q(`SELECT f.* FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date h) x, admin_crm_funil(h - 9, h) f`))
    + JSON.stringify(await q(`SELECT f.* FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date h) x, admin_crm_funil_por_anuncio(h - 9, h) f`))
    + JSON.stringify(await q(`SELECT f.* FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date h) x, admin_crm_funil_teste(h - 9, h) f`));

  try {
    await db.exec(BASE);
    await db.exec(COLUNAS_TESTE);
    await db.exec(PADRAO_SUPABASE);
    await db.exec(META_ADS);
    for (const sql of ANTERIORES) await db.exec(sql);
    const [{ h }] = await q("SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') h");
    const dia = (n) => { const d = new Date(`${h}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 9 + n); return d.toISOString().slice(0, 10); };

    // ---------------- dados das fases anteriores ----------------
    await db.exec(`INSERT INTO user_roles VALUES ('${ADMIN}', 'admin');`);
    // Gasto informado (direto na tabela; D0..D9 = h-9..h):
    //  M1 anúncio A, D0..D9, R$ 100,00 -> 1.000 c/dia
    //  M2 anúncio B, D0..D4, R$ 50,00  -> 1.000 c/dia (só manual)
    //  M3 GERAL,     D5..D9, R$ 25,00  ->   500 c/dia
    //  M4 anúncio D, D0..D2, R$ 10,00  -> 333,33… c/dia (arredondamento)
    //  M5 anúncio A, removido (não conta)
    await db.exec(`INSERT INTO crm_gasto_manual (inicio, fim, ad_id, valor, removido_em) VALUES
      ('${dia(0)}', '${dia(9)}', '${A}', 100.00, NULL),
      ('${dia(0)}', '${dia(4)}', '${B}',  50.00, NULL),
      ('${dia(5)}', '${dia(9)}', NULL,    25.00, NULL),
      ('${dia(0)}', '${dia(2)}', '${D}',  10.00, NULL),
      ('${dia(0)}', '${dia(9)}', '${A}', 999.00, now());`);
    // um lead com anúncio A, para o funil antigo ter linha
    await como("service_role");
    await q("SELECT public.crm_ingerir_mensagens($1::jsonb)", [JSON.stringify([{ telefone: "5511990000101", wa_message_id: "m1",
      direcao: "entrada", autor: "lead", tipo: "texto", texto: "oi", enviada_em: new Date(Date.now() - 3600_000).toISOString(),
      referral: { ad_id: A, titulo: "Anúncio A (ficticio)" } }])]);
    await db.exec("RESET ROLE");
    const antigasAntes = await defs(ANTIGAS);
    await como("authenticated", ADMIN);
    const funilAntes = await funilAntigo();
    ok(/does not exist/.test(await erro("SELECT * FROM admin_crm_funil_gasto(current_date - 1, current_date)")), "antes da 2A a função nova não existe");

    // ---------------- conferência, aplicação 2x, verificação ----------------
    await db.exec("RESET ROLE");
    const conf = await tudoOk(CONFERIR, "2a-0-conferir-producao (antes)");
    const info7 = conf.find((l) => l.item.startsWith("7."))?.encontrado ?? "";
    ok(info7 === "com anúncio 3 · geral 1", `conferência informa o gasto informado ativo (${info7})`);
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "2a-1-verificar");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "2a-1-verificar (depois da 2ª aplicação: idempotente)");

    // ---------------- só manual: igual ao funil antigo ----------------
    await como("authenticated", ADMIN);
    const [velho] = (await q(`SELECT f.* FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date h) x, admin_crm_funil(h - 9, h) f`)).map(num);
    let g = await gasto();
    ok(g.gasto_auto_centavos === 0 && g.dias_auto === 0 && g.anuncios_auto === 0 && g.atualizado_em === null,
       "sem linha automática: automático zerado, atualizado_em nulo");
    ok(g.gasto_manual_efetivo_centavos === velho.gasto_manual_centavos && g.gasto_manual_efetivo_centavos === 10000 + 5000 + 2500 + 1000,
       `sem automático o informado efetivo = gasto_manual do funil antigo (${g.gasto_manual_efetivo_centavos} = ${velho.gasto_manual_centavos})`);
    ok(g.lancamentos_manuais_efetivos === velho.gasto_manual_lancamentos && g.lancamentos_manuais_efetivos === 4, "lançamentos = os do funil antigo (4; removido fora)");
    // período parcial: rateio igual ao antigo (D1..D9 pega 2/3 de M4 = 666,67 -> 667)
    const [velhoParcial] = (await q(`SELECT f.* FROM (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date h) x, admin_crm_funil(h - 8, h) f`)).map(num);
    const gParcial = await gasto("h - 8, h");
    ok(gParcial.gasto_manual_efetivo_centavos === velhoParcial.gasto_manual_centavos && gParcial.gasto_manual_efetivo_centavos === 9000 + 4000 + 2500 + 667,
       `período parcial: rateio igual ao funil antigo (${gParcial.gasto_manual_efetivo_centavos} = ${velhoParcial.gasto_manual_centavos})`);

    // ---------------- gravação (service_role) ----------------
    await como("service_role");
    const r1 = await gravar([
      { ad_id: A, data: dia(2), gasto_centavos: 3000, impressoes: 1000, cliques: 50, conversas_meta: 4, campaign_id: "120000000000900" },
      { ad_id: A, data: dia(3), gasto_centavos: 4000, impressoes: 1500, cliques: 60, conversas_meta: 5 },
      { ad_id: C, data: dia(7), gasto_centavos: 0 },                                      // dia com gasto 0
      { ad_id: C, data: dia(8), gasto_centavos: 2500, impressoes: 800, cliques: 20, conversas_meta: 2, moeda: "BRL" },
      { ad_id: E, data: dia(5), gasto_centavos: 9999, moeda: "USD" },                     // outra moeda: guarda, não conta
      { ad_id: A, data: dia(-6), gasto_centavos: 7777 },                                  // fora do período do card
    ]);
    ok(r1.inseridos === 6 && r1.atualizados === 0 && r1.rejeitadas.length === 0, `1º envio: 6 inseridos (${JSON.stringify(r1)})`);

    await como("authenticated", ADMIN);
    g = await gasto();
    ok(g.gasto_auto_centavos === 9500, `automático do período = 3000+4000+0+2500, sem USD e sem o dia de fora (${g.gasto_auto_centavos})`);
    ok(g.dias_auto === 4 && g.anuncios_auto === 2, `4 dias e 2 anúncios com linha automática (${g.dias_auto}/${g.anuncios_auto})`);
    ok(g.conversas_meta === 11 && g.impressoes === 3300 && g.cliques === 130, `conversas/impressões/cliques da Meta (${g.conversas_meta}/${g.impressoes}/${g.cliques})`);
    // A: 10 dias manual - 2 dias com automático = 8.000 | B só manual 5.000 |
    // geral D5..D9 sem D7 e D8 (linha de C, inclusive a de gasto 0) = 1.500 |
    // D (só manual) 1.000. USD não tira o geral do D5.
    ok(g.gasto_manual_efetivo_centavos === 8000 + 5000 + 1500 + 1000,
       `informado efetivo: A sem os 2 dias automáticos, geral sem os dias com qualquer linha (${g.gasto_manual_efetivo_centavos})`);
    ok(g.lancamentos_manuais_efetivos === 4, "lançamentos que ainda valem algum dia = 4");
    ok(g.atualizado_em !== null, "atualizado_em preenchido (última sincronização)");

    const ad = await gastoAd();
    const resumo = (l) => l.map((x) => `${x.ad_id.slice(-1)}:${x.gasto_auto_centavos}/${x.dias_auto}/${x.gasto_manual_efetivo_centavos}/${x.conversas_meta}`).join(" ");
    ok(resumo(ad) === "1:7000/2/8000/9 2:0/0/5000/0 3:2500/2/0/2 4:0/0/1000/0",
       `por anúncio: A auto+manual sem sobreposição, B só manual, C só automático, D só manual; USD fora (${resumo(ad)})`);
    ok(ad.reduce((t, x) => t + x.gasto_auto_centavos, 0) === g.gasto_auto_centavos, "soma do automático por anúncio = automático do período");
    ok(ad.reduce((t, x) => t + x.gasto_manual_efetivo_centavos, 0) + 1500 === g.gasto_manual_efetivo_centavos,
       "soma do informado por anúncio + geral efetivo = informado efetivo do período");
    ok(ad.find((x) => x.ad_id === B).atualizado_em === null && ad.find((x) => x.ad_id === A).atualizado_em !== null, "atualizado_em por anúncio só onde há automático");

    // dia/período sem gasto nenhum
    const vazio = await gasto("h - 40, h - 30");
    ok(vazio.gasto_auto_centavos === 0 && vazio.gasto_manual_efetivo_centavos === 0 && vazio.lancamentos_manuais_efetivos === 0 && vazio.atualizado_em !== null,
       "período sem gasto: zeros, 1 linha, e a última sincronização continua aparecendo");
    ok((await gastoAd("h - 40, h - 30")).length === 0, "período sem gasto: nenhuma linha por anúncio");
    const soD1 = await gasto("h - 8, h - 8");
    ok(soD1.gasto_auto_centavos === 0 && soD1.gasto_manual_efetivo_centavos === 1000 + 1000 + 333,
       `dia sem linha automática: o informado vale inteiro (${soD1.gasto_manual_efetivo_centavos})`);
    const soD2 = await gasto("h - 7, h - 7");
    ok(soD2.gasto_auto_centavos === 3000 && soD2.gasto_manual_efetivo_centavos === 1000 + 333,
       `dia com automático de A: o informado de A some, o de B e D fica (${soD2.gasto_manual_efetivo_centavos})`);

    // funções antigas: mesmo resultado com dado automático gravado
    ok(await funilAntigo() === funilAntes, "admin_crm_funil / por_anuncio / teste: resultado idêntico com linhas automáticas gravadas (não leem a tabela nova)");

    // ---------------- reenvio (idempotente, atualiza) ----------------
    await db.exec(`RESET ROLE; UPDATE crm_gasto_meta_anuncio SET atualizado_em = now() - interval '2 hours' WHERE ad_id = '${A}' AND data = '${dia(2)}';`);
    await como("service_role");
    const r2 = await gravar([{ ad_id: A, data: dia(2), gasto_centavos: 3500, impressoes: 1100, cliques: 55, conversas_meta: 4 }]);
    ok(r2.inseridos === 0 && r2.atualizados === 1, `reenvio do mesmo dia: 1 atualizado, 0 inserido (${JSON.stringify(r2)})`);
    const r3 = await gravar([{ ad_id: A, data: dia(2), gasto_centavos: 3500, impressoes: 1100, cliques: 55, conversas_meta: 4 }]);
    ok(r3.atualizados === 1 && r3.inseridos === 0, "reenvio idêntico: continua 1 atualizado");
    await db.exec("RESET ROLE");
    const [linha] = await q(`SELECT gasto_centavos::int g, campaign_id, atualizado_em > now() - interval '1 minute' AS recente,
      (SELECT count(*)::int FROM crm_gasto_meta_anuncio) n FROM crm_gasto_meta_anuncio WHERE ad_id = '${A}' AND data = '${dia(2)}'`);
    ok(linha.g === 3500 && linha.n === 6, `reenvio troca o valor, não duplica (gasto ${linha.g}, ${linha.n} linhas)`);
    ok(linha.recente === true, "reenvio move o atualizado_em");
    ok(linha.campaign_id === null, "campaign_id é do último envio (informativo; ausente = nulo)");
    // a Meta corrigiu um dia para zero: o n8n manda 0 e sobrescreve
    await como("service_role");
    await gravar([{ ad_id: C, data: dia(8), gasto_centavos: 0, impressoes: 0, cliques: 0, conversas_meta: 0 }]);
    await como("authenticated", ADMIN);
    g = await gasto();
    ok(g.gasto_auto_centavos === 3500 + 4000 + 0 + 0 && g.dias_auto === 4, `dia corrigido para 0 sobrescreve e continua contando como dia automático (${g.gasto_auto_centavos})`);
    ok(g.gasto_manual_efetivo_centavos === 8000 + 5000 + 1500 + 1000, "dia zerado continua tirando o geral (linha existe)");

    // ---------------- validação ----------------
    await como("service_role");
    const ruins = [
      [{ ad_id: "abc def", data: dia(1), gasto_centavos: 1 }, "ad_id_invalido"],
      [{ ad_id: "x".repeat(65), data: dia(1), gasto_centavos: 1 }, "ad_id_invalido"],
      [{ ad_id: 123, data: dia(1), gasto_centavos: 1 }, "ad_id_invalido"],
      [{ ad_id: "AD1", campaign_id: "camp anha", data: dia(1), gasto_centavos: 1 }, "campaign_id_invalido"],
      [{ ad_id: "AD1", data: "2026-02-30", gasto_centavos: 1 }, "data_invalida"],
      [{ ad_id: "AD1", data: "ontem", gasto_centavos: 1 }, "data_invalida"],
      [{ ad_id: "AD1", data: dia(12), gasto_centavos: 1 }, "data_fora_da_janela"],
      [{ ad_id: "AD1", data: dia(-400), gasto_centavos: 1 }, "data_fora_da_janela"],
      [{ ad_id: "AD1", data: dia(1), gasto_centavos: -1 }, "gasto_invalido"],
      [{ ad_id: "AD1", data: dia(1), gasto_centavos: 1.5 }, "gasto_invalido"],
      [{ ad_id: "AD1", data: dia(1), gasto_centavos: "100" }, "gasto_invalido"],
      [{ ad_id: "AD1", data: dia(1), gasto_centavos: 100000001 }, "gasto_invalido"],
      [{ ad_id: "AD1", data: dia(1) }, "gasto_invalido"],
      [{ ad_id: "AD1", data: dia(1), gasto_centavos: 1, impressoes: -5 }, "impressoes_invalido"],
      [{ ad_id: "AD1", data: dia(1), gasto_centavos: 1, conversas_meta: 10000001 }, "conversas_meta_invalido"],
      [{ ad_id: "AD1", data: dia(1), gasto_centavos: 1, moeda: "brl" }, "moeda_invalida"],
      ["texto solto", "nao_objeto"],
    ];
    const lote = [{ ad_id: "AD-OK", data: dia(1), gasto_centavos: 100 }, ...ruins.map((x) => x[0]), { ad_id: "AD-OK", data: dia(1), gasto_centavos: 200 }];
    const r4 = await gravar(lote);
    const esperado = [...ruins.map((x, i) => ({ indice: i + 1, erro: x[1] })), { indice: ruins.length + 1, erro: "duplicado_no_lote" }];
    ok(JSON.stringify(r4.rejeitadas.map((x) => ({ indice: x.indice, erro: x.erro }))) === JSON.stringify(esperado), `inválidos rejeitados com o índice e o motivo (${JSON.stringify(r4.rejeitadas.map((x) => x.erro))})`);
    ok(r4.inseridos === 1, "o item bom do mesmo lote grava");
    await db.exec("RESET ROLE");
    const [{ n: nAd1, g1 }] = await q("SELECT count(*)::int n, max(gasto_centavos)::int g1 FROM crm_gasto_meta_anuncio WHERE ad_id IN ('AD1', 'AD-OK')");
    ok(nAd1 === 1 && g1 === 100, "nada dos inválidos foi gravado; o duplicado do lote não sobrescreveu o 1º");
    await como("service_role");
    ok(/Lote grande/.test(await erro("SELECT crm_gravar_gasto_meta($1::jsonb)", [JSON.stringify(Array.from({ length: 101 }, (_, i) => ({ ad_id: `L${i}`, data: dia(1), gasto_centavos: 1 })))])),
       "lote de 101 itens recusado inteiro");
    ok(/Lote inválido/.test(await erro("SELECT crm_gravar_gasto_meta('{}'::jsonb)")), "corpo que não é lista recusado");

    // ---------------- privilégios ----------------
    await como("anon");
    for (const fn of ["admin_crm_funil_gasto(current_date - 1, current_date)", "admin_crm_funil_gasto_por_anuncio(current_date - 1, current_date)", "crm_gravar_gasto_meta('[]'::jsonb)"]) {
      ok(/permission denied/.test(await erro(`SELECT * FROM ${fn}`)), `anon não executa ${fn.split("(")[0]}`);
    }
    ok(/permission denied/.test(await erro("SELECT * FROM crm_gasto_meta_anuncio")), "anon não lê a tabela");
    await como("authenticated", COMUM);
    for (const fn of ["admin_crm_funil_gasto", "admin_crm_funil_gasto_por_anuncio"]) {
      ok(/Apenas administradores/.test(await erro(`SELECT * FROM ${fn}(current_date - 1, current_date)`)), `${fn} recusa authenticated não-admin`);
    }
    ok(/permission denied/.test(await erro("SELECT crm_gravar_gasto_meta('[]'::jsonb)")), "authenticated não grava");
    await como("authenticated", ADMIN);
    ok(/permission denied/.test(await erro("SELECT * FROM crm_gasto_meta_anuncio")), "nem o admin lê a tabela direto (só pelas funções)");
    ok(/permission denied/.test(await erro(`INSERT INTO crm_gasto_meta_anuncio (ad_id, data, gasto_centavos) VALUES ('X', current_date, 1)`)), "admin não grava direto");
    ok(/permission denied/.test(await erro("SELECT crm_gravar_gasto_meta('[]'::jsonb)")), "admin não chama a gravação do n8n");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_gasto(current_date, current_date - 1)")), "período invertido recusado");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_gasto_por_anuncio(current_date - 401, current_date)")), "mais de 400 dias recusado");
    ok(/Período inválido/.test(await erro("SELECT * FROM admin_crm_funil_gasto(NULL, current_date)")), "data nula recusada");
    await como("postgres");
    ok(/Apenas administradores/.test(await erro("SELECT * FROM admin_crm_funil_gasto(current_date - 1, current_date)")), "sem usuário (SQL Editor) a função do card recusa");
    await db.exec("RESET ROLE");
    const [{ pub }] = await q(`SELECT count(*)::int pub FROM pg_proc p, aclexplode(p.proacl) a
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1) AND a.grantee = 0`, [NOVAS]);
    ok(pub === 0, "nenhuma função da 2A com EXECUTE para PUBLIC");
    const [{ priv }] = await q(`SELECT has_table_privilege('anon', 'public.crm_gasto_meta_anuncio', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      OR has_table_privilege('authenticated', 'public.crm_gasto_meta_anuncio', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') AS priv`);
    ok(priv === false, "tabela: anon e authenticated sem privilégio nenhum");
    const [{ rls, pol }] = await q(`SELECT c.relrowsecurity rls, (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) pol
      FROM pg_class c WHERE c.oid = 'public.crm_gasto_meta_anuncio'::regclass`);
    ok(rls === true && pol === 0, "tabela: RLS ligada e sem política");
    const [{ cols }] = await q(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position) cols FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_gasto_meta_anuncio'`);
    ok(cols === "ad_id,data,campaign_id,gasto_centavos,impressoes,cliques,conversas_meta,moeda,atualizado_em",
       `tabela só com IDs e números, sem nome/e-mail/telefone/user_id (${cols})`);

    // ---------------- funções antigas intactas ----------------
    const antigasDepois = await defs(ANTIGAS);
    for (const n of ANTIGAS) {
      const a = antigasAntes[n], b = antigasDepois[n];
      ok(a && b && a.prosrc === b.prosrc && a.a === b.a && a.r === b.r && a.acl === b.acl && a.prosecdef === b.prosecdef,
         `${n}: texto, assinatura e privilégios iguais aos da 1D`);
    }

    // ---------------- rollback ----------------
    await db.exec(s.rollback);
    ok((await q("SELECT to_regclass('public.crm_gasto_meta_anuncio') IS NULL AS x"))[0].x === true, "rollback: tabela removida");
    ok((await q(`SELECT count(*)::int c FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = ANY($1)`, [NOVAS]))[0].c === 0, "rollback: 3 funções removidas");
    const rb = await defs(ANTIGAS);
    ok(ANTIGAS.every((n) => rb[n].prosrc === antigasAntes[n].prosrc && rb[n].acl === antigasAntes[n].acl && rb[n].r === antigasAntes[n].r),
       "rollback: funções das fases 1, 1C e 1D exatamente como antes");
    await como("authenticated", ADMIN);
    ok(await funilAntigo() === funilAntes, "rollback: funil antigo com o mesmo resultado");
    await db.exec("RESET ROLE");
    ok((await q("SELECT count(*)::int c FROM crm_gasto_manual"))[0].c === 5, "rollback: gasto informado intacto (5 lançamentos)");
    await tudoOk(CONFERIR, "2a-0-conferir-producao (depois do rollback, pronto para reaplicar)");
    await db.exec(s.rollback);
    ok(true, "rollback rodado 2 vezes não dá erro");
    await db.exec(s.mig);
    if (comVerificacao) await tudoOk(VERIFICAR, "2a-1-verificar (reaplicada depois do rollback)");
    await como("authenticated", ADMIN);
    const re = await gasto();
    ok(re.gasto_auto_centavos === 0 && re.gasto_manual_efetivo_centavos === 18500, "reaplicada: tabela vazia, volta a valer só o informado");
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
  ok(JSON.stringify(criadas) === JSON.stringify(NOVAS), `só cria as 3 funções novas (${criadas.join(", ")})`);
  ok(!/ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?public\.(?!crm_gasto_meta_anuncio\b)/i.test(sc) && !/\bDROP\b|\bTRUNCATE\b/i.test(sc),
     "não altera outra tabela; nenhum DROP/TRUNCATE");
  ok([...sc.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map((m) => m[1]).join() === "crm_gasto_meta_anuncio", "só cria a tabela nova");
  ok(!/meta_ads_insights_dia|crm_campanhas_whatsapp|_zerar_catalogo|admin_mkt_|crm_automacoes|crm_configuracoes|garantia|caixa|recibo/i.test(sc),
     "não usa meta_ads_insights_dia nem crm_campanhas_whatsapp; não toca _zerar_catalogo, CRM antigo, garantias, caixa ou recibos");
  ok(!/telefone|email|e164|\bnome\b|user_id/i.test(sc), "migration não tem telefone, e-mail, nome nem user_id");
  ok(ORIG.rollback.includes("NÃO RODE — SÓ EM EMERGÊNCIA") && /DROP TABLE IF EXISTS public\.crm_gasto_meta_anuncio;/.test(ORIG.rollback)
     && NOVAS.every((n) => ORIG.rollback.includes(`DROP FUNCTION IF EXISTS public.${n}(`)), "rollback marcado NÃO RODE; apaga tabela e as 3 funções");
  ok(!/CREATE OR REPLACE|ALTER TABLE/i.test(ORIG.rollback.replace(/--.*$/gm, "")), "rollback não recria nem altera nada das fases anteriores");
  ok(!/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i.test((CONFERIR + VERIFICAR).replace(/--.*$/gm, "").replace(/'[^']*'/g, "")),
     "conferência e verificação são só leitura");
  return falhas;
}

// ---------------------------------------------------------------------------
// Mutantes: cada um TEM que derrubar a suíte (rodam sem a verificação 2a-1,
// que compara o md5 e mataria qualquer mutante sem provar nada).
// ---------------------------------------------------------------------------
const MUTANTES = [
  { nome: "manual do anúncio não some no dia automático do mesmo anúncio", de: "AND (m.g_ad IS NULL OR x.a_ad = m.g_ad))", para: "AND m.g_ad IS NULL)" },
  { nome: "manual geral não some no dia com linha automática", de: "AND (m.g_ad IS NULL OR x.a_ad = m.g_ad))", para: "AND x.a_ad = m.g_ad)" },
  { nome: "manual do anúncio some com linha de QUALQUER anúncio", de: "AND (m.g_ad IS NULL OR x.a_ad = m.g_ad))", para: "AND true)" },
  { nome: "por anúncio soma manual e automático no mesmo dia", de: "\n       AND NOT EXISTS (SELECT 1 FROM auto x WHERE x.a_ad = g.ad_id AND x.a_dia = greatest(g.inicio, p_inicio) + k)", para: "" },
  { nome: "automático sem filtro de moeda (USD entra)", de: "     WHERE a.data BETWEEN p_inicio AND p_fim AND a.moeda = 'BRL'\n  ),\n  manual_dia", para: "     WHERE a.data BETWEEN p_inicio AND p_fim\n  ),\n  manual_dia" },
  { nome: "automático sem o início do período", de: "     WHERE a.data BETWEEN p_inicio AND p_fim AND a.moeda = 'BRL'\n  ),\n  manual_dia", para: "     WHERE a.data <= p_fim AND a.moeda = 'BRL'\n  ),\n  manual_dia" },
  { nome: "rateio do manual dividindo pelos dias errados", de: "g.valor * 100 / (g.fim - g.inicio + 1) AS centavos", para: "g.valor * 100 / (g.fim - g.inicio + 2) AS centavos" },
  { nome: "manual removido volta a contar", de: "     WHERE g.removido_em IS NULL AND g.moeda = 'BRL'\n       AND g.inicio <= p_fim AND g.fim >= p_inicio\n  ),\n  manual_efetivo", para: "     WHERE g.moeda = 'BRL'\n       AND g.inicio <= p_fim AND g.fim >= p_inicio\n  ),\n  manual_efetivo" },
  { nome: "reenvio não atualiza (DO NOTHING)", de: /ON CONFLICT \(ad_id, data\) DO UPDATE SET[\s\S]*?atualizado_em  = now\(\)\n/, para: "ON CONFLICT (ad_id, data) DO NOTHING\n" },
  { nome: "reenvio não mexe no atualizado_em", de: "      atualizado_em  = now()\n    RETURNING", para: "      atualizado_em  = g.atualizado_em\n    RETURNING" },
  { nome: "atualizado contado como inserido", de: "IF v_inserido THEN", para: "IF true THEN" },
  { nome: "gravação aceita valor negativo (CHECK estoura o lote)", de: "           OR (v_num::text)::numeric < 0\n", para: "" },
  { nome: "gravação aceita valor quebrado", de: "           OR (v_num::text)::numeric <> trunc((v_num::text)::numeric)\n", para: "" },
  { nome: "gravação sem a janela de datas", de: "ELSIF v_data < v_hoje - 400 OR v_data > v_hoje + 1 OR v_data < DATE '2024-01-01' THEN", para: "ELSIF false THEN" },
  { nome: "gravação sem checar duplicado no lote", de: "IF v_erro IS NULL AND (v_ad || '|' || v_txt) = ANY (v_vistos) THEN", para: "IF false THEN" },
  { nome: "gravação aceita moeda minúscula", de: "(v_item->>'moeda') ~ '^[A-Z]{3}$'", para: "(v_item->>'moeda') ~* '^[A-Z]{3}$'" },
  { nome: "sem limite de lote", de: "IF jsonb_array_length(p_itens) > 100 THEN", para: "IF false THEN" },
  { nome: "tirar has_role do gasto do período", de: /IF NOT public\.has_role\(auth\.uid\(\), 'admin'\) THEN\n    RAISE EXCEPTION 'Apenas administradores podem executar esta função';\n  END IF;/, para: "" },
  { nome: "gravação sem REVOKE de authenticated", de: "REVOKE ALL ON FUNCTION public.crm_gravar_gasto_meta(jsonb)                    FROM PUBLIC, anon, authenticated;", para: "REVOKE ALL ON FUNCTION public.crm_gravar_gasto_meta(jsonb)                    FROM anon;" },
  { nome: "funções do card sem REVOKE de anon", de: "REVOKE ALL ON FUNCTION public.admin_crm_funil_gasto(date, date)               FROM PUBLIC, anon;", para: "" },
  { nome: "tabela sem REVOKE (privilégios padrão do Supabase)", de: "REVOKE ALL ON public.crm_gasto_meta_anuncio FROM PUBLIC, anon, authenticated;", para: "" },
  { nome: "tabela sem RLS", de: "ALTER TABLE public.crm_gasto_meta_anuncio ENABLE ROW LEVEL SECURITY;", para: "" },
  { nome: "rollback sem apagar a tabela", alvo: "rollback", de: "DROP TABLE IF EXISTS public.crm_gasto_meta_anuncio;", para: "" },
  { nome: "rollback sem apagar a gravação", alvo: "rollback", de: "DROP FUNCTION IF EXISTS public.crm_gravar_gasto_meta(jsonb);", para: "" },
];

function aplicarMutante(m) {
  const s = { ...ORIG };
  const alvo = m.alvo ?? "mig";
  const antes = s[alvo];
  s[alvo] = antes.replace(m.de, () => m.para); // função: "$" do SQL não vira padrão de substituição
  if (s[alvo] === antes) throw new Error(`mutante "${m.nome}" não achou o trecho`);
  return s;
}

const falhasEst = estaticas();
let falhas = [];
let falhasMut = 0;
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
console.log("\n--- suíte ---");
falhas = await suite(ORIG);
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
