
-- 1. Adicionar campos CRM na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS crm_stage text DEFAULT 'novo';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_enviado boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_ultima_mensagem timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_numero_valido boolean DEFAULT true;

-- 2. Setar crm_stage para usuários existentes
UPDATE public.profiles SET crm_stage = 'novo' WHERE crm_stage IS NULL;

-- 3. Índice para buscas por crm_stage
CREATE INDEX IF NOT EXISTS idx_profiles_crm_stage ON public.profiles (crm_stage);

-- 4. Função: buscar usuários por estágio CRM
CREATE OR REPLACE FUNCTION public.get_users_by_crm_stage(p_crm_stage text)
RETURNS TABLE(
  user_id uuid,
  nome text,
  celular text,
  plano_tipo text,
  crm_stage text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.nome,
    p.celular,
    a.plano_tipo::text,
    p.crm_stage,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.assinaturas a ON a.user_id = p.user_id
  WHERE p.crm_stage = p_crm_stage
    AND p.celular IS NOT NULL
    AND p.celular != ''
    AND p.whatsapp_numero_valido = true
  ORDER BY p.created_at ASC;
END;
$$;

-- 5. Função: atualizar estágio CRM
CREATE OR REPLACE FUNCTION public.update_crm_stage(p_user_id uuid, p_crm_stage text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    crm_stage = p_crm_stage,
    whatsapp_ultima_mensagem = now(),
    whatsapp_enviado = CASE WHEN p_crm_stage = 'boas_vindas_enviada' THEN true ELSE whatsapp_enviado END
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- 6. Função: buscar usuário por ID
CREATE OR REPLACE FUNCTION public.get_user_by_id(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  nome text,
  celular text,
  plano_tipo text,
  crm_stage text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.nome,
    p.celular,
    a.plano_tipo::text,
    p.crm_stage
  FROM public.profiles p
  LEFT JOIN public.assinaturas a ON a.user_id = p.user_id
  WHERE p.user_id = p_user_id
  LIMIT 1;
END;
$$;

-- 7. Função: marcar como cliente
CREATE OR REPLACE FUNCTION public.mark_as_client(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET crm_stage = 'cliente'
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- 8. Trigger: auto marcar como cliente quando assinatura ativa com plano pago
CREATE OR REPLACE FUNCTION public.auto_crm_stage_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.plano_tipo NOT IN ('free', 'demonstracao', 'trial') THEN
    UPDATE public.profiles
    SET crm_stage = 'cliente'
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_crm_stage_cliente ON public.assinaturas;
CREATE TRIGGER trg_auto_crm_stage_cliente
  AFTER INSERT OR UPDATE ON public.assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_crm_stage_cliente();
