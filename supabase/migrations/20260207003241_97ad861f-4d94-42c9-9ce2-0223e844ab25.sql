-- Corrigir políticas RLS para funcionários verem dados do dono
-- Usar o nome original do parâmetro da função existente (owner_user_id)

-- 2. Políticas para assinaturas - funcionário vê assinatura do dono
DROP POLICY IF EXISTS "Funcionarios veem assinatura do dono" ON public.assinaturas;
CREATE POLICY "Funcionarios veem assinatura do dono"
ON public.assinaturas
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 3. Políticas para loja_funcionarios - funcionário vê seu próprio registro
DROP POLICY IF EXISTS "Funcionario ve proprio registro" ON public.loja_funcionarios;
CREATE POLICY "Funcionario ve proprio registro"
ON public.loja_funcionarios
FOR SELECT
TO authenticated
USING (
  funcionario_user_id = auth.uid() 
  OR loja_user_id = auth.uid()
);

-- 4. Políticas para user_onboarding - funcionário vê onboarding do dono
DROP POLICY IF EXISTS "Funcionarios veem onboarding do dono" ON public.user_onboarding;
CREATE POLICY "Funcionarios veem onboarding do dono"
ON public.user_onboarding
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 5. Políticas para onboarding_config - todos autenticados podem ver
DROP POLICY IF EXISTS "Usuarios autenticados podem ver config onboarding" ON public.onboarding_config;
CREATE POLICY "Usuarios autenticados podem ver config onboarding"
ON public.onboarding_config
FOR SELECT
TO authenticated
USING (true);

-- 6. Políticas para configuracoes_loja - funcionário vê configuração da loja
DROP POLICY IF EXISTS "Funcionarios veem config loja do dono" ON public.configuracoes_loja;
CREATE POLICY "Funcionarios veem config loja do dono"
ON public.configuracoes_loja
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);