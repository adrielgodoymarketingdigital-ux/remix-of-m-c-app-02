-- Policies RLS para gerente de filial operar em vendas e ordens_servico
-- com user_id = proprietario_id (padrão do sistema multi-empresa).
-- Sem estas policies o RLS bloqueava INSERT/SELECT/UPDATE dos gerentes.

-- VENDAS: INSERT
DROP POLICY IF EXISTS "gerente pode inserir venda com user_id do proprietario" ON public.vendas;
CREATE POLICY "gerente pode inserir venda com user_id do proprietario"
  ON public.vendas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = vendas.user_id
        AND eu.empresa_id = vendas.empresa_id
    )
  );

-- VENDAS: SELECT
DROP POLICY IF EXISTS "gerente ve registros da filial em vendas" ON public.vendas;
CREATE POLICY "gerente ve registros da filial em vendas"
  ON public.vendas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = vendas.user_id
        AND eu.empresa_id = vendas.empresa_id
    )
  );

-- VENDAS: UPDATE
DROP POLICY IF EXISTS "gerente atualiza registros da filial em vendas" ON public.vendas;
CREATE POLICY "gerente atualiza registros da filial em vendas"
  ON public.vendas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = vendas.user_id
        AND eu.empresa_id = vendas.empresa_id
    )
  );

-- ORDENS_SERVICO: INSERT
DROP POLICY IF EXISTS "gerente pode inserir OS com user_id do proprietario" ON public.ordens_servico;
CREATE POLICY "gerente pode inserir OS com user_id do proprietario"
  ON public.ordens_servico FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = ordens_servico.user_id
        AND eu.empresa_id = ordens_servico.empresa_id
    )
  );

-- ORDENS_SERVICO: SELECT
DROP POLICY IF EXISTS "gerente ve registros da filial em ordens_servico" ON public.ordens_servico;
CREATE POLICY "gerente ve registros da filial em ordens_servico"
  ON public.ordens_servico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = ordens_servico.user_id
        AND eu.empresa_id = ordens_servico.empresa_id
    )
  );

-- ORDENS_SERVICO: UPDATE
DROP POLICY IF EXISTS "gerente atualiza registros da filial em ordens_servico" ON public.ordens_servico;
CREATE POLICY "gerente atualiza registros da filial em ordens_servico"
  ON public.ordens_servico FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = ordens_servico.user_id
        AND eu.empresa_id = ordens_servico.empresa_id
    )
  );
