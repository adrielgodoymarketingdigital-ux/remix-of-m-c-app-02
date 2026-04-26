-- Permitir que funcionários da loja excluam produtos do dono
DROP POLICY IF EXISTS "Funcionarios podem excluir produtos do dono" ON public.produtos;
CREATE POLICY "Funcionarios podem excluir produtos do dono"
ON public.produtos
FOR DELETE
TO authenticated
USING ((user_id = auth.uid()) OR is_funcionario_of(user_id));

-- Permitir que funcionários da loja excluam peças do dono
DROP POLICY IF EXISTS "Funcionarios podem excluir pecas do dono" ON public.pecas;
CREATE POLICY "Funcionarios podem excluir pecas do dono"
ON public.pecas
FOR DELETE
TO authenticated
USING ((user_id = auth.uid()) OR is_funcionario_of(user_id));