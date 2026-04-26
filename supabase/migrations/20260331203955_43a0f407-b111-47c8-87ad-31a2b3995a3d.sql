
-- Restore correct plan types for users with active Stripe subscriptions who were wrongly downgraded
-- User bb1163fa: intermediario_mensal (price_1SkxLbCjA5c0MuV8M6rYpYd6, next billing 2026-04-17)
UPDATE public.assinaturas 
SET plano_tipo = 'intermediario_mensal', updated_at = now()
WHERE user_id = 'bb1163fa-d663-449d-8129-7d0da3516a19' AND plano_tipo = 'free';

-- User 18f445d1: intermediario_mensal (price_1SkxLbCjA5c0MuV8M6rYpYd6, next billing 2026-04-11)
UPDATE public.assinaturas 
SET plano_tipo = 'intermediario_mensal', updated_at = now()
WHERE user_id = '18f445d1-22cc-4615-83a9-c3f3f41b1700' AND plano_tipo = 'free';

-- User e0cbafd8: profissional_mensal (price_1SkxObCjA5c0MuV8G3OccySn, next billing 2026-04-07)
UPDATE public.assinaturas 
SET plano_tipo = 'profissional_mensal', updated_at = now()
WHERE user_id = 'e0cbafd8-04be-4d61-8b08-4482103c7b00' AND plano_tipo = 'free';
