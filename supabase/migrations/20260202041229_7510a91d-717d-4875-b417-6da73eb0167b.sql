-- =====================================================
-- FASE 1: Migração do banco de dados para trial com cartão
-- =====================================================

-- 1. Novos campos na tabela user_onboarding
ALTER TABLE public.user_onboarding
ADD COLUMN IF NOT EXISTS onboarding_obrigatorio_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_obrigatorio_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS nome_assistencia text,
ADD COLUMN IF NOT EXISTS cidade text,
ADD COLUMN IF NOT EXISTS estado text,
ADD COLUMN IF NOT EXISTS primeiro_cliente_id uuid,
ADD COLUMN IF NOT EXISTS primeira_os_simulada boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS primeira_os_simulada_at timestamp with time zone;

-- 2. Novos campos na tabela assinaturas para trial com cartão
ALTER TABLE public.assinaturas
ADD COLUMN IF NOT EXISTS trial_with_card boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_end_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_converted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_converted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_canceled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_canceled_at timestamp with time zone;

-- 3. Criar tabela para tracking de emails do trial
CREATE TABLE IF NOT EXISTS public.trial_emails_sent (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  opened_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on trial_emails_sent
ALTER TABLE public.trial_emails_sent ENABLE ROW LEVEL SECURITY;

-- Policies for trial_emails_sent (admin only read, service role insert)
CREATE POLICY "Admins podem ver emails de trial"
  ON public.trial_emails_sent
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role pode inserir emails de trial"
  ON public.trial_emails_sent
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role'::text);

-- 4. Index para queries de trial
CREATE INDEX IF NOT EXISTS idx_assinaturas_trial_with_card 
  ON public.assinaturas(trial_with_card) 
  WHERE trial_with_card = true;

CREATE INDEX IF NOT EXISTS idx_assinaturas_trial_end_at 
  ON public.assinaturas(trial_end_at) 
  WHERE trial_end_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trial_emails_user_type 
  ON public.trial_emails_sent(user_id, email_type);