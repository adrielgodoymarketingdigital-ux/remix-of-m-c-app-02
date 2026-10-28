-- =====================================================================
-- Conferência da migration 20261103120000_estoque_minimo_por_item.sql
-- (rodar DEPOIS dela e do passo 2). Só estrutura e contagens: nenhum dado
-- de cliente. Um único resultado; toda linha deve ter ok = true.
-- Antes do passo 2, as linhas 5 e 6 dão false (CHECK ainda NOT VALID).
-- =====================================================================
WITH
col AS (
  SELECT table_name AS tabela, data_type || '|' || is_nullable || '|' || COALESCE(column_default, '') AS def
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name IN ('produtos', 'pecas') AND column_name = 'estoque_minimo'
),
chk AS (
  SELECT conrelid::regclass::text AS tabela, pg_get_constraintdef(oid) AS def, convalidated
    FROM pg_constraint
   WHERE conname IN ('produtos_estoque_minimo_check', 'pecas_estoque_minimo_check') AND contype = 'c'
),
linhas (ordem, item, esperado, encontrado) AS (
            SELECT 1, 'coluna produtos.estoque_minimo (tipo|nula|default)', 'integer|YES|',
                   (SELECT def FROM col WHERE tabela = 'produtos')
  UNION ALL SELECT 2, 'coluna pecas.estoque_minimo (tipo|nula|default)', 'integer|YES|',
                   (SELECT def FROM col WHERE tabela = 'pecas')
  UNION ALL SELECT 3, 'CHECK produtos (0 a 1000)', 'CHECK (((estoque_minimo >= 0) AND (estoque_minimo <= 1000)))',
                   (SELECT replace(def, ' NOT VALID', '') FROM chk WHERE tabela = 'produtos')
  UNION ALL SELECT 4, 'CHECK pecas (0 a 1000)', 'CHECK (((estoque_minimo >= 0) AND (estoque_minimo <= 1000)))',
                   (SELECT replace(def, ' NOT VALID', '') FROM chk WHERE tabela = 'pecas')
  UNION ALL SELECT 5, 'CHECK produtos validado (passo 2)', 'true',
                   (SELECT convalidated::text FROM chk WHERE tabela = 'produtos')
  UNION ALL SELECT 6, 'CHECK pecas validado (passo 2)', 'true',
                   (SELECT convalidated::text FROM chk WHERE tabela = 'pecas')
  UNION ALL SELECT 7, 'produtos com estoque_minimo fora de 0..1000', '0',
                   (SELECT count(*)::text FROM public.produtos WHERE estoque_minimo < 0 OR estoque_minimo > 1000)
  UNION ALL SELECT 8, 'pecas com estoque_minimo fora de 0..1000', '0',
                   (SELECT count(*)::text FROM public.pecas WHERE estoque_minimo < 0 OR estoque_minimo > 1000)
  UNION ALL SELECT 9, 'views do catálogo público sem estoque_minimo', '0',
                   (SELECT count(*)::text FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name IN ('produtos_catalogo', 'pecas_catalogo')
                       AND column_name = 'estoque_minimo')
  UNION ALL SELECT 10, 'nenhum gatilho novo cita estoque_minimo', '0',
                   (SELECT count(*)::text FROM pg_trigger g JOIN pg_proc p ON p.oid = g.tgfoid
                     WHERE g.tgrelid IN ('public.produtos'::regclass, 'public.pecas'::regclass)
                       AND NOT g.tgisinternal AND p.prosrc ILIKE '%estoque_minimo%')
  UNION ALL SELECT 11, 'anon sem privilégio novo na coluna (igual à tabela)', 'true',
                   (has_column_privilege('anon', 'public.produtos', 'estoque_minimo', 'SELECT')
                      = has_table_privilege('anon', 'public.produtos', 'SELECT'))::text
)
SELECT ordem, item, esperado, encontrado, (encontrado IS NOT DISTINCT FROM esperado) AS ok
  FROM linhas
 ORDER BY ordem;
