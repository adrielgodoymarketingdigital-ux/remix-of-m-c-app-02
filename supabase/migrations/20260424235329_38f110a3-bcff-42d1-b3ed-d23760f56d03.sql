ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS pagarme_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS pagarme_card_id TEXT;

CREATE INDEX IF NOT EXISTS idx_assinaturas_pagarme_subscription_id
  ON public.assinaturas(pagarme_subscription_id)
  WHERE pagarme_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assinaturas_pagarme_customer_id
  ON public.assinaturas(pagarme_customer_id)
  WHERE pagarme_customer_id IS NOT NULL;