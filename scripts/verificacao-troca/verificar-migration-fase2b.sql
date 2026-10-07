-- =====================================================================
-- Verificação da migration 20261008120000_caixa_total_devolucoes_troca.sql (Fase 2B)
-- SOMENTE LEITURA. Rodar DEPOIS de aplicar a migration. Um único SELECT
-- (o SQL Editor mostra só o último resultado), sem tabela temporária.
-- Devolve UMA linha; a coluna "resultado" deve ser 'OK' (ou 'FALHOU: motivo').
--
-- O que prova:
--  1) caixas.total_devolucoes_troca existe, numeric(12,2), NOT NULL, DEFAULT 0;
--  2) o CHECK caixas_total_devolucoes_troca_nao_negativo existe e está validado;
--  3) nenhum caixa com valor nulo ou negativo;
--  4) nenhuma outra coluna de caixas sumiu ou mudou de tipo (17 de antes + 1 nova).
-- =====================================================================
WITH
col AS (
  SELECT c.data_type, c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'caixas' AND c.column_name = 'total_devolucoes_troca'
),
chk AS (
  SELECT con.convalidated, pg_get_constraintdef(con.oid) AS def
  FROM pg_constraint con
  WHERE con.conrelid = 'public.caixas'::regclass
    AND con.conname = 'caixas_total_devolucoes_troca_nao_negativo'
),
antigas AS (
  SELECT count(*) AS n
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'caixas'
    AND (c.column_name, c.data_type) IN (
      ('id', 'uuid'), ('user_id', 'uuid'), ('data_abertura', 'timestamp with time zone'),
      ('data_fechamento', 'timestamp with time zone'), ('saldo_inicial', 'numeric'), ('saldo_final', 'numeric'),
      ('total_vendas', 'numeric'), ('total_dinheiro', 'numeric'), ('total_pix', 'numeric'),
      ('total_cartao', 'numeric'), ('total_a_receber', 'numeric'), ('observacoes', 'text'),
      ('status', 'text'), ('created_at', 'timestamp with time zone'), ('empresa_id', 'uuid'),
      ('proprietario_id', 'uuid'), ('total_servicos', 'numeric'))
),
dados AS (
  SELECT
    count(*) AS caixas,
    count(*) FILTER (WHERE (to_jsonb(cx) ->> 'total_devolucoes_troca') IS NULL) AS nulos,
    count(*) FILTER (WHERE (to_jsonb(cx) ->> 'total_devolucoes_troca')::numeric < 0) AS negativos,
    COALESCE(sum((to_jsonb(cx) ->> 'total_devolucoes_troca')::numeric), 0) AS soma
  FROM public.caixas cx
),
checagens AS (
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM col) THEN 'coluna caixas.total_devolucoes_troca não existe'
      WHEN (SELECT data_type FROM col) <> 'numeric'
        OR (SELECT numeric_precision FROM col) IS DISTINCT FROM 12
        OR (SELECT numeric_scale FROM col) IS DISTINCT FROM 2 THEN 'coluna não é numeric(12,2)'
      WHEN (SELECT is_nullable FROM col) <> 'NO' THEN 'coluna aceita NULL'
      WHEN (SELECT column_default FROM col) IS NULL
        OR (SELECT column_default FROM col) NOT IN ('0', '0.00', '(0)::numeric') THEN 'coluna sem DEFAULT 0'
      WHEN NOT EXISTS (SELECT 1 FROM chk) THEN 'CHECK caixas_total_devolucoes_troca_nao_negativo não existe'
      WHEN NOT (SELECT convalidated FROM chk) THEN 'CHECK existe mas não foi validado'
      WHEN (SELECT def FROM chk) NOT LIKE '%total_devolucoes_troca >= %0%' THEN 'CHECK com regra diferente'
      WHEN (SELECT nulos FROM dados) > 0 THEN 'há caixa com valor nulo'
      WHEN (SELECT negativos FROM dados) > 0 THEN 'há caixa com valor negativo'
      WHEN (SELECT n FROM antigas) <> 17 THEN 'alguma coluna antiga de caixas sumiu ou mudou de tipo'
    END AS motivo
)
SELECT
  CASE WHEN motivo IS NULL THEN 'OK' ELSE 'FALHOU: ' || motivo END AS resultado,
  (SELECT caixas FROM dados) AS caixas,
  (SELECT soma FROM dados) AS soma_total_devolucoes_troca,
  (SELECT def FROM chk) AS check_definicao
FROM checagens;
