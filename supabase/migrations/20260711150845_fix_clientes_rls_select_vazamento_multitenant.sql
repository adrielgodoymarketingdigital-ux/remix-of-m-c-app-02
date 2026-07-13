-- Corrige vazamento de PII multi-tenant: a policy "Authenticated users can view clients"
-- (USING (true), recriada em 20260605000001_fix_clientes_rls_select.sql) permitia que
-- QUALQUER usuário autenticado lesse a tabela clientes inteira (nome, telefone, CPF,
-- endereço) de todas as lojas, não apenas os seus próprios clientes.
--
-- As policies de SELECT corretamente escopadas por papel já existem e cobrem os três
-- casos necessários — não precisam ser recriadas, só a policy permissiva removida:
--   - "Users can view own clients"              -> auth.uid() = user_id (dono)
--   - "Funcionarios podem ver clientes do dono"  -> user_id = auth.uid() OR is_funcionario_of(user_id)
--   - "gerente ve clientes da filial"            -> EXISTS empresa_usuarios (gerente_id = auth.uid())

DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clientes;
