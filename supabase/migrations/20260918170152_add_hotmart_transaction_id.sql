-- Coluna dedicada pro provider Hotmart (fluxo internacional /es), espelhando
-- ticto_order_id/pagarme_subscription_id/stripe_subscription_id. Aditiva e
-- nullable — não afeta nenhuma linha ou provider existente.
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS hotmart_transaction_id TEXT;
