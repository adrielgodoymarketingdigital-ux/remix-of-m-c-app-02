-- =====================================================================
-- REVERSÃO da migration 20261101120000_hotmart_transaction_id.sql
-- (aplicar à mão no SQL Editor; NUNCA `supabase db push`)
--
-- Guardas (a reversão aborta e não muda nada):
--   - alguma assinatura já tem hotmart_transaction_id preenchido (houve venda
--     real pela Hotmart): apagaria a transação que o cancelamento confere;
--   - já existe aviso com hotmart_oferta_nao_mapeada ou
--     hotmart_config_invalida: o CHECK antigo não voltaria com eles na tabela.
-- Nos dois casos, fale com o Adriel antes.
-- Antes de reverter, a versão nova do hotmart-webhook precisa sair do ar
-- (a antiga também grava a coluna: a compra aprovada volta a falhar como
-- antes da P0).
-- Idempotente, numa transação só.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

LOCK TABLE public.assinaturas, public.admin_notifications IN ACCESS EXCLUSIVE MODE;

-- 0) Guardas (consulta dinâmica: numa reexecução a coluna já não existe)
DO $$
DECLARE
  v_qtd bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'assinaturas'
                AND column_name = 'hotmart_transaction_id') THEN
    EXECUTE 'SELECT count(*) FROM public.assinaturas WHERE hotmart_transaction_id IS NOT NULL'
      INTO v_qtd;
    IF v_qtd > 0 THEN
      RAISE EXCEPTION 'HOTRB001: % assinatura(s) com hotmart_transaction_id preenchido; reversão cancelada', v_qtd;
    END IF;
  END IF;

  SELECT count(*) INTO v_qtd FROM public.admin_notifications
   WHERE tipo IN ('hotmart_oferta_nao_mapeada', 'hotmart_config_invalida');
  IF v_qtd > 0 THEN
    RAISE EXCEPTION 'HOTRB003: % aviso(s) com os tipos novos da Hotmart; reversão cancelada', v_qtd;
  END IF;
END;
$$;

-- 1) CHECK de tipo volta à lista de antes (20260215152816)
ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_tipo_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
  CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou', 'push_enviado']));

-- 2) Índice e coluna (o índice cairia junto com a coluna; explícito por clareza)
DROP INDEX IF EXISTS public.assinaturas_hotmart_transaction_id_key;
ALTER TABLE public.assinaturas DROP COLUMN IF EXISTS hotmart_transaction_id;

-- 3) Conferência
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'assinaturas'
                AND column_name = 'hotmart_transaction_id')
     OR to_regclass('public.assinaturas_hotmart_transaction_id_key') IS NOT NULL THEN
    RAISE EXCEPTION 'HOTRB002: coluna ou índice ainda existem depois da reversão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                  WHERE c.conrelid = 'public.admin_notifications'::regclass
                    AND c.conname = 'admin_notifications_tipo_check'
                    AND pg_get_constraintdef(c.oid) =
                      'CHECK ((tipo = ANY (ARRAY[''novo_trial''::text, ''nova_assinatura''::text, ''cancelamento''::text, ''pagamento_falhou''::text, ''push_enviado''::text])))') THEN
    RAISE EXCEPTION 'HOTRB004: admin_notifications_tipo_check não voltou à lista de antes';
  END IF;
  RAISE NOTICE 'HOTRB OK: hotmart_transaction_id removida e tipos de aviso de volta à lista de antes';
END;
$$;

COMMIT;
