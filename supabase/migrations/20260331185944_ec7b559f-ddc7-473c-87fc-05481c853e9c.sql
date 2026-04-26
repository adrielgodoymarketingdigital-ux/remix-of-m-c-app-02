UPDATE public.assinaturas 
SET plano_tipo = 'free', status = 'active', stripe_subscription_id = NULL, stripe_price_id = NULL, stripe_customer_id = NULL, data_fim = NULL, data_proxima_cobranca = NULL, updated_at = now()
WHERE user_id = (SELECT user_id FROM public.profiles WHERE email = 'majucelassistencia@gmail.com' LIMIT 1)
AND plano_tipo = 'basico_mensal' AND status = 'active';