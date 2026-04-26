-- Criar função para obter limite de dispositivos baseado no plano do usuário
CREATE OR REPLACE FUNCTION public.get_user_device_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN a.plano_tipo = 'demonstracao' THEN 5
    WHEN a.plano_tipo IN ('basico_mensal', 'basico_anual') THEN 50
    WHEN a.plano_tipo IN ('intermediario_mensal', 'intermediario_anual') THEN 200
    WHEN a.plano_tipo IN ('profissional_mensal', 'profissional_anual') THEN 999999
    WHEN a.plano_tipo = 'admin' THEN 999999
    ELSE 5
  END
  FROM public.assinaturas a
  WHERE a.user_id = _user_id AND a.status = 'active'
  LIMIT 1
$$;

-- Criar função para contar dispositivos do usuário
CREATE OR REPLACE FUNCTION public.count_user_devices(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.dispositivos
  WHERE user_id = _user_id
$$;

-- Criar função para verificar se usuário pode inserir dispositivo
CREATE OR REPLACE FUNCTION public.can_insert_device(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.count_user_devices(_user_id) < public.get_user_device_limit(_user_id)
$$;

-- Atualizar política INSERT de dispositivos para incluir verificação de limite
DROP POLICY IF EXISTS "Users can insert own devices" ON dispositivos;
CREATE POLICY "Users can insert own devices"
ON dispositivos FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND public.can_insert_device(auth.uid())
);