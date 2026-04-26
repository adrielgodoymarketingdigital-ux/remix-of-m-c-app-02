-- Atualizar a função de criação de assinatura para criar trial de 7 dias
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
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Atualizar função de limite de dispositivos para incluir trial (ilimitado durante trial)
CREATE OR REPLACE FUNCTION public.get_user_device_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN a.plano_tipo = 'demonstracao' THEN 5
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 50
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 200
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 5
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status IN ('active', 'trialing')
  LIMIT 1
$function$;

-- Atualizar função de limite de clientes para incluir trial
CREATE OR REPLACE FUNCTION public.get_user_client_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN a.plano_tipo = 'demonstracao' THEN 10
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 10
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status IN ('active', 'trialing')
  LIMIT 1
$function$;

-- Atualizar função de limite de ordens de serviço para incluir trial
CREATE OR REPLACE FUNCTION public.get_user_order_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN a.plano_tipo = 'demonstracao' THEN 5
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 5
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status IN ('active', 'trialing')
  LIMIT 1
$function$;