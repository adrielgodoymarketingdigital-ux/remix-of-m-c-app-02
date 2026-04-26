ALTER TABLE public.profiles
  ADD COLUMN whatsapp_status TEXT DEFAULT 'never_sent',
  ADD COLUMN whatsapp_last_sent_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN whatsapp_followup_stage INTEGER DEFAULT 0,
  ADD COLUMN whatsapp_response BOOLEAN DEFAULT false;