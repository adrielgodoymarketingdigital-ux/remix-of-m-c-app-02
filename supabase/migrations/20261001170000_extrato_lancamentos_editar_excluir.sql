-- =====================================================================
-- Extrato: lançamento manual/balanço aparece sempre na lista (com selo de
-- "fora do caixa" quando não conta no saldo), e passa a poder ser editado
-- (valor, data, se conta ou não no saldo) e excluído.
--
-- 1) fn_extrato_eventos_raw deixa de FILTRAR lm.conta_no_saldo = true no
--    bloco 8 — antes isso tirava a linha de TUDO, inclusive da lista do
--    Extrato, o que não era o pedido (pedido era só tirar do saldo/cards).
--    Em vez disso, a função passa a devolver uma coluna nova
--    conta_no_saldo (true pra todas as origens antigas 1-7, e
--    lm.conta_no_saldo pro bloco 8), pra quem consome decidir o que fazer.
--    Muda a assinatura de retorno → precisa DROP FUNCTION antes do CREATE.
--
-- 2) fn_extrato_lista devolve essa coluna nova também (mesma razão —
--    assinatura muda, precisa DROP). A tela usa pra mostrar o selo "Fora
--    do caixa" na linha, sem escondê-la.
--
-- 3) fn_extrato_resumo (saldo dos cards) passa a somar só
--    WHERE conta_no_saldo — aqui a assinatura não muda (ainda devolve só
--    os 3 números), então é só CREATE OR REPLACE.
--
-- 4) UPDATE/DELETE em extrato_lancamentos_manuais já tinham RLS pronta
--    desde a migration anterior (dono+funcionário editam, só dono
--    exclui) — nenhuma policy nova aqui.
-- =====================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.fn_extrato_lista(uuid, uuid, boolean, date, date, integer, integer, text[]);
DROP FUNCTION IF EXISTS public.fn_extrato_eventos_raw(uuid, uuid, boolean, date, date);

CREATE FUNCTION public.fn_extrato_eventos_raw(p_user_id uuid, p_empresa_id uuid, p_is_filial boolean, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
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

  )
  SELECT eventos.data, eventos.tipo, eventos.origem, eventos.valor, eventos.descricao, eventos.referencia_id, eventos.conta_no_saldo
  FROM eventos
  WHERE eventos.valor > 0
    AND eventos.data IS NOT NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_extrato_eventos_raw(uuid, uuid, boolean, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- fn_extrato_resumo: saldo dos cards. MUDOU: cada SUM ganhou
-- FILTER (WHERE conta_no_saldo ...) — uma linha de balanço marcada como
-- "não contar" continua aparecendo em fn_extrato_eventos_raw/lista, mas
-- não entra aqui. Assinatura de entrada/saída não muda.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_extrato_resumo(
  p_user_id uuid,
  p_empresa_id uuid,
  p_is_filial boolean,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE (
  saldo_atual numeric,
  entradas_periodo numeric,
  saidas_periodo numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END) FILTER (WHERE conta_no_saldo), 0) AS saldo_atual,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND conta_no_saldo AND data BETWEEN p_data_inicio AND p_data_fim), 0) AS entradas_periodo,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND conta_no_saldo AND data BETWEEN p_data_inicio AND p_data_fim), 0) AS saidas_periodo
  FROM public.fn_extrato_eventos_raw(p_user_id, p_empresa_id, p_is_filial, NULL, NULL);
$$;

GRANT EXECUTE ON FUNCTION public.fn_extrato_resumo(uuid, uuid, boolean, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- fn_extrato_lista: ganha a coluna conta_no_saldo (mesma razão do raw) pra
-- tela mostrar o selo "Fora do caixa" sem esconder a linha.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.fn_extrato_lista(
  p_user_id uuid, p_empresa_id uuid, p_is_filial boolean,
  p_data_inicio date, p_data_fim date,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_origens text[] DEFAULT NULL
)
 RETURNS TABLE(data date, tipo text, origem text, valor numeric, descricao text, referencia_id uuid, conta_no_saldo boolean)
 LANGUAGE sql STABLE
AS $function$
  SELECT *
  FROM public.fn_extrato_eventos_raw(p_user_id, p_empresa_id, p_is_filial, p_data_inicio, p_data_fim) e
  WHERE p_origens IS NULL OR e.origem = ANY(p_origens)
  ORDER BY e.data DESC, e.tipo, e.origem, e.referencia_id
  LIMIT p_limit OFFSET p_offset;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_extrato_lista(uuid, uuid, boolean, date, date, integer, integer, text[])
  TO anon, authenticated, service_role;

COMMIT;
