-- RLS policies para gerente de filial em orcamentos.
-- Gerentes usam empresa_usuarios; is_funcionario_of() cobre apenas loja_funcionarios.

DROP POLICY IF EXISTS "gerente ve orcamentos da filial" ON public.orcamentos;
CREATE POLICY "gerente ve orcamentos da filial"
  ON public.orcamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = orcamentos.user_id
    )
  );

DROP POLICY IF EXISTS "gerente pode inserir orcamento com user_id do proprietario" ON public.orcamentos;
CREATE POLICY "gerente pode inserir orcamento com user_id do proprietario"
  ON public.orcamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = orcamentos.user_id
    )
  );

DROP POLICY IF EXISTS "gerente atualiza orcamentos da filial" ON public.orcamentos;
CREATE POLICY "gerente atualiza orcamentos da filial"
  ON public.orcamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = orcamentos.user_id
    )
  );

DROP POLICY IF EXISTS "gerente exclui orcamentos da filial" ON public.orcamentos;
CREATE POLICY "gerente exclui orcamentos da filial"
  ON public.orcamentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = orcamentos.user_id
    )
  );
