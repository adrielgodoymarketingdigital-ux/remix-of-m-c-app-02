-- Adicionar políticas de SELECT para admins em todas as tabelas relevantes

-- Assinaturas - Admin pode ver todas
CREATE POLICY "Admins podem ver todas assinaturas"
  ON public.assinaturas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Ordens de serviço - Admin pode ver todas
CREATE POLICY "Admins podem ver todas ordens_servico"
  ON public.ordens_servico
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Dispositivos - Admin pode ver todos
CREATE POLICY "Admins podem ver todos dispositivos"
  ON public.dispositivos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Clientes - Admin pode ver todos
CREATE POLICY "Admins podem ver todos clientes"
  ON public.clientes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Vendas - Admin pode ver todas
CREATE POLICY "Admins podem ver todas vendas"
  ON public.vendas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Produtos - Admin pode ver todos
CREATE POLICY "Admins podem ver todos produtos"
  ON public.produtos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Serviços - Admin pode ver todos
CREATE POLICY "Admins podem ver todos servicos"
  ON public.servicos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );