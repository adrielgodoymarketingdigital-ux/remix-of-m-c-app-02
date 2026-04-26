-- Adicionar políticas RLS para funcionários em ordens_servico
-- (Nota: algumas políticas já existem, vamos apenas garantir que as de funcionário existam)

-- Primeiro remover políticas existentes de funcionários para evitar conflito
DROP POLICY IF EXISTS "Funcionarios podem ver OS do dono" ON public.ordens_servico;
DROP POLICY IF EXISTS "Funcionarios podem inserir OS para o dono" ON public.ordens_servico;
DROP POLICY IF EXISTS "Funcionarios podem atualizar OS do dono" ON public.ordens_servico;

-- Criar novas políticas para funcionários em ordens_servico
CREATE POLICY "Funcionarios podem ver OS do dono"
ON public.ordens_servico FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem inserir OS para o dono"
ON public.ordens_servico FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem atualizar OS do dono"
ON public.ordens_servico FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));