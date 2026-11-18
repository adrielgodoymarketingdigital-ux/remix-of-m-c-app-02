// Prova da migration real em Postgres local (PGlite 0.3.16), sem produção. Dados fictícios.
//   PGLITE_PATH=<.../@electric-sql/pglite/dist/index.js> node scripts/testes-caixa-relogio/migration.pglite.mjs
import { readFileSync } from "node:fs";
const { PGlite } = await import(process.env.PGLITE_PATH ?? "@electric-sql/pglite");
const ler = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const MIGRATION = ler("../../supabase/migrations/20261118120000_caixa_hora_servidor.sql");
const ROLLBACK = ler("./rollback-20261118120000_caixa_hora_servidor.sql");

let falhas = 0;
const confere = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}${ok ? "" : `: ${JSON.stringify(obtido)} ≠ ${JSON.stringify(esperado)}`}`);
};

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
  CREATE TABLE public.caixas (id int PRIMARY KEY, status text NOT NULL, data_abertura timestamptz NOT NULL, data_fechamento timestamptz,
    saldo_inicial numeric(10,2), saldo_final numeric(10,2), total_dinheiro numeric(10,2), total_vendas numeric(10,2));
  CREATE TABLE public.vendas (id int PRIMARY KEY, data timestamptz DEFAULT now(), total numeric(10,2));
  INSERT INTO public.caixas VALUES
    (1, 'fechado', '2026-11-14 12:00+00', '2026-11-14 11:00+00', 100, 480.55, 300, 300),
    (2, 'fechado', '2026-11-15 12:00+00', '2026-11-15 21:00+00', 100, 600, 500, 700),
    (3, 'aberto', now() - interval '3 hours', NULL, 100, NULL, 0, 0),
    (4, 'aberto', now() - interval '2 hours', NULL, 100, NULL, 0, 0),
    (5, 'aberto', now() - interval '1 hour', NULL, 100, NULL, 0, 0);
  INSERT INTO public.vendas VALUES (1, '2026-11-14 10:59+00', 80), (2, '2026-11-15 15:00+00', 120);
`);
const fotoFechados = async () => (await db.query("SELECT * FROM public.caixas WHERE id IN (1, 2) ORDER BY id")).rows;
const fotoVendas = async () => (await db.query("SELECT * FROM public.vendas ORDER BY id")).rows;
const antesFechados = await fotoFechados();
const antesVendas = await fotoVendas();

await db.exec(MIGRATION);
await db.exec(MIGRATION);
confere("aplicar a migration (2 vezes) não altera caixas fechados", await fotoFechados(), antesFechados);
confere("aplicar a migration não altera vendas", await fotoVendas(), antesVendas);

const pertoDeAgora = async (id) => (await db.query("SELECT abs(extract(epoch FROM data_fechamento - now())) < 5 AS ok FROM public.caixas WHERE id = $1", [id])).rows[0].ok;
await db.query("UPDATE public.caixas SET status = 'fechado', data_fechamento = now() - interval '1 hour', saldo_final = 777 WHERE id = 3");
confere("versão antiga com aparelho atrasado: grava a hora do servidor", await pertoDeAgora(3), true);
confere("o saldo contado é preservado", (await db.query("SELECT saldo_final FROM public.caixas WHERE id = 3")).rows[0].saldo_final, "777.00");
await db.query("UPDATE public.caixas SET status = 'fechado', data_fechamento = now() + interval '1 hour' WHERE id = 4");
confere("versão antiga com aparelho adiantado: grava a hora do servidor", await pertoDeAgora(4), true);
await db.query("UPDATE public.caixas SET status = 'fechado' WHERE id = 5");
confere("app que não envia a hora: o gatilho preenche", await pertoDeAgora(5), true);

await db.query("UPDATE public.caixas SET status = 'fechado' WHERE id IN (1, 2)");
confere("regravar o status de caixa fechado não muda nada", await fotoFechados(), antesFechados);
await db.query("UPDATE public.caixas SET total_dinheiro = 510, total_vendas = 710, saldo_final = 610 WHERE id = 2");
confere("ajuste de caixa fechado mantém data_fechamento",
  (await db.query("SELECT data_fechamento FROM public.caixas WHERE id = 2")).rows[0].data_fechamento.getTime(), antesFechados[1].data_fechamento.getTime());

const pode = async (papel) => (await db.query("SELECT has_function_privilege($1, 'public.agora_servidor()', 'execute') AS p", [papel])).rows[0].p;
confere("anon não executa agora_servidor()", await pode("anon"), false);
confere("authenticated executa agora_servidor()", await pode("authenticated"), true);
confere("agora_servidor() devolve a hora do banco", (await db.query("SELECT abs(extract(epoch FROM public.agora_servidor() - now())) < 1 AS ok")).rows[0].ok, true);

await db.exec(ROLLBACK);
const restos = (await db.query("SELECT count(*)::int AS n FROM pg_proc WHERE proname IN ('agora_servidor', 'caixas_fechamento_hora_servidor')")).rows[0].n;
confere("rollback remove as funções", restos, 0);
confere("rollback remove o gatilho", (await db.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'trg_caixas_fechamento_hora_servidor'")).rows[0].n, 0);
confere("rollback não altera vendas", await fotoVendas(), antesVendas);

console.log(falhas ? `${falhas} falha(s)` : "migration provada");
process.exit(falhas ? 1 : 0);
