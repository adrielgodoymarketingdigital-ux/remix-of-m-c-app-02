-- Reverter coluna data de DATE para TIMESTAMP WITH TIME ZONE
-- As vendas convertidas para DATE ficaram como YYYY-MM-DD (meia-noite UTC).
-- Ao reconverter, usamos AT TIME ZONE 'America/Sao_Paulo' para que a data
-- fique correta no timezone brasileiro, e setamos hora 12:00 para que
-- o dia não mude por arredondamento de fuso.

DROP VIEW IF EXISTS public.vendas_ativas;

ALTER TABLE public.vendas
  ALTER COLUMN data TYPE TIMESTAMP WITH TIME ZONE
  USING (data::date + TIME '12:00:00') AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE public.vendas
  ALTER COLUMN data SET DEFAULT NOW();

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
