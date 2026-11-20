// "Minhas garantias" — prova de LOCK num Postgres REAL e LOCAL (o PGlite tem uma
// conexão só e não consegue ter "outra transação segurando lock").
// Cria um banco descartável teste_minhas_garantias_<n>, monta a réplica mínima,
// roda os cenários com 3 conexões e apaga o banco no fim. Recusa qualquer host
// que não seja localhost. NUNCA aponte para produção.
//
//   PG_DIR=<pasta com node_modules/pg> PG_URL=postgres://postgres:senha@127.0.0.1:5432/postgres \
//     node scripts/minhas-garantias/teste-lock-postgres.mjs
//
// Cenários:
//   1) venda em andamento (transação aberta com INSERT em vendas) + estrutura:
//      a estrutura FALHA com lock_timeout (55P03) em ~5 s e desfaz tudo; mede
//      quanto tempo uma leitura de vendas feita durante a espera ficou na fila.
//   2) sem venda em andamento: a estrutura passa em < 2 s.
//   3) validação com venda em andamento: passa sem esperar; INSERT de outra
//      conexão durante a validação não trava.
//   4) índice CONCURRENTLY com venda em andamento: espera a venda terminar, mas
//      INSERTs de outras conexões passam na hora; no fim o índice é válido.
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { BASE, TIPOS_GARANTIA, ler, zerarCatalogoBase } from "./replica-minima.mjs";

const require = createRequire(join(resolve(process.env.PG_DIR ?? "."), "noop.js"));
const { Client } = require("pg");
const URL_BASE = new URL(process.env.PG_URL ?? "postgres://postgres@127.0.0.1:5432/postgres");
if (!["127.0.0.1", "localhost", "::1"].includes(URL_BASE.hostname)) {
  console.error("Recusado: PG_URL tem que ser um Postgres LOCAL (127.0.0.1/localhost).");
  process.exit(2);
}

const ESTRUTURA = ler("supabase/migrations/20261120120000_minhas_garantias_estrutura.sql");
const VALIDAR = ler("supabase/migrations/20261120120010_minhas_garantias_validar_constraints.sql");
const INDICE_1 = ler("supabase/migrations/20261120120020_minhas_garantias_indice_vendas_garantia_id.sql");
const INDICE_2 = ler("supabase/migrations/20261120120030_minhas_garantias_indice_vendas_garantia_texto_id.sql");

let falhas = 0;
const ok = (c, m, x) => { if (c) console.log("  ✓", m); else { falhas++; console.log("  ✗", m, x === undefined ? "" : JSON.stringify(x)); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cronometrar = async (p) => { const t = Date.now(); try { await p; return { ms: Date.now() - t, erro: null }; } catch (e) { return { ms: Date.now() - t, erro: e }; } };

const NOME_DB = `teste_minhas_garantias_${Date.now()}`;
const admin = new Client({ connectionString: URL_BASE.href });
await admin.connect();
await admin.query(`CREATE DATABASE ${NOME_DB}`);
const urlTeste = new URL(URL_BASE.href); urlTeste.pathname = `/${NOME_DB}`;
const conectar = async () => { const c = new Client({ connectionString: urlTeste.href }); await c.connect(); return c; };
const [A, B, C] = [await conectar(), await conectar(), await conectar()];
const DONO = "00000000-0000-4000-8000-000000000005";

try {
  // papéis do Supabase podem já existir num Postgres local
  await B.query(BASE.replace(/CREATE ROLE (\w+) NOLOGIN( BYPASSRLS)?;/g, (_m, r, by) =>
    `DO $r$ BEGIN CREATE ROLE ${r} NOLOGIN${by ?? ""}; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;`));
  await B.query(TIPOS_GARANTIA);
  await B.query(zerarCatalogoBase());
  await B.query(`INSERT INTO public.vendas (user_id) SELECT '${DONO}' FROM generate_series(1, 20000)`);

  console.log("1) venda em andamento + estrutura");
  await A.query("BEGIN");
  await A.query(`INSERT INTO public.vendas (user_id) VALUES ('${DONO}')`); // segura ROW EXCLUSIVE em vendas
  const migracao = cronometrar(B.query(ESTRUTURA));
  await espera(1000);
  const leitura = await cronometrar(C.query("SELECT count(*) FROM public.vendas"));
  const r1 = await migracao;
  await B.query("ROLLBACK").catch(() => {});
  ok(r1.erro?.code === "55P03", "estrutura falhou com lock_timeout (55P03)", r1.erro?.message);
  ok(r1.ms >= 4500 && r1.ms <= 8000, `falhou rápido: ${r1.ms} ms (lock_timeout 5 s)`);
  console.log(`    leitura de vendas feita 1 s depois ficou ${leitura.ms} ms na fila (máximo esperado ≈ 4 s)`);
  ok(!leitura.erro && leitura.ms <= 6000, "a leitura não deu erro e esperou no máximo o lock_timeout", leitura.erro?.message);
  const sobrou = (await C.query("SELECT to_regclass('public.garantias_loja') AS t, (SELECT count(*)::int FROM public._zerar_catalogo()) AS z, (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'vendas' AND column_name LIKE 'garantia%') AS c")).rows[0];
  ok(sobrou.t === null && sobrou.z === 112 && sobrou.c === 0, "nada ficou criado (desfez tudo)", sobrou);
  await A.query("COMMIT");

  console.log("2) sem venda em andamento");
  const r2 = await cronometrar(B.query(ESTRUTURA));
  ok(!r2.erro && r2.ms < 2000, `estrutura aplicada em ${r2.ms} ms`, r2.erro?.message);

  console.log("3) validação com venda em andamento");
  await A.query("BEGIN");
  await A.query(`INSERT INTO public.vendas (user_id) VALUES ('${DONO}')`);
  const validacao = cronometrar(B.query(VALIDAR));
  const insercao = await cronometrar(C.query(`INSERT INTO public.vendas (user_id) VALUES ('${DONO}')`));
  const r3 = await validacao;
  ok(!r3.erro && r3.ms < 3000, `validação passou com a venda aberta: ${r3.ms} ms`, r3.erro?.message);
  ok(!insercao.erro && insercao.ms < 1000, `INSERT de outra conexão durante a validação: ${insercao.ms} ms`);
  await A.query("COMMIT");
  const val = (await C.query("SELECT count(*) FILTER (WHERE convalidated)::int AS n FROM pg_constraint WHERE conname LIKE 'vendas_garantia%' OR conname = 'dispositivos_garantia_padrao_id_fkey'")).rows[0].n;
  ok(val === 6, "6 constraints validadas", val);

  console.log("4) índice CONCURRENTLY com venda em andamento");
  await A.query("BEGIN");
  await A.query(`INSERT INTO public.vendas (user_id) VALUES ('${DONO}')`);
  const indice = cronometrar(B.query(INDICE_1));
  await espera(500);
  const ins4 = await cronometrar(C.query(`INSERT INTO public.vendas (user_id) VALUES ('${DONO}')`));
  ok(!ins4.erro && ins4.ms < 1000, `INSERT durante a criação do índice: ${ins4.ms} ms (não travou)`);
  await espera(500);
  await A.query("COMMIT");
  const r4 = await indice;
  ok(!r4.erro, `índice terminou depois que a venda aberta acabou (${r4.ms} ms)`, r4.erro?.message);
  const r5 = await cronometrar(B.query(INDICE_2));
  ok(!r5.erro, `2º índice: ${r5.ms} ms`, r5.erro?.message);
  const idx = (await C.query("SELECT count(*) FILTER (WHERE indisvalid AND indisready)::int AS n FROM pg_index WHERE indexrelid IN ('public.idx_vendas_garantia_id'::regclass, 'public.idx_vendas_garantia_texto_id'::regclass)")).rows[0].n;
  ok(idx === 2, "2 índices válidos", idx);
} finally {
  for (const c of [A, B, C]) await c.end().catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS ${NOME_DB}`).catch(() => {});
  await admin.end();
}
console.log(falhas === 0 ? "\nOK: locks conferidos" : `\nFALHAS: ${falhas}`);
process.exit(falhas === 0 ? 0 : 1);
