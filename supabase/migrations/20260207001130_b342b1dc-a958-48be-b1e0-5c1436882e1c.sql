-- Criar função para verificar se o usuário é funcionário ativo de uma loja
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

-- Política para funcionários verem a assinatura do dono da loja
DROP POLICY IF EXISTS "Funcionarios podem ver assinatura do dono" ON public.assinaturas;
CREATE POLICY "Funcionarios podem ver assinatura do dono"
ON public.assinaturas
FOR SELECT
TO authenticated
USING (
  public.is_funcionario_of(user_id)
);