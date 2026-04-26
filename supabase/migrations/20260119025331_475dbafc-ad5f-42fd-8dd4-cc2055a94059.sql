-- Atualizar a função track_user_event para também atualizar last_login_at e login_count
-- quando o evento for de login

CREATE OR REPLACE FUNCTION public.track_user_event(
  _event_type TEXT,
  _event_data JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _user_status TEXT;
  _event_id UUID;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN NULL;
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
$$;