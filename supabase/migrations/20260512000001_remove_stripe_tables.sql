-- Remove tabela stripe_eventos (não é mais usada — Stripe foi removido)
DROP TABLE IF EXISTS public.stripe_eventos;

-- Remove coluna cupom_stripe_id da tabela cupons
ALTER TABLE public.cupons DROP COLUMN IF EXISTS cupom_stripe_id;
