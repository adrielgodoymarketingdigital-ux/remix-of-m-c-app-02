-- Funcionários com permissão sobre serviços do dono não conseguiam excluir
-- serviços porque só existia policy de DELETE restrita a auth.uid() = user_id.
DROP POLICY IF EXISTS "Funcionarios podem deletar servicos do dono" ON public.servicos;
CREATE POLICY "Funcionarios podem deletar servicos do dono"
ON public.servicos FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_funcionario_of(user_id)
);
