-- =====================================================================
-- Extrato: opção "não contar no saldo" para o Balanço do caixa.
--
-- 1) Coluna nova extrato_lancamentos_manuais.conta_no_saldo (default true,
--    não quebra as linhas já gravadas nem o lançamento manual simples, que
--    continua sempre contando). Quando false (só o diálogo "Balanço do
--    caixa" oferece essa opção), o ajuste é gravado — fica na tabela — mas
--    fn_extrato_eventos_raw passa a ignorá-lo: não entra no saldo, nos
--    cards de entradas/saídas, na lista do Extrato, nem em nenhum outro
--    relatório que use essa função ou fn_extrato_resumo/fn_extrato_lista.
--
-- 2) fn_extrato_eventos_raw: só o bloco 8 muda (filtro extra no WHERE).
--    Blocos 1 a 7 IDÊNTICOS à versão em produção
--    (20261001150000_extrato_lancamentos_manuais.sql). Assinatura e
--    colunas de retorno não mudam; fn_extrato_lista/fn_extrato_resumo
--    não mudam.
-- =====================================================================

BEGIN;

ALTER TABLE public.extrato_lancamentos_manuais
  ADD COLUMN IF NOT EXISTS conta_no_saldo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.extrato_lancamentos_manuais.conta_no_saldo IS
  'Se false, o lançamento fica gravado mas fn_extrato_eventos_raw o ignora: não aparece no saldo, nos cards nem na lista do Extrato. Hoje só o Balanço do caixa oferece essa opção ao usuário.';

CREATE OR REPLACE FUNCTION public.fn_extrato_eventos_raw(p_user_id uuid, p_empresa_id uuid, p_is_filial boolean, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
 RETURNS TABLE(data date, tipo text, origem text, valor numeric, descricao text, referencia_id uuid)
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

    -- 1) VENDAS DO PDV (entrada) — inalterado.
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
      v.id AS referencia_id
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

    -- 2) VENDAS AVULSAS (entrada) — inalterado.
    SELECT
      (va.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      'entrada',
      'venda_avulsa',
      COALESCE(va.valor, 0),
      COALESCE(NULLIF(va.descricao, ''), 'Venda avulsa'),
      va.id
    FROM public.vendas_avulsas va
    WHERE va.user_id = p_user_id
      AND va.deleted_at IS NULL
      AND (p_data_inicio IS NULL OR (va.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio)
      AND (p_data_fim IS NULL OR (va.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim)

    UNION ALL

    -- 3) SERVIÇOS AVULSOS (entrada) — inalterado.
    SELECT
      (sa.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      'entrada',
      'servico_avulso',
      COALESCE(sa.preco, 0),
      'Serviço avulso: ' || sa.nome,
      sa.id
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

    -- 4) ORDENS DE SERVIÇO ENTREGUES (entrada) — inalterado.
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
      os.id
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

    -- 5) CONTAS A RECEBER QUITADAS (entrada) — inalterado.
    SELECT
      c.data_pagamento AS data,
      'entrada',
      'conta_receber',
      COALESCE(NULLIF(c.valor_pago, 0), c.valor, 0),
      COALESCE(NULLIF(c.nome, ''), NULLIF(c.descricao, ''), 'Conta a receber'),
      c.id
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

    -- 6) CONTAS A PAGAR QUITADAS (saída) — inalterado.
    SELECT
      c.data_pagamento AS data,
      'saida',
      'conta_pagar',
      COALESCE(NULLIF(c.valor_pago, 0), c.valor, 0),
      COALESCE(NULLIF(c.nome, ''), NULLIF(c.descricao, ''), 'Conta a pagar'),
      c.id
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

    -- 7) SANGRIA / SUPRIMENTO DO PDV — inalterado.
    SELECT
      (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
      CASE WHEN m.tipo = 'sangria' THEN 'saida' ELSE 'entrada' END,
      CASE WHEN m.tipo = 'sangria' THEN 'pdv_sangria' ELSE 'pdv_suprimento' END,
      COALESCE(m.valor, 0),
      (CASE WHEN m.tipo = 'sangria' THEN 'Sangria' ELSE 'Suprimento' END)
        || COALESCE(': ' || NULLIF(btrim(m.motivo), ''), ''),
      m.id
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

    -- 8) LANÇAMENTOS MANUAIS E BALANÇO DO CAIXA — MUDOU: só entra aqui (e
    -- portanto no saldo, nos cards, na lista do Extrato e em qualquer
    -- relatório baseado nesta função) quem tem conta_no_saldo = true. Um
    -- balanço marcado como "não contar" fica gravado na tabela, mas é como
    -- se não existisse pra todo o resto do sistema.
    SELECT
      lm.data,
      lm.tipo,
      CASE WHEN lm.categoria = 'balanco' THEN 'balanco_caixa' ELSE 'lancamento_manual' END,
      lm.valor,
      CASE WHEN lm.categoria = 'balanco'
           THEN 'Balanço do caixa' || COALESCE(': ' || NULLIF(btrim(lm.motivo), ''), '')
           ELSE COALESCE(NULLIF(btrim(lm.motivo), ''), 'Lançamento manual') END,
      lm.id
    FROM public.extrato_lancamentos_manuais lm
    WHERE lm.user_id = p_user_id
      AND lm.conta_no_saldo = true
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN lm.empresa_id = p_empresa_id
                 ELSE (lm.empresa_id = p_empresa_id OR lm.empresa_id IS NULL) END
          ))
      AND (p_data_inicio IS NULL OR lm.data >= p_data_inicio)
      AND (p_data_fim IS NULL OR lm.data <= p_data_fim)

  )
  SELECT eventos.data, eventos.tipo, eventos.origem, eventos.valor, eventos.descricao, eventos.referencia_id
  FROM eventos
  WHERE eventos.valor > 0
    AND eventos.data IS NOT NULL;
END;
$function$;

COMMIT;
