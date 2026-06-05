-- Garantir que a política de SELECT em clientes permita ver clientes próprios.
-- A policy original "Authenticated users can view clients" com USING (true) pode ter
-- sido removida do dashboard, fazendo o join cliente nas OS retornar null (N/A).
-- Recriamos ela para garantir que qualquer usuário autenticado possa ver clientes
-- (o filtro por user_id é feito na query da aplicação, não no RLS).

DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clientes;
CREATE POLICY "Authenticated users can view clients"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);
