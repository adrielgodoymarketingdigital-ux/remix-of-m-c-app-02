-- Add columns for skip/dismiss onboarding control
ALTER TABLE public.user_onboarding 
ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_dismissed_at TIMESTAMPTZ;