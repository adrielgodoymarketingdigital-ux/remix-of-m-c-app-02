-- =====================================================================
-- Hotmart (i18n, etapa P0, item 1): coluna assinaturas.hotmart_transaction_id
-- e os dois tipos de aviso novos do hotmart-webhook
--
-- APLICAR À MÃO NO SQL EDITOR. NUNCA usar `supabase db push`: o histórico
-- supabase_migrations.schema_migrations da produção para em 20260606000001
-- (as migrations seguintes foram aplicadas à mão), então o db push tentaria
-- reaplicar tudo o que veio depois.
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
--   3) admin_notifications_tipo_check: a lista de hoje (5 tipos) mais
--      hotmart_oferta_nao_mapeada e hotmart_config_invalida. Só aceita
--      começar se a lista atual for exatamente a de hoje (ou já a nova, numa
--      reexecução). Nenhuma linha muda; a lista só cresce.
--
-- NÃO toca em RLS, policies, gatilhos, funções nem em outras colunas ou
-- restrições; a autoverificação confere isso, nas duas tabelas, contra uma
-- foto tirada antes do primeiro ALTER.
-- Idempotente, numa transação só. Reversão em
-- scripts/i18n-p0-hotmart/rollback.sql; conferência em
-- scripts/i18n-p0-hotmart/verificacao.sql.
-- =====================================================================

BEGIN;

-- assinaturas é lida em toda troca de tela (plano/limites): se algo segurar
-- uma das tabelas, desiste em vez de enfileirar o app atrás do ALTER.
SET LOCAL lock_timeout = '5s';

-- As duas tabelas travadas desde já (o ALTER pegaria o mesmo lock logo
-- adiante): sem isso, um cadastro ou aviso gravado entre a foto e o ALTER
-- mudaria a contagem de linhas e a autoverificação abortaria à toa.
LOCK TABLE public.assinaturas, public.admin_notifications IN ACCESS EXCLUSIVE MODE;


-- ---------------------------------------------------------------------
-- 0) Pré-condições e foto do que NÃO pode mudar
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tipo  text;
  v_def   text;
  v_tipos text[];
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

  -- CHECK de admin_notifications.tipo: lista de hoje ou, numa reexecução,
  -- a nova. Qualquer outra (alguém já mexeu na produção) aborta, para não
  -- apagar um tipo que esteja em uso.
  IF to_regclass('public.admin_notifications') IS NULL THEN
    RAISE EXCEPTION 'HOT006: tabela public.admin_notifications não existe';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.admin_notifications'::regclass
     AND c.conname = 'admin_notifications_tipo_check' AND c.contype = 'c';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'HOT007: admin_notifications_tipo_check não existe';
  END IF;
  SELECT array_agg(m[1] ORDER BY m[1]) INTO v_tipos
    FROM regexp_matches(v_def, '''([^'']*)''', 'g') m;
  IF v_def NOT LIKE 'CHECK ((tipo = ANY (ARRAY[%])))'
     OR (v_tipos IS DISTINCT FROM ARRAY['cancelamento', 'nova_assinatura', 'novo_trial',
                                        'pagamento_falhou', 'push_enviado']
         AND v_tipos IS DISTINCT FROM ARRAY['cancelamento', 'hotmart_config_invalida',
                                            'hotmart_oferta_nao_mapeada', 'nova_assinatura',
                                            'novo_trial', 'pagamento_falhou', 'push_enviado']) THEN
    RAISE EXCEPTION 'HOT008: admin_notifications_tipo_check diferente do esperado: %', v_def;
  END IF;
END;
$$;

-- Tudo o que não pode mudar, numa view temporária: a foto (antes) e a
-- conferência (depois) usam a mesma consulta. Ficam de fora só a coluna e o
-- índice novos de assinaturas e o CHECK de tipo de admin_notifications.
CREATE TEMP VIEW _hot_estrutura AS
  WITH tabelas(tabela) AS (VALUES ('assinaturas'::text), ('admin_notifications'))
  SELECT t.tabela, 'coluna' AS tipo, column_name::text || '|' || data_type || '|' || is_nullable
         || '|' || COALESCE(column_default, '') AS def
    FROM tabelas t JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = t.tabela
   WHERE column_name <> 'hotmart_transaction_id'
  UNION ALL
  SELECT t.tabela, 'policy', policyname::text || '|' || cmd || '|' || roles::text || '|'
         || COALESCE(qual, '') || '|' || COALESCE(with_check, '')
    FROM tabelas t JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.tabela
  UNION ALL
  SELECT t.tabela, 'rls', c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
    FROM tabelas t JOIN pg_class c ON c.oid = ('public.' || t.tabela)::regclass
  UNION ALL
  SELECT t.tabela, 'gatilho', g.tgname::text || '|' || g.tgenabled::text || '|' || pg_get_triggerdef(g.oid)
    FROM tabelas t JOIN pg_trigger g ON g.tgrelid = ('public.' || t.tabela)::regclass
   WHERE NOT g.tgisinternal
  UNION ALL
  SELECT t.tabela, 'restricao', k.conname::text || '|' || pg_get_constraintdef(k.oid)
    FROM tabelas t JOIN pg_constraint k ON k.conrelid = ('public.' || t.tabela)::regclass
   WHERE k.conname <> 'admin_notifications_tipo_check'
  UNION ALL
  SELECT t.tabela, 'indice', i.indexname::text || '|' || i.indexdef
    FROM tabelas t JOIN pg_indexes i ON i.schemaname = 'public' AND i.tablename = t.tabela
   WHERE i.indexname <> 'assinaturas_hotmart_transaction_id_key'
  UNION ALL
  SELECT t.tabela, 'grant', g.grantee || '|' || g.privilege_type
    FROM tabelas t JOIN information_schema.role_table_grants g
      ON g.table_schema = 'public' AND g.table_name = t.tabela
  UNION ALL
  SELECT 'assinaturas', 'linhas',
         count(*)::text || '|' || count(*) FILTER (WHERE payment_provider = 'hotmart')::text
    FROM public.assinaturas
  UNION ALL
  SELECT 'admin_notifications', 'linhas', count(*)::text FROM public.admin_notifications;

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
-- 3) Tipos de aviso do hotmart-webhook: lista de hoje + os dois novos
--    (a ordem é a de hoje, com os novos no fim)
-- ---------------------------------------------------------------------
ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_tipo_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
  CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou',
                           'push_enviado', 'hotmart_oferta_nao_mapeada', 'hotmart_config_invalida']));


-- ---------------------------------------------------------------------
-- 4) Autoverificação: qualquer divergência desfaz a transação inteira.
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

  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                  WHERE c.conrelid = 'public.admin_notifications'::regclass
                    AND c.conname = 'admin_notifications_tipo_check' AND c.contype = 'c'
                    AND c.convalidated
                    AND pg_get_constraintdef(c.oid) =
                      'CHECK ((tipo = ANY (ARRAY[''novo_trial''::text, ''nova_assinatura''::text, ''cancelamento''::text, ''pagamento_falhou''::text, ''push_enviado''::text, ''hotmart_oferta_nao_mapeada''::text, ''hotmart_config_invalida''::text])))') THEN
    RAISE EXCEPTION 'HOT016: admin_notifications_tipo_check ausente, não validado ou com outra lista';
  END IF;

  -- colunas antigas, RLS, policies, gatilhos, restrições, outros índices,
  -- grants e quantidade de linhas das duas tabelas: iguais à foto, nos dois
  -- sentidos
  SELECT string_agg(tabela || ' ' || tipo || ': ' || def, ' ; ') INTO v_falta FROM (
    (SELECT tabela, 'sumiu/mudou ' || tipo AS tipo, def FROM
       (SELECT * FROM _hot_antes EXCEPT ALL SELECT * FROM _hot_estrutura) x)
    UNION ALL
    (SELECT tabela, 'apareceu ' || tipo, def FROM
       (SELECT * FROM _hot_estrutura EXCEPT ALL SELECT * FROM _hot_antes) y)
  ) d;
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'HOT012: mudou além da coluna, do índice e do CHECK novos: %', v_falta;
  END IF;

  RAISE NOTICE 'HOT OK: hotmart_transaction_id e tipos de aviso aplicados e conferidos';
END;
$$;

DROP VIEW _hot_estrutura;

COMMIT;
