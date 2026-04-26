
CREATE TABLE public.followup_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  etapa text NOT NULL,
  enviado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT followup_control_user_etapa_unique UNIQUE (user_id, etapa)
);

CREATE INDEX idx_followup_control_user_id ON public.followup_control (user_id);
CREATE INDEX idx_followup_control_etapa ON public.followup_control (etapa);

ALTER TABLE public.followup_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.followup_control FOR ALL USING (true) WITH CHECK (true);
