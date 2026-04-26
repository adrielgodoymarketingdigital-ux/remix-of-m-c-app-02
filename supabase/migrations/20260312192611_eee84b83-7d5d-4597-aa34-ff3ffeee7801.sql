
-- Drop the recursive policy
DROP POLICY IF EXISTS "Funcionario pode ver colegas da mesma loja" ON public.loja_funcionarios;

-- Create a security definer function to check if user belongs to same store
CREATE OR REPLACE FUNCTION public.is_colleague_of(target_loja_user_id uuid)
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
      AND ativo = true
      AND loja_user_id = target_loja_user_id
  )
$$;

-- Recreate the policy using the function
CREATE POLICY "Funcionario pode ver colegas da mesma loja"
ON public.loja_funcionarios
FOR SELECT
TO authenticated
USING (
  public.is_colleague_of(loja_user_id)
);
