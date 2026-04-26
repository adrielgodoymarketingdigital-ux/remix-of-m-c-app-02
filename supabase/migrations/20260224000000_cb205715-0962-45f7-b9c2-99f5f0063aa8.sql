
-- 1. Add free_trial_ends_at column
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS free_trial_ends_at timestamptz DEFAULT NULL;

-- 2. Set 24h trial for ALL existing Free users
UPDATE public.assinaturas
SET free_trial_ends_at = NOW() + interval '24 hours'
WHERE plano_tipo = 'free'
  AND status = 'active'
  AND free_trial_ends_at IS NULL;

-- 3. Update trigger to set free_trial_ends_at for new users
CREATE OR REPLACE FUNCTION public.criar_assinatura_basica_gratuita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assinaturas (
    user_id,
    plano_tipo,
    status,
    data_inicio,
    free_trial_ends_at
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    now(),
    now() + interval '24 hours'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
