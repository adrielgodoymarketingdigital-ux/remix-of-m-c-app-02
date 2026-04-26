-- Adicionar campo tipo_negocio na tabela user_onboarding
ALTER TABLE public.user_onboarding 
ADD COLUMN tipo_negocio text DEFAULT NULL;

-- Adicionar campo para o passo de cadastro de peça (para assistência técnica)
ALTER TABLE public.user_onboarding 
ADD COLUMN step_peca_cadastrada boolean DEFAULT false,
ADD COLUMN step_peca_cadastrada_at timestamp with time zone DEFAULT NULL;

-- Atualizar a função update_onboarding_step para incluir o novo passo
CREATE OR REPLACE FUNCTION public.update_onboarding_step(_user_id uuid, _step text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamp with time zone := now();
BEGIN
  -- Atualiza o passo específico
  IF _step = 'cliente_cadastrado' THEN
    UPDATE user_onboarding 
    SET step_cliente_cadastrado = true, 
        step_cliente_cadastrado_at = _now,
        updated_at = _now
    WHERE user_id = _user_id AND step_cliente_cadastrado = false;
  ELSIF _step = 'dispositivo_cadastrado' THEN
    UPDATE user_onboarding 
    SET step_dispositivo_cadastrado = true, 
        step_dispositivo_cadastrado_at = _now,
        updated_at = _now
    WHERE user_id = _user_id AND step_dispositivo_cadastrado = false;
  ELSIF _step = 'peca_cadastrada' THEN
    UPDATE user_onboarding 
    SET step_peca_cadastrada = true, 
        step_peca_cadastrada_at = _now,
        updated_at = _now
    WHERE user_id = _user_id AND step_peca_cadastrada = false;
  ELSIF _step = 'os_criada' THEN
    UPDATE user_onboarding 
    SET step_os_criada = true, 
        step_os_criada_at = _now,
        updated_at = _now
    WHERE user_id = _user_id AND step_os_criada = false;
  ELSIF _step = 'lucro_visualizado' THEN
    UPDATE user_onboarding 
    SET step_lucro_visualizado = true, 
        step_lucro_visualizado_at = _now,
        aha_moment_reached = true,
        aha_moment_reached_at = _now,
        onboarding_completed = true,
        onboarding_completed_at = _now,
        updated_at = _now
    WHERE user_id = _user_id AND step_lucro_visualizado = false;
  END IF;
END;
$$;