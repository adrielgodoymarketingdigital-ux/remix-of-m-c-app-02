-- FASE 1: Remover trigger duplicado
DROP TRIGGER IF EXISTS on_auth_user_created_assinatura ON auth.users;

-- FASE 2: Tornar funções resilientes com ON CONFLICT DO NOTHING

-- 2.1 Atualizar função criar_assinatura_basica_gratuita
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
    data_proxima_cobranca
  ) VALUES (
    NEW.id,
    'demo_' || NEW.id,
    'sub_demo_' || NEW.id,
    'price_demo',
    'demonstracao',
    'active',
    NOW(),
    NOW() + INTERVAL '999 years'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- 2.2 Atualizar função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;