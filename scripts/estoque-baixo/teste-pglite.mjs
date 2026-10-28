// Teste da migration 20261102120000 (estoque baixo, fase 2) num Postgres 17
// local (PGlite, WebAssembly). Não toca em produção: monta uma réplica mínima
// do que a migration usa e testa permissões, CHECK, catálogo, rollback e
// a conferência.
//
// Rodar (o PGlite não é dependência do projeto; 0.3.4 quebra em RAISE):
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/estoque-baixo/teste-pglite.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const MIGRATION = ler("supabase/migrations/20261102120000_configuracao_estoque_baixo.sql");
const ROLLBACK = ler("scripts/estoque-baixo/rollback.sql");
const VERIFICACAO = ler("scripts/estoque-baixo/verificacao.sql");
// _zerar_catalogo() como está na main (etapa 3a): o bloco CREATE ... REVOKE.
const ETAPA_3A = ler("supabase/migrations/20261029120000_zerar_cota_registros_apagados_etapa3a.sql");
const CATALOGO_3A = ETAPA_3A.slice(
  ETAPA_3A.indexOf("CREATE OR REPLACE FUNCTION public._zerar_catalogo()"),
  ETAPA_3A.indexOf("-- 3) Execução"),
).replace(/-- -+\s*$/, "");

// ---------------------------------------------------------------------------
// Réplica mínima. is_funcionario_of: definição de 20260207001545 (a última
// nas migrations). Policies de empresa_usuarios: 20260515000001.
// update_updated_at_column: a de sempre (conferir em produção, consulta 4).
// ---------------------------------------------------------------------------
const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.loja_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_user_id uuid NOT NULL, funcionario_user_id uuid, ativo boolean DEFAULT true
);
ALTER TABLE public.loja_funcionarios ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_funcionario_of(owner_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loja_funcionarios
    WHERE funcionario_user_id = auth.uid() AND loja_user_id = owner_user_id AND ativo = true
  )
$$;

CREATE TABLE public.empresa_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid, proprietario_id uuid, gerente_id uuid, ativa boolean DEFAULT true
);
ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proprietario pode ver empresa_usuarios" ON public.empresa_usuarios
  FOR SELECT USING (proprietario_id = auth.uid());
CREATE POLICY "gerente pode ler sua propria linha" ON public.empresa_usuarios
  FOR SELECT USING (gerente_id = auth.uid());

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
`;

// ---------------------------------------------------------------------------
let falhas = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log("  ✓", msg);
  else { falhas++; console.log("  ✗", msg, extra === undefined ? "" : JSON.stringify(extra)); }
};
const db = new PGlite();
const um = async (sql, p) => (await db.query(sql, p)).rows[0];

async function como(papel, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${papel}`);
    await tx.query("SELECT set_config('request.jwt.claims', $1, true)",
      [JSON.stringify(uid ? { sub: uid, role: papel } : { role: papel })]);
    return fn(tx);
  });
}
async function erro(promessa) {
  try { await promessa; return null; } catch (e) {
    if (process.env.MOSTRAR_ERROS) console.log("      erro esperado:", e.message);
    return e.message;
  }
}
async function aplicar(sql) {
  try { await db.exec(sql); return null; } catch (e) { await db.exec("ROLLBACK").catch(() => {}); return e.message; }
}
const ler1 = (papel, uid, alvo) => como(papel, uid, async (tx) =>
  (await tx.query("SELECT limite_baixo FROM public.configuracao_estoque WHERE user_id = $1", [alvo])).rows);
// Mesmo comando que o PostgREST gera para .upsert(..., { onConflict: 'user_id' })
const upsert = (papel, uid, alvo, limite) => como(papel, uid, (tx) => tx.query(
  `INSERT INTO public.configuracao_estoque (user_id, limite_baixo) VALUES ($1, $2)
   ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id, limite_baixo = EXCLUDED.limite_baixo
   RETURNING limite_baixo`, [alvo, limite]));
const atualizar = (papel, uid, alvo, limite) => como(papel, uid, async (tx) =>
  (await tx.query("UPDATE public.configuracao_estoque SET limite_baixo = $2 WHERE user_id = $1", [alvo, limite])).affectedRows);
const limiteDe = async (alvo) => (await um("SELECT limite_baixo FROM public.configuracao_estoque WHERE user_id = $1", [alvo]))?.limite_baixo;
const catalogo = async () => (await db.query("SELECT * FROM public._zerar_catalogo() ORDER BY ordem")).rows;

// ---------------------------------------------------------------------------
console.log("\n== Montagem ==");
await db.exec(BASE);
await db.exec(CATALOGO_3A);
const catalogoAntes = await catalogo();
ok(catalogoAntes.length === 111, `catálogo da etapa 3a com 111 linhas (${catalogoAntes.length})`);

const novoUsuario = async (email) => (await um("INSERT INTO auth.users (email) VALUES ($1) RETURNING id", [email])).id;
const dono = await novoUsuario("dono@x.test");
const outroDono = await novoUsuario("outro@x.test");
const func = await novoUsuario("func@x.test");
const funcInativo = await novoUsuario("func2@x.test");
const gerente = await novoUsuario("gerente@x.test");
const gerenteOutro = await novoUsuario("gerente2@x.test");
const estranho = await novoUsuario("estranho@x.test");
await db.query("INSERT INTO public.loja_funcionarios (loja_user_id, funcionario_user_id, ativo) VALUES ($1, $2, true), ($1, $3, false)", [dono, func, funcInativo]);
await db.query("INSERT INTO public.empresa_usuarios (empresa_id, proprietario_id, gerente_id) VALUES (gen_random_uuid(), $1, $2), (gen_random_uuid(), $3, $4)", [dono, gerente, outroDono, gerenteOutro]);

console.log("\n== Migration falha inteira se faltar dependência ==");
await db.exec("ALTER FUNCTION public.update_updated_at_column() RENAME TO update_updated_at_column_x");
const eFalta = await aplicar(MIGRATION);
ok(eFalta !== null, "sem update_updated_at_column a migration dá erro", eFalta);
ok((await um("SELECT to_regclass('public.configuracao_estoque') AS t")).t === null, "... e não deixa a tabela criada");
ok(JSON.stringify(await catalogo()) === JSON.stringify(catalogoAntes), "... e não muda o catálogo");
await db.exec("ALTER FUNCTION public.update_updated_at_column_x() RENAME TO update_updated_at_column");

console.log("\n== Migration (duas vezes: idempotente) ==");
ok((await aplicar(MIGRATION)) === null, "aplica sem erro");
ok((await aplicar(MIGRATION)) === null, "aplica de novo sem erro");

console.log("\n== Catálogo do Começar do zero ==");
const catalogoDepois = await catalogo();
ok(catalogoDepois.length === 112, `112 linhas (${catalogoDepois.length})`);
const novas = catalogoDepois.filter((d) => !catalogoAntes.some((a) => JSON.stringify(a) === JSON.stringify(d)));
const sumidas = catalogoAntes.filter((a) => !catalogoDepois.some((d) => JSON.stringify(a) === JSON.stringify(d)));
ok(sumidas.length === 0, "nenhuma linha da etapa 3a mudou ou sumiu", sumidas);
ok(novas.length === 1 && novas[0].tabela === "public.configuracao_estoque" && novas[0].lista === "MANTER"
  && novas[0].filtro === "user_id = $1" && novas[0].ordem === 1550, "só entrou configuracao_estoque como MANTER (1550)", novas);
ok(await erro(como("authenticated", dono, (tx) => tx.query("SELECT * FROM public._zerar_catalogo()"))) !== null,
  "authenticated não executa _zerar_catalogo");

console.log("\n== Dono ==");
ok((await ler1("authenticated", dono, dono)).length === 0, "sem linha: lê vazio (app usa o padrão da tela)");
ok((await upsert("authenticated", dono, dono, 3)).rows[0]?.limite_baixo === 3, "grava 3 (upsert do app)");
ok((await ler1("authenticated", dono, dono))[0]?.limite_baixo === 3, "lê 3");
const criado = await um("SELECT created_at, updated_at FROM public.configuracao_estoque WHERE user_id = $1", [dono]);
ok((await upsert("authenticated", dono, dono, 0)).rows[0]?.limite_baixo === 0, "regrava 0 (não avisar) pelo mesmo upsert");
const depois = await um("SELECT created_at, updated_at FROM public.configuracao_estoque WHERE user_id = $1", [dono]);
ok(depois.created_at.getTime() === criado.created_at.getTime() && depois.updated_at > criado.updated_at, "updated_at anda, created_at fica");
ok((await upsert("authenticated", dono, dono, null)).rows[0]?.limite_baixo === null, "limpa (nulo = padrão)");
ok((await atualizar("authenticated", dono, dono, 4)) === 1, "UPDATE direto funciona");
ok(await erro(como("authenticated", dono, (tx) => tx.query("INSERT INTO public.configuracao_estoque (user_id, limite_baixo) VALUES ($1, 3)", [dono]))) !== null,
  "segunda linha para o mesmo dono é recusada (linha única)");
ok(await erro(upsert("authenticated", dono, outroDono, 3)) !== null, "não grava no id de outro dono");
ok(await erro(como("authenticated", dono, (tx) => tx.query("UPDATE public.configuracao_estoque SET user_id = $2 WHERE user_id = $1", [dono, outroDono]))) !== null,
  "não troca o user_id da própria linha para outro dono");
ok(await erro(como("authenticated", dono, (tx) => tx.query("DELETE FROM public.configuracao_estoque WHERE user_id = $1", [dono]))) !== null,
  "não apaga (sem DELETE para usuário)");
ok((await limiteDe(dono)) === 4, "limite do dono continua 4");

console.log("\n== CHECK ==");
for (const v of [-1, 1001, 99999]) ok(await erro(upsert("authenticated", dono, dono, v)) !== null, `recusa ${v}`);
for (const v of [0, 1000]) ok((await upsert("authenticated", dono, dono, v)).rows[0]?.limite_baixo === v, `aceita ${v}`);
await upsert("authenticated", dono, dono, 4);

console.log("\n== Funcionário ==");
ok((await ler1("authenticated", func, dono))[0]?.limite_baixo === 4, "funcionário ativo lê o limite do dono");
ok(await erro(upsert("authenticated", func, dono, 9)) !== null, "funcionário não grava pelo upsert");
ok((await atualizar("authenticated", func, dono, 9)) === 0, "UPDATE do funcionário não pega nenhuma linha");
ok(await erro(como("authenticated", func, (tx) => tx.query("DELETE FROM public.configuracao_estoque"))) !== null, "funcionário não apaga");
ok((await ler1("authenticated", funcInativo, dono)).length === 0, "funcionário inativo não lê");

console.log("\n== Gerente de filial ==");
ok((await ler1("authenticated", gerente, dono))[0]?.limite_baixo === 4, "gerente lê o limite do proprietário");
ok(await erro(upsert("authenticated", gerente, dono, 9)) !== null, "gerente não grava pelo upsert");
ok((await atualizar("authenticated", gerente, dono, 9)) === 0, "UPDATE do gerente não pega nenhuma linha");
ok((await ler1("authenticated", gerenteOutro, dono)).length === 0, "gerente de outro proprietário não lê");
ok((await limiteDe(dono)) === 4, "limite do dono continua 4 depois das tentativas");

console.log("\n== Outro usuário e anon ==");
ok((await ler1("authenticated", estranho, dono)).length === 0, "outro usuário não lê");
ok(await erro(upsert("authenticated", estranho, dono, 9)) !== null, "outro usuário não grava no dono");
ok((await atualizar("authenticated", estranho, dono, 9)) === 0, "outro usuário não atualiza");
ok(await erro(como("anon", null, (tx) => tx.query("SELECT * FROM public.configuracao_estoque"))) !== null, "anon não lê (sem privilégio)");
ok(await erro(como("anon", null, (tx) => tx.query("INSERT INTO public.configuracao_estoque (user_id, limite_baixo) VALUES ($1, 1)", [estranho]))) !== null, "anon não grava");
ok((await limiteDe(dono)) === 4, "limite do dono continua 4");

console.log("\n== Conferência (verificacao.sql) ==");
const conf = (await db.query(VERIFICACAO)).rows;
ok(conf.length === 18 && conf.every((r) => r.ok === true), `18 itens, todos ok (${conf.filter((r) => r.ok).length})`,
  conf.filter((r) => r.ok !== true));

console.log("\n== Exclusão da conta ==");
await db.query("DELETE FROM auth.users WHERE id = $1", [dono]);
ok((await limiteDe(dono)) === undefined, "apagar o usuário apaga a linha (CASCADE)");

console.log("\n== Rollback (duas vezes) ==");
ok((await aplicar(ROLLBACK)) === null, "rollback sem erro");
ok((await aplicar(ROLLBACK)) === null, "rollback de novo sem erro");
ok((await um("SELECT to_regclass('public.configuracao_estoque') AS t")).t === null, "tabela apagada");
ok(JSON.stringify(await catalogo()) === JSON.stringify(catalogoAntes), "catálogo idêntico ao da etapa 3a");
ok((await aplicar(MIGRATION)) === null, "migration aplica de novo depois do rollback");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nOK: todos os testes passaram");
process.exit(falhas ? 1 : 0);
