-- Primeiro dropar a política que depende da função
DROP POLICY IF EXISTS "Funcionarios podem ver assinatura do dono" ON public.assinaturas;

-- Dropar a função
DROP FUNCTION IF EXISTS public.is_funcionario_of(uuid);

-- Recriar a função com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_funcionario_of(owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.loja_funcionarios
    WHERE funcionario_user_id = auth.uid()
      AND loja_user_id = owner_user_id
      AND ativo = true
  )
$$;

-- Recriar a política de assinaturas para funcionários
CREATE POLICY "Funcionarios podem ver assinatura do dono"
ON public.assinaturas
FOR SELECT
TO authenticated
USING (public.is_funcionario_of(user_id));