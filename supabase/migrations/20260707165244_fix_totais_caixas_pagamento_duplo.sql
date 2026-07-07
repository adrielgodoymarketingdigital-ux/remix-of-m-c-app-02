-- Corrige os totais de caixas já FECHADOS que foram calculados com valores
-- duplicados/errados em vendas com 2 formas de pagamento (pagamento duplo no PDV).
--
-- Causa raiz: o fechamento de caixa somava vendas por forma de pagamento sem
-- ratear o valor do registro principal entre a 1ª e a 2ª forma, e sem ignorar
-- o registro auxiliar (observacoes = 'pagamento_duplo_secundario'), inflando
-- o total. Esta migration recalcula total_dinheiro/total_pix/total_cartao/
-- total_a_receber/total_vendas/saldo_final de cada caixa fechado, replicando
-- em SQL a mesma lógica de rateio agora usada em src/lib/formaPagamento.ts.

WITH vendas_rateadas AS (
  -- Cada linha de "vendas" vira até 2 linhas: a fatia da 1ª forma e a fatia da 2ª forma
  SELECT
    v.user_id,
    v.empresa_id,
    v.data,
    CASE
      WHEN v.segunda_forma_pagamento IS NOT NULL AND COALESCE(v.valor_segunda_forma, 0) > 0
        THEN GREATEST(0, COALESCE(v.total, 0) - COALESCE(v.valor_segunda_forma, 0))
      ELSE COALESCE(v.total, 0)
    END AS valor,
    v.forma_pagamento::text AS forma
  FROM public.vendas v
  WHERE v.observacoes IS DISTINCT FROM 'pagamento_duplo_secundario'
    AND (v.cancelada IS NULL OR v.cancelada = false)

  UNION ALL

  SELECT
    v.user_id,
    v.empresa_id,
    v.data,
    v.valor_segunda_forma AS valor,
    v.segunda_forma_pagamento::text AS forma
  FROM public.vendas v
  WHERE v.observacoes IS DISTINCT FROM 'pagamento_duplo_secundario'
    AND (v.cancelada IS NULL OR v.cancelada = false)
    AND v.segunda_forma_pagamento IS NOT NULL
    AND COALESCE(v.valor_segunda_forma, 0) > 0
),
totais_por_caixa AS (
  SELECT
    c.id AS caixa_id,
    COALESCE(SUM(vr.valor) FILTER (WHERE vr.forma = 'dinheiro'), 0) AS total_dinheiro,
    COALESCE(SUM(vr.valor) FILTER (WHERE vr.forma = 'pix'), 0) AS total_pix,
    COALESCE(SUM(vr.valor) FILTER (WHERE vr.forma IN ('debito', 'credito', 'credito_parcelado')), 0) AS total_cartao,
    COALESCE(SUM(vr.valor) FILTER (WHERE vr.forma = 'a_receber'), 0) AS total_a_receber
  FROM public.caixas c
  LEFT JOIN vendas_rateadas vr
    ON vr.user_id = COALESCE(c.proprietario_id, c.user_id)
    AND (c.empresa_id IS NULL OR vr.empresa_id = c.empresa_id)
    AND vr.data >= c.data_abertura
    AND vr.data <= COALESCE(c.data_fechamento, now())
  WHERE c.status = 'fechado'
  GROUP BY c.id
)
-- Nota: saldo_final NÃO é recalculado aqui de propósito — ele pode ter sido
-- ajustado manualmente pelo usuário ao contar o dinheiro físico do caixa,
-- e sobrescrevê-lo apagaria essa contagem real. Apenas os totais por forma
-- de pagamento (que vêm 100% das vendas, sem digitação manual) são corrigidos.
UPDATE public.caixas c
SET
  total_dinheiro = t.total_dinheiro,
  total_pix = t.total_pix,
  total_cartao = t.total_cartao,
  total_a_receber = t.total_a_receber,
  total_vendas = t.total_dinheiro + t.total_pix + t.total_cartao + t.total_a_receber
FROM totais_por_caixa t
WHERE c.id = t.caixa_id
  AND c.status = 'fechado';
