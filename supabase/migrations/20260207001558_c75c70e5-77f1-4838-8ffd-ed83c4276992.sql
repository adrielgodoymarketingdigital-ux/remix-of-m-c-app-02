-- Remover políticas duplicadas em loja_funcionarios
DROP POLICY IF EXISTS "Funcionarios veem proprio registro" ON public.loja_funcionarios;
DROP POLICY IF EXISTS "Funcionarios podem ver seu vinculo" ON public.loja_funcionarios;
DROP POLICY IF EXISTS "Donos gerenciam funcionarios" ON public.loja_funcionarios;

-- Criar políticas limpas
-- 1. Dono da loja pode fazer tudo com seus funcionários
CREATE POLICY "Dono gerencia funcionarios"
ON public.loja_funcionarios
FOR ALL
TO authenticated
USING (loja_user_id = auth.uid())
WITH CHECK (loja_user_id = auth.uid());

-- 2. Funcionário pode ver seu próprio registro
CREATE POLICY "Funcionario ve seu vinculo"
ON public.loja_funcionarios
FOR SELECT
TO authenticated
USING (funcionario_user_id = auth.uid());