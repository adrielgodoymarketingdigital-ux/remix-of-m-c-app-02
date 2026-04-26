-- =====================================================
-- TABELA: crm_automacoes
-- Armazena as regras de automação que mapeiam condições de usuários para estágios do CRM
-- =====================================================

CREATE TABLE public.crm_automacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condicao TEXT NOT NULL UNIQUE,
  condicao_label TEXT NOT NULL,
  estagio_destino_id UUID REFERENCES public.crm_estagios(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  prioridade INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para crm_automacoes (apenas admins podem ver/editar)
ALTER TABLE public.crm_automacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver automacoes"
ON public.crm_automacoes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem inserir automacoes"
ON public.crm_automacoes FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar automacoes"
ON public.crm_automacoes FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar automacoes"
ON public.crm_automacoes FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_crm_automacoes_updated_at
BEFORE UPDATE ON public.crm_automacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- INSERIR CONDIÇÕES PADRÃO
-- =====================================================

INSERT INTO public.crm_automacoes (condicao, condicao_label, prioridade) VALUES
  ('novo_cadastro', 'Novo Cadastro', 0),
  ('trial_com_cartao_ativo', 'Trial Ativo (Cartão Cadastrado)', 1),
  ('trial_com_cartao_expirado', 'Trial Expirado (Com Cartão)', 2),
  ('trial_sem_cartao_ativo', 'Demonstração Ativa (Sem Cartão)', 3),
  ('pagante_ativo', 'Pagante Ativo', 4),
  ('converteu_trial', 'Converteu do Trial', 5),
  ('pagamento_falhou', 'Pagamento Falhou', 6),
  ('pagante_cancelado', 'Cancelou Assinatura', 7),
  ('reembolsado', 'Solicitou Reembolso', 8);

-- =====================================================
-- FUNÇÃO: determinar_condicao_usuario
-- Determina a condição atual de um usuário baseado em sua assinatura
-- =====================================================

CREATE OR REPLACE FUNCTION public.determinar_condicao_usuario(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assinatura RECORD;
  v_condicao TEXT;
BEGIN
  -- Buscar dados da assinatura do usuário
  SELECT 
    plano_tipo,
    status,
    trial_with_card,
    trial_end_at,
    trial_converted,
    trial_canceled,
    data_fim
  INTO v_assinatura
  FROM public.assinaturas
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Se não existe assinatura, é novo cadastro
  IF v_assinatura IS NULL THEN
    RETURN 'novo_cadastro';
  END IF;

  -- Verificar se converteu o trial recentemente
  IF v_assinatura.trial_converted = true AND v_assinatura.status = 'active' THEN
    RETURN 'converteu_trial';
  END IF;

  -- Pagante ativo
  IF v_assinatura.status = 'active' AND v_assinatura.plano_tipo NOT IN ('trial', 'demonstracao') THEN
    RETURN 'pagante_ativo';
  END IF;

  -- Pagamento falhou
  IF v_assinatura.status = 'past_due' THEN
    RETURN 'pagamento_falhou';
  END IF;

  -- Trial com cartão ativo
  IF v_assinatura.trial_with_card = true AND v_assinatura.status = 'trialing' THEN
    IF v_assinatura.trial_end_at IS NOT NULL AND v_assinatura.trial_end_at > NOW() THEN
      RETURN 'trial_com_cartao_ativo';
    ELSE
      RETURN 'trial_com_cartao_expirado';
    END IF;
  END IF;

  -- Trial com cartão cancelado
  IF v_assinatura.trial_with_card = true AND v_assinatura.trial_canceled = true THEN
    RETURN 'pagante_cancelado';
  END IF;

  -- Cancelado (subscription deleted)
  IF v_assinatura.status = 'canceled' THEN
    -- Se tinha cartão antes, é cancelamento
    IF v_assinatura.trial_with_card = true THEN
      RETURN 'pagante_cancelado';
    END IF;
    -- Senão é demonstração/trial sem cartão
    RETURN 'trial_sem_cartao_ativo';
  END IF;

  -- Demonstração (trial sem cartão)
  IF v_assinatura.plano_tipo = 'demonstracao' THEN
    RETURN 'trial_sem_cartao_ativo';
  END IF;

  -- Trial padrão
  IF v_assinatura.plano_tipo = 'trial' AND v_assinatura.status = 'trialing' THEN
    RETURN 'trial_com_cartao_ativo';
  END IF;

  -- Fallback
  RETURN 'novo_cadastro';
END;
$$;

-- =====================================================
-- FUNÇÃO: aplicar_automacao_crm
-- Aplica a regra de automação para um usuário específico
-- =====================================================

CREATE OR REPLACE FUNCTION public.aplicar_automacao_crm(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_condicao TEXT;
  v_estagio_destino_id UUID;
  v_estagio_atual_id UUID;
BEGIN
  -- Determinar condição atual do usuário
  v_condicao := public.determinar_condicao_usuario(p_user_id);

  -- Buscar estágio de destino para essa condição
  SELECT estagio_destino_id INTO v_estagio_destino_id
  FROM public.crm_automacoes
  WHERE condicao = v_condicao AND ativo = true;

  -- Se não há regra configurada ou estágio de destino, sair
  IF v_estagio_destino_id IS NULL THEN
    RETURN;
  END IF;

  -- Buscar estágio atual do usuário
  SELECT estagio_id INTO v_estagio_atual_id
  FROM public.crm_usuarios
  WHERE user_id = p_user_id;

  -- Se o usuário já está no estágio de destino, não fazer nada
  IF v_estagio_atual_id = v_estagio_destino_id THEN
    RETURN;
  END IF;

  -- Inserir ou atualizar o registro do usuário no CRM
  INSERT INTO public.crm_usuarios (user_id, estagio_id, updated_at)
  VALUES (p_user_id, v_estagio_destino_id, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    estagio_id = v_estagio_destino_id,
    updated_at = NOW();

END;
$$;

-- =====================================================
-- FUNÇÃO: trigger_aplicar_automacao_crm
-- Função de trigger que chama a automação quando assinatura muda
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_aplicar_automacao_crm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Aplicar automação para o usuário
  PERFORM public.aplicar_automacao_crm(NEW.user_id);
  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER: executar automação quando assinatura muda
-- =====================================================

CREATE TRIGGER trigger_crm_automacao
AFTER INSERT OR UPDATE OF status, plano_tipo, trial_with_card, trial_end_at, trial_converted, trial_canceled
ON public.assinaturas
FOR EACH ROW
EXECUTE FUNCTION public.trigger_aplicar_automacao_crm();

-- =====================================================
-- FUNÇÃO: aplicar_automacao_crm_todos
-- Aplica automação para TODOS os usuários (para uso manual pelo admin)
-- =====================================================

CREATE OR REPLACE FUNCTION public.aplicar_automacao_crm_todos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Verificar se é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;

  -- Iterar por todos os usuários com assinatura
  FOR v_user_id IN 
    SELECT DISTINCT user_id FROM public.assinaturas
  LOOP
    PERFORM public.aplicar_automacao_crm(v_user_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Adicionar constraint única em crm_usuarios para user_id (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_usuarios_user_id_key'
  ) THEN
    ALTER TABLE public.crm_usuarios ADD CONSTRAINT crm_usuarios_user_id_key UNIQUE (user_id);
  END IF;
END $$;