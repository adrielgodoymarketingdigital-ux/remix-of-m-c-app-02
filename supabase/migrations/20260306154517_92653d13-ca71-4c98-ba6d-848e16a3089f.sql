
-- 1. Make termos-compra bucket private
UPDATE storage.buckets SET public = false WHERE id = 'termos-compra';

-- 2. Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Public can view termos" ON storage.objects;
DROP POLICY IF EXISTS "Acesso público aos recibos de compra" ON storage.objects;

-- 3. Create owner-scoped SELECT policy
CREATE POLICY "Users can view own termos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'termos-compra' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Add input validation to update_onboarding_step
CREATE OR REPLACE FUNCTION public.update_onboarding_step(_user_id uuid, _step text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _now timestamp with time zone := now();
BEGIN
  -- Validate step input
  IF _step NOT IN ('cliente_cadastrado', 'dispositivo_cadastrado', 'peca_cadastrada', 'os_criada', 'lucro_visualizado') THEN
    RAISE EXCEPTION 'Invalid onboarding step: %', _step;
  END IF;

  -- Validate ownership
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot update onboarding for another user';
  END IF;

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
$function$;

-- 5. Add input validation to track_user_event
CREATE OR REPLACE FUNCTION public.track_user_event(_event_type text, _event_data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _user_status TEXT;
  _event_id UUID;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Validate event_type against allowed values
  IF _event_type NOT IN (
    'login', 'logout', 'cliente_cadastrado', 'dispositivo_cadastrado',
    'peca_cadastrada', 'os_criada', 'os_finalizada', 'relatorio_visualizado',
    'planos_visitado', 'funcionalidade_bloqueada', 'onboarding_step_completed',
    'onboarding_tipo_negocio_selected', 'onboarding_skipped', 'onboarding_dismissed',
    'aha_moment_reached', 'upgrade_clicked', 'trial_warning_shown', 'page_view'
  ) THEN
    RAISE EXCEPTION 'Invalid event type: %', _event_type;
  END IF;

  -- Limit JSONB payload size to 64KB
  IF pg_column_size(_event_data) > 65536 THEN
    RAISE EXCEPTION 'Event data too large';
  END IF;
  
  -- Determinar status do usuário
  SELECT 
    CASE 
      WHEN a.plano_tipo = 'admin' THEN 'admin'
      WHEN a.plano_tipo = 'trial' AND a.status = 'trialing' AND a.data_fim > NOW() THEN 'trial'
      WHEN a.plano_tipo = 'trial' AND (a.status != 'trialing' OR a.data_fim <= NOW()) THEN 'expired'
      WHEN a.status = 'active' THEN 'paid'
      ELSE 'unknown'
    END INTO _user_status
  FROM public.assinaturas a
  WHERE a.user_id = _user_id
  LIMIT 1;
  
  -- Se for evento de login, atualizar last_login_at e login_count no profile
  IF _event_type = 'login' THEN
    UPDATE public.profiles
    SET 
      last_login_at = NOW(),
      login_count = COALESCE(login_count, 0) + 1,
      updated_at = NOW()
    WHERE user_id = _user_id;
  END IF;
  
  -- Inserir evento
  INSERT INTO public.user_events (user_id, event_type, event_data, user_status)
  VALUES (_user_id, _event_type, _event_data, COALESCE(_user_status, 'unknown'))
  RETURNING id INTO _event_id;
  
  RETURN _event_id;
END;
$function$;

-- 6. Add input validation to update_crm_stage
CREATE OR REPLACE FUNCTION public.update_crm_stage(p_user_id uuid, p_crm_stage text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate CRM stage
  IF p_crm_stage NOT IN (
    'novo', 'boas_vindas_enviada', 'cliente', 'trial_sem_cartao_ativo',
    'trial_sem_cartao_expirado', 'trial_com_cartao_ativo', 'trial_com_cartao_expirado',
    'pagante_ativo', 'pagante_cancelado', 'pagamento_falhou', 'converteu_trial',
    'novo_cadastro', 'reembolso'
  ) THEN
    RAISE EXCEPTION 'Invalid CRM stage: %', p_crm_stage;
  END IF;

  -- Validate length
  IF length(p_crm_stage) > 100 THEN
    RAISE EXCEPTION 'CRM stage value too long';
  END IF;

  UPDATE public.profiles
  SET 
    crm_stage = p_crm_stage,
    whatsapp_ultima_mensagem = now(),
    whatsapp_enviado = CASE WHEN p_crm_stage = 'boas_vindas_enviada' THEN true ELSE whatsapp_enviado END
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$function$;
