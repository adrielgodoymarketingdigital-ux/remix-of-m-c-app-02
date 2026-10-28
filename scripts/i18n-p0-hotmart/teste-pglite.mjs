// Teste da migration 20261101120000 (hotmart_transaction_id + tipos de aviso)
// num Postgres 17 local (PGlite, WebAssembly). Não toca em produção: monta uma
// réplica mínima de assinaturas (colunas de pagamento, RLS, policies, gatilho,
// índices e grants) e de admin_notifications (CHECK de tipo criado pelas
// mesmas duas migrations da produção), aplica, reaplica, sabota, reverte.
//
// Rodar (o PGlite não é dependência do projeto):
// (0.3.4 quebra em qualquer RAISE de plpgsql; 0.3.16 não)
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/i18n-p0-hotmart/teste-pglite.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const MIGRATION = ler("supabase/migrations/20261101120000_hotmart_transaction_id.sql");
const ROLLBACK = ler("scripts/i18n-p0-hotmart/rollback.sql");
const VERIFICACAO = ler("scripts/i18n-p0-hotmart/verificacao.sql");
const MARCA_VERIFICACAO = "-- 4) Autoverificação";
if (!MIGRATION.includes(MARCA_VERIFICACAO)) throw new Error("marca da autoverificação não encontrada");

// ---------------------------------------------------------------------------
// Réplica mínima (colunas de pagamento das migrations do repositório)
// ---------------------------------------------------------------------------
const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plano_tipo text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  data_inicio timestamptz DEFAULT now(),
  data_fim timestamptz,
  data_proxima_cobranca timestamptz,
  payment_provider text DEFAULT 'stripe',
  payment_method text,
  stripe_customer_id text, stripe_subscription_id text, stripe_price_id text,
  ticto_order_id text DEFAULT NULL,
  pagarme_subscription_id text, pagarme_customer_id text,
  bloqueado_admin boolean DEFAULT false, bloqueado_admin_em timestamptz,
  bloqueado_admin_motivo text, bloqueado_tipo text,
  cancelado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT assinaturas_status_check CHECK (status IN ('active', 'canceled', 'past_due', 'trialing'))
);
CREATE INDEX idx_assinaturas_user_id ON public.assinaturas (user_id);
CREATE INDEX idx_assinaturas_pagarme_subscription_id ON public.assinaturas (pagarme_subscription_id);
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.assinaturas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages subscriptions" ON public.assinaturas FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT SELECT ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;

CREATE FUNCTION public.set_cancelado_em() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'canceled' AND OLD.status IS DISTINCT FROM 'canceled' THEN NEW.cancelado_em := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_cancelado_em BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_cancelado_em();

-- admin_notifications como em 20260115004047 + 20260215152816
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados JSONB DEFAULT '{}'::jsonb,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou', 'push_enviado']));
CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view notifications" ON public.admin_notifications FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role can insert notifications" ON public.admin_notifications FOR INSERT TO service_role
  WITH CHECK (true);
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
INSERT INTO public.admin_notifications (tipo, titulo, mensagem)
SELECT (ARRAY['novo_trial','nova_assinatura','cancelamento','pagamento_falhou','push_enviado'])[1 + i % 5], 't', 'm'
  FROM generate_series(1, 25) i;

INSERT INTO public.assinaturas (user_id, plano_tipo, payment_provider)
SELECT gen_random_uuid(), (ARRAY['free','intermediario_mensal','basico_anual'])[1 + i % 3],
       (ARRAY['stripe','pagarme','ticto','hotmart'])[1 + i % 4]
  FROM generate_series(1, 40) i;
`;

// ---------------------------------------------------------------------------
let falhas = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log("  ✓", msg);
  else { falhas++; console.log("  ✗", msg, extra === undefined ? "" : JSON.stringify(extra)); }
};
const db = new PGlite();
const um = async (sql, p) => (await db.query(sql, p)).rows[0];
async function falha(promessa) {
  try { await promessa; return null; } catch (e) { return e.message; }
}
const temColuna = async () =>
  (await um("SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name = 'hotmart_transaction_id'")).n === 1;
const CHECK_ANTIGO = "CHECK ((tipo = ANY (ARRAY['novo_trial'::text, 'nova_assinatura'::text, 'cancelamento'::text, 'pagamento_falhou'::text, 'push_enviado'::text])))";
const CHECK_NOVO = "CHECK ((tipo = ANY (ARRAY['novo_trial'::text, 'nova_assinatura'::text, 'cancelamento'::text, 'pagamento_falhou'::text, 'push_enviado'::text, 'hotmart_oferta_nao_mapeada'::text, 'hotmart_config_invalida'::text])))";
const checkTipo = async () =>
  (await um("SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'admin_notifications_tipo_check'"))?.d ?? null;
const RESTAURAR_CHECK = `ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_tipo_check;
  ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
  CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou', 'push_enviado']))`;
const avisar = (tipo) => db.query("INSERT INTO public.admin_notifications (tipo, titulo, mensagem) VALUES ($1, 't', 'm')", [tipo]);
const temIndice = async () =>
  (await um("SELECT to_regclass('public.assinaturas_hotmart_transaction_id_key') IS NOT NULL AS v")).v;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Tudo que a migration não pode mudar, lido de fora (independente da view dela)
const sqlFoto = `
  SELECT 'c' t, column_name || data_type || is_nullable || COALESCE(column_default, '') d
    FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name <> 'hotmart_transaction_id'
  UNION ALL SELECT 'p', policyname || cmd || roles::text || COALESCE(qual, '') || COALESCE(with_check, '')
    FROM pg_policies WHERE tablename = 'assinaturas'
  UNION ALL SELECT 'g', tgname || pg_get_triggerdef(oid) FROM pg_trigger
   WHERE tgrelid = 'public.assinaturas'::regclass AND NOT tgisinternal
  UNION ALL SELECT 'i', indexdef FROM pg_indexes
   WHERE tablename = 'assinaturas' AND indexname <> 'assinaturas_hotmart_transaction_id_key'
  UNION ALL SELECT 'r', relrowsecurity::text FROM pg_class WHERE oid = 'public.assinaturas'::regclass
  UNION ALL SELECT 'an_c', column_name || data_type || is_nullable || COALESCE(column_default, '')
    FROM information_schema.columns WHERE table_name = 'admin_notifications'
  UNION ALL SELECT 'an_p', policyname || cmd || roles::text || COALESCE(qual, '') || COALESCE(with_check, '')
    FROM pg_policies WHERE tablename = 'admin_notifications'
  UNION ALL SELECT 'an_k', conname || pg_get_constraintdef(oid) FROM pg_constraint
   WHERE conrelid = 'public.admin_notifications'::regclass AND conname <> 'admin_notifications_tipo_check'
  UNION ALL SELECT 'an_i', indexdef FROM pg_indexes WHERE tablename = 'admin_notifications'
  UNION ALL SELECT 'an_r', relrowsecurity::text FROM pg_class WHERE oid = 'public.admin_notifications'::regclass
  ORDER BY 1, 2`;
const sqlAvisos = "SELECT id, tipo, created_at FROM public.admin_notifications ORDER BY id";
const sqlLinhas = "SELECT id, user_id, plano_tipo, status, payment_provider, updated_at FROM public.assinaturas ORDER BY id";
const verificar = async () => (await db.query(VERIFICACAO)).rows;
const semTemporarios = async () =>
  (await um("SELECT count(*)::int n FROM pg_class WHERE relname IN ('_hot_estrutura', '_hot_antes')")).n === 0;

// ---------------------------------------------------------------------------
console.log("\n== Montagem (antes da migration) ==");
await db.exec(BASE);
const fotoAntes = (await db.query(sqlFoto)).rows;
const linhasAntes = (await db.query(sqlLinhas)).rows;
const avisosAntes = (await db.query(sqlAvisos)).rows;
ok((await checkTipo()) === CHECK_ANTIGO, "réplica com o CHECK de tipo igual ao da produção (5 tipos)", await checkTipo());
ok((await falha(avisar("hotmart_oferta_nao_mapeada")))?.includes("admin_notifications_tipo_check"),
  "antes da migration o banco recusa hotmart_oferta_nao_mapeada (o problema achado na produção)");
ok(!(await temColuna()), "réplica sem hotmart_transaction_id (como a produção hoje)");
const vAntes = await verificar();
ok(vAntes.length === 7, "verificação roda antes da migration (7 linhas)", vAntes.length);
ok(igual(vAntes.filter((r) => !r.ok).map((r) => r.n), [1, 2, 3, 5, 6]),
  "antes da migration: checagens 1, 2, 3, 5 e 6 dão ok = false", vAntes);

console.log("\n== Sabotagem: a migration aborta e não deixa nada ==");
async function migracaoFalha(rotulo, codigo, sql, estragar = null, consertar = null) {
  if (estragar) await db.exec(estragar);
  const erro = await falha(db.exec(sql));
  await db.exec("ROLLBACK");
  if (consertar) await db.exec(consertar);
  ok(erro?.includes(codigo), `${rotulo}: aborta com ${codigo}`, erro);
  ok(!(await temColuna()) && !(await temIndice()) && (await semTemporarios()) && (await checkTipo()) === CHECK_ANTIGO,
    `${rotulo}: nada ficou aplicado (nem coluna, nem índice, nem CHECK novo, nem temporários)`);
  ok(igual(fotoAntes, (await db.query(sqlFoto)).rows) && igual(linhasAntes, (await db.query(sqlLinhas)).rows)
     && igual(avisosAntes, (await db.query(sqlAvisos)).rows),
    `${rotulo}: estrutura e linhas iguais às de antes`);
}
const injetar = (sql) => MIGRATION.replace(MARCA_VERIFICACAO, `${sql}\n${MARCA_VERIFICACAO}`);

await migracaoFalha("coluna já existe como integer", "HOT003", MIGRATION,
  "ALTER TABLE public.assinaturas ADD COLUMN hotmart_transaction_id integer",
  "ALTER TABLE public.assinaturas DROP COLUMN hotmart_transaction_id");
await migracaoFalha("coluna já existe com DEFAULT", "HOT003", MIGRATION,
  "ALTER TABLE public.assinaturas ADD COLUMN hotmart_transaction_id text DEFAULT 'x'",
  "ALTER TABLE public.assinaturas DROP COLUMN hotmart_transaction_id");
await migracaoFalha("índice de mesmo nome com outra definição", "HOT004", MIGRATION,
  "CREATE INDEX assinaturas_hotmart_transaction_id_key ON public.assinaturas (payment_method)",
  "DROP INDEX public.assinaturas_hotmart_transaction_id_key");
await migracaoFalha("coluna já existe com transação repetida", "HOT005", MIGRATION,
  `ALTER TABLE public.assinaturas ADD COLUMN hotmart_transaction_id text;
   UPDATE public.assinaturas SET hotmart_transaction_id = 'HP-DUP' WHERE payment_provider = 'hotmart'`,
  "ALTER TABLE public.assinaturas DROP COLUMN hotmart_transaction_id");
await migracaoFalha("sem payment_provider", "HOT002", MIGRATION,
  "ALTER TABLE public.assinaturas RENAME COLUMN payment_provider TO pp",
  "ALTER TABLE public.assinaturas RENAME COLUMN pp TO payment_provider");
await migracaoFalha("CHECK de tipo da produção já tem outro tipo", "HOT008", MIGRATION,
  `ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check;
   ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
   CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou', 'push_enviado', 'nova_assinatura_hotmart']))`,
  RESTAURAR_CHECK);
await migracaoFalha("CHECK de tipo da produção com um tipo a menos (NOT VALID)", "HOT008", MIGRATION,
  `ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check;
   ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
   CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou'])) NOT VALID`,
  RESTAURAR_CHECK);
await migracaoFalha("CHECK de tipo em outra forma (tipo <> ...)", "HOT008", MIGRATION,
  `ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check;
   ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check CHECK (tipo <> 'push_enviado') NOT VALID`,
  RESTAURAR_CHECK);
await migracaoFalha("sem o CHECK de tipo", "HOT007", MIGRATION,
  "ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check",
  RESTAURAR_CHECK.split(";")[1]);
await migracaoFalha("CHECK trocado antes da conferência", "HOT016",
  injetar(`ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check;
           ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check CHECK (tipo IS NOT NULL);`));
await migracaoFalha("CHECK novo NOT VALID antes da conferência", "HOT016",
  injetar(`ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check;
           ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
           CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou',
             'push_enviado', 'hotmart_oferta_nao_mapeada', 'hotmart_config_invalida'])) NOT VALID;`));
await migracaoFalha("policy de admin_notifications some no meio", "HOT012",
  injetar(`DROP POLICY "Service role can insert notifications" ON public.admin_notifications;`));
await migracaoFalha("RLS de admin_notifications desligado no meio", "HOT012",
  injetar("ALTER TABLE public.admin_notifications DISABLE ROW LEVEL SECURITY;"));
await migracaoFalha("outra restrição de admin_notifications some no meio", "HOT012",
  injetar("ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_pkey;"));
await migracaoFalha("aviso apagado no meio", "HOT012",
  injetar("DELETE FROM public.admin_notifications WHERE id = (SELECT min(id::text)::uuid FROM public.admin_notifications);"));
await migracaoFalha("índice some antes da conferência", "HOT011",
  injetar("DROP INDEX public.assinaturas_hotmart_transaction_id_key;"));
await migracaoFalha("coluna ganha DEFAULT antes da conferência", "HOT010",
  injetar("ALTER TABLE public.assinaturas ALTER COLUMN hotmart_transaction_id SET DEFAULT 'x';"));
await migracaoFalha("uma policy some no meio (RLS)", "HOT012",
  injetar(`DROP POLICY "Users can view own subscription" ON public.assinaturas;`));
await migracaoFalha("RLS desligado no meio", "HOT012",
  injetar("ALTER TABLE public.assinaturas DISABLE ROW LEVEL SECURITY;"));
await migracaoFalha("gatilho desligado no meio", "HOT012",
  injetar("ALTER TABLE public.assinaturas DISABLE TRIGGER trg_set_cancelado_em;"));
await migracaoFalha("outra coluna muda de DEFAULT no meio", "HOT012",
  injetar("ALTER TABLE public.assinaturas ALTER COLUMN payment_provider SET DEFAULT 'hotmart';"));
await migracaoFalha("coluna a mais nasce no meio", "HOT012",
  injetar("ALTER TABLE public.assinaturas ADD COLUMN hotmart_extra text;"));
await migracaoFalha("grant novo para anon no meio", "HOT012",
  injetar("GRANT SELECT ON public.assinaturas TO anon;"));
await migracaoFalha("linha apagada no meio", "HOT012",
  injetar("DELETE FROM public.assinaturas WHERE id = (SELECT min(id::text)::uuid FROM public.assinaturas);"));

console.log("\n== Aplicar migration (2x: idempotência) ==");
await db.exec(MIGRATION);
ok(await temColuna() && await temIndice() && await semTemporarios(), "1ª aplicação: coluna e índice criados, temporários removidos");
await db.exec(MIGRATION);
ok(true, "2ª aplicação sem erro (autoverificação passou nas duas)");
ok(igual(fotoAntes, (await db.query(sqlFoto)).rows), "colunas antigas, policies, RLS, gatilho e índices antigos iguais");
ok(igual(linhasAntes, (await db.query(sqlLinhas)).rows), "nenhuma linha mudou (nem updated_at)");
ok(igual(avisosAntes, (await db.query(sqlAvisos)).rows), "nenhum aviso mudou");
ok((await checkTipo()) === CHECK_NOVO, "CHECK de tipo = os 5 de antes + os 2 da Hotmart, nessa ordem", await checkTipo());
ok((await um("SELECT count(*)::int n FROM public.assinaturas WHERE hotmart_transaction_id IS NOT NULL")).n === 0,
  "coluna nasce nula em todas as linhas");
const vDepois = await verificar();
ok(vDepois.every((r) => r.ok), "verificação depois: as 7 linhas ok = true", vDepois);

console.log("\n== Avisos ==");
for (const tipo of ["hotmart_oferta_nao_mapeada", "hotmart_config_invalida"]) {
  ok((await falha(avisar(tipo))) === null, `aviso ${tipo} gravado`);
}
for (const tipo of ["novo_trial", "nova_assinatura", "cancelamento", "pagamento_falhou", "push_enviado"]) {
  ok((await falha(avisar(tipo))) === null, `tipo de antes ${tipo} continua aceito`);
}
for (const tipo of ["nova_assinatura_hotmart", "hotmart_qualquer", "HOTMART_CONFIG_INVALIDA", ""]) {
  ok((await falha(avisar(tipo)))?.includes("admin_notifications_tipo_check"), `tipo fora da lista "${tipo}" continua recusado`);
}
await db.exec(MIGRATION);
ok((await checkTipo()) === CHECK_NOVO, "reaplicar com avisos dos tipos novos na tabela: sem erro, CHECK igual");

console.log("\n== Uso pelo webhook ==");
const [h1, h2] = (await db.query("SELECT user_id FROM public.assinaturas WHERE payment_provider = 'hotmart' ORDER BY id LIMIT 2")).rows.map((r) => r.user_id);
await db.query("UPDATE public.assinaturas SET hotmart_transaction_id = 'HP111', plano_tipo = 'intermediario_mensal' WHERE user_id = $1", [h1]);
ok((await um("SELECT hotmart_transaction_id t FROM public.assinaturas WHERE user_id = $1", [h1])).t === "HP111",
  "compra aprovada grava a transação (UPDATE do webhook)");
await db.query("UPDATE public.assinaturas SET hotmart_transaction_id = 'HP111', updated_at = now() WHERE user_id = $1", [h1]);
ok(true, "mesmo evento reenviado para a mesma conta: sem conflito");
const dup = await falha(db.query("UPDATE public.assinaturas SET hotmart_transaction_id = 'HP111' WHERE user_id = $1", [h2]));
ok(dup?.includes("assinaturas_hotmart_transaction_id_key"), "mesma transação em outra conta: o índice recusa", dup);
await db.query("UPDATE public.assinaturas SET hotmart_transaction_id = 'HP222' WHERE user_id = $1", [h2]);
ok(true, "outra transação em outra conta: aceita");
const nulos = await falha(db.query("UPDATE public.assinaturas SET hotmart_transaction_id = NULL WHERE payment_provider = 'stripe'"));
ok(nulos === null, "várias linhas com transação nula: aceitas (índice parcial)");
await db.exec(MIGRATION);
ok(true, "3ª aplicação, já com transações gravadas: sem erro");

console.log("\n== Reversão ==");
const guarda = await falha(db.exec(ROLLBACK));
await db.exec("ROLLBACK");
ok(guarda?.includes("HOTRB001"), "com transação gravada: reversão recusa (HOTRB001)", guarda);
ok(await temColuna() && await temIndice(), "e não removeu nada");
await db.exec("UPDATE public.assinaturas SET hotmart_transaction_id = NULL");
const guardaAviso = await falha(db.exec(ROLLBACK));
await db.exec("ROLLBACK");
ok(guardaAviso?.includes("HOTRB003"), "com aviso dos tipos novos na tabela: reversão recusa (HOTRB003)", guardaAviso);
ok(await temColuna() && (await checkTipo()) === CHECK_NOVO, "e não removeu nada");
await db.exec("DELETE FROM public.admin_notifications WHERE tipo LIKE 'hotmart_%'");
await db.exec(ROLLBACK);
ok(!(await temColuna()) && !(await temIndice()), "sem transação nem aviso novo: coluna e índice removidos");
ok((await checkTipo()) === CHECK_ANTIGO, "CHECK de tipo volta exatamente ao de antes", await checkTipo());
await db.exec(ROLLBACK);
ok(true, "reversão 2x sem erro (idempotente)");
ok(igual(fotoAntes, (await db.query(sqlFoto)).rows), "estrutura volta a ser a de antes da migration");
const vRev = await verificar();
ok(igual(vRev.filter((r) => !r.ok).map((r) => r.n), [1, 2, 3, 5, 6]), "verificação depois da reversão: igual à de antes");

console.log("\n== Reaplicar depois da reversão ==");
await db.exec(MIGRATION);
ok((await verificar()).every((r) => r.ok), "migration volta a aplicar e a verificação fica toda ok");

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
