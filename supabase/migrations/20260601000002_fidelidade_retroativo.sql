-- ──────────────────────────────────────────────────────────────────────────────
-- Retroativo: creditar pontos de fidelidade para vendas e OS já existentes
-- Só insere onde ainda não há registro (proteção por referencia_id + tipo)
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_config     RECORD;
  v_venda      RECORD;
  v_os         RECORD;
  v_pontos     INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN

  -- ─── Processar cada usuário que tem config de fidelidade ativa ───────────
  FOR v_config IN
    SELECT * FROM fidelidade_config WHERE ativo = true
  LOOP

    -- ── Vendas ──────────────────────────────────────────────────────────────
    FOR v_venda IN
      SELECT
        v.id,
        v.user_id,
        v.cliente_id,
        GREATEST(0,
          COALESCE(v.total, 0)
          - COALESCE(v.valor_desconto_manual, 0)
          - COALESCE(v.valor_desconto_cupom, 0)
        ) AS valor_liquido
      FROM vendas v
      WHERE v.user_id       = v_config.user_id
        AND v.cliente_id    IS NOT NULL
        AND v.cancelada     = false
        AND (v.observacoes IS NULL OR v.observacoes != 'pagamento_duplo_secundario')
        AND COALESCE(v.total, 0) > 0
        -- Não inserir se já existe registro para esta venda
        AND NOT EXISTS (
          SELECT 1 FROM fidelidade_pontos fp
          WHERE fp.referencia_id = v.id
            AND fp.tipo = 'venda'
            AND fp.user_id = v_config.user_id
        )
    LOOP
      v_pontos := FLOOR(v_venda.valor_liquido * COALESCE(v_config.pontos_por_real_venda, 0));
      IF v_pontos <= 0 THEN CONTINUE; END IF;

      IF v_config.validade_pontos_dias IS NOT NULL THEN
        v_expires_at := NOW() + (v_config.validade_pontos_dias || ' days')::INTERVAL;
      ELSE
        v_expires_at := NULL;
      END IF;

      INSERT INTO fidelidade_pontos (
        user_id, cliente_id, pontos, tipo,
        referencia_id, descricao, expires_at
      ) VALUES (
        v_config.user_id,
        v_venda.cliente_id,
        v_pontos,
        'venda',
        v_venda.id,
        'Pontos por compra (retroativo)',
        v_expires_at
      );
    END LOOP;

    -- ── OS Finalizadas ───────────────────────────────────────────────────────
    FOR v_os IN
      SELECT
        o.id,
        o.user_id,
        o.cliente_id,
        COALESCE(o.total, 0) AS valor
      FROM ordens_servico o
      WHERE o.user_id    = v_config.user_id
        AND o.cliente_id IS NOT NULL
        AND o.status     IN ('finalizado', 'entregue', 'concluido', 'pago')
        AND o.deleted_at IS NULL
        AND COALESCE(o.total, 0) > 0
        -- Não inserir se já existe registro para esta OS
        AND NOT EXISTS (
          SELECT 1 FROM fidelidade_pontos fp
          WHERE fp.referencia_id = o.id
            AND fp.tipo = 'os'
            AND fp.user_id = v_config.user_id
        )
    LOOP
      v_pontos := FLOOR(v_os.valor * COALESCE(v_config.pontos_por_real_os, 0));
      IF v_pontos <= 0 THEN CONTINUE; END IF;

      IF v_config.validade_pontos_dias IS NOT NULL THEN
        v_expires_at := NOW() + (v_config.validade_pontos_dias || ' days')::INTERVAL;
      ELSE
        v_expires_at := NULL;
      END IF;

      INSERT INTO fidelidade_pontos (
        user_id, cliente_id, pontos, tipo,
        referencia_id, descricao, expires_at
      ) VALUES (
        v_config.user_id,
        v_os.cliente_id,
        v_pontos,
        'os',
        v_os.id,
        'Pontos por serviço concluído (retroativo)',
        v_expires_at
      );
    END LOOP;

  END LOOP; -- fim loop configs

END;
$$;
