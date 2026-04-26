
-- Adicionar colunas de parcelamento na tabela vendas
ALTER TABLE public.vendas 
ADD COLUMN parcela_numero integer DEFAULT NULL,
ADD COLUMN total_parcelas integer DEFAULT NULL;

COMMENT ON COLUMN public.vendas.parcela_numero IS 'Número da parcela (1, 2, 3...)';
COMMENT ON COLUMN public.vendas.total_parcelas IS 'Total de parcelas da venda parcelada';
