-- ============================================================================
-- Fechamento de caixa: persistir o valor de OS (serviços entregues)
-- ----------------------------------------------------------------------------
-- Contexto: hoje a seção "Serviços Entregues" do DialogFechamentoCaixa é só
-- visual — nada é persistido e os totais gravados em `caixas` vêm apenas de
-- `vendas` + `vendas_avulsas`. Não existe vínculo estrutural OS <-> caixa; a
-- associação passa a ser por DATA, usando a "Data no caixa" escolhida na
-- confirmação de entrega (DialogAssinaturaSaida) como referência canônica.
-- ============================================================================

-- 1. caixas.total_servicos — soma (faturável) das OS entregues cujo recebimento
--    caiu na janela do caixa. É gravada separada para alimentar a seção visual;
--    o valor de cada OS TAMBÉM entra em total_dinheiro/total_pix/total_cartao
--    conforme a forma de pagamento (ver src/hooks/useCaixa.ts fecharCaixa).
ALTER TABLE public.caixas
  ADD COLUMN IF NOT EXISTS total_servicos numeric(10,2) DEFAULT 0;

-- 2. ordens_servico.data_caixa — a "Data no caixa" do recebimento (campo DATE
--    puro). Referência canônica para casar o recebimento da OS com um caixa.
--    NÃO usar data_saida (é timestamptz e tem semântica de "entrega") nem
--    contas.data_pagamento.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS data_caixa date;

-- 3. Backfill das OS já entregues: usa a data da entrega (data_saida) em
--    horário de Brasília como melhor aproximação da "Data no caixa".
UPDATE public.ordens_servico
SET data_caixa = (data_saida AT TIME ZONE 'America/Sao_Paulo')::date
WHERE data_caixa IS NULL
  AND data_saida IS NOT NULL
  AND status IN ('entregue', 'garantia');

COMMENT ON COLUMN public.caixas.total_servicos IS
  'Soma faturável das OS entregues no período do caixa (também rateada em total_dinheiro/pix/cartao por forma de pagamento).';
COMMENT ON COLUMN public.ordens_servico.data_caixa IS
  'Data no caixa do recebimento da OS (escolhida na confirmação de entrega). Usada para associar o recebimento a um caixa no fechamento.';
