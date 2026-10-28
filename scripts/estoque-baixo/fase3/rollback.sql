-- =====================================================================
-- ROLLBACK da migration 20261103120000_estoque_minimo_por_item.sql
--
-- GUARDA: aborta se algum produto ou peça já tiver estoque_minimo
-- preenchido (para não perder o que o lojista configurou). Nesse caso,
-- fale antes com quem decide; não force.
--
-- Tira os dois CHECKs e as duas colunas. DROP COLUMN só mexe no catálogo
-- (não reescreve a tabela). O app volta sozinho ao limite da loja/padrão,
-- sem erro na tela (o front esconde o campo quando a coluna não existe).
-- Idempotente, numa transação só. Termina com autoconferência.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE public.produtos, public.pecas IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  t       text;
  v_qtd   bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos', 'pecas'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = t AND column_name = 'estoque_minimo') THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE estoque_minimo IS NOT NULL', t) INTO v_qtd;
      IF v_qtd > 0 THEN
        RAISE EXCEPTION 'EMN-RB1: % item(ns) em % já têm estoque_minimo preenchido; rollback cancelado para não perder dado', v_qtd, t;
      END IF;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_estoque_minimo_check;
ALTER TABLE public.pecas    DROP CONSTRAINT IF EXISTS pecas_estoque_minimo_check;
ALTER TABLE public.produtos DROP COLUMN IF EXISTS estoque_minimo;
ALTER TABLE public.pecas    DROP COLUMN IF EXISTS estoque_minimo;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name IN ('produtos', 'pecas')
                AND column_name = 'estoque_minimo') THEN
    RAISE EXCEPTION 'EMN-RB2: estoque_minimo ainda existe';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname IN ('produtos_estoque_minimo_check', 'pecas_estoque_minimo_check')) THEN
    RAISE EXCEPTION 'EMN-RB3: CHECK de estoque_minimo ainda existe';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
