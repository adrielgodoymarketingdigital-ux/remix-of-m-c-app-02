-- Atualizar função get_user_client_limit para permitir usuários em demonstração/onboarding
CREATE OR REPLACE FUNCTION public.get_user_client_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo = 'demonstracao' THEN 10  -- Limite para onboarding
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 10  -- Default para onboarding
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id 
    AND (a.status IN ('active', 'trialing') OR a.plano_tipo = 'demonstracao')  -- Incluir demonstração
  LIMIT 1
$$;

-- Atualizar função get_user_device_limit também
CREATE OR REPLACE FUNCTION public.get_user_device_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo = 'demonstracao' THEN 10  -- Limite para onboarding
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 50
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 200
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 10  -- Default para onboarding
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id 
    AND (a.status IN ('active', 'trialing') OR a.plano_tipo = 'demonstracao')
  LIMIT 1
$$;

-- Atualizar função get_user_order_limit também
CREATE OR REPLACE FUNCTION public.get_user_order_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN a.plano_tipo = 'trial' THEN 999999
    WHEN a.plano_tipo = 'demonstracao' THEN 10  -- Limite para onboarding
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 10  -- Default para onboarding
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id 
    AND (a.status IN ('active', 'trialing') OR a.plano_tipo = 'demonstracao')
  LIMIT 1
$$;