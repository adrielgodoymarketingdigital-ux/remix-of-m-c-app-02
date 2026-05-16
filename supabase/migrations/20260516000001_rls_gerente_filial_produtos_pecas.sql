-- RLS policies para gerente de filial operar em produtos e pecas
-- com user_id = proprietario_id (padrão do sistema multi-empresa).
-- Gerentes estão em empresa_usuarios; is_funcionario_of() cobre apenas loja_funcionarios.

-- PRODUTOS: SELECT
DROP POLICY IF EXISTS "gerente ve produtos da filial" ON public.produtos;
CREATE POLICY "gerente ve produtos da filial"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = produtos.user_id
        AND eu.empresa_id = produtos.empresa_id
    )
  );

-- PRODUTOS: INSERT
DROP POLICY IF EXISTS "gerente pode inserir produto com user_id do proprietario" ON public.produtos;
CREATE POLICY "gerente pode inserir produto com user_id do proprietario"
  ON public.produtos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = produtos.user_id
        AND eu.empresa_id = produtos.empresa_id
    )
  );

-- PRODUTOS: UPDATE
DROP POLICY IF EXISTS "gerente atualiza produtos da filial" ON public.produtos;
CREATE POLICY "gerente atualiza produtos da filial"
  ON public.produtos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = produtos.user_id
        AND eu.empresa_id = produtos.empresa_id
    )
  );

-- PRODUTOS: DELETE
DROP POLICY IF EXISTS "gerente exclui produtos da filial" ON public.produtos;
CREATE POLICY "gerente exclui produtos da filial"
  ON public.produtos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = produtos.user_id
        AND eu.empresa_id = produtos.empresa_id
    )
  );

-- PECAS: SELECT
DROP POLICY IF EXISTS "gerente ve pecas da filial" ON public.pecas;
CREATE POLICY "gerente ve pecas da filial"
  ON public.pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = pecas.user_id
        AND eu.empresa_id = pecas.empresa_id
    )
  );

-- PECAS: INSERT
DROP POLICY IF EXISTS "gerente pode inserir peca com user_id do proprietario" ON public.pecas;
CREATE POLICY "gerente pode inserir peca com user_id do proprietario"
  ON public.pecas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = pecas.user_id
        AND eu.empresa_id = pecas.empresa_id
    )
  );

-- PECAS: UPDATE
DROP POLICY IF EXISTS "gerente atualiza pecas da filial" ON public.pecas;
CREATE POLICY "gerente atualiza pecas da filial"
  ON public.pecas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = pecas.user_id
        AND eu.empresa_id = pecas.empresa_id
    )
  );

-- PECAS: DELETE
DROP POLICY IF EXISTS "gerente exclui pecas da filial" ON public.pecas;
CREATE POLICY "gerente exclui pecas da filial"
  ON public.pecas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = pecas.user_id
        AND eu.empresa_id = pecas.empresa_id
    )
  );
