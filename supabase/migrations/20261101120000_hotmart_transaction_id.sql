-- =====================================================================
-- Hotmart (i18n, etapa P0, item 1): coluna assinaturas.hotmart_transaction_id
--
-- O hotmart-webhook grava essa coluna na compra aprovada e a lê no
-- cancelamento, mas ela não existe na produção: a migration
-- 20260918170152_add_hotmart_transaction_id.sql nunca foi aplicada.
-- Esta migration a substitui (a antiga continua no repositório e, se um dia
-- rodar, não faz nada: é o mesmo ADD COLUMN IF NOT EXISTS).
--
--   1) assinaturas.hotmart_transaction_id text, nula, sem DEFAULT.
--      Nenhuma linha muda: ADD COLUMN sem DEFAULT só mexe no catálogo.
--   2) Índice único parcial (payment_provider, hotmart_transaction_id) onde a
--      transação não é nula: a mesma transação da Hotmart não ativa duas
--      contas. Nasce vazio (a coluna é nova), então o lock é curto.
--
-- NÃO toca em RLS, policies, gatilhos, funções nem em outras colunas; a
-- autoverificação confere isso contra uma foto tirada antes do ALTER.
-- Idempotente, numa transação só. Reversão em
-- scripts/i18n-p0-hotmart/rollback.sql; conferência em
-- scripts/i18n-p0-hotmart/verificacao.sql.
-- =====================================================================

BEGIN;

-- assinaturas é lida em toda troca de tela (plano/limites): se algo segurar
-- a tabela, desiste em vez de enfileirar o app atrás do ALTER.
SET LOCAL lock_timeout = '5s';


-- ---------------------------------------------------------------------
-- 0) Pré-condições e foto do que NÃO pode mudar
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tipo text;
  v_def  text;
BEGIN
  IF to_regclass('public.assinaturas') IS NULL THEN
    RAISE EXCEPTION 'HOT001: tabela public.assinaturas não existe';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'assinaturas'
                    AND column_name = 'payment_provider' AND data_type = 'text') THEN
    RAISE EXCEPTION 'HOT002: assinaturas.payment_provider ausente ou não é text';
  END IF;

  -- numa reexecução a coluna já existe: só aceita se for exatamente a nossa
  SELECT data_type || '|' || is_nullable || '|' || COALESCE(column_default, '')
    INTO v_tipo
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'assinaturas'
     AND column_name = 'hotmart_transaction_id';
  IF v_tipo IS NOT NULL AND v_tipo <> 'text|YES|' THEN
    RAISE EXCEPTION 'HOT003: assinaturas.hotmart_transaction_id já existe com outra definição (%)', v_tipo;
  END IF;

  -- índice com o mesmo nome e outra definição: não sobrescreve
  SELECT pg_get_indexdef(i.indexrelid) INTO v_def
    FROM pg_index i
   WHERE i.indexrelid = to_regclass('public.assinaturas_hotmart_transaction_id_key');
  IF v_def IS NOT NULL AND v_def <>
     'CREATE UNIQUE INDEX assinaturas_hotmart_transaction_id_key ON public.assinaturas USING btree (payment_provider, hotmart_transaction_id) WHERE (hotmart_transaction_id IS NOT NULL)' THEN
    RAISE EXCEPTION 'HOT004: já existe assinaturas_hotmart_transaction_id_key com outra definição: %', v_def;
  END IF;
END;
$$;

-- Tudo o que não pode mudar, numa view temporária: a foto (antes) e a
-- conferência (depois) usam a mesma consulta. Colunas entram sem a nova.
CREATE TEMP VIEW _hot_estrutura AS
  SELECT 'coluna' AS tipo, column_name::text || '|' || data_type || '|' || is_nullable
         || '|' || COALESCE(column_default, '') AS def
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'assinaturas'
     AND column_name <> 'hotmart_transaction_id'
  UNION ALL
  SELECT 'policy', policyname::text || '|' || cmd || '|' || roles::text || '|'
         || COALESCE(qual, '') || '|' || COALESCE(with_check, '')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'assinaturas'
  UNION ALL
  SELECT 'rls', c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
    FROM pg_class c WHERE c.oid = 'public.assinaturas'::regclass
  UNION ALL
  SELECT 'gatilho', t.tgname::text || '|' || t.tgenabled::text || '|' || pg_get_triggerdef(t.oid)
    FROM pg_trigger t WHERE t.tgrelid = 'public.assinaturas'::regclass AND NOT t.tgisinternal
  UNION ALL
  SELECT 'restricao', conname::text || '|' || pg_get_constraintdef(oid)
    FROM pg_constraint WHERE conrelid = 'public.assinaturas'::regclass
  UNION ALL
  SELECT 'indice', indexname::text || '|' || indexdef
    FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'assinaturas'
     AND indexname <> 'assinaturas_hotmart_transaction_id_key'
  UNION ALL
  SELECT 'grant', grantee || '|' || privilege_type
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'assinaturas'
  UNION ALL
  SELECT 'linhas', count(*)::text || '|' || count(*) FILTER (WHERE payment_provider = 'hotmart')::text
    FROM public.assinaturas;

CREATE TEMP TABLE _hot_antes ON COMMIT DROP AS SELECT * FROM _hot_estrutura;


-- ---------------------------------------------------------------------
-- 1) Coluna
-- ---------------------------------------------------------------------
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS hotmart_transaction_id text;

COMMENT ON COLUMN public.assinaturas.hotmart_transaction_id IS
  'Transação da Hotmart (data.purchase.transaction) da última compra aprovada. Gravada pelo hotmart-webhook; o cancelamento só vale se bater com ela.';


-- ---------------------------------------------------------------------
-- 2) Índice único parcial
--    Numa reexecução com dados, duplicata aborta com mensagem clara em vez
--    do erro genérico do CREATE INDEX.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_qtd bigint;
BEGIN
  SELECT count(*) INTO v_qtd FROM (
    SELECT 1 FROM public.assinaturas
     WHERE hotmart_transaction_id IS NOT NULL
     GROUP BY payment_provider, hotmart_transaction_id
    HAVING count(*) > 1
  ) d;
  IF v_qtd > 0 THEN
    RAISE EXCEPTION 'HOT005: % transação(ões) Hotmart repetida(s) em assinaturas; o índice único não pode nascer', v_qtd;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_hotmart_transaction_id_key
  ON public.assinaturas (payment_provider, hotmart_transaction_id)
  WHERE hotmart_transaction_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- 3) Autoverificação: qualquer divergência desfaz a transação inteira.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_falta text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'assinaturas'
                    AND column_name = 'hotmart_transaction_id'
                    AND data_type = 'text' AND is_nullable = 'YES'
                    AND column_default IS NULL) THEN
    RAISE EXCEPTION 'HOT010: assinaturas.hotmart_transaction_id ausente ou com tipo/nulo/default errado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_index i
                  WHERE i.indexrelid = to_regclass('public.assinaturas_hotmart_transaction_id_key')
                    AND i.indrelid = 'public.assinaturas'::regclass
                    AND i.indisunique AND i.indisvalid AND i.indisready
                    AND pg_get_indexdef(i.indexrelid) =
                      'CREATE UNIQUE INDEX assinaturas_hotmart_transaction_id_key ON public.assinaturas USING btree (payment_provider, hotmart_transaction_id) WHERE (hotmart_transaction_id IS NOT NULL)') THEN
    RAISE EXCEPTION 'HOT011: índice assinaturas_hotmart_transaction_id_key ausente, inválido ou com outra definição';
  END IF;

  -- colunas antigas, RLS, policies, gatilhos, restrições, outros índices,
  -- grants e quantidade de linhas: iguais à foto, nos dois sentidos
  SELECT string_agg(tipo || ': ' || def, ' ; ') INTO v_falta FROM (
    (SELECT 'sumiu/mudou ' || tipo AS tipo, def FROM
       (SELECT * FROM _hot_antes EXCEPT ALL SELECT * FROM _hot_estrutura) x)
    UNION ALL
    (SELECT 'apareceu ' || tipo, def FROM
       (SELECT * FROM _hot_estrutura EXCEPT ALL SELECT * FROM _hot_antes) y)
  ) d;
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'HOT012: assinaturas mudou além da coluna e do índice novos: %', v_falta;
  END IF;

  RAISE NOTICE 'HOT OK: hotmart_transaction_id aplicada e conferida';
END;
$$;

DROP VIEW _hot_estrutura;

COMMIT;
