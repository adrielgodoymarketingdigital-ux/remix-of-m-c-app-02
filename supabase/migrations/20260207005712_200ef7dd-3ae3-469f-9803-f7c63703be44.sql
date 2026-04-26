-- Adicionar políticas RLS para tabela pecas (funcionários)

-- SELECT: Funcionários podem ver peças do dono
CREATE POLICY "Funcionarios podem ver pecas do dono"
ON public.pecas FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));

-- INSERT: Funcionários podem inserir peças para o dono
CREATE POLICY "Funcionarios podem inserir pecas para o dono"
ON public.pecas FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_funcionario_of(user_id));

-- UPDATE: Funcionários podem atualizar peças do dono
CREATE POLICY "Funcionarios podem atualizar pecas do dono"
ON public.pecas FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));