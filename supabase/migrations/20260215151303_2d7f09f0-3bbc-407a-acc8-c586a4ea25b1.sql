
-- Tabela de histórico de notificações por usuário
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT DEFAULT '/dashboard',
  type TEXT DEFAULT 'geral',
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (false);

-- Índices
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_opened_at ON public.notifications(user_id, opened_at);

-- Colunas novas em push_subscriptions
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS device TEXT DEFAULT 'desktop',
ADD COLUMN IF NOT EXISTS is_pwa_installed BOOLEAN DEFAULT false;
