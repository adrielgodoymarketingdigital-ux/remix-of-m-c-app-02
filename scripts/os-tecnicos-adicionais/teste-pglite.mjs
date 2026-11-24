// Técnicos adicionais da OS — F1 (só banco). Prova num Postgres 17 LOCAL
// (PGlite, WebAssembly, em memória). Não toca produção nem banco nenhum de verdade.
// Dados 100% fictícios.
//
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/os-tecnicos-adicionais/teste-pglite.mjs
//
// Réplica: ordens_servico / loja_funcionarios / empresa_usuarios com as
// policies EM VIGOR no repositório (mapeamento F1), is_funcionario_of,
// is_colleague_of, trigger de auditoria simplificado e o _zerar_catalogo()
// REAL da 20261102120000. Por cima, as 3 migrations REAIS da F1, inteiras.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const MIG1 = ler("supabase/migrations/20261125120000_os_tecnicos_adicionais.sql");
const MIG2 = ler("supabase/migrations/20261125120100_salvar_tecnicos_os.sql");
const MIG3 = ler("supabase/migrations/20261125120200_zerar_catalogo_os_tecnicos_adicionais.sql");
const RB1 = ler("scripts/os-tecnicos-adicionais/rollback-1-tabela.sql");
const RB2 = ler("scripts/os-tecnicos-adicionais/rollback-2-funcao.sql");
const RB3 = ler("scripts/os-tecnicos-adicionais/rollback-3-zerar-catalogo.sql");
const VERIF = ler("scripts/os-tecnicos-adicionais/9-verificar.sql");

const catalogoFonte = ler("supabase/migrations/20261102120000_configuracao_estoque_baixo.sql");
const mCat = catalogoFonte.match(/CREATE OR REPLACE FUNCTION public\._zerar_catalogo\(\)[\s\S]*?\n\$\$;/);
if (!mCat) throw new Error("não achei _zerar_catalogo na 20261102120000");

// ids fictícios
const id = (p, n) => `${p}0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const U1 = id("a", 1), U2 = id("a", 2), F1 = id("a", 11), F2 = id("a", 12), G1 = id("a", 21), FB = id("a", 31);
const LA1 = id("b", 1), LA2 = id("b", 2), LA3 = id("b", 3), LA4 = id("b", 4), LA5 = id("b", 5), LA6 = id("b", 6), LADONO = id("b", 9), LB1 = id("b", 11);
const E1 = id("c", 1);
const OS1 = id("d", 1), OS2 = id("d", 2), OS3 = id("d", 3), OS4 = id("d", 4), OS5 = id("d", 5);

const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.loja_funcionarios (
  id uuid PRIMARY KEY, loja_user_id uuid NOT NULL, funcionario_user_id uuid,
  nome text, ativo boolean NOT NULL DEFAULT true, eh_dono boolean NOT NULL DEFAULT false, empresa_id uuid);
CREATE TABLE public.empresa_usuarios (gerente_id uuid, proprietario_id uuid, empresa_id uuid);
CREATE TABLE public.ordens_servico (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, empresa_id uuid, funcionario_id uuid,
  deleted_at timestamptz, updated_at timestamptz DEFAULT now());
CREATE TABLE public.os_audit_log (id serial PRIMARY KEY, os_id uuid, acao text);

CREATE FUNCTION public.is_funcionario_of(owner_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.loja_funcionarios
   WHERE funcionario_user_id = auth.uid() AND loja_user_id = owner_user_id AND ativo = true) $$;
CREATE FUNCTION public.is_colleague_of(target_loja_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.loja_funcionarios
   WHERE funcionario_user_id = auth.uid() AND ativo = true AND loja_user_id = target_loja_user_id) $$;

CREATE FUNCTION public.os_audit_trigger_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO public.os_audit_log (os_id, acao) VALUES (NEW.id, TG_OP); RETURN NEW; END $$;
CREATE TRIGGER os_audit_trigger AFTER INSERT OR UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_audit_trigger_fn();

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY eu_le ON public.empresa_usuarios FOR SELECT TO authenticated USING (true);

-- ordens_servico: policies em vigor no repositório (ver relatório F1)
CREATE POLICY "Users can view own service orders" ON public.ordens_servico FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own service orders" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own service orders" ON public.ordens_servico FOR DELETE USING ((auth.uid() = user_id) OR is_funcionario_of(user_id));
CREATE POLICY "Funcionarios podem ver ordens do dono" ON public.ordens_servico FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));
CREATE POLICY "Funcionarios podem atualizar ordens do dono" ON public.ordens_servico FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));
CREATE POLICY "Funcionarios podem ver OS do dono" ON public.ordens_servico FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));
CREATE POLICY "Funcionarios podem inserir OS para o dono" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_funcionario_of(user_id));
CREATE POLICY "gerente ve registros da filial em ordens_servico" ON public.ordens_servico FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.empresa_usuarios eu WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = ordens_servico.user_id AND eu.empresa_id = ordens_servico.empresa_id));
CREATE POLICY "gerente atualiza registros da filial em ordens_servico" ON public.ordens_servico FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.empresa_usuarios eu WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = ordens_servico.user_id
   AND (eu.empresa_id = ordens_servico.empresa_id OR ordens_servico.empresa_id IS NULL)));

-- loja_funcionarios: policies em vigor
CREATE POLICY "Dono gerencia funcionarios" ON public.loja_funcionarios FOR ALL TO authenticated USING (loja_user_id = auth.uid()) WITH CHECK (loja_user_id = auth.uid());
CREATE POLICY "Funcionario ve proprio registro" ON public.loja_funcionarios FOR SELECT TO authenticated USING (funcionario_user_id = auth.uid() OR loja_user_id = auth.uid());
CREATE POLICY "Funcionario pode ver colegas da mesma loja" ON public.loja_funcionarios FOR SELECT TO authenticated USING (public.is_colleague_of(loja_user_id));
CREATE POLICY "Gerente gerencia funcionarios da loja" ON public.loja_funcionarios FOR ALL TO authenticated
  USING (loja_user_id = (SELECT proprietario_id FROM public.empresa_usuarios WHERE gerente_id = auth.uid() LIMIT 1))
  WITH CHECK (loja_user_id = (SELECT proprietario_id FROM public.empresa_usuarios WHERE gerente_id = auth.uid() LIMIT 1));

${mCat[0]}
REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;

INSERT INTO auth.users VALUES ('${U1}','u1@teste.local'),('${U2}','u2@teste.local'),('${F1}','f1@teste.local'),
  ('${F2}','f2@teste.local'),('${G1}','g1@teste.local'),('${FB}','fb@teste.local');
INSERT INTO public.loja_funcionarios (id, loja_user_id, funcionario_user_id, nome, ativo, eh_dono) VALUES
  ('${LA1}','${U1}','${F1}','Ana',true,false), ('${LA2}','${U1}','${F2}','Bia',true,false),
  ('${LA3}','${U1}',NULL,'Caio sem login',true,false), ('${LA4}','${U1}',NULL,'Davi inativo',false,false),
  ('${LA5}','${U1}',NULL,'Edu',true,false), ('${LA6}','${U1}',NULL,'Fábio',true,false),
  ('${LADONO}','${U1}',NULL,'Dono',true,true), ('${LB1}','${U2}','${FB}','Outra loja',true,false);
INSERT INTO public.empresa_usuarios VALUES ('${G1}','${U1}','${E1}');
INSERT INTO public.ordens_servico (id, user_id, empresa_id, funcionario_id, deleted_at) VALUES
  ('${OS1}','${U1}',NULL,'${LA1}',NULL), ('${OS2}','${U1}','${E1}','${LA1}',NULL),
  ('${OS3}','${U2}',NULL,'${LB1}',NULL), ('${OS4}','${U1}',NULL,'${LA1}',now()),
  ('${OS5}','${U1}',NULL,'${LA1}',NULL);
`;

let ok = 0, falhas = 0;
const t = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log("  ok  ", nome); }
  else { falhas++; console.log("  FALHA", nome, extra); }
};

async function como(db, uid, fn) {
  await db.query("SELECT set_config('request.jwt.claims', $1, false)", [uid ? JSON.stringify({ sub: uid, role: "authenticated" }) : ""]);
  await db.exec(uid ? "SET ROLE authenticated" : "SET ROLE anon");
  try { return await fn(); } finally {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims', '', false)");
  }
}
const salvar = (db, os, principal, adicionais) =>
  db.query("SELECT public.salvar_tecnicos_os($1, $2, $3::uuid[]) AS r", [os, principal, adicionais]).then((r) => r.rows[0].r);
async function erro(p) {
  try { await p; return null; } catch (e) { return e.code || e.message; }
}
const adicionaisDe = async (db, os) =>
  (await db.query("SELECT funcionario_id FROM public.os_tecnicos_adicionais WHERE os_id = $1 ORDER BY funcionario_id", [os])).rows.map((r) => r.funcionario_id);
const principalDe = async (db, os) => (await db.query("SELECT funcionario_id FROM public.ordens_servico WHERE id = $1", [os])).rows[0].funcionario_id;
const auditoria = async (db, os) => Number((await db.query("SELECT count(*)::int n FROM public.os_audit_log WHERE os_id = $1 AND acao = 'UPDATE'", [os])).rows[0].n);
const estado = async (db) => JSON.stringify([
  (await db.query("SELECT os_id, user_id, funcionario_id FROM public.os_tecnicos_adicionais ORDER BY 1,3")).rows,
  (await db.query("SELECT id, funcionario_id FROM public.ordens_servico ORDER BY 1")).rows,
]);
const md5 = (s) => createHash("md5").update(s).digest("hex");
const defCatalogo = async (db) => (await db.query("SELECT pg_get_functiondef('public._zerar_catalogo()'::regprocedure) d")).rows[0].d;
const ordenar = (a) => [...a].sort();

const db = new PGlite();
await db.exec(BASE);
const catalogoAntes = await defCatalogo(db);
const linhasAntes = Number((await db.query("SELECT count(*)::int n FROM public._zerar_catalogo()")).rows[0].n);

console.log("\nA. Migrations aplicam e são idempotentes");
await db.exec(MIG1); await db.exec(MIG2); await db.exec(MIG3);
await db.exec(MIG1); await db.exec(MIG2); await db.exec(MIG3);
const v = (await db.query(VERIF.split(";\n\nSELECT policyname")[0])).rows[0];
for (const [k, val] of Object.entries(v)) if (k.startsWith("ok_")) t(`verificar: ${k}`, val === true, String(val));
const linhasDepois = Number((await db.query("SELECT count(*)::int n FROM public._zerar_catalogo()")).rows[0].n);
t("catálogo ganhou exatamente 1 linha (2ª execução não duplica)", linhasDepois === linhasAntes + 1, `${linhasAntes}→${linhasDepois}`);
const linha12 = (await db.query("SELECT * FROM public._zerar_catalogo() WHERE ordem = 12")).rows[0];
t("linha 12 = APAGAR/os/os_tecnicos_adicionais", linha12?.lista === "APAGAR" && linha12?.categoria === "os" && linha12?.tabela === "public.os_tecnicos_adicionais");
t("demais linhas do catálogo intactas", md5(JSON.stringify((await db.query("SELECT * FROM public._zerar_catalogo() WHERE ordem <> 12 ORDER BY ordem")).rows))
  === md5(JSON.stringify((await (async () => { const d2 = new PGlite(); await d2.exec(BASE); const r = (await d2.query("SELECT * FROM public._zerar_catalogo() ORDER BY ordem")).rows; await d2.close(); return r; })()))));

console.log("\nB. Dono grava pela função");
let r = await como(db, U1, () => salvar(db, OS1, LA1, [LA2, LA3]));
t("2 adicionais inseridos", r.inseridos === 2 && r.removidos === 0 && r.principal_alterado === false, JSON.stringify(r));
t("tabela tem LA2, LA3", JSON.stringify(await adicionaisDe(db, OS1)) === JSON.stringify(ordenar([LA2, LA3])));
t("principal igual não gera UPDATE na OS (auditoria 0)", (await auditoria(db, OS1)) === 0);
r = await como(db, U1, () => salvar(db, OS1, LA1, [LA3, LA2]));
t("reenviar o mesmo conjunto: nada muda", r.inseridos === 0 && r.removidos === 0);
r = await como(db, U1, () => salvar(db, OS1, LA2, [LA1, LADONO]));
t("troca principal↔adicional numa chamada só", r.removidos === 2 && r.inseridos === 2 && r.principal_alterado === true, JSON.stringify(r));
t("principal agora LA2", (await principalDe(db, OS1)) === LA2);
t("adicionais agora LA1 + dono-como-funcionário", JSON.stringify(await adicionaisDe(db, OS1)) === JSON.stringify(ordenar([LA1, LADONO])));
t("auditoria: 1 UPDATE (só a troca de principal)", (await auditoria(db, OS1)) === 1);
r = await como(db, U1, () => salvar(db, OS1, LA2, [LA1, LA3, LA5, LA6]));
t("4 adicionais: ok", (await adicionaisDe(db, OS1)).length === 4);
r = await como(db, U1, () => salvar(db, OS1, LA2, []));
t("lista vazia remove todos os adicionais", (await adicionaisDe(db, OS1)).length === 0 && r.removidos === 4);
r = await como(db, U1, () => salvar(db, OS1, LA2, null));
t("NULL = lista vazia", r.inseridos === 0 && r.removidos === 0);

console.log("\nC. Recusas (e nada muda quando recusa)");
await como(db, U1, () => salvar(db, OS1, LA1, [LA2, LA3]));
const antes = await estado(db);
const casos = [
  ["principal nulo", U1, OS1, null, [LA2], "TA002"],
  ["5 adicionais", U1, OS1, LA1, [LA2, LA3, LA5, LA6, LADONO], "TA005"],
  ["repetido", U1, OS1, LA1, [LA2, LA2], "TA006"],
  ["item nulo", U1, OS1, LA1, [LA2, null], "TA006"],
  ["adicional = principal", U1, OS1, LA1, [LA1], "TA003"],
  ["funcionário de outra loja", U1, OS1, LA1, [LB1], "TA004"],
  ["principal de outra loja", U1, OS1, LB1, [], "TA004"],
  ["adicional novo inativo", U1, OS1, LA1, [LA4], "TA004"],
  ["trocar para principal inativo", U1, OS1, LA4, [], "TA007"],
  ["id inexistente", U1, OS1, LA1, [id("e", 99)], "TA004"],
  ["OS na lixeira", U1, OS4, LA1, [LA2], "TA001"],
  ["OS de outra loja (dono U1)", U1, OS3, LB1, [], "TA001"],
  ["funcionário de outra loja chamando OS de U1", FB, OS1, LA1, [], "TA001"],
  ["OS inexistente", U1, id("d", 99), LA1, [], "TA001"],
];
for (const [nome, quem, os, p, a, cod] of casos) {
  const c = await como(db, quem, () => erro(salvar(db, os, p, a)));
  t(`${nome} → ${cod}`, c === cod, String(c));
}
t("estado idêntico depois das recusas", (await estado(db)) === antes);
t("anon não executa a função", (await como(db, null, () => erro(salvar(db, OS1, LA1, [])))) === "42501");

console.log("\nD. Funcionário e gerente de filial (pelo RLS em vigor)");
r = await como(db, F1, () => salvar(db, OS1, LA1, [LA2]));
t("funcionário ativo da loja grava", r.removidos === 1 && JSON.stringify(await adicionaisDe(db, OS1)) === JSON.stringify([LA2]));
t("funcionário vê os adicionais", (await como(db, F2, () => db.query("SELECT count(*)::int n FROM public.os_tecnicos_adicionais WHERE os_id = $1", [OS1]))).rows[0].n === 1);
r = await como(db, G1, () => salvar(db, OS2, LA1, [LA3]));
t("gerente grava em OS da filial dele", r.inseridos === 1);
t("gerente NÃO grava em OS da matriz (empresa nula)", (await como(db, G1, () => erro(salvar(db, OS1, LA1, [])))) === "TA001");
t("gerente não vê adicionais da matriz", (await como(db, G1, () => db.query("SELECT count(*)::int n FROM public.os_tecnicos_adicionais WHERE os_id = $1", [OS1]))).rows[0].n === 0);
t("outra loja não vê nada", (await como(db, U2, () => db.query("SELECT count(*)::int n FROM public.os_tecnicos_adicionais"))).rows[0].n === 0);
await db.exec(`UPDATE public.loja_funcionarios SET ativo = false WHERE id = '${LA1}'`);
t("funcionário desativado perde acesso", (await como(db, F1, () => erro(salvar(db, OS1, LA2, [])))) === "TA001");
await db.exec(`UPDATE public.loja_funcionarios SET ativo = true WHERE id = '${LA1}'`);

console.log("\nE. Insert direto pela API (sem a função) também respeita as regras");
const ins = (os, dono, f) => db.query("INSERT INTO public.os_tecnicos_adicionais (os_id, user_id, funcionario_id) VALUES ($1,$2,$3)", [os, dono, f]);
await como(db, U1, () => salvar(db, OS5, LA1, [LA2, LA3, LA5, LA6]));
t("5º adicional direto → TA005", (await como(db, U1, () => erro(ins(OS5, U1, LADONO)))) === "TA005");
await como(db, U1, () => salvar(db, OS5, LA1, []));
t("principal direto → TA003", (await como(db, U1, () => erro(ins(OS5, U1, LA1)))) === "TA003");
t("user_id de outro dono → recusa", (await como(db, U1, () => erro(ins(OS5, U2, LA2)))) !== null);
t("funcionário de outra loja → recusa", (await como(db, U1, () => erro(ins(OS5, U1, LB1)))) !== null);
t("inativo → TA004", (await como(db, U1, () => erro(ins(OS5, U1, LA4)))) === "TA004");
t("repetido → 23505", await (async () => { await como(db, U1, () => ins(OS5, U1, LA2)); return (await como(db, U1, () => erro(ins(OS5, U1, LA2)))) === "23505"; })());
t("UPDATE direto → sem permissão", (await como(db, U1, () => erro(db.query("UPDATE public.os_tecnicos_adicionais SET funcionario_id = $1 WHERE os_id = $2", [LA3, OS5])))) === "42501");
t("anon não lê a tabela", (await como(db, null, () => erro(db.query("SELECT 1 FROM public.os_tecnicos_adicionais")))) === "42501");
t("U2 não insere na OS de U1", (await como(db, U2, () => erro(ins(OS5, U1, LA3)))) !== null);

console.log("\nF. Cascata");
await db.exec(`DELETE FROM public.loja_funcionarios WHERE id = '${LA2}'`);
t("funcionário excluído some das OS (CASCADE)", !(await adicionaisDe(db, OS5)).includes(LA2));
await como(db, U1, () => salvar(db, OS5, LA1, [LA3]));
await db.exec(`DELETE FROM public.ordens_servico WHERE id = '${OS5}'`);
t("OS excluída de vez leva os adicionais (CASCADE)", (await adicionaisDe(db, OS5)).length === 0);

console.log("\nG. Rollbacks (ordem 3 → 2 → 1)");
t("rollback-1 recusa antes do 3", (await erro(db.exec(RB1))) !== null);
await db.exec("ROLLBACK").catch(() => {});
await db.exec(RB3);
t("rollback-3 volta o texto EXATO do catálogo (md5)", md5(await defCatalogo(db)) === md5(catalogoAntes));
await db.exec(RB3);
t("rollback-3 2ª vez não quebra", md5(await defCatalogo(db)) === md5(catalogoAntes));
await db.exec(RB2); await db.exec(RB1);
t("tabela e funções removidas", (await db.query(`SELECT to_regclass('public.os_tecnicos_adicionais') IS NULL a,
  to_regprocedure('public.salvar_tecnicos_os(uuid,uuid,uuid[])') IS NULL b,
  to_regprocedure('public.os_tecnicos_adicionais_validar()') IS NULL c`)).rows.every((x) => x.a && x.b && x.c));
await db.exec(MIG1); await db.exec(MIG2); await db.exec(MIG3);
t("reaplicar depois do rollback funciona", Number((await db.query("SELECT count(*)::int n FROM public._zerar_catalogo()")).rows[0].n) === linhasAntes + 1);

console.log("\nH. Remendo recusa sem âncora");
const db2 = new PGlite();
await db2.exec(BASE.replace("'public.os_tecnicos',", "'public.os_tecnicos_X',"));
await db2.exec(MIG1);
const e3 = await erro(db2.exec(MIG3));
await db2.exec("ROLLBACK").catch(() => {});
t("sem a linha 10 de os_tecnicos → erro e catálogo intacto",
  e3 !== null && !(await db2.query("SELECT 1 FROM public._zerar_catalogo() WHERE ordem = 12")).rows.length);
await db2.close();

await db.close();
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
