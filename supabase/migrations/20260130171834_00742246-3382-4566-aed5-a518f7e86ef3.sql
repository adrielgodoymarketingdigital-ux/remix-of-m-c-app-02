-- Atualizar função para criar trial de 24 horas ao invés de 7 dias
CREATE OR REPLACE FUNCTION public.criar_assinatura_basica_gratuita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.assinaturas (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    plano_tipo,
    status,
    data_inicio,
    data_fim,
    data_proxima_cobranca
  ) VALUES (
    NEW.id,
    'trial_' || NEW.id,
    'sub_trial_' || NEW.id,
    'price_trial',
    'trial',
    'trialing',
    NOW(),
    NOW() + INTERVAL '24 hours',
    NOW() + INTERVAL '24 hours'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;