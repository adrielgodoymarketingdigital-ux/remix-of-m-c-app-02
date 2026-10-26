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
const perfil = (uid) => um("SELECT * FROM public.profiles WHERE user_id = $1", [uid]);
const camposComuns = (p) => {
  const c = { ...p };
  for (const k of ["id", "user_id", "email", "created_at", "updated_at", "mercado", "idioma"]) delete c[k];
  return c;
};

// ---------------------------------------------------------------------------
console.log("\n== Montagem (antes da migration) ==");
await db.exec(BASE);
await db.exec(HANDLE_BASE);
await db.exec(GATILHOS_AUTH);
const srcBase = (await um("SELECT prosrc FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure")).prosrc;
const policiesAntes = (await db.query(
  "SELECT tablename, policyname, cmd, roles::text, qual, with_check FROM pg_policies ORDER BY 1, 2")).rows;

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
await db.exec("DROP TRIGGER on_auth_user_created_assinatura ON auth.users");
const semGatilho = await falha(db.exec(MIGRATION));
await db.exec("ROLLBACK");
ok(semGatilho?.includes("I18N007"), "sem o gatilho da assinatura: aborta com I18N007", semGatilho);
ok((await um("SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'mercado'")).n === 0
  && (await um("SELECT to_regprocedure('public.get_mercado_loja()') IS NULL AS v")).v,
  "nada ficou aplicado (nem coluna, nem função)");
await db.exec(`CREATE TRIGGER on_auth_user_created_assinatura AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION criar_assinatura_basica_gratuita()`);

console.log("\n== Aplicar migration (2x: idempotência) ==");
await db.exec(MIGRATION);
await db.exec(MIGRATION);
ok(true, "migration aplicada duas vezes sem erro (autoverificação passou nas duas)");
const policiesDepois = (await db.query(
  "SELECT tablename, policyname, cmd, roles::text, qual, with_check FROM pg_policies ORDER BY 1, 2")).rows;
ok(JSON.stringify(policiesAntes) === JSON.stringify(policiesDepois), "RLS: nenhuma policy mudou");

const antigos = await db.query("SELECT mercado, idioma FROM public.profiles");
ok(antigos.rows.every((r) => r.mercado === "BR" && r.idioma === "pt-BR"),
  `usuários que já existiam ficaram BR / pt-BR (${antigos.rows.length})`);
const cfg = await um("SELECT moeda, pais, fuso_horario FROM public.configuracoes_loja");
ok(cfg.moeda === "BRL" && cfg.pais === "BR" && cfg.fuso_horario === "America/Sao_Paulo",
  "configuracoes_loja existente ficou BRL / BR / America/Sao_Paulo", cfg);

console.log("\n== (a) cadastro sem mercado/idioma ==");
const novoComum = await cadastrar("novo@x.com", META_COMUM);
const pNovo = await perfil(novoComum);
ok(pNovo.mercado === "BR" && pNovo.idioma === "pt-BR", "cai em BR / pt-BR", pNovo);
const pAntigo = await perfil(antigoComum);
ok(JSON.stringify(camposComuns(pNovo)) === JSON.stringify(camposComuns(pAntigo)),
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

console.log("\n== (d) o usuário não altera o próprio mercado ==");
await como("authenticated", es, (tx) => tx.query("UPDATE public.profiles SET mercado = 'EN' WHERE user_id = $1", [es]));
ok((await perfil(es)).mercado === "ES_LATAM", "UPDATE direto: mercado continua ES_LATAM");
await como("authenticated", es, (tx) => tx.query(
  "UPDATE public.profiles SET mercado = 'BR', idioma = 'en', crm_stage = 'x' WHERE user_id = $1", [es]));
let p = await perfil(es);
ok(p.mercado === "ES_LATAM" && p.idioma === "en" && p.crm_stage === "x",
  "UPDATE misto: mercado mantido, idioma e outro campo gravados", p);
await como("authenticated", es, (tx) => tx.query("SELECT public.rpc_teste_mudar_mercado('IT')"));
ok((await perfil(es)).mercado === "ES_LATAM", "via RPC SECURITY DEFINER chamada pelo app: mantido");
await como("authenticated", es, (tx) => tx.query(
  `INSERT INTO public.profiles (user_id, nome, email, mercado) VALUES ($1, 'n', 'e', 'IT')
   ON CONFLICT (user_id) DO UPDATE SET mercado = EXCLUDED.mercado`, [es]));
ok((await perfil(es)).mercado === "ES_LATAM", "upsert do app: mantido");
await como("authenticated", es, async (tx) => {
  await tx.query("DELETE FROM public.profiles WHERE user_id = $1", [es]);
  await tx.query("INSERT INTO public.profiles (user_id, nome, email, mercado, idioma) VALUES ($1, 'n', 'e', 'EN', 'es')", [es]);
});
p = await perfil(es);
ok(p.mercado === "BR" && p.idioma === "es", "apagar e reinserir o próprio perfil: nasce BR (não escolhe mercado)", p);
const anonUpd = await como("anon", null, (tx) => tx.query("UPDATE public.profiles SET mercado = 'EN'"));
ok(anonUpd.affectedRows === 0, "anon não altera nada (RLS)");
const idiomaRuim = await falha(como("authenticated", it, (tx) =>
  tx.query("UPDATE public.profiles SET idioma = 'fr' WHERE user_id = $1", [it])));
ok(idiomaRuim?.includes("profiles_idioma_check"), "idioma fora da lista no UPDATE: CHECK recusa", idiomaRuim);

console.log("\n== (d2) quem pode alterar ==");
await db.query("INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')", [admin]);
await como("authenticated", admin, (tx) => tx.query("UPDATE public.profiles SET mercado = 'ES_LATAM' WHERE user_id = $1", [es]));
ok((await perfil(es)).mercado === "ES_LATAM", "admin do MecApp (pelo app) altera");
await como("service_role", null, (tx) => tx.query("UPDATE public.profiles SET mercado = 'EN' WHERE user_id = $1", [it]));
ok((await perfil(it)).mercado === "EN", "service_role (Edge Function) altera");
await db.query("UPDATE public.profiles SET mercado = 'IT' WHERE user_id = $1", [it]);
ok((await perfil(it)).mercado === "IT", "postgres (SQL Editor) altera");
const ruim = await falha(db.query("UPDATE public.profiles SET mercado = 'XX' WHERE user_id = $1", [it]));
ok(ruim?.includes("profiles_mercado_check"), "nem o admin grava valor fora da lista (CHECK)", ruim);

console.log("\n== (e) os três gatilhos de cadastro ==");
const totais = await um(`SELECT
  (SELECT count(*) FROM auth.users)::int AS users,
  (SELECT count(*) FROM auth.users u WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id))::int AS com_profile,
  (SELECT count(*) FROM auth.users u WHERE EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.user_id = u.id
     AND a.plano_tipo = 'free' AND a.status = 'active' AND a.free_trial_ends_at > now() + interval '23 hours'))::int AS com_free,
  (SELECT count(DISTINCT (body->'record'->>'id')) FROM net.chamadas)::int AS notificados`);
ok(totais.com_profile === totais.users,
  `profile para todo cadastro (${totais.com_profile}/${totais.users})`, totais);
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
// no PGlite não há cadastro com created_at antigo; a consulta roda igual à da produção
const ver = await db.query(VERIFICACAO);
const ruins = ver.rows.filter((r) => !r.ok && ![27].includes(r.ordem));
ok(ver.rows.length === 30 && ruins.length === 0,
  `30 linhas, todas ok (a 27 dá false aqui de propósito: o teste criou contas ES/IT)`, ruins);
ok(ver.rows.find((r) => r.ordem === 27).encontrado !== "0", "linha 27 acusa as contas não-BR criadas no teste");

console.log("\n== Rollback ==");
const guarda = await falha(db.exec(ROLLBACK));
await db.exec("ROLLBACK"); // como no SQL Editor: o erro deixa a transação abortada
ok(guarda?.includes("I18N-RB001"), "guarda: recusa reverter com contas fora de BR", guarda);
ok((await um("SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'mercado'")).n === 1,
  "recusa não alterou nada (transação desfeita)");
await db.exec("UPDATE public.profiles SET mercado = 'BR', idioma = 'pt-BR'");
await db.exec(ROLLBACK);
await db.exec(ROLLBACK);
ok(true, "rollback aplicado duas vezes sem erro");
const srcDepois = (await um("SELECT prosrc FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure")).prosrc;
ok(srcDepois === srcBase, "handle_new_user idêntica à de antes da migration");
const posRb = await cadastrar("posrb@x.com", META_COMUM);
ok(JSON.stringify(camposComuns(await perfil(posRb))) === JSON.stringify(camposComuns(pAntigo)),
  "cadastro após o rollback igual ao de antes");
const policiesRb = (await db.query(
  "SELECT tablename, policyname, cmd, roles::text, qual, with_check FROM pg_policies ORDER BY 1, 2")).rows;
ok(JSON.stringify(policiesAntes) === JSON.stringify(policiesRb), "RLS igual ao original após o rollback");
await db.exec(MIGRATION);
ok(true, "migration reaplicada depois do rollback");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK");
process.exit(falhas ? 1 : 0);
