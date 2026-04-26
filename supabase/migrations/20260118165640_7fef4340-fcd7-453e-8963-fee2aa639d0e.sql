-- =============================================
-- FASE 1: Sistema de Tracking e Onboarding
-- =============================================

-- 1. Tabela de eventos do usuário (event tracking)
CREATE TABLE public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  user_status TEXT, -- trial, active, expired, paid
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_user_events_user_id ON public.user_events(user_id);
CREATE INDEX idx_user_events_type ON public.user_events(event_type);
CREATE INDEX idx_user_events_created_at ON public.user_events(created_at DESC);

-- RLS
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem inserir seus próprios eventos"
ON public.user_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem ver seus próprios eventos"
ON public.user_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os eventos"
ON public.user_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Tabela de progresso do onboarding
CREATE TABLE public.user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  step_cliente_cadastrado BOOLEAN DEFAULT FALSE,
  step_cliente_cadastrado_at TIMESTAMPTZ,
  step_dispositivo_cadastrado BOOLEAN DEFAULT FALSE,
  step_dispositivo_cadastrado_at TIMESTAMPTZ,
  step_os_criada BOOLEAN DEFAULT FALSE,
  step_os_criada_at TIMESTAMPTZ,
  step_lucro_visualizado BOOLEAN DEFAULT FALSE,
  step_lucro_visualizado_at TIMESTAMPTZ,
  aha_moment_reached BOOLEAN DEFAULT FALSE,
  aha_moment_reached_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por user_id
CREATE INDEX idx_user_onboarding_user_id ON public.user_onboarding(user_id);

-- RLS
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio onboarding"
ON public.user_onboarding FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio onboarding"
ON public.user_onboarding FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio onboarding"
ON public.user_onboarding FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os onboardings"
ON public.user_onboarding FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Adicionar campos úteis na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_os_created_at TIMESTAMPTZ;

-- 4. Função para criar onboarding automaticamente para novos usuários
CREATE OR REPLACE FUNCTION public.create_user_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_onboarding (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger para criar onboarding quando usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created_onboarding ON auth.users;
CREATE TRIGGER on_auth_user_created_onboarding
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_onboarding();

-- 5. Função para atualizar progresso do onboarding
CREATE OR REPLACE FUNCTION public.update_onboarding_step(
  _user_id UUID,
  _step TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_onboarding RECORD;
BEGIN
  -- Buscar estado atual
  SELECT * INTO current_onboarding
  FROM public.user_onboarding
  WHERE user_id = _user_id;
  
  -- Se não existe, criar
  IF NOT FOUND THEN
    INSERT INTO public.user_onboarding (user_id)
    VALUES (_user_id);
    SELECT * INTO current_onboarding
    FROM public.user_onboarding
    WHERE user_id = _user_id;
  END IF;
  
  -- Atualizar o passo específico
  IF _step = 'cliente_cadastrado' AND NOT current_onboarding.step_cliente_cadastrado THEN
    UPDATE public.user_onboarding
    SET step_cliente_cadastrado = TRUE,
        step_cliente_cadastrado_at = NOW(),
        updated_at = NOW()
    WHERE user_id = _user_id;
  ELSIF _step = 'dispositivo_cadastrado' AND NOT current_onboarding.step_dispositivo_cadastrado THEN
    UPDATE public.user_onboarding
    SET step_dispositivo_cadastrado = TRUE,
        step_dispositivo_cadastrado_at = NOW(),
        updated_at = NOW()
    WHERE user_id = _user_id;
  ELSIF _step = 'os_criada' AND NOT current_onboarding.step_os_criada THEN
    UPDATE public.user_onboarding
    SET step_os_criada = TRUE,
        step_os_criada_at = NOW(),
        updated_at = NOW()
    WHERE user_id = _user_id;
    
    -- Atualizar first_os_created_at no profile
    UPDATE public.profiles
    SET first_os_created_at = NOW()
    WHERE user_id = _user_id AND first_os_created_at IS NULL;
  ELSIF _step = 'lucro_visualizado' AND NOT current_onboarding.step_lucro_visualizado THEN
    UPDATE public.user_onboarding
    SET step_lucro_visualizado = TRUE,
        step_lucro_visualizado_at = NOW(),
        updated_at = NOW()
    WHERE user_id = _user_id;
  END IF;
  
  -- Verificar se atingiu Aha Moment (OS criada com cliente e dispositivo)
  SELECT * INTO current_onboarding
  FROM public.user_onboarding
  WHERE user_id = _user_id;
  
  IF current_onboarding.step_cliente_cadastrado 
     AND current_onboarding.step_dispositivo_cadastrado 
     AND current_onboarding.step_os_criada 
     AND NOT current_onboarding.aha_moment_reached THEN
    UPDATE public.user_onboarding
    SET aha_moment_reached = TRUE,
        aha_moment_reached_at = NOW(),
        updated_at = NOW()
    WHERE user_id = _user_id;
  END IF;
  
  -- Verificar se completou todo onboarding
  IF current_onboarding.step_cliente_cadastrado 
     AND current_onboarding.step_dispositivo_cadastrado 
     AND current_onboarding.step_os_criada 
     AND current_onboarding.step_lucro_visualizado
     AND NOT current_onboarding.onboarding_completed THEN
    UPDATE public.user_onboarding
    SET onboarding_completed = TRUE,
        onboarding_completed_at = NOW(),
        updated_at = NOW()
    WHERE user_id = _user_id;
  END IF;
END;
$$;

-- 6. Função para registrar evento do usuário
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
  
  -- Inserir evento
  INSERT INTO public.user_events (user_id, event_type, event_data, user_status)
  VALUES (_user_id, _event_type, _event_data, COALESCE(_user_status, 'unknown'))
  RETURNING id INTO _event_id;
  
  RETURN _event_id;
END;
$$;

-- 7. Habilitar realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_onboarding;

-- 8. Criar onboarding para usuários existentes que não têm
INSERT INTO public.user_onboarding (user_id)
SELECT p.user_id 
FROM public.profiles p
LEFT JOIN public.user_onboarding o ON o.user_id = p.user_id
WHERE o.id IS NULL;