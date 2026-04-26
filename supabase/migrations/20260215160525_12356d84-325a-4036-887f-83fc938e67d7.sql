
-- Tabela de regras de notificação automática
CREATE TABLE public.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  url_template TEXT DEFAULT '/',
  target TEXT NOT NULL DEFAULT 'owner',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

-- Admins podem tudo
CREATE POLICY "Admins podem gerenciar regras de notificação"
ON public.notification_rules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários autenticados podem ler regras ativas
CREATE POLICY "Usuários podem ler regras ativas"
ON public.notification_rules
FOR SELECT
TO authenticated
USING (active = true);

-- Seed com regras padrão
INSERT INTO public.notification_rules (event_type, title_template, body_template, url_template, target) VALUES
  ('SALE_CREATED', 'Nova venda realizada', 'Venda no valor de R$ {{total}}', '/vendas', 'owner'),
  ('SERVICE_ORDER_CREATED', 'Nova OS cadastrada', 'OS {{numero_os}} criada', '/ordem-servico', 'owner'),
  ('SERVICE_ORDER_DELIVERED', 'OS entregue', 'OS {{numero_os}} foi entregue ao cliente', '/ordem-servico', 'owner'),
  ('SERVICE_ORDER_UPDATED', 'Status da OS alterado', 'OS {{numero_os}} mudou para {{status}}', '/ordem-servico', 'owner'),
  ('PAYMENT_CONFIRMED', 'Pagamento confirmado', 'Pagamento de R$ {{total}} confirmado', '/vendas', 'owner');
