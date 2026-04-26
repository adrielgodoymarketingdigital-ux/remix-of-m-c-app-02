-- Endurecer políticas RLS que estavam com WITH CHECK (true)

-- admin_notifications
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.admin_notifications;

CREATE POLICY "Service role can insert notifications"
ON public.admin_notifications
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- Opcional: permitir que admin autenticado insira manualmente (se necessário)
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.admin_notifications;
CREATE POLICY "Admins can insert notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- kirvano_eventos
DROP POLICY IF EXISTS "Sistema pode inserir eventos Kirvano" ON public.kirvano_eventos;
CREATE POLICY "Service role can insert kirvano events"
ON public.kirvano_eventos
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- vendas_cupons
DROP POLICY IF EXISTS "System can insert coupon usage" ON public.vendas_cupons;
CREATE POLICY "Users can insert coupon usage for own sale"
ON public.vendas_cupons
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendas v
    WHERE v.id = vendas_cupons.venda_id
      AND v.user_id = auth.uid()
  )
);

-- (mantém SELECT/UPDATE/DELETE existentes sem alterações aqui)