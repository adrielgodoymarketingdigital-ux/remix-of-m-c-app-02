
-- Drop the restrictive owner-only UPDATE policy that blocks staff
DROP POLICY IF EXISTS "Users can update own service orders" ON public.ordens_servico;

-- Also drop the duplicate staff UPDATE policy (keep just one)
DROP POLICY IF EXISTS "Funcionarios podem atualizar OS do dono" ON public.ordens_servico;

-- Drop the restrictive owner-only DELETE policy and recreate with staff support
DROP POLICY IF EXISTS "Users can delete own service orders" ON public.ordens_servico;
CREATE POLICY "Users can delete own service orders"
  ON public.ordens_servico FOR DELETE
  USING ((auth.uid() = user_id) OR is_funcionario_of(user_id));
