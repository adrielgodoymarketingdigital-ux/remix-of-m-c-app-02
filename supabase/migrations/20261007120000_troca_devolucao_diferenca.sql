-- =====================================================================
-- Troca de aparelho no PDV — FASE 2A: devolução da diferença ao cliente
-- quando o aparelho recebido vale mais que a venda.
--
-- 100% ADITIVA — sem DROP de tabela/coluna/dado. Reexecutável.
-- Depende da migration 20261006120000_troca_registrada_na_venda.sql (Fase 1).
--
-- 1) vendas_trocas.caixa_id: caixa aberto em que a devolução foi feita
--    (o fechamento usa na Fase 2B). ON DELETE SET NULL.
-- 2) CHECKs em vendas_trocas (a tabela tinha 0 linhas em 07/10/2026):
--    - devolução coerente: valor 0 e forma NULL, ou valor > 0 e forma preenchida;
--    - valor_devolvido < valor_entrada.
-- 3) Índice parcial por caixa_id das devoluções.
-- 4) fn_extrato_eventos_raw: CREATE OR REPLACE a partir da definição VIVA do
--    banco (Fase 1, pg_get_functiondef em 07/10/2026, md5
--    33285ff50d1700e8b074867a686dccfc, já com COALESCE(v.valor_troca, 0)).
--    Única mudança: a seção 9 (saída "Devolução de troca (Dinheiro/Pix)")
--    acrescentada no fim dos eventos. As seções 1–8 ficam byte a byte iguais.
--    Grants refeitos (anon sem EXECUTE nas 3 funções do Extrato).
--    Verificação: scripts/verificacao-troca/verificar-migration-fase2.sql
-- =====================================================================

BEGIN;

-- ---------- 1. caixa da devolução -------------------------------------
ALTER TABLE public.vendas_trocas
  ADD COLUMN IF NOT EXISTS caixa_id uuid REFERENCES public.caixas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendas_trocas.caixa_id IS
  'Caixa aberto em que a venda (e a devolução da diferença, se houver) foi registrada.';

-- ---------- 2. coerência da devolução -----------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.vendas_trocas'::regclass AND conname = 'vendas_trocas_devolucao_coerente') THEN
    ALTER TABLE public.vendas_trocas ADD CONSTRAINT vendas_trocas_devolucao_coerente
      CHECK ((valor_devolvido = 0 AND forma_devolucao IS NULL)
          OR (valor_devolvido > 0 AND forma_devolucao IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.vendas_trocas'::regclass AND conname = 'vendas_trocas_devolucao_menor_que_entrada') THEN
    ALTER TABLE public.vendas_trocas ADD CONSTRAINT vendas_trocas_devolucao_menor_que_entrada
      CHECK (valor_devolvido < valor_entrada);
  END IF;
END $$;

-- ---------- 3. índice das devoluções por caixa ---------------------------
CREATE INDEX IF NOT EXISTS idx_vendas_trocas_caixa_devolucao
  ON public.vendas_trocas (caixa_id) WHERE valor_devolvido > 0;

-- ---------- 4. Extrato: seção 9 (devolução da troca) --------------------
CREATE OR REPLACE FUNCTION public.fn_extrato_eventos_raw(p_user_id uuid, p_empresa_id uuid, p_is_filial boolean, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
 RETURNS TABLE(data date, tipo text, origem text, valor numeric, descricao text, referencia_id uuid, conta_no_saldo boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (auth.uid() = p_user_id OR public.is_funcionario_of(p_user_id)) THEN
    RAISE EXCEPTION 'Acesso negado ao extrato financeiro deste usuário';
  END IF;

  RETURN QUERY
  WITH eventos AS (

    -- 1) VENDAS DO PDV (entrada) — inalterado, sempre conta no saldo.
    SELECT
      (v.data AT TIME ZONE 'America/Sao_Paulo')::date AS data,
      'entrada'::text AS tipo,
      'venda_pdv'::text AS origem,
      GREATEST(
        COALESCE(v.total, 0)
          - COALESCE(v.valor_desconto_manual, 0)
          - COALESCE(v.valor_desconto_cupom, 0)
          - COALESCE(v.valor_troca, 0) -- aparelho recebido na troca: pagamento em espécie, não entra no caixa
          - (CASE WHEN v.segunda_forma_pagamento = 'a_receber' AND COALESCE(v.valor_segunda_forma, 0) > 0
                  THEN v.valor_segunda_forma ELSE 0 END),
        0
      ) AS valor,
      COALESCE(NULLIF(v.observacoes, ''), 'Venda') AS descricao,
      v.id AS referencia_id,
      true AS conta_no_saldo
    FROM public.vendas v
    WHERE v.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN v.empresa_id = p_empresa_id
                 ELSE (v.empresa_id = p_empresa_id OR v.empresa_id IS NULL) END
          ))
      AND v.deleted_at IS NULL
      AND COALESCE(v.cancelada, false) = false
      AND (p_data_inicio IS NULL OR (v.data AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio)
      AND (p_data_fim IS NULL OR (v.data AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim)
      AND (
        (v.forma_pagamento::text IN ('a_receber', 'a_prazo') AND v.recebido = true)
        OR (v.forma_pagamento::text NOT IN ('a_receber', 'a_prazo') AND COALESCE(v.parcela_numero, 1) <= 1)
      )
      AND (v.observacoes IS NULL OR v.observacoes <> 'pagamento_duplo_secundario')
      AND (v.observacoes IS NULL OR v.observacoes NOT LIKE '%utilizado na OS%')
      AND v.peca_id IS NULL

    UNION ALL

    -- 2) VENDAS AVULSAS (entrada) — inalterado, sempre conta no saldo.
    SELECT
      (va.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      'entrada',
      'venda_avulsa',
      COALESCE(va.valor, 0),
      COALESCE(NULLIF(va.descricao, ''), 'Venda avulsa'),
      va.id,
      true
    FROM public.vendas_avulsas va
    WHERE va.user_id = p_user_id
      AND va.deleted_at IS NULL
      AND (p_data_inicio IS NULL OR (va.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio)
      AND (p_data_fim IS NULL OR (va.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim)

    UNION ALL

    -- 3) SERVIÇOS AVULSOS (entrada) — inalterado, sempre conta no saldo.
    SELECT
      (sa.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      'entrada',
      'servico_avulso',
      COALESCE(sa.preco, 0),
      'Serviço avulso: ' || sa.nome,
      sa.id,
      true
    FROM public.servicos_avulsos sa
    WHERE sa.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN sa.empresa_id = p_empresa_id
                 ELSE (sa.empresa_id = p_empresa_id OR sa.empresa_id IS NULL) END
          ))
      AND sa.status IN ('finalizado', 'entregue', 'garantia')
      AND (p_data_inicio IS NULL OR (sa.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio)
      AND (p_data_fim IS NULL OR (sa.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim)

    UNION ALL

    -- 4) ORDENS DE SERVIÇO ENTREGUES (entrada) — inalterado, sempre conta no saldo.
    SELECT
      os.data_caixa AS data,
      'entrada',
      'ordem_servico',
      CASE
        WHEN COALESCE(os.avarias -> 'dados_pagamento' ->> 'forma', os.forma_pagamento::text, '') IN ('a_prazo', 'a_receber')
             AND COALESCE((os.avarias -> 'dados_pagamento' ->> 'entrada')::numeric, 0) <= 0
          THEN CASE WHEN c.status IS NULL OR c.status::text = 'pendente' THEN 0 ELSE os.total END
        WHEN os.avarias -> 'dados_pagamento' IS NULL
             OR COALESCE((os.avarias -> 'dados_pagamento' ->> 'entrada')::numeric, 0) <= 0
          THEN os.total
        WHEN (os.avarias -> 'dados_pagamento' ->> 'saldo_cancelado')::boolean IS TRUE
          THEN (os.avarias -> 'dados_pagamento' ->> 'entrada')::numeric
        WHEN c.status::text = 'pendente'
          THEN (os.avarias -> 'dados_pagamento' ->> 'entrada')::numeric
        ELSE os.total
      END AS valor,
      'OS ' || os.numero_os,
      os.id,
      true
    FROM public.ordens_servico os
    LEFT JOIN public.contas c
      ON c.os_numero = os.numero_os AND c.user_id = os.user_id AND c.tipo = 'receber'
    WHERE os.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN os.empresa_id = p_empresa_id
                 ELSE (os.empresa_id = p_empresa_id OR os.empresa_id IS NULL) END
          ))
      AND os.deleted_at IS NULL
      AND os.status IN ('entregue', 'finalizado', 'garantia')
      AND os.data_caixa IS NOT NULL
      AND (p_data_inicio IS NULL OR os.data_caixa >= p_data_inicio)
      AND (p_data_fim IS NULL OR os.data_caixa <= p_data_fim)

    UNION ALL

    -- 5) CONTAS A RECEBER QUITADAS (entrada) — inalterado, sempre conta no saldo.
    SELECT
      c.data_pagamento AS data,
      'entrada',
      'conta_receber',
      COALESCE(NULLIF(c.valor_pago, 0), c.valor, 0),
      COALESCE(NULLIF(c.nome, ''), NULLIF(c.descricao, ''), 'Conta a receber'),
      c.id,
      true
    FROM public.contas c
    WHERE c.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN c.empresa_id = p_empresa_id
                 ELSE (c.empresa_id = p_empresa_id OR c.empresa_id IS NULL) END
          ))
      AND c.tipo = 'receber'
      AND c.status::text = 'recebido'
      AND c.data_pagamento IS NOT NULL
      AND c.os_numero IS NULL
      AND (c.descricao IS NULL OR c.descricao NOT LIKE 'venda_id:%')
      AND (p_data_inicio IS NULL OR c.data_pagamento >= p_data_inicio)
      AND (p_data_fim IS NULL OR c.data_pagamento <= p_data_fim)

    UNION ALL

    -- 6) CONTAS A PAGAR QUITADAS (saída) — inalterado, sempre conta no saldo.
    SELECT
      c.data_pagamento AS data,
      'saida',
      'conta_pagar',
      COALESCE(NULLIF(c.valor_pago, 0), c.valor, 0),
      COALESCE(NULLIF(c.nome, ''), NULLIF(c.descricao, ''), 'Conta a pagar'),
      c.id,
      true
    FROM public.contas c
    LEFT JOIN public.ordens_servico os_check
      ON os_check.numero_os = c.os_numero AND os_check.user_id = c.user_id
    WHERE c.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN c.empresa_id = p_empresa_id
                 ELSE (c.empresa_id = p_empresa_id OR c.empresa_id IS NULL) END
          ))
      AND c.tipo = 'pagar'
      AND c.status::text = 'pago'
      AND c.data_pagamento IS NOT NULL
      AND (c.os_numero IS NULL OR os_check.deleted_at IS NULL)
      AND (p_data_inicio IS NULL OR c.data_pagamento >= p_data_inicio)
      AND (p_data_fim IS NULL OR c.data_pagamento <= p_data_fim)

    UNION ALL

    -- 7) SANGRIA / SUPRIMENTO DO PDV — inalterado, sempre conta no saldo.
    SELECT
      (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      CASE WHEN m.tipo = 'sangria' THEN 'saida' ELSE 'entrada' END,
      CASE WHEN m.tipo = 'sangria' THEN 'pdv_sangria' ELSE 'pdv_suprimento' END,
      COALESCE(m.valor, 0),
      (CASE WHEN m.tipo = 'sangria' THEN 'Sangria' ELSE 'Suprimento' END)
        || COALESCE(': ' || NULLIF(btrim(m.motivo), ''), ''),
      m.id,
      true
    FROM public.caixa_movimentacoes m
    JOIN public.caixas cx ON cx.id = m.caixa_id
    WHERE (cx.proprietario_id = p_user_id OR (cx.proprietario_id IS NULL AND cx.user_id = p_user_id))
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN cx.empresa_id = p_empresa_id
                 ELSE (cx.empresa_id = p_empresa_id OR cx.empresa_id IS NULL) END
          ))
      AND m.tipo IN ('sangria', 'suprimento')
      AND (p_data_inicio IS NULL OR (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio)
      AND (p_data_fim IS NULL OR (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim)

    UNION ALL

    -- 8) LANÇAMENTOS MANUAIS E BALANÇO DO CAIXA — MUDOU: não filtra mais
    -- por conta_no_saldo. A linha sempre aparece aqui (e portanto na lista
    -- do Extrato); quem decide o que fazer com conta_no_saldo = false é
    -- fn_extrato_resumo, que não soma essas linhas no saldo/cards.
    SELECT
      lm.data,
      lm.tipo,
      CASE WHEN lm.categoria = 'balanco' THEN 'balanco_caixa' ELSE 'lancamento_manual' END,
      lm.valor,
      CASE WHEN lm.categoria = 'balanco'
           THEN 'Balanço do caixa' || COALESCE(': ' || NULLIF(btrim(lm.motivo), ''), '')
           ELSE COALESCE(NULLIF(btrim(lm.motivo), ''), 'Lançamento manual') END,
      lm.id,
      lm.conta_no_saldo
    FROM public.extrato_lancamentos_manuais lm
    WHERE lm.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN lm.empresa_id = p_empresa_id
                 ELSE (lm.empresa_id = p_empresa_id OR lm.empresa_id IS NULL) END
          ))
      AND (p_data_inicio IS NULL OR lm.data >= p_data_inicio)
      AND (p_data_fim IS NULL OR lm.data <= p_data_fim)

    UNION ALL

    -- 9) DEVOLUÇÃO DA DIFERENÇA DA TROCA (saída) — Fase 2: o aparelho recebido
    -- valeu mais que a venda e a loja devolveu a diferença (dinheiro ou Pix).
    -- Data = data da venda (acompanha "alterar data"); some com a troca cancelada
    -- ou quando não sobra nenhuma linha ativa da venda.
    SELECT
      (gv.data AT TIME ZONE 'America/Sao_Paulo')::date,
      'saida',
      'devolucao_troca',
      vt.valor_devolvido,
      'Devolução de troca (' || CASE vt.forma_devolucao WHEN 'pix' THEN 'Pix' ELSE 'Dinheiro' END || ')',
      vt.id,
      true
    FROM public.vendas_trocas vt
    JOIN LATERAL (
      SELECT min(v.data) AS data
      FROM public.vendas v
      WHERE v.grupo_venda = vt.grupo_venda
        AND v.user_id = vt.user_id
        AND v.deleted_at IS NULL
        AND COALESCE(v.cancelada, false) = false
    ) gv ON gv.data IS NOT NULL
    WHERE vt.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN vt.empresa_id = p_empresa_id
                 ELSE (vt.empresa_id = p_empresa_id OR vt.empresa_id IS NULL) END
          ))
      AND vt.cancelada = false
      AND vt.valor_devolvido > 0
      AND (p_data_inicio IS NULL OR (gv.data AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio)
      AND (p_data_fim IS NULL OR (gv.data AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim)

  )
  SELECT eventos.data, eventos.tipo, eventos.origem, eventos.valor, eventos.descricao, eventos.referencia_id, eventos.conta_no_saldo
  FROM eventos
  WHERE eventos.valor > 0
    AND eventos.data IS NOT NULL;
END;
$function$;

-- CREATE OR REPLACE mantém o ACL; refeito para não depender do estado anterior.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_extrato_eventos_raw', 'fn_extrato_lista', 'fn_extrato_resumo')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.fn);
  END LOOP;
END $$;

COMMIT;

-- PostgREST passa a enxergar vendas_trocas.caixa_id sem esperar o recarregamento automático.
NOTIFY pgrst, 'reload schema';
