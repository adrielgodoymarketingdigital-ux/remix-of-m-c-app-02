-- ──────────────────────────────────────────────────────────────────────────────
-- Trigger: creditação automática de pontos de fidelidade
--
-- 1. Vendas  → ao inserir em `vendas` com cliente_id e sem cancelamento
-- 2. OS      → ao atualizar `ordens_servico` com status finalizado/entregue
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── Função auxiliar: registrar pontos ───────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_pontos_fidelidade(
  p_user_id      UUID,
  p_cliente_id   UUID,
  p_referencia_id UUID,
  p_tipo         TEXT,   -- 'venda' | 'os'
  p_valor        NUMERIC
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_config       RECORD;
  v_pontos       INTEGER;
  v_expires_at   TIMESTAMPTZ;
  v_pontos_por_real NUMERIC;
BEGIN
  -- Buscar configuração de fidelidade do dono da loja
  SELECT * INTO v_config
  FROM fidelidade_config
  WHERE user_id = p_user_id
    AND ativo = true
  LIMIT 1;

  -- Se não houver config ativa, não faz nada
  IF NOT FOUND THEN RETURN; END IF;

  -- Selecionar taxa correta conforme tipo
  IF p_tipo = 'os' THEN
    v_pontos_por_real := COALESCE(v_config.pontos_por_real_os, 0);
  ELSE
    v_pontos_por_real := COALESCE(v_config.pontos_por_real_venda, 0);
  END IF;

  -- Calcular pontos (arredondado para baixo, mínimo 1 se valor > 0)
  v_pontos := FLOOR(p_valor * v_pontos_por_real);
  IF v_pontos <= 0 THEN RETURN; END IF;

  -- Calcular expiração se configurada
  IF v_config.validade_pontos_dias IS NOT NULL THEN
    v_expires_at := NOW() + (v_config.validade_pontos_dias || ' days')::INTERVAL;
  ELSE
    v_expires_at := NULL;
  END IF;

  -- Evitar duplicidade: se já existe registro para esta referência + tipo, não insere
  IF EXISTS (
    SELECT 1 FROM fidelidade_pontos
    WHERE referencia_id = p_referencia_id
      AND tipo = p_tipo
      AND user_id = p_user_id
  ) THEN RETURN; END IF;

  -- Inserir pontos
  INSERT INTO fidelidade_pontos (
    user_id, cliente_id, pontos, tipo,
    referencia_id, descricao, expires_at
  ) VALUES (
    p_user_id,
    p_cliente_id,
    v_pontos,
    p_tipo,
    p_referencia_id,
    CASE p_tipo
      WHEN 'venda' THEN 'Pontos por compra (automático)'
      WHEN 'os'    THEN 'Pontos por serviço concluído (automático)'
    END,
    v_expires_at
  );
END;
$$;

-- ─── Trigger: vendas ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_pontos_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Só pontua se tiver cliente e não for cancelada e não for registro auxiliar
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.cancelada = true THEN RETURN NEW; END IF;
  IF NEW.observacoes = 'pagamento_duplo_secundario' THEN RETURN NEW; END IF;

  -- Valor líquido para cálculo de pontos
  PERFORM registrar_pontos_fidelidade(
    NEW.user_id,
    NEW.cliente_id,
    NEW.id,
    'venda',
    GREATEST(0,
      COALESCE(NEW.total, 0)
      - COALESCE(NEW.valor_desconto_manual, 0)
      - COALESCE(NEW.valor_desconto_cupom, 0)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_pontos_fidelidade_venda ON vendas;
CREATE TRIGGER auto_pontos_fidelidade_venda
  AFTER INSERT ON vendas
  FOR EACH ROW EXECUTE FUNCTION trigger_pontos_venda();

-- ─── Trigger: ordens_servico ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_pontos_os()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Só age em UPDATE onde status mudou para finalizado/entregue
  IF TG_OP = 'UPDATE' THEN
    -- Ignorar se status não mudou
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;
    -- Ignorar se não chegou a um status final
    IF NEW.status NOT IN ('finalizado', 'entregue', 'concluido', 'pago') THEN RETURN NEW; END IF;
    -- Ignorar se já estava em status final (evita dupla contagem em re-saves)
    IF OLD.status IN ('finalizado', 'entregue', 'concluido', 'pago') THEN RETURN NEW; END IF;
    -- Precisa de cliente e valor
    IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
    IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;

    PERFORM registrar_pontos_fidelidade(
      NEW.user_id,
      NEW.cliente_id,
      NEW.id,
      'os',
      COALESCE(NEW.total, 0)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_pontos_fidelidade_os ON ordens_servico;
CREATE TRIGGER auto_pontos_fidelidade_os
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION trigger_pontos_os();
