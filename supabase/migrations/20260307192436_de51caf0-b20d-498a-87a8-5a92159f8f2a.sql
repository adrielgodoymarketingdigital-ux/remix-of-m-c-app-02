
CREATE TABLE public.reactivation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_step integer NOT NULL,
  template_key text,
  channel text,
  status text,
  provider_message_id text,
  message_text text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, campaign_step)
);

CREATE INDEX idx_reactivation_messages_user_id ON public.reactivation_messages (user_id);
CREATE INDEX idx_reactivation_messages_user_step ON public.reactivation_messages (user_id, campaign_step);
CREATE INDEX idx_reactivation_messages_sent_at ON public.reactivation_messages (sent_at);

ALTER TABLE public.reactivation_messages ENABLE ROW LEVEL SECURITY;
