
-- 1. Adicionar campos de soft delete na tabela ordens_servico
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- Índice para consultas filtrando soft delete
CREATE INDEX IF NOT EXISTS idx_ordens_servico_deleted_at ON public.ordens_servico (deleted_at) WHERE deleted_at IS NULL;

-- 2. Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.os_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('CREATE', 'UPDATE', 'DELETE')),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dados_antes JSONB DEFAULT NULL,
  dados_depois JSONB DEFAULT NULL
);

ALTER TABLE public.os_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins podem ver tudo, donos veem seus próprios logs
CREATE POLICY "Admins podem ver todos os audit logs"
ON public.os_audit_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Donos podem ver seus audit logs"
ON public.os_audit_log FOR SELECT
USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));

-- Inserção via trigger (SECURITY DEFINER)
CREATE POLICY "Sistema pode inserir audit logs"
ON public.os_audit_log FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_os_audit_log_os_id ON public.os_audit_log (os_id);
CREATE INDEX idx_os_audit_log_user_id ON public.os_audit_log (user_id);
CREATE INDEX idx_os_audit_log_created_at ON public.os_audit_log (created_at DESC);

-- 3. Trigger de auditoria automática para ordens_servico
CREATE OR REPLACE FUNCTION public.os_audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_audit_log (os_id, acao, user_id, dados_depois)
    VALUES (NEW.id, 'CREATE', COALESCE(auth.uid(), NEW.user_id), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se está sendo soft-deleted, registrar como DELETE
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.os_audit_log (os_id, acao, user_id, dados_antes, dados_depois)
      VALUES (NEW.id, 'DELETE', COALESCE(auth.uid(), NEW.user_id), to_jsonb(OLD), to_jsonb(NEW));
    ELSE
      INSERT INTO public.os_audit_log (os_id, acao, user_id, dados_antes, dados_depois)
      VALUES (NEW.id, 'UPDATE', COALESCE(auth.uid(), NEW.user_id), to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER os_audit_trigger
AFTER INSERT OR UPDATE ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.os_audit_trigger_fn();

-- 4. Recriar generate_os_number para ser safe (não desperdiçar números)
-- Nova abordagem: o número é reservado apenas no momento do INSERT via trigger
CREATE OR REPLACE FUNCTION public.generate_os_number_safe(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_os_number TEXT;
BEGIN
  -- Buscar ou criar contador do usuário com lock FOR UPDATE
  INSERT INTO user_os_counters (user_id, ultimo_numero)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Lock e incrementar atomicamente
  UPDATE user_os_counters 
  SET ultimo_numero = ultimo_numero + 1,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING ultimo_numero INTO next_number;
  
  -- Formata como OS-XXXXXX
  new_os_number := 'OS-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_os_number;
END;
$$;

-- Trigger que atribui o número da OS apenas após inserção bem-sucedida
CREATE OR REPLACE FUNCTION public.assign_os_number_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só gera número se não foi fornecido
  IF NEW.numero_os IS NULL OR NEW.numero_os = '' THEN
    NEW.numero_os := public.generate_os_number_safe(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT para atribuir número
CREATE TRIGGER assign_os_number_trigger
BEFORE INSERT ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.assign_os_number_on_insert();
