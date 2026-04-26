-- 1. Migrar todos os usuários de demonstracao para trial (com data_fim = NOW + 7 dias)
UPDATE public.assinaturas 
SET 
  plano_tipo = 'trial',
  status = CASE 
    WHEN status = 'canceled' THEN 'trialing' 
    ELSE status 
  END,
  data_fim = CASE 
    WHEN data_fim IS NULL OR data_fim < NOW() THEN NOW() + INTERVAL '7 days'
    ELSE data_fim
  END,
  updated_at = NOW()
WHERE plano_tipo = 'demonstracao';

-- 2. Atualizar função get_user_device_limit para remover demonstracao
CREATE OR REPLACE FUNCTION public.get_user_device_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 50
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 200
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 999999
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status IN ('active', 'trialing')
  LIMIT 1
$function$;

-- 3. Atualizar função get_user_client_limit para remover demonstracao
CREATE OR REPLACE FUNCTION public.get_user_client_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 999999
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status IN ('active', 'trialing')
  LIMIT 1
$function$;

-- 4. Atualizar função get_user_order_limit para remover demonstracao
CREATE OR REPLACE FUNCTION public.get_user_order_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 999999
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status IN ('active', 'trialing')
  LIMIT 1
$function$;

-- 5. Atualizar trigger de criação de assinatura para novos usuários (agora cria trial direto)
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

-- 6. Atualizar trigger de notificação de mudança de assinatura
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- New paid subscription
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') AND NEW.plano_tipo NOT IN ('trial') THEN
    INSERT INTO public.admin_notifications (tipo, titulo, mensagem, dados)
    VALUES (
      'nova_assinatura',
      'Nova assinatura paga!',
      'Um usuário assinou o plano ' || NEW.plano_tipo,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'plano_tipo', NEW.plano_tipo,
        'stripe_subscription_id', NEW.stripe_subscription_id
      )
    );
  END IF;
  
  -- Subscription canceled
  IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
    INSERT INTO public.admin_notifications (tipo, titulo, mensagem, dados)
    VALUES (
      'cancelamento',
      'Assinatura cancelada',
      'Um usuário cancelou o plano ' || OLD.plano_tipo,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'plano_tipo', OLD.plano_tipo
      )
    );
  END IF;
  
  -- Payment failed
  IF NEW.status = 'past_due' AND OLD.status != 'past_due' THEN
    INSERT INTO public.admin_notifications (tipo, titulo, mensagem, dados)
    VALUES (
      'pagamento_falhou',
      'Pagamento falhou',
      'O pagamento de um usuário falhou',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'plano_tipo', NEW.plano_tipo
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;