-- Converter coluna data de TIMESTAMP WITH TIME ZONE para DATE
-- Os dados existentes são convertidos usando o timezone de Brasília (America/Sao_Paulo)
-- para evitar que timestamps gravados em UTC (ex: 2025-05-25T00:00:00Z = 24/05 às 21h BRT)
-- sejam interpretados como dia errado.

DROP VIEW IF EXISTS public.vendas_ativas;

ALTER TABLE public.vendas
  ALTER COLUMN data TYPE DATE
  USING (data AT TIME ZONE 'America/Sao_Paulo')::DATE;

ALTER TABLE public.vendas
  ALTER COLUMN data SET DEFAULT (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

CREATE VIEW public.vendas_ativas AS
SELECT
  id, cliente_id, cupom_codigo, custo_unitario, data, data_cancelamento,
  data_prevista_recebimento, data_recebimento, deleted_at, dispositivo_id,
  estorno_estoque, forma_pagamento, funcionario_id, grupo_venda,
  motivo_cancelamento, observacoes, parcela_numero, peca_id, produto_id,
  quantidade, recebido, cancelada, tipo, total, total_parcelas, user_id,
  valor_desconto_cupom, valor_desconto_manual
FROM public.vendas
WHERE deleted_at IS NULL;
