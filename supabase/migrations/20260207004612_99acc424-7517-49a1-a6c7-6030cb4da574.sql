-- =====================================================
-- Permitir funcionários acessar dados do dono da loja
-- =====================================================

-- 1. DISPOSITIVOS - Funcionários podem VER dispositivos do dono
DROP POLICY IF EXISTS "Funcionarios podem ver dispositivos do dono" ON public.dispositivos;
CREATE POLICY "Funcionarios podem ver dispositivos do dono"
ON public.dispositivos FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- Funcionários podem INSERIR dispositivos para o dono
DROP POLICY IF EXISTS "Funcionarios podem inserir dispositivos para o dono" ON public.dispositivos;
CREATE POLICY "Funcionarios podem inserir dispositivos para o dono"
ON public.dispositivos FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- Funcionários podem ATUALIZAR dispositivos do dono
DROP POLICY IF EXISTS "Funcionarios podem atualizar dispositivos do dono" ON public.dispositivos;
CREATE POLICY "Funcionarios podem atualizar dispositivos do dono"
ON public.dispositivos FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 2. PRODUTOS - Funcionários podem VER produtos do dono
DROP POLICY IF EXISTS "Funcionarios podem ver produtos do dono" ON public.produtos;
CREATE POLICY "Funcionarios podem ver produtos do dono"
ON public.produtos FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- Funcionários podem INSERIR produtos para o dono
DROP POLICY IF EXISTS "Funcionarios podem inserir produtos para o dono" ON public.produtos;
CREATE POLICY "Funcionarios podem inserir produtos para o dono"
ON public.produtos FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- Funcionários podem ATUALIZAR produtos do dono
DROP POLICY IF EXISTS "Funcionarios podem atualizar produtos do dono" ON public.produtos;
CREATE POLICY "Funcionarios podem atualizar produtos do dono"
ON public.produtos FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 3. CLIENTES - Funcionários podem acessar clientes do dono
DROP POLICY IF EXISTS "Funcionarios podem ver clientes do dono" ON public.clientes;
CREATE POLICY "Funcionarios podem ver clientes do dono"
ON public.clientes FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir clientes para o dono" ON public.clientes;
CREATE POLICY "Funcionarios podem inserir clientes para o dono"
ON public.clientes FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar clientes do dono" ON public.clientes;
CREATE POLICY "Funcionarios podem atualizar clientes do dono"
ON public.clientes FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 4. SERVIÇOS - Funcionários podem acessar serviços do dono
DROP POLICY IF EXISTS "Funcionarios podem ver servicos do dono" ON public.servicos;
CREATE POLICY "Funcionarios podem ver servicos do dono"
ON public.servicos FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir servicos para o dono" ON public.servicos;
CREATE POLICY "Funcionarios podem inserir servicos para o dono"
ON public.servicos FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar servicos do dono" ON public.servicos;
CREATE POLICY "Funcionarios podem atualizar servicos do dono"
ON public.servicos FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 5. VENDAS - Funcionários podem acessar vendas do dono
DROP POLICY IF EXISTS "Funcionarios podem ver vendas do dono" ON public.vendas;
CREATE POLICY "Funcionarios podem ver vendas do dono"
ON public.vendas FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir vendas para o dono" ON public.vendas;
CREATE POLICY "Funcionarios podem inserir vendas para o dono"
ON public.vendas FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar vendas do dono" ON public.vendas;
CREATE POLICY "Funcionarios podem atualizar vendas do dono"
ON public.vendas FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 6. ORDENS DE SERVIÇO - Funcionários podem acessar OS do dono
DROP POLICY IF EXISTS "Funcionarios podem ver ordens do dono" ON public.ordens_servico;
CREATE POLICY "Funcionarios podem ver ordens do dono"
ON public.ordens_servico FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir ordens para o dono" ON public.ordens_servico;
CREATE POLICY "Funcionarios podem inserir ordens para o dono"
ON public.ordens_servico FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar ordens do dono" ON public.ordens_servico;
CREATE POLICY "Funcionarios podem atualizar ordens do dono"
ON public.ordens_servico FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 7. FORNECEDORES - Funcionários podem acessar fornecedores do dono
DROP POLICY IF EXISTS "Funcionarios podem ver fornecedores do dono" ON public.fornecedores;
CREATE POLICY "Funcionarios podem ver fornecedores do dono"
ON public.fornecedores FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir fornecedores para o dono" ON public.fornecedores;
CREATE POLICY "Funcionarios podem inserir fornecedores para o dono"
ON public.fornecedores FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar fornecedores do dono" ON public.fornecedores;
CREATE POLICY "Funcionarios podem atualizar fornecedores do dono"
ON public.fornecedores FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 8. CONTAS - Funcionários podem acessar contas do dono
DROP POLICY IF EXISTS "Funcionarios podem ver contas do dono" ON public.contas;
CREATE POLICY "Funcionarios podem ver contas do dono"
ON public.contas FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir contas para o dono" ON public.contas;
CREATE POLICY "Funcionarios podem inserir contas para o dono"
ON public.contas FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar contas do dono" ON public.contas;
CREATE POLICY "Funcionarios podem atualizar contas do dono"
ON public.contas FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 9. CUPONS - Funcionários podem acessar cupons do dono
DROP POLICY IF EXISTS "Funcionarios podem ver cupons do dono" ON public.cupons;
CREATE POLICY "Funcionarios podem ver cupons do dono"
ON public.cupons FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 10. ORÇAMENTOS - Funcionários podem acessar orçamentos do dono
DROP POLICY IF EXISTS "Funcionarios podem ver orcamentos do dono" ON public.orcamentos;
CREATE POLICY "Funcionarios podem ver orcamentos do dono"
ON public.orcamentos FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir orcamentos para o dono" ON public.orcamentos;
CREATE POLICY "Funcionarios podem inserir orcamentos para o dono"
ON public.orcamentos FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar orcamentos do dono" ON public.orcamentos;
CREATE POLICY "Funcionarios podem atualizar orcamentos do dono"
ON public.orcamentos FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 11. COMPRAS DE DISPOSITIVOS - Funcionários podem acessar compras do dono
DROP POLICY IF EXISTS "Funcionarios podem ver compras do dono" ON public.compras_dispositivos;
CREATE POLICY "Funcionarios podem ver compras do dono"
ON public.compras_dispositivos FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir compras para o dono" ON public.compras_dispositivos;
CREATE POLICY "Funcionarios podem inserir compras para o dono"
ON public.compras_dispositivos FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem atualizar compras do dono" ON public.compras_dispositivos;
CREATE POLICY "Funcionarios podem atualizar compras do dono"
ON public.compras_dispositivos FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

-- 12. ORIGEM PESSOAS - Funcionários podem acessar pessoas do dono
DROP POLICY IF EXISTS "Funcionarios podem ver pessoas do dono" ON public.origem_pessoas;
CREATE POLICY "Funcionarios podem ver pessoas do dono"
ON public.origem_pessoas FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);

DROP POLICY IF EXISTS "Funcionarios podem inserir pessoas para o dono" ON public.origem_pessoas;
CREATE POLICY "Funcionarios podem inserir pessoas para o dono"
ON public.origem_pessoas FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_funcionario_of(user_id)
);