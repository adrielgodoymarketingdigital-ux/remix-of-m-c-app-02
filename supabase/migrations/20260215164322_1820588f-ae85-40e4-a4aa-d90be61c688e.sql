
-- Add condition column to support per-status rules
ALTER TABLE public.notification_rules 
ADD COLUMN condition jsonb DEFAULT NULL;

-- Add a label column for friendly display in admin
ALTER TABLE public.notification_rules 
ADD COLUMN condition_label text DEFAULT NULL;

-- Remove the old generic SERVICE_ORDER_UPDATED rule
DELETE FROM public.notification_rules WHERE event_type = 'SERVICE_ORDER_UPDATED';

-- Insert per-status rules for SERVICE_ORDER_UPDATED
INSERT INTO public.notification_rules (event_type, title_template, body_template, url_template, target, active, condition, condition_label)
VALUES
  ('SERVICE_ORDER_UPDATED', 'OS em andamento', 'OS {{numero_os}} está sendo trabalhada', '/ordem-servico', 'owner', true, '{"status": "em_andamento"}', 'Em andamento'),
  ('SERVICE_ORDER_UPDATED', 'OS concluída', 'OS {{numero_os}} foi concluída e está pronta', '/ordem-servico', 'owner', true, '{"status": "concluida"}', 'Concluída'),
  ('SERVICE_ORDER_UPDATED', 'OS aguardando aprovação', 'OS {{numero_os}} aguarda sua aprovação', '/ordem-servico', 'owner', true, '{"status": "aguardando_aprovacao"}', 'Aguardando aprovação'),
  ('SERVICE_ORDER_UPDATED', 'OS finalizada', 'OS {{numero_os}} foi finalizada', '/ordem-servico', 'owner', true, '{"status": "finalizado"}', 'Finalizada'),
  ('SERVICE_ORDER_UPDATED', 'OS aguardando retirada', 'OS {{numero_os}} está aguardando retirada', '/ordem-servico', 'owner', true, '{"status": "aguardando_retirada"}', 'Aguardando retirada'),
  ('SERVICE_ORDER_UPDATED', 'OS em garantia', 'OS {{numero_os}} entrou em garantia', '/ordem-servico', 'owner', true, '{"status": "garantia"}', 'Garantia'),
  ('SERVICE_ORDER_UPDATED', 'OS cancelada', 'OS {{numero_os}} foi cancelada', '/ordem-servico', 'owner', true, '{"status": "cancelada"}', 'Cancelada'),
  ('SERVICE_ORDER_UPDATED', 'OS estornada', 'OS {{numero_os}} foi estornada', '/ordem-servico', 'owner', true, '{"status": "estornado"}', 'Estornada');
