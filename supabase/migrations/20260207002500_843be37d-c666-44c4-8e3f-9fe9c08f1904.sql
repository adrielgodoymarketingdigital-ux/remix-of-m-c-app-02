-- ============================================================
-- MIGRAÇÃO: Corrigir RLS para acesso de funcionários (v2)
-- ============================================================

-- 1. Limpar políticas de loja_funcionarios existentes primeiro
DROP POLICY IF EXISTS "Dono gerencia funcionarios" ON public.loja_funcionarios;
DROP POLICY IF EXISTS "Funcionario ve proprio registro" ON public.loja_funcionarios;

-- 2. Recriar políticas de loja_funcionarios
-- Dono pode tudo
CREATE POLICY "Dono gerencia funcionarios"
ON public.loja_funcionarios
FOR ALL
TO authenticated
USING (loja_user_id = auth.uid())
WITH CHECK (loja_user_id = auth.uid());

-- Funcionário pode ler próprio registro  
CREATE POLICY "Funcionario ve proprio registro"
ON public.loja_funcionarios
FOR SELECT
TO authenticated
USING (funcionario_user_id = auth.uid() AND ativo = true);

-- 3. Limpar e recriar políticas de assinaturas
DROP POLICY IF EXISTS "Usuario ve propria assinatura ou do dono" ON public.assinaturas;
DROP POLICY IF EXISTS "Usuarios podem ver propria assinatura" ON public.assinaturas;

CREATE POLICY "Usuario ve propria assinatura ou do dono"
ON public.assinaturas
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);