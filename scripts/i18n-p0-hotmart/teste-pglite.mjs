// Teste da migration 20261101120000 (hotmart_transaction_id) num Postgres 17
// local (PGlite, WebAssembly). Não toca em produção: monta uma réplica mínima
// de assinaturas (colunas de pagamento, RLS, policies, gatilho, índices e
// grants), aplica a migration, reaplica, sabota, reverte.
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
const MARCA_VERIFICACAO = "-- 3) Autoverificação";
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
  ORDER BY 1, 2`;
const sqlLinhas = "SELECT id, user_id, plano_tipo, status, payment_provider, updated_at FROM public.assinaturas ORDER BY id";
const verificar = async () => (await db.query(VERIFICACAO)).rows;
const semTemporarios = async () =>
  (await um("SELECT count(*)::int n FROM pg_class WHERE relname IN ('_hot_estrutura', '_hot_antes')")).n === 0;

// ---------------------------------------------------------------------------
console.log("\n== Montagem (antes da migration) ==");
await db.exec(BASE);
const fotoAntes = (await db.query(sqlFoto)).rows;
const linhasAntes = (await db.query(sqlLinhas)).rows;
ok(!(await temColuna()), "réplica sem hotmart_transaction_id (como a produção hoje)");
const vAntes = await verificar();
ok(vAntes.length === 5, "verificação roda antes da migration (5 linhas)", vAntes.length);
ok(igual(vAntes.filter((r) => !r.ok).map((r) => r.n), [1, 2, 3, 5]),
  "antes da migration: checagens 1, 2, 3 e 5 dão ok = false", vAntes);

console.log("\n== Sabotagem: a migration aborta e não deixa nada ==");
async function migracaoFalha(rotulo, codigo, sql, estragar = null, consertar = null) {
  if (estragar) await db.exec(estragar);
  const erro = await falha(db.exec(sql));
  await db.exec("ROLLBACK");
  if (consertar) await db.exec(consertar);
  ok(erro?.includes(codigo), `${rotulo}: aborta com ${codigo}`, erro);
  ok(!(await temColuna()) && !(await temIndice()) && (await semTemporarios()),
    `${rotulo}: nada ficou aplicado (nem coluna, nem índice, nem temporários)`);
  ok(igual(fotoAntes, (await db.query(sqlFoto)).rows) && igual(linhasAntes, (await db.query(sqlLinhas)).rows),
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
ok((await um("SELECT count(*)::int n FROM public.assinaturas WHERE hotmart_transaction_id IS NOT NULL")).n === 0,
  "coluna nasce nula em todas as linhas");
const vDepois = await verificar();
ok(vDepois.every((r) => r.ok), "verificação depois: as 5 linhas ok = true", vDepois);

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
await db.exec(ROLLBACK);
ok(!(await temColuna()) && !(await temIndice()), "sem transação gravada: coluna e índice removidos");
await db.exec(ROLLBACK);
ok(true, "reversão 2x sem erro (idempotente)");
ok(igual(fotoAntes, (await db.query(sqlFoto)).rows), "estrutura volta a ser a de antes da migration");
const vRev = await verificar();
ok(igual(vRev.filter((r) => !r.ok).map((r) => r.n), [1, 2, 3, 5]), "verificação depois da reversão: igual à de antes");

console.log("\n== Reaplicar depois da reversão ==");
await db.exec(MIGRATION);
ok((await verificar()).every((r) => r.ok), "migration volta a aplicar e a verificação fica toda ok");

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
