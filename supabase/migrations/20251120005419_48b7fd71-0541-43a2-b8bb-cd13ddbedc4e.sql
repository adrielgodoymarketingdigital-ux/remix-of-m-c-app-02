-- Remover colunas Kirvano e adicionar colunas Stripe
ALTER TABLE public.assinaturas DROP COLUMN IF EXISTS kirvano_customer_email;
ALTER TABLE public.assinaturas DROP COLUMN IF EXISTS kirvano_subscription_id;
ALTER TABLE public.assinaturas DROP COLUMN IF EXISTS kirvano_payment_link;

-- Adicionar colunas Stripe
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Criar índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_customer ON public.assinaturas(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_subscription ON public.assinaturas(stripe_subscription_id);

-- Comentários para documentação
COMMENT ON COLUMN public.assinaturas.stripe_customer_id IS 'ID do cliente no Stripe (cus_xxx)';
COMMENT ON COLUMN public.assinaturas.stripe_subscription_id IS 'ID da assinatura no Stripe (sub_xxx)';
COMMENT ON COLUMN public.assinaturas.stripe_price_id IS 'ID do preço no Stripe (price_xxx)';