ALTER TABLE public.admin_notifications DROP CONSTRAINT admin_notifications_tipo_check;

ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check 
CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou', 'push_enviado']));
