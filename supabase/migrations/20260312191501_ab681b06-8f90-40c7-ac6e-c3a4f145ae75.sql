CREATE POLICY "Funcionario pode ver colegas da mesma loja"
ON public.loja_funcionarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loja_funcionarios AS meu
    WHERE meu.funcionario_user_id = auth.uid()
      AND meu.ativo = true
      AND meu.loja_user_id = loja_funcionarios.loja_user_id
  )
);