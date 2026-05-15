-- Gerente de filial precisa ler a assinatura do proprietário da matriz para herdar o plano.
-- Sem essa policy o RLS bloqueia a query e o gerente fica com plano free.

DROP POLICY IF EXISTS "gerente de filial ve assinatura do proprietario" ON public.assinaturas;

CREATE POLICY "gerente de filial ve assinatura do proprietario"
  ON public.assinaturas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = assinaturas.user_id
    )
  );
