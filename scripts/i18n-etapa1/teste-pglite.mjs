// Teste da etapa 1 do i18n num Postgres 17 local (PGlite, WebAssembly).
// Não toca em produção: monta uma réplica mínima do que a migration usa
// (auth.users + os 3 gatilhos de cadastro, profiles com RLS, papéis do
// Supabase e privilégios padrão), aplica a migration e testa.
//
// Rodar (o PGlite não é dependência do projeto):
// (0.3.4 quebra em qualquer RAISE de plpgsql; 0.3.16 não)
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/i18n-etapa1/teste-pglite.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const MIGRATION = ler("supabase/migrations/20261030120000_i18n_mercado_idioma_etapa1.sql");
const HANDLE_BASE = ler("supabase/migrations/20260525000002_handle_new_user_tracking_fields.sql");
const ROLLBACK = ler("scripts/i18n-etapa1/rollback.sql");
const VERIFICACAO = ler("scripts/i18n-etapa1/verificacao.sql");

// ---------------------------------------------------------------------------
// Réplica mínima (definições de auth.*, has_role, get_loja_owner_id,
// criar_assinatura_basica_gratuita e notificar_novo_usuario copiadas da
// produção em 2026-10-26; a chave do http_post foi trocada por um texto fixo)
// ---------------------------------------------------------------------------
const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_auth_admin NOLOGIN;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, supabase_auth_admin;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT ALL ON auth.users TO supabase_auth_admin;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;

CREATE SCHEMA net;
CREATE TABLE net.chamadas (id serial PRIMARY KEY, url text, body jsonb);
CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint
LANGUAGE sql AS $$ INSERT INTO net.chamadas (url, body) VALUES (url, body) RETURNING id::bigint $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  celular text,
  registration_tracked boolean DEFAULT false,
  last_login_at timestamptz,
  login_count integer DEFAULT 0,
  crm_stage text,
  whatsapp_enviado boolean,
  whatsapp_ultima_mensagem timestamptz,
  preferencias_os jsonb,
  fbc text, fbp text, fbclid text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  purchase_event_id text
);
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins podem ver todos os profiles" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "Admins podem atualizar profiles" ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plano_tipo text, status text,
  data_inicio timestamptz, free_trial_ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE FUNCTION public.criar_assinatura_basica_gratuita() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.assinaturas (user_id, plano_tipo, status, data_inicio, free_trial_ends_at)
  VALUES (NEW.id, 'free', 'active', now(), now() + interval '24 hours')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE FUNCTION public.notificar_novo_usuario() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://exemplo.supabase.co/functions/v1/notificar-novo-cadastro',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer (omitida)'),
    body := jsonb_build_object('type', 'INSERT', 'table', 'users', 'schema', 'auth',
      'record', jsonb_build_object('id', NEW.id, 'email', NEW.email)));
  RETURN NEW;
END; $$;

CREATE TABLE public.loja_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_user_id uuid NOT NULL, funcionario_user_id uuid,
  nome text NOT NULL DEFAULT 'f', email text NOT NULL DEFAULT 'f@x', ativo boolean DEFAULT true
);
CREATE FUNCTION public.get_loja_owner_id() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE owner_id UUID;
BEGIN
  SELECT loja_user_id INTO owner_id FROM public.loja_funcionarios
   WHERE funcionario_user_id = auth.uid() AND ativo = true LIMIT 1;
  IF owner_id IS NOT NULL THEN RETURN owner_id; END IF;
  RETURN auth.uid();
END; $$;
CREATE FUNCTION public.is_funcionario_of(_dono uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM loja_funcionarios WHERE loja_user_id = _dono
                  AND funcionario_user_id = auth.uid() AND ativo) $$;

CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid, nome text NOT NULL, tipo text NOT NULL DEFAULT 'filial'
);
CREATE TABLE public.empresa_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid, proprietario_id uuid, gerente_id uuid,
  ativa boolean DEFAULT true, created_at timestamptz DEFAULT now()
);

CREATE TABLE public.configuracoes_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_loja text NOT NULL, user_id uuid NOT NULL, empresa_id uuid
);
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own store config" ON public.configuracoes_loja FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own store config" ON public.configuracoes_loja FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Apenas usuários autenticados acessam configurações" ON public.configuracoes_loja FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Funcionarios veem config loja do dono" ON public.configuracoes_loja FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_funcionario_of(user_id));
CREATE POLICY "Users can view own store config" ON public.configuracoes_loja FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own store config" ON public.configuracoes_loja FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Funcionarios podem atualizar config loja do dono" ON public.configuracoes_loja FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_funcionario_of(user_id)) WITH CHECK (auth.uid() = user_id OR is_funcionario_of(user_id));

-- RPC SECURITY DEFINER qualquer que o app chamasse (molde de update_crm_stage)
-- (plpgsql: o corpo só é validado na chamada, depois da migration criar a coluna)
CREATE FUNCTION public.rpc_teste_mudar_mercado(p text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN UPDATE public.profiles SET mercado = p WHERE user_id = auth.uid(); END; $$;
`;

const GATILHOS_AUTH = `
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER on_auth_user_created_assinatura AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION criar_assinatura_basica_gratuita();
CREATE TRIGGER trigger_notificar_novo_usuario AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION notificar_novo_usuario();
`;

// ---------------------------------------------------------------------------
let falhas = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log("  ✓", msg);
  else { falhas++; console.log("  ✗", msg, extra === undefined ? "" : JSON.stringify(extra)); }
};
const db = new PGlite();
const um = async (sql, p) => (await db.query(sql, p)).rows[0];

// Cadastro como o GoTrue faz: conexão supabase_auth_admin, sem JWT.
async function cadastrar(email, meta, claims = null) {
  return db.transaction(async (tx) => {
    await tx.exec("SET LOCAL ROLE supabase_auth_admin");
    if (claims) await tx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const r = await tx.query(
      "INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, $2::jsonb) RETURNING id",
      [email, meta === undefined ? null : JSON.stringify(meta)],
    );
    return r.rows[0].id;
  });
}

// Pedido do app (PostgREST): papel do JWT + claims.
async function como(papel, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${papel}`);
    await tx.query("SELECT set_config('request.jwt.claims', $1, true)",
      [JSON.stringify(uid ? { sub: uid, role: papel } : { role: papel })]);
    return fn(tx);
  });
}
async function falha(promessa) {
  try { await promessa; return null; } catch (e) { return e.message; }
}
const NOVAS = ["mercado", "idioma", "pais", "moeda", "fuso_horario"];
const PADRAO = { mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo" };
const regional = (p) => ({ mercado: p.mercado, pais: p.pais, moeda: p.moeda, fuso_horario: p.fuso_horario });
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const perfil = (uid) => um("SELECT * FROM public.profiles WHERE user_id = $1", [uid]);
const camposComuns = (p) => {
  const c = { ...p };
  for (const k of ["id", "user_id", "email", "created_at", "updated_at", ...NOVAS]) delete c[k];
  return c;
};

// ---------------------------------------------------------------------------
console.log("\n== Montagem (antes da migration) ==");
await db.exec(BASE);
await db.exec(HANDLE_BASE);
await db.exec(GATILHOS_AUTH);
const srcBase = (await um("SELECT prosrc FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure")).prosrc;
const sqlPolicies = "SELECT tablename, policyname, cmd, roles::text, qual, with_check FROM pg_policies ORDER BY 1, 2";
const policiesAntes = (await db.query(sqlPolicies)).rows;
const sqlColsCfg = "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'configuracoes_loja' ORDER BY ordinal_position";
const colsCfgAntes = (await db.query(sqlColsCfg)).rows;
const temColuna = async (c) =>
  (await um("SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = $1", [c])).n === 1;

const META_COMUM = { nome: "Loja Teste", celular: "11999990000", utm_source: "meta", utm_campaign: "c1", fbclid: "abc" };
const antigoComum = await cadastrar("antigo@x.com", META_COMUM);
const dono = await cadastrar("dono@x.com", { nome: "Dono" });
const func = await cadastrar("func@x.com", { nome: "Func" });
const funcInativo = await cadastrar("func2@x.com", { nome: "Func2" });
const gerente = await cadastrar("gerente@x.com", { nome: "Gerente" });
const admin = await cadastrar("admin@x.com", { nome: "Admin" });
await db.exec(`INSERT INTO public.configuracoes_loja (nome_loja, user_id) VALUES ('L', '${dono}')`);
ok(true, "réplica montada com handle_new_user de 20260525000002");

console.log("\n== Autoverificação desfaz tudo se faltar algo ==");
async function migracaoFalha(rotulo, codigo, estragar, consertar) {
  await db.exec(estragar);
  const erro = await falha(db.exec(MIGRATION));
  await db.exec("ROLLBACK");
  await db.exec(consertar);
  ok(erro?.includes(codigo), `${rotulo}: aborta com ${codigo}`, erro);
  ok(!(await temColuna("mercado")) && (await um("SELECT to_regprocedure('public.get_mercado_loja()') IS NULL AS v")).v,
    `${rotulo}: nada ficou aplicado (nem coluna, nem função)`);
}
await migracaoFalha("sem o gatilho da assinatura", "I18N007",
  "DROP TRIGGER on_auth_user_created_assinatura ON auth.users",
  "CREATE TRIGGER on_auth_user_created_assinatura AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION criar_assinatura_basica_gratuita()");
await migracaoFalha("sem empresa_usuarios.created_at", "I18N016",
  "ALTER TABLE public.empresa_usuarios DROP COLUMN created_at",
  "ALTER TABLE public.empresa_usuarios ADD COLUMN created_at timestamptz DEFAULT now()");
await migracaoFalha("sem loja_funcionarios.ativo", "I18N016",
  "ALTER TABLE public.loja_funcionarios DROP COLUMN ativo",
  "ALTER TABLE public.loja_funcionarios ADD COLUMN ativo boolean DEFAULT true");
await migracaoFalha("get_mercado_loja quebra ao executar", "I18N018",
  `CREATE OR REPLACE FUNCTION public.get_loja_owner_id() RETURNS uuid LANGUAGE plpgsql AS $$
   BEGIN RETURN (SELECT coluna_que_nao_existe FROM public.loja_funcionarios LIMIT 1); END $$`,
  `CREATE OR REPLACE FUNCTION public.get_loja_owner_id() RETURNS uuid
   LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
   DECLARE owner_id UUID;
   BEGIN
     SELECT loja_user_id INTO owner_id FROM public.loja_funcionarios
      WHERE funcionario_user_id = auth.uid() AND ativo = true LIMIT 1;
     IF owner_id IS NOT NULL THEN RETURN owner_id; END IF;
     RETURN auth.uid();
   END; $$`);

console.log("\n== Aplicar migration (2x: idempotência) ==");
await db.exec(MIGRATION);
await db.exec(MIGRATION);
ok(true, "migration aplicada duas vezes sem erro (autoverificação passou nas duas)");
ok(igual(policiesAntes, (await db.query(sqlPolicies)).rows), "RLS: nenhuma policy mudou");
ok(igual(colsCfgAntes, (await db.query(sqlColsCfg)).rows), "configuracoes_loja: nenhuma coluna mudou");
const jwtSobrou = async () => ((await um("SELECT current_setting('request.jwt.claims', true) AS c")).c ?? "") !== "";
ok(!(await jwtSobrou()), "o JWT falso da autoverificação não sobrou na sessão");

const antigos = (await db.query("SELECT * FROM public.profiles")).rows;
ok(antigos.every((r) => igual(regional(r), PADRAO) && r.idioma === "pt-BR"),
  `usuários que já existiam: BR / pt-BR / BR / BRL / America/Sao_Paulo (${antigos.length})`);

console.log("\n== (a) cadastro sem mercado/idioma ==");
const novoComum = await cadastrar("novo@x.com", META_COMUM);
const pNovo = await perfil(novoComum);
ok(igual(regional(pNovo), PADRAO) && pNovo.idioma === "pt-BR", "cai em BR / pt-BR / BR / BRL / America/Sao_Paulo", pNovo);
const pAntigo = await perfil(antigoComum);
ok(igual(camposComuns(pNovo), camposComuns(pAntigo)),
  "perfil idêntico ao de um cadastro igual feito ANTES da migration (nome, celular, utm, fbclid...)",
  { antes: camposComuns(pAntigo), depois: camposComuns(pNovo) });
const semMeta = await cadastrar("semmeta@x.com", undefined);
const pSemMeta = await perfil(semMeta);
ok(pSemMeta?.mercado === "BR" && pSemMeta?.idioma === "pt-BR" && pSemMeta?.nome === "semmeta@x.com",
  "raw_user_meta_data nulo: BR / pt-BR, nome = e-mail", pSemMeta);

console.log("\n== (b) cadastro com ES_LATAM / es ==");
const es = await cadastrar("es@x.com", { nome: "Tienda", mercado: "ES_LATAM", idioma: "es" });
const pEs = await perfil(es);
ok(pEs.mercado === "ES_LATAM" && pEs.idioma === "es", "grava ES_LATAM / es", pEs);
ok(pEs.pais === "BR" && pEs.moeda === "BRL" && pEs.fuso_horario === "America/Sao_Paulo",
  "pais/moeda/fuso nascem pelo padrão (nada deduzido do mercado)", regional(pEs));
const metaRegional = await cadastrar("metareg@x.com", { mercado: "EN", pais: "XX", moeda: "YYY", fuso_horario: "Etc/UTC" });
ok(igual(regional(await perfil(metaRegional)), { ...PADRAO, mercado: "EN" }),
  "pais/moeda/fuso enviados no signUp são ignorados (só mercado e idioma vêm do cadastro)");
const it = await cadastrar("it@x.com", { mercado: "IT", idioma: "it" });
ok((await perfil(it)).mercado === "IT", "grava IT / it");
const comJwt = await cadastrar("jwt@x.com", { mercado: "EN", idioma: "en" }, { role: "anon" });
ok((await perfil(comJwt)).mercado === "EN",
  "mesmo com JWT anon na sessão, o cadastro grava o mercado (a trava não pega o handle_new_user)");

console.log("\n== (c) metadata inválida cai no padrão ==");
for (const [rot, meta] of [
  ["mercado 'XX' / idioma 'fr'", { mercado: "XX", idioma: "fr" }],
  ["minúsculas 'br' / 'PT-BR'", { mercado: "br", idioma: "PT-BR" }],
  ["número e booleano", { mercado: 5, idioma: true }],
  ["objeto aninhado", { mercado: { a: 1 }, idioma: ["es"] }],
  ["string vazia", { mercado: "", idioma: "" }],
  ["SQL no valor", { mercado: "BR'); DROP TABLE x;--", idioma: "es' OR '1'='1" }],
]) {
  const id = await cadastrar(`inv${Math.random()}@x.com`, meta);
  const p = await perfil(id);
  ok(p?.mercado === "BR" && p?.idioma === "pt-BR", `${rot}: BR / pt-BR`, p);
}
const metaArray = await falha(cadastrar("arr@x.com", [1, 2]));
ok(metaArray === null && (await um("SELECT mercado FROM profiles p JOIN auth.users u ON u.id = p.user_id WHERE u.email = 'arr@x.com'"))?.mercado === "BR",
  "raw_user_meta_data como array: cadastro não falha, BR", metaArray);

console.log("\n== (d) o usuário não altera mercado, pais, moeda nem fuso ==");
// admin define a configuração regional de verdade (como provisionar-conta faria);
// valores de teste, não são regra de país
const REG_ES = { mercado: "ES_LATAM", pais: "TESTE", moeda: "TST", fuso_horario: "Etc/UTC" };
await como("service_role", null, (tx) => tx.query(
  "UPDATE public.profiles SET pais = $2, moeda = $3, fuso_horario = $4 WHERE user_id = $1",
  [es, REG_ES.pais, REG_ES.moeda, REG_ES.fuso_horario]));
ok(igual(regional(await perfil(es)), REG_ES), "service_role define pais/moeda/fuso depois do cadastro");
for (const [campo, valor] of [["mercado", "EN"], ["pais", "BR"], ["moeda", "BRL"], ["fuso_horario", "America/Sao_Paulo"]]) {
  await como("authenticated", es, (tx) => tx.query(`UPDATE public.profiles SET ${campo} = $2 WHERE user_id = $1`, [es, valor]));
  ok(igual(regional(await perfil(es)), REG_ES), `UPDATE direto de ${campo}: mantido`);
}
await como("authenticated", es, (tx) => tx.query(
  `UPDATE public.profiles SET mercado = 'BR', pais = 'BR', moeda = 'BRL', fuso_horario = 'America/Sao_Paulo',
          idioma = 'en', crm_stage = 'x' WHERE user_id = $1`, [es]));
let p = await perfil(es);
ok(igual(regional(p), REG_ES) && p.idioma === "en" && p.crm_stage === "x",
  "UPDATE misto: os 4 mantidos, idioma e outro campo gravados", p);
await como("authenticated", es, (tx) => tx.query("SELECT public.rpc_teste_mudar_mercado('IT')"));
ok(igual(regional(await perfil(es)), REG_ES), "via RPC SECURITY DEFINER chamada pelo app: mantido");
await como("authenticated", es, (tx) => tx.query(
  `INSERT INTO public.profiles (user_id, nome, email, mercado, pais, moeda, fuso_horario) VALUES ($1, 'n', 'e', 'IT', 'X', 'Y', 'Z')
   ON CONFLICT (user_id) DO UPDATE SET mercado = EXCLUDED.mercado, pais = EXCLUDED.pais,
     moeda = EXCLUDED.moeda, fuso_horario = EXCLUDED.fuso_horario`, [es]));
ok(igual(regional(await perfil(es)), REG_ES), "upsert do app: mantido");
await como("authenticated", es, async (tx) => {
  await tx.query("DELETE FROM public.profiles WHERE user_id = $1", [es]);
  await tx.query(`INSERT INTO public.profiles (user_id, nome, email, mercado, idioma, pais, moeda, fuso_horario)
                  VALUES ($1, 'n', 'e', 'EN', 'es', 'X', 'Y', 'Z')`, [es]);
});
p = await perfil(es);
ok(igual(regional(p), PADRAO) && p.idioma === "es",
  "apagar e reinserir o próprio perfil: os 4 nascem no padrão BR, idioma livre", p);
const anonUpd = await como("anon", null, (tx) => tx.query("UPDATE public.profiles SET mercado = 'EN', moeda = 'X'"));
ok(anonUpd.affectedRows === 0, "anon não altera nada (RLS)");
const idiomaRuim = await falha(como("authenticated", it, (tx) =>
  tx.query("UPDATE public.profiles SET idioma = 'fr' WHERE user_id = $1", [it])));
ok(idiomaRuim?.includes("profiles_idioma_check"), "idioma fora da lista no UPDATE: CHECK recusa", idiomaRuim);

console.log("\n== (d2) quem pode alterar ==");
await db.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [admin]);
await como("authenticated", admin, (tx) => tx.query(
  "UPDATE public.profiles SET mercado = 'ES_LATAM', pais = $2, moeda = $3, fuso_horario = $4 WHERE user_id = $1",
  [es, REG_ES.pais, REG_ES.moeda, REG_ES.fuso_horario]));
ok(igual(regional(await perfil(es)), REG_ES), "admin do MecApp (pelo app) altera os 4");
await como("service_role", null, (tx) => tx.query("UPDATE public.profiles SET mercado = 'EN' WHERE user_id = $1", [it]));
ok((await perfil(it)).mercado === "EN", "service_role (Edge Function) altera");
await db.query("UPDATE public.profiles SET mercado = 'IT', moeda = 'TST' WHERE user_id = $1", [it]);
p = await perfil(it);
ok(p.mercado === "IT" && p.moeda === "TST", "postgres (SQL Editor) altera");
const ruim = await falha(db.query("UPDATE public.profiles SET mercado = 'XX' WHERE user_id = $1", [it]));
ok(ruim?.includes("profiles_mercado_check"), "nem o admin grava mercado fora da lista (CHECK)", ruim);

console.log("\n== (e) os três gatilhos de cadastro ==");
const totais = await um(`SELECT
  (SELECT count(*) FROM auth.users)::int AS users,
  (SELECT count(*) FROM auth.users u WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id))::int AS com_profile,
  (SELECT count(*) FROM auth.users u WHERE EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.user_id = u.id
     AND a.plano_tipo = 'free' AND a.status = 'active' AND a.free_trial_ends_at > now() + interval '23 hours'))::int AS com_free,
  (SELECT count(DISTINCT (body->'record'->>'id')) FROM net.chamadas)::int AS notificados`);
ok(totais.com_profile === totais.users, `profile para todo cadastro (${totais.com_profile}/${totais.users})`, totais);
ok(totais.com_free === totais.users, `assinatura free com trial de 24h para todo cadastro (${totais.com_free}/${totais.users})`, totais);
ok(totais.notificados === totais.users, `notificação ao admin para todo cadastro (${totais.notificados}/${totais.users})`, totais);

console.log("\n== get_mercado_loja() ==");
await db.query("UPDATE public.profiles SET mercado = 'ES_LATAM' WHERE user_id = $1", [dono]);
await db.query("INSERT INTO public.loja_funcionarios (loja_user_id, funcionario_user_id) VALUES ($1, $2)", [dono, func]);
await db.query("INSERT INTO public.loja_funcionarios (loja_user_id, funcionario_user_id, ativo) VALUES ($1, $2, false)", [dono, funcInativo]);
await db.query("INSERT INTO public.empresa_usuarios (proprietario_id, gerente_id) VALUES ($1, $2)", [dono, gerente]);
const gm = (uid) => como("authenticated", uid, (tx) => tx.query("SELECT public.get_mercado_loja() AS m")).then((r) => r.rows[0].m);
ok(await gm(dono) === "ES_LATAM", "dono: o próprio (ES_LATAM)");
ok(await gm(func) === "ES_LATAM", "funcionário ativo: herda do dono");
ok(await gm(gerente) === "ES_LATAM", "gerente de filial: herda da matriz");
ok(await gm(funcInativo) === "BR", "funcionário desativado: o próprio perfil (mesma regra de get_loja_owner_id)");
ok(await gm(novoComum) === "BR", "usuário comum: BR");
ok(await gm("00000000-0000-0000-0000-000000000001") === "BR", "uid sem perfil: BR");
const semLogin = await como("authenticated", null, (tx) => tx.query("SELECT public.get_mercado_loja() AS m"));
ok(semLogin.rows[0].m === null, "sem uid: NULL");
const anonGm = await falha(como("anon", null, (tx) => tx.query("SELECT public.get_mercado_loja()")));
ok(anonGm?.includes("permission denied"), "anon: sem permissão", anonGm);
const srvGm = await falha(como("service_role", null, (tx) => tx.query("SELECT public.get_mercado_loja()")));
ok(srvGm?.includes("permission denied"), "service_role: sem permissão (só authenticated)", srvGm);
const travaDireto = await falha(como("authenticated", dono, (tx) => tx.query("SELECT public.profiles_travar_mercado()")));
ok(travaDireto !== null, "função da trava não é chamável pelo app", travaDireto);

console.log("\n== Consultas de verificação ==");
// como no SQL Editor: o script inteiro numa ida só; vale o último resultado
const verificar = async () => (await db.exec(VERIFICACAO)).at(-1).rows;
let ver = await verificar();
const ruins = ver.filter((r) => !r.ok && r.ordem !== 30);
ok(ver.length === 32 && ruins.length === 0,
  "32 linhas, todas ok (a 30 dá false aqui de propósito: o teste criou contas fora de BR)", ruins);
ok(ver.find((r) => r.ordem === 27).encontrado === "BR", "linha 27: get_mercado_loja() executou e respondeu BR");
ok(ver.find((r) => r.ordem === 30).encontrado !== "0", "linha 30 acusa as contas fora de BR criadas no teste");
ok(!(await jwtSobrou()), "o JWT falso da verificação não sobrou na sessão");
await db.exec("ALTER TABLE public.empresa_usuarios RENAME COLUMN created_at TO criado");
ver = await verificar();
const l27 = ver.find((r) => r.ordem === 27);
ok(!l27.ok && l27.encontrado.startsWith("ERRO:") && l27.encontrado.includes("created_at"),
  "coluna sumida depois: linha 27 mostra o erro sem derrubar a consulta", l27);
ok(ver.find((r) => r.ordem === 26).encontrado === "6", "linha 26 acusa 6 de 7 colunas");
await db.exec("ALTER TABLE public.empresa_usuarios RENAME COLUMN criado TO created_at");

console.log("\n== Rollback ==");
const guarda = await falha(db.exec(ROLLBACK));
await db.exec("ROLLBACK"); // como no SQL Editor: o erro deixa a transação abortada
ok(guarda?.includes("I18N-RB001"), "guarda: recusa reverter com contas fora de BR", guarda);
ok(await temColuna("mercado"), "recusa não alterou nada (transação desfeita)");
await db.exec(`UPDATE public.profiles SET mercado = 'BR', idioma = 'pt-BR', pais = 'BR', moeda = 'BRL',
               fuso_horario = 'America/Sao_Paulo'`);
await db.query("UPDATE public.profiles SET moeda = 'TST' WHERE user_id = $1", [it]);
const guardaMoeda = await falha(db.exec(ROLLBACK));
await db.exec("ROLLBACK");
ok(guardaMoeda?.includes("I18N-RB001"), "guarda: recusa também se só a moeda difere", guardaMoeda);
await db.query("UPDATE public.profiles SET moeda = 'BRL' WHERE user_id = $1", [it]);
await db.exec(ROLLBACK);
await db.exec(ROLLBACK);
ok(true, "rollback aplicado duas vezes sem erro");
ok(!(await Promise.all(NOVAS.map(temColuna))).some(Boolean), "as 5 colunas saíram de profiles");
const srcDepois = (await um("SELECT prosrc FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure")).prosrc;
ok(srcDepois === srcBase, "handle_new_user idêntica à de antes da migration");
const posRb = await cadastrar("posrb@x.com", META_COMUM);
ok(igual(camposComuns(await perfil(posRb)), camposComuns(pAntigo)), "cadastro após o rollback igual ao de antes");
ok(igual(policiesAntes, (await db.query(sqlPolicies)).rows), "RLS igual ao original após o rollback");
ok(igual(colsCfgAntes, (await db.query(sqlColsCfg)).rows), "configuracoes_loja igual ao original após o rollback");
await db.exec(MIGRATION);
ok(true, "migration reaplicada depois do rollback");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK");
process.exit(falhas ? 1 : 0);
