ALTER TABLE public.notification_rules
  ADD COLUMN IF NOT EXISTS sound text DEFAULT 'default';

COMMENT ON COLUMN public.notification_rules.sound IS 'Som da notificação: default, silent, ou nome do arquivo (cash, bell, chime, etc.)';