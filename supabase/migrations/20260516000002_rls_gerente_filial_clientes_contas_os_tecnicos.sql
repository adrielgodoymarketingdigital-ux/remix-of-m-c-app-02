-- RLS policies para gerente de filial em clientes, contas e os_tecnicos.
-- Gerentes usam empresa_usuarios; is_funcionario_of() cobre apenas loja_funcionarios.

-- =====================
-- CLIENTES
-- =====================
DROP POLICY IF EXISTS "gerente ve clientes da filial" ON public.clientes;
CREATE POLICY "gerente ve clientes da filial"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = clientes.user_id
    )
  );

DROP POLICY IF EXISTS "gerente pode inserir cliente com user_id do proprietario" ON public.clientes;
CREATE POLICY "gerente pode inserir cliente com user_id do proprietario"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = clientes.user_id
    )
  );

DROP POLICY IF EXISTS "gerente atualiza clientes da filial" ON public.clientes;
CREATE POLICY "gerente atualiza clientes da filial"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = clientes.user_id
    )
  );

DROP POLICY IF EXISTS "gerente exclui clientes da filial" ON public.clientes;
CREATE POLICY "gerente exclui clientes da filial"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = clientes.user_id
    )
  );

-- =====================
-- CONTAS
-- =====================
DROP POLICY IF EXISTS "gerente ve contas da filial" ON public.contas;
CREATE POLICY "gerente ve contas da filial"
  ON public.contas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = contas.user_id
    )
  );

DROP POLICY IF EXISTS "gerente pode inserir conta com user_id do proprietario" ON public.contas;
CREATE POLICY "gerente pode inserir conta com user_id do proprietario"
  ON public.contas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = contas.user_id
    )
  );

DROP POLICY IF EXISTS "gerente atualiza contas da filial" ON public.contas;
CREATE POLICY "gerente atualiza contas da filial"
  ON public.contas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = contas.user_id
    )
  );

DROP POLICY IF EXISTS "gerente exclui contas da filial" ON public.contas;
CREATE POLICY "gerente exclui contas da filial"
  ON public.contas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = contas.user_id
    )
  );

-- =====================
-- OS_TECNICOS
-- (política via OS: gerente que criou a OS pode gerenciar os técnicos dela)
-- =====================
DROP POLICY IF EXISTS "gerente ve tecnicos das OS da filial" ON public.os_tecnicos;
CREATE POLICY "gerente ve tecnicos das OS da filial"
  ON public.os_tecnicos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
      WHERE os.id = os_tecnicos.os_id
        AND eu.gerente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "gerente insere tecnicos nas OS da filial" ON public.os_tecnicos;
CREATE POLICY "gerente insere tecnicos nas OS da filial"
  ON public.os_tecnicos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
      WHERE os.id = os_tecnicos.os_id
        AND eu.gerente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "gerente atualiza tecnicos das OS da filial" ON public.os_tecnicos;
CREATE POLICY "gerente atualiza tecnicos das OS da filial"
  ON public.os_tecnicos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
      WHERE os.id = os_tecnicos.os_id
        AND eu.gerente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "gerente exclui tecnicos das OS da filial" ON public.os_tecnicos;
CREATE POLICY "gerente exclui tecnicos das OS da filial"
  ON public.os_tecnicos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
      WHERE os.id = os_tecnicos.os_id
        AND eu.gerente_id = auth.uid()
    )
  );
