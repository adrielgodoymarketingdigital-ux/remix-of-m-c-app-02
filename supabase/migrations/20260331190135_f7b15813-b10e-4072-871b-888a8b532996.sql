
-- 1. Rebaixar assinantes PAGANTES com data_fim vencida para free
UPDATE public.assinaturas 
SET plano_tipo = 'free', status = 'active', updated_at = now()
WHERE status IN ('active','trialing')
AND plano_tipo NOT IN ('free','demonstracao','admin','trial')
AND data_fim IS NOT NULL AND data_fim < now();

-- 2. Rebaixar TRIALS expirados para free
UPDATE public.assinaturas 
SET plano_tipo = 'free', status = 'active', updated_at = now()
WHERE status IN ('active','trialing')
AND plano_tipo = 'trial'
AND data_fim IS NOT NULL AND data_fim < now();
