-- Corrige policy de UPDATE para gerente de filial em ordens_servico.
-- A policy anterior exigia empresa_id = eu.empresa_id, bloqueando OS
-- com empresa_id IS NULL (registros anteriores ao sistema multi-empresa).

DROP POLICY IF EXISTS "gerente atualiza registros da filial em ordens_servico" ON public.ordens_servico;
CREATE POLICY "gerente atualiza registros da filial em ordens_servico"
  ON public.ordens_servico FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = ordens_servico.user_id
        AND (eu.empresa_id = ordens_servico.empresa_id OR ordens_servico.empresa_id IS NULL)
    )
  );
