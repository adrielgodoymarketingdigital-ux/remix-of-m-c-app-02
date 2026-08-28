-- Comissão sobre Lucro (por funcionário):
-- comissao_calculo define sobre o que a Comissão por Tipo de Serviço incide.
--   'faturamento' (padrão) = valor de venda do serviço (comportamento atual)
--   'lucro'                 = valor de venda menos o custo do serviço (venda - custo)
-- Não afeta quem não mexer nisso: default 'faturamento' preserva o cálculo existente.
ALTER TABLE public.loja_funcionarios
  ADD COLUMN IF NOT EXISTS comissao_calculo text NOT NULL DEFAULT 'faturamento';

ALTER TABLE public.loja_funcionarios
  DROP CONSTRAINT IF EXISTS loja_funcionarios_comissao_calculo_check;

ALTER TABLE public.loja_funcionarios
  ADD CONSTRAINT loja_funcionarios_comissao_calculo_check
  CHECK (comissao_calculo IN ('faturamento', 'lucro'));
