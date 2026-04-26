-- Create notifications table for admin alerts
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados JSONB DEFAULT '{}',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can read notifications
CREATE POLICY "Admins can read notifications"
  ON public.admin_notifications
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update notifications (mark as read)
CREATE POLICY "Admins can update notifications"
  ON public.admin_notifications
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert (from edge functions/triggers)
CREATE POLICY "Service role can insert notifications"
  ON public.admin_notifications
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Create function to notify on new trial registration
CREATE OR REPLACE FUNCTION public.notify_new_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plano_tipo = 'trial' AND NEW.status = 'trialing' THEN
    INSERT INTO public.admin_notifications (tipo, titulo, mensagem, dados)
    VALUES (
      'novo_trial',
      'Novo usuário em trial',
      'Um novo usuário iniciou o período de trial',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'data_inicio', NEW.data_inicio,
        'data_fim', NEW.data_fim
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new trial notifications
CREATE TRIGGER on_new_trial_notification
  AFTER INSERT ON public.assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_trial();

-- Create function to notify on subscription changes
CREATE OR REPLACE FUNCTION public.notify_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- New paid subscription
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') AND NEW.plano_tipo NOT IN ('trial', 'demonstracao') THEN
    INSERT INTO public.admin_notifications (tipo, titulo, mensagem, dados)
    VALUES (
      'nova_assinatura',
      'Nova assinatura paga!',
      'Um usuário assinou o plano ' || NEW.plano_tipo,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'plano_tipo', NEW.plano_tipo,
        'stripe_subscription_id', NEW.stripe_subscription_id
      )
    );
  END IF;
  
  -- Subscription canceled
  IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
    INSERT INTO public.admin_notifications (tipo, titulo, mensagem, dados)
    VALUES (
      'cancelamento',
      'Assinatura cancelada',
      'Um usuário cancelou o plano ' || OLD.plano_tipo,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'plano_tipo', OLD.plano_tipo
      )
    );
  END IF;
  
  -- Payment failed
  IF NEW.status = 'past_due' AND OLD.status != 'past_due' THEN
    INSERT INTO public.admin_notifications (tipo, titulo, mensagem, dados)
    VALUES (
      'pagamento_falhou',
      'Pagamento falhou',
      'O pagamento de um usuário falhou',
      jsonb_build_object(
        'user_id', NEW.user_id,
        'plano_tipo', NEW.plano_tipo
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for subscription change notifications
CREATE TRIGGER on_subscription_change_notification
  AFTER UPDATE ON public.assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_change();