-- Corrigir políticas de admin que estavam com acesso público (roles:{public})
-- Mantém isolamento por user_id para usuários comuns e permite visão total apenas para admin autenticado.

DO $$ BEGIN
  -- clientes
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='clientes' AND policyname='Admins podem ver todos clientes'
  ) THEN
    DROP POLICY "Admins podem ver todos clientes" ON public.clientes;
  END IF;

  CREATE POLICY "Admins podem ver todos clientes"
  ON public.clientes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

  -- dispositivos
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='dispositivos' AND policyname='Admins podem ver todos dispositivos'
  ) THEN
    DROP POLICY "Admins podem ver todos dispositivos" ON public.dispositivos;
  END IF;

  CREATE POLICY "Admins podem ver todos dispositivos"
  ON public.dispositivos
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

  -- produtos
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='produtos' AND policyname='Admins podem ver todos produtos'
  ) THEN
    DROP POLICY "Admins podem ver todos produtos" ON public.produtos;
  END IF;

  CREATE POLICY "Admins podem ver todos produtos"
  ON public.produtos
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

  -- servicos
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='servicos' AND policyname='Admins podem ver todos servicos'
  ) THEN
    DROP POLICY "Admins podem ver todos servicos" ON public.servicos;
  END IF;

  CREATE POLICY "Admins podem ver todos servicos"
  ON public.servicos
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

  -- vendas
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='vendas' AND policyname='Admins podem ver todas vendas'
  ) THEN
    DROP POLICY "Admins podem ver todas vendas" ON public.vendas;
  END IF;

  CREATE POLICY "Admins podem ver todas vendas"
  ON public.vendas
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
END $$;