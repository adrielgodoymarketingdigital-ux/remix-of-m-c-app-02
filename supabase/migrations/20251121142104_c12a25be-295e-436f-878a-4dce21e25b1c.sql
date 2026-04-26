-- Adicionar colunas para rastreamento de cupons na tabela assinaturas
ALTER TABLE public.assinaturas 
ADD COLUMN IF NOT EXISTS cupom_stripe_id TEXT,
ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN public.assinaturas.cupom_stripe_id IS 'ID do cupom Stripe aplicado na assinatura';
COMMENT ON COLUMN public.assinaturas.valor_desconto IS 'Valor total de desconto aplicado em reais';