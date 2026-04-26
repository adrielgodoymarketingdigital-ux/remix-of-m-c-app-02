-- Remover tabela de assinaturas e eventos Stripe
DROP TABLE IF EXISTS public.assinaturas CASCADE;
DROP TABLE IF EXISTS public.stripe_eventos CASCADE;

-- Remover função de verificação de limite de plano
DROP FUNCTION IF EXISTS public.verificar_limite_plano(uuid, text, integer) CASCADE;