-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Validação Server-Side de Limites de Plano
-- =====================================================

-- Função para obter limite de clientes baseado no plano
CREATE OR REPLACE FUNCTION public.get_user_client_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN a.plano_tipo = 'demonstracao' THEN 10
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 10
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status = 'active'
  LIMIT 1
$$;

-- Função para contar clientes do usuário
CREATE OR REPLACE FUNCTION public.count_user_clients(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.clientes
  WHERE user_id = _user_id
$$;

-- Função para verificar se pode inserir cliente
CREATE OR REPLACE FUNCTION public.can_insert_client(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.count_user_clients(_user_id) < public.get_user_client_limit(_user_id)
$$;

-- Função para obter limite de ordens de serviço baseado no plano
CREATE OR REPLACE FUNCTION public.get_user_order_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN a.plano_tipo = 'demonstracao' THEN 5
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 100
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 500
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 5
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status = 'active'
  LIMIT 1
$$;

-- Função para contar ordens de serviço do usuário
CREATE OR REPLACE FUNCTION public.count_user_orders(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.ordens_servico
  WHERE user_id = _user_id
$$;

-- Função para verificar se pode inserir ordem de serviço
CREATE OR REPLACE FUNCTION public.can_insert_order(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.count_user_orders(_user_id) < public.get_user_order_limit(_user_id)
$$;

-- Atualizar política RLS para clientes (INSERT)
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clientes;
CREATE POLICY "Users can insert own clients" 
ON public.clientes 
FOR INSERT 
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND can_insert_client(auth.uid()));

-- Atualizar política RLS para ordens_servico (INSERT)
DROP POLICY IF EXISTS "Users can insert own service orders" ON public.ordens_servico;
CREATE POLICY "Users can insert own service orders" 
ON public.ordens_servico 
FOR INSERT 
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND can_insert_order(auth.uid()));