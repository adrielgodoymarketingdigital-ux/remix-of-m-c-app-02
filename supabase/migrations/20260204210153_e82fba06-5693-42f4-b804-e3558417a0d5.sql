
-- Corrigir a função de determinação de condição do usuário
CREATE OR REPLACE FUNCTION public.determinar_condicao_usuario(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura RECORD;
  v_condicao TEXT;
BEGIN
  -- Buscar dados da assinatura
  SELECT 
    status,
    plano_tipo,
    trial_with_card,
    trial_end_at,
    trial_canceled,
    trial_converted,
    data_fim
  INTO v_assinatura
  FROM public.assinaturas
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se não encontrou assinatura
  IF v_assinatura IS NULL THEN
    RETURN 'novo_cadastro';
  END IF;
  
  -- Verificar condições em ordem de prioridade (mais específicas primeiro)
  
  -- 1. Reembolso (verificar se foi cancelado por reembolso - tratado no webhook)
  -- Esta condição é definida pelo webhook quando detecta refund
  
  -- 2. Cancelamento de pagante
  IF v_assinatura.status = 'canceled' AND v_assinatura.plano_tipo NOT IN ('trial', 'demonstracao') THEN
    RETURN 'pagante_cancelado';
  END IF;
  
  -- 3. Pagamento falhou
  IF v_assinatura.status = 'past_due' THEN
    RETURN 'pagamento_falhou';
  END IF;
  
  -- 4. Converteu do trial (tinha trial e agora é pagante)
  IF v_assinatura.trial_converted = true AND v_assinatura.status = 'active' THEN
    RETURN 'converteu_trial';
  END IF;
  
  -- 5. Pagante ativo (não veio de trial ou já tratado acima)
  IF v_assinatura.status = 'active' AND v_assinatura.plano_tipo NOT IN ('trial', 'demonstracao') THEN
    RETURN 'pagante_ativo';
  END IF;
  
  -- 6. Trial COM cartão (trial_with_card = true)
  IF v_assinatura.trial_with_card = true THEN
    -- Verificar se expirou
    IF v_assinatura.trial_canceled = true THEN
      RETURN 'trial_com_cartao_expirado';
    END IF;
    
    IF v_assinatura.trial_end_at IS NOT NULL AND v_assinatura.trial_end_at < now() THEN
      RETURN 'trial_com_cartao_expirado';
    END IF;
    
    -- Se status já é canceled mas não por trial_canceled, considerar expirado
    IF v_assinatura.status = 'canceled' THEN
      RETURN 'trial_com_cartao_expirado';
    END IF;
    
    RETURN 'trial_com_cartao_ativo';
  END IF;
  
  -- 7. Trial SEM cartão (demonstração ou trial antigo sem flag)
  -- Inclui: plano_tipo = 'demonstracao' OU (plano_tipo = 'trial' e trial_with_card = false)
  IF v_assinatura.plano_tipo = 'demonstracao' OR 
     (v_assinatura.plano_tipo = 'trial' AND (v_assinatura.trial_with_card IS NULL OR v_assinatura.trial_with_card = false)) THEN
    
    -- Verificar se expirou
    -- Trial sem cartão: usar data_fim se existir
    IF v_assinatura.status = 'canceled' THEN
      RETURN 'trial_sem_cartao_expirado';
    END IF;
    
    IF v_assinatura.data_fim IS NOT NULL AND v_assinatura.data_fim::date < CURRENT_DATE THEN
      RETURN 'trial_sem_cartao_expirado';
    END IF;
    
    -- Se status não é active/trialing, considerar expirado
    IF v_assinatura.status NOT IN ('active', 'trialing') THEN
      RETURN 'trial_sem_cartao_expirado';
    END IF;
    
    RETURN 'trial_sem_cartao_ativo';
  END IF;
  
  -- Fallback: novo cadastro
  RETURN 'novo_cadastro';
END;
$$;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION public.determinar_condicao_usuario IS 'Determina a condição atual do usuário para automação do CRM. Prioridades: reembolso > cancelado > pagamento_falhou > converteu > pagante > trial_com_cartao > trial_sem_cartao > novo';
