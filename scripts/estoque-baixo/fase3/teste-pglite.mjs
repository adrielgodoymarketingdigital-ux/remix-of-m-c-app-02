// Teste da migration 20261103120000 (estoque mínimo por item) num Postgres 17
// local (PGlite, WebAssembly). Não toca em produção: monta uma réplica mínima
// de produtos/pecas com RLS, gatilho, índices, grants, views do catálogo e
// funções que gravam nelas, aplica a migration e prova o que quebra e o que
// não quebra com a coluna nova.
//
// Rodar (o PGlite não é dependência do projeto; 0.3.4 quebra em RAISE):
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/estoque-baixo/fase3/teste-pglite.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const MIGRATION = ler("supabase/migrations/20261103120000_estoque_minimo_por_item.sql");
const PASSO2 = ler("scripts/estoque-baixo/fase3/passo2-validar-check.sql");
const ROLLBACK = ler("scripts/estoque-baixo/fase3/rollback.sql");
const VERIFICACAO = ler("scripts/estoque-baixo/fase3/verificacao.sql");

// ---------------------------------------------------------------------------
// Réplica mínima. Colunas de produtos/pecas como em types.ts; views do
// catálogo como em 20260707183409; função com colunas listadas no molde de
// importar_nfe_compra (20261024120000).
// ---------------------------------------------------------------------------
const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

CREATE TABLE public.configuracoes_loja (user_id uuid, catalogo_ativo boolean, catalogo_slug text);
CREATE TABLE public.categorias_produtos (id uuid PRIMARY KEY, user_id uuid, nome text, cor text);

CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, empresa_id uuid, nome text NOT NULL,
  sku text, codigo_barras text, quantidade integer DEFAULT 0,
  custo numeric DEFAULT 0, preco numeric DEFAULT 0, preco_atacado numeric, lucro numeric,
  fotos jsonb DEFAULT '[]', fornecedor_id uuid, categoria_id uuid, produto_pai_id uuid,
  variacao_label text, exibir_no_catalogo boolean DEFAULT true, deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, empresa_id uuid, nome text NOT NULL,
  codigo_barras text, quantidade integer DEFAULT 0,
  custo numeric DEFAULT 0, preco numeric DEFAULT 0, preco_atacado numeric,
  fotos jsonb DEFAULT '[]', fornecedor_id uuid, categoria_id uuid, peca_pai_id uuid,
  variacao_label text, exibir_no_catalogo boolean DEFAULT true, deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_produtos_empresa_id ON public.produtos (empresa_id);
CREATE INDEX idx_pecas_empresa_id ON public.pecas (empresa_id);
CREATE INDEX idx_produtos_user ON public.produtos (user_id, nome);
ALTER TABLE public.produtos ADD CONSTRAINT produtos_quantidade_check CHECK (quantidade > -100000);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dono produtos" ON public.produtos FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "dono pecas" ON public.pecas FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- gatilho que já existe em muitas bases: recalcula o lucro
CREATE FUNCTION public.calcular_lucro_produto() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.lucro := COALESCE(NEW.preco, 0) - COALESCE(NEW.custo, 0); RETURN NEW; END; $$;
CREATE TRIGGER trg_lucro_produto BEFORE INSERT OR UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.calcular_lucro_produto();

-- views do catálogo público (colunas listadas)
CREATE VIEW public.produtos_catalogo AS
SELECT p.id, 'produto'::text AS tipo_item, p.nome, p.preco, p.fotos, p.quantidade, p.sku,
       p.codigo_barras, p.created_at, cl.catalogo_slug, p.categoria_id, cp.nome AS categoria_nome, cp.cor AS categoria_cor
  FROM produtos p JOIN configuracoes_loja cl ON p.user_id = cl.user_id
  LEFT JOIN categorias_produtos cp ON cp.id = p.categoria_id AND cp.user_id = p.user_id
 WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL AND p.exibir_no_catalogo = true;
CREATE VIEW public.pecas_catalogo AS
SELECT p.id, 'peca'::text AS tipo_item, p.nome, p.preco, p.fotos, p.quantidade,
       p.codigo_barras, p.created_at, cl.catalogo_slug, p.categoria_id, cp.nome AS categoria_nome, cp.cor AS categoria_cor
  FROM pecas p JOIN configuracoes_loja cl ON p.user_id = cl.user_id
  LEFT JOIN categorias_produtos cp ON cp.id = p.categoria_id AND cp.user_id = p.user_id
 WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL AND p.exibir_no_catalogo = true;
-- view feita com SELECT *: o Postgres fixa as colunas na criação
CREATE VIEW public.produtos_todos_campos AS SELECT * FROM public.produtos;

-- (a) colunas listadas, molde de importar_nfe_compra: continua funcionando
CREATE FUNCTION public.teste_inserir_listado(p_user uuid, p_nome text) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.produtos (nome, user_id, empresa_id, quantidade, custo, preco, codigo_barras)
  VALUES (p_nome, p_user, NULL, 1, 2, 3, NULL) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
-- (b) INSERT posicional sem lista de colunas (valores só para as primeiras):
--     a coluna nova vai no fim e fica nula, continua funcionando
CREATE FUNCTION public.teste_inserir_posicional(p_user uuid, p_nome text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.pecas VALUES (gen_random_uuid(), p_user, NULL, p_nome);
END; $$;
-- (c) cópia da linha inteira para uma tabela "igual" criada antes
--     (CREATE TABLE ... LIKE produtos): QUEBRA com a coluna a mais
CREATE TABLE public.produtos_historico (LIKE public.produtos);
CREATE FUNCTION public.teste_copiar_para_historico(p_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.produtos_historico SELECT * FROM public.produtos WHERE id = p_id;
END; $$;
-- (d) %ROWTYPE: o registro ganha o campo novo, continua funcionando
CREATE FUNCTION public.teste_rowtype(p_id uuid) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE r public.produtos%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.produtos WHERE id = p_id;
  RETURN r.nome;
END; $$;
`;

// ---------------------------------------------------------------------------
let falhas = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log("  ✓", msg);
  else { falhas++; console.log("  ✗", msg, extra === undefined ? "" : JSON.stringify(extra)); }
};
async function erro(promessa) {
  try { await promessa; return null; } catch (e) {
    if (process.env.MOSTRAR_ERROS) console.log("      erro esperado:", e.message);
    return e.message;
  }
}

async function novoBanco() {
  const db = new PGlite();
  await db.exec(BASE);
  return db;
}
const um = async (db, sql, p) => (await db.query(sql, p)).rows[0];
async function aplicar(db, sql) {
  try { await db.exec(sql); return null; } catch (e) { await db.exec("ROLLBACK").catch(() => {}); return e.message; }
}
const temColuna = async (db, t) =>
  (await um(db, "SELECT count(*)::int n FROM information_schema.columns WHERE table_name = $1 AND column_name = 'estoque_minimo'", [t])).n === 1;
const arquivo = async (db, t) => (await um(db, `SELECT relfilenode::text f FROM pg_class WHERE oid = 'public.${t}'::regclass`)).f;
async function como(db, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.exec("SET LOCAL ROLE authenticated");
    await tx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    return fn(tx);
  });
}

const DONO = "00000000-0000-4000-8000-0000000000aa";
const OUTRO = "00000000-0000-4000-8000-0000000000bb";

// ---------------------------------------------------------------------------
console.log("\n== Pré-condição: coluna já existe com outro tipo ==");
{
  const db = await novoBanco();
  await db.exec("ALTER TABLE public.pecas ADD COLUMN estoque_minimo text");
  const e = await aplicar(db, MIGRATION);
  ok(e?.includes("EMN003"), "recusa com EMN003", e);
  ok(!(await temColuna(db, "produtos")), "... e não cria a coluna em produtos");
}

console.log("\n== Autoverificação pega mudança além da coluna ==");
{
  const db = await novoBanco();
  const alterada = MIGRATION.replace(
    "ALTER TABLE public.pecas    ADD COLUMN IF NOT EXISTS estoque_minimo integer;",
    "ALTER TABLE public.pecas    ADD COLUMN IF NOT EXISTS estoque_minimo integer;\nCREATE INDEX idx_intruso ON public.produtos (sku);",
  );
  ok(alterada !== MIGRATION, "(injeção preparada)");
  const e = await aplicar(db, alterada);
  ok(e?.includes("EMN012") && e.includes("idx_intruso"), "índice a mais aborta com EMN012", e);
  ok(!(await temColuna(db, "produtos")) && !(await temColuna(db, "pecas")), "... e desfaz tudo (sem coluna)");
  ok((await um(db, "SELECT to_regclass('public.idx_intruso') AS i")).i === null, "... e o índice intruso também some");
}

console.log("\n== Migration ==");
const db = await novoBanco();
for (let i = 0; i < 60; i++) {
  await db.query("INSERT INTO public.produtos (user_id, nome, quantidade, custo, preco) VALUES ($1, $2, $3, 5, 10)", [i % 3 ? DONO : OUTRO, `Produto ${i}`, i % 7]);
}
for (let i = 0; i < 15; i++) await db.query("INSERT INTO public.pecas (user_id, nome, quantidade) VALUES ($1, $2, $3)", [DONO, `Peça ${i}`, i]);
const umProduto = (await um(db, "SELECT id FROM public.produtos WHERE user_id = $1 ORDER BY nome LIMIT 1", [DONO])).id;
const arqAntes = { produtos: await arquivo(db, "produtos"), pecas: await arquivo(db, "pecas") };
const catalogoAntes = (await db.query("SELECT pg_get_viewdef('public.produtos_catalogo'::regclass) a, pg_get_viewdef('public.pecas_catalogo'::regclass) b")).rows[0];
const colsViewStar = async () => (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'produtos_todos_campos' ORDER BY ordinal_position")).rows.map((r) => r.column_name);
const colsViewStarAntes = await colsViewStar();
ok((await erro(db.query("SELECT public.teste_copiar_para_historico($1)", [umProduto]))) === null, "antes: cópia SELECT * para o histórico funciona");

ok((await aplicar(db, MIGRATION)) === null, "aplica sem erro");
ok((await aplicar(db, MIGRATION)) === null, "aplica de novo sem erro (idempotente)");
ok(await temColuna(db, "produtos") && await temColuna(db, "pecas"), "coluna nas duas tabelas");
ok((await arquivo(db, "produtos")) === arqAntes.produtos && (await arquivo(db, "pecas")) === arqAntes.pecas,
  "nenhuma tabela reescrita (mesmo relfilenode)");
const cdef = (await um(db, "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'estoque_minimo'"));
ok(cdef.data_type === "integer" && cdef.is_nullable === "YES" && cdef.column_default === null, "integer, nula, sem default", cdef);
ok((await um(db, "SELECT count(*)::int n FROM public.produtos WHERE estoque_minimo IS NOT NULL")).n === 0, "linhas antigas ficam nulas");
ok((await um(db, "SELECT bool_and(NOT convalidated) v FROM pg_constraint WHERE conname LIKE '%estoque_minimo_check'")).v === true, "CHECK nasce NOT VALID");

console.log("\n== CHECK ==");
for (const [v, aceita] of [[0, true], [3, true], [1000, true], [null, true], [-1, false], [1001, false]]) {
  const e = await erro(db.query("UPDATE public.produtos SET estoque_minimo = $1 WHERE id = $2", [v, umProduto]));
  ok(aceita ? e === null : e?.includes("produtos_estoque_minimo_check"), `${aceita ? "aceita" : "recusa"} ${v}`, e);
}
const e1001 = await erro(db.query("INSERT INTO public.pecas (user_id, nome, estoque_minimo) VALUES ($1, 'x', 1001)", [DONO]));
ok(e1001?.includes("pecas_estoque_minimo_check"), "pecas também recusa 1001 (mesmo NOT VALID)", e1001);

console.log("\n== O que continua funcionando / o que quebra ==");
const idListado = (await um(db, "SELECT public.teste_inserir_listado($1, 'Importado') AS id", [DONO])).id;
ok((await um(db, "SELECT estoque_minimo FROM public.produtos WHERE id = $1", [idListado])).estoque_minimo === null,
  "(a) INSERT com colunas listadas (molde importar_nfe_compra): funciona, mínimo nulo");
ok((await erro(db.query("SELECT public.teste_inserir_posicional($1, 'Posicional')", [DONO]))) === null,
  "(b) INSERT posicional sem lista de colunas: funciona (coluna nova vai no fim)");
const eCopia = await erro(db.query("SELECT public.teste_copiar_para_historico($1)", [umProduto]));
ok(eCopia !== null, "(c) INSERT ... SELECT * para tabela LIKE produtos criada antes: QUEBRA (por isso a consulta 4)", eCopia);
ok((await um(db, "SELECT public.teste_rowtype($1) AS n", [umProduto])).n !== null, "(d) %ROWTYPE: funciona");
await db.query("UPDATE public.produtos SET preco = 20, estoque_minimo = 5 WHERE id = $1", [umProduto]);
ok(Number((await um(db, "SELECT lucro FROM public.produtos WHERE id = $1", [umProduto])).lucro) === 15, "gatilho existente (lucro) segue funcionando");
ok((await db.query("SELECT * FROM public.produtos_catalogo")).rows !== undefined, "view do catálogo segue respondendo");
const catalogoDepois = (await db.query("SELECT pg_get_viewdef('public.produtos_catalogo'::regclass) a, pg_get_viewdef('public.pecas_catalogo'::regclass) b")).rows[0];
ok(JSON.stringify(catalogoDepois) === JSON.stringify(catalogoAntes), "views do catálogo idênticas (sem a coluna nova)");
ok(JSON.stringify(await colsViewStar()) === JSON.stringify(colsViewStarAntes), "view com SELECT * fica com as colunas de antes");

console.log("\n== RLS (policies de sempre) ==");
ok((await como(db, DONO, async (tx) => (await tx.query("UPDATE public.produtos SET estoque_minimo = 2 WHERE id = $1", [umProduto])).affectedRows)) === 1,
  "dono altera o mínimo do próprio item");
const outroId = (await um(db, "SELECT id FROM public.produtos WHERE user_id = $1 LIMIT 1", [OUTRO])).id;
ok((await como(db, DONO, async (tx) => (await tx.query("UPDATE public.produtos SET estoque_minimo = 2 WHERE id = $1", [outroId])).affectedRows)) === 0,
  "dono não altera item de outro usuário");
ok((await como(db, OUTRO, async (tx) => (await tx.query("SELECT estoque_minimo FROM public.produtos WHERE id = $1", [umProduto])).rows.length)) === 0,
  "outro usuário não lê o item do dono");

console.log("\n== Conferência ==");
let conf = (await db.query(VERIFICACAO)).rows;
ok(conf.filter((r) => !r.ok).map((r) => r.ordem).join(",") === "5,6", "antes do passo 2: só as linhas 5 e 6 (CHECK não validado) dão false",
  conf.filter((r) => !r.ok));
ok((await aplicar(db, PASSO2)) === null, "passo 2 valida sem erro");
ok((await aplicar(db, PASSO2)) === null, "passo 2 de novo sem erro");
conf = (await db.query(VERIFICACAO)).rows;
ok(conf.length === 11 && conf.every((r) => r.ok === true), `depois do passo 2: 11 itens, todos ok`, conf.filter((r) => !r.ok));
ok((await aplicar(db, MIGRATION)) === null, "migration roda de novo depois do passo 2 (CHECK já validado)");

console.log("\n== Rollback ==");
const eGuarda = await aplicar(db, ROLLBACK);
ok(eGuarda?.includes("EMN-RB1"), "com mínimo preenchido, o rollback recusa (EMN-RB1)", eGuarda);
ok(await temColuna(db, "produtos"), "... e a coluna continua lá");
await db.exec("UPDATE public.produtos SET estoque_minimo = NULL; UPDATE public.pecas SET estoque_minimo = NULL;");
ok((await aplicar(db, ROLLBACK)) === null, "sem mínimo preenchido, o rollback passa");
ok((await aplicar(db, ROLLBACK)) === null, "rollback de novo sem erro");
ok(!(await temColuna(db, "produtos")) && !(await temColuna(db, "pecas")), "colunas removidas");
ok((await arquivo(db, "produtos")) === arqAntes.produtos, "rollback também não reescreve a tabela");
ok((await erro(db.query("SELECT public.teste_copiar_para_historico($1)", [umProduto]))) === null, "depois do rollback a cópia (c) volta a funcionar");
ok((await aplicar(db, MIGRATION)) === null, "migration aplica de novo depois do rollback");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nOK: todos os testes passaram");
process.exit(falhas ? 1 : 0);
