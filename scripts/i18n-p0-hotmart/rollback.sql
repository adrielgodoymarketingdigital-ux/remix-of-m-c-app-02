-- =====================================================================
-- REVERSÃO da migration 20261101120000_hotmart_transaction_id.sql
--
-- Guarda: se alguma assinatura já tiver hotmart_transaction_id preenchido
-- (houve venda real pela Hotmart), a reversão aborta, porque apagaria a
-- transação que o cancelamento usa para conferir. Nesse caso, fale com o
-- Adriel antes.
-- Antes de reverter, a versão do hotmart-webhook que grava a coluna precisa
-- sair do ar (senão a próxima compra aprovada falha como hoje).
-- Idempotente, numa transação só.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 0) Guarda (consulta dinâmica: numa reexecução a coluna já não existe)
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
END;
$$;

-- 1) Índice e coluna (o índice cairia junto com a coluna; explícito por clareza)
DROP INDEX IF EXISTS public.assinaturas_hotmart_transaction_id_key;
ALTER TABLE public.assinaturas DROP COLUMN IF EXISTS hotmart_transaction_id;

-- 2) Conferência
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'assinaturas'
                AND column_name = 'hotmart_transaction_id')
     OR to_regclass('public.assinaturas_hotmart_transaction_id_key') IS NOT NULL THEN
    RAISE EXCEPTION 'HOTRB002: coluna ou índice ainda existem depois da reversão';
  END IF;
  RAISE NOTICE 'HOTRB OK: hotmart_transaction_id removida';
END;
$$;

COMMIT;
