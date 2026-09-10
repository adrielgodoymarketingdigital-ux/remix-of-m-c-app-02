-- Correção: fn_extrato_eventos_raw tratava contas.valor_pago = 0 como um
-- valor "confiável" (COALESCE só cai pro fallback quando é NULL). Na prática,
-- valor_pago é 0 (não NULL) em ~95-99% das contas quitadas do modelo antigo
-- (nunca foi populado antes da feature de pagamento parcial de hoje) — então
-- COALESCE(c.valor_pago, c.valor, 0) devolvia 0 pra essas linhas, e o filtro
-- final (WHERE valor > 0) as descartava silenciosamente do Extrato.
--
-- Medido em produção antes desta correção: 1254/1255 contas a pagar quitadas
-- (R$ 230.929,09) e 6863/7254 contas a receber quitadas (R$ 1.782.652,53)
-- tinham valor_pago = 0 e sumiriam do Extrato.
--
-- Confirmado que esse padrão de bug NÃO existe em nenhum lugar do TS já em
-- produção: useRelatorios.calcularReceitaManual (a função que o bloco 5
-- replica) soma `c.valor` direto, nunca usa valor_pago; useCaixa.ts e
-- servicosCaixa.ts também não usam valor_pago; todo outro uso de valor_pago
-- no TS (useContas.ts, TabelaContas.tsx, DialogConfirmarBaixa.tsx) é pra
-- calcular SALDO RESTANTE (valor - valor_pago), onde 0 como fallback é
-- correto por definição. Essa tentativa de "usar valor_pago como fonte de
-- verdade pro valor recebido" foi uma escolha só desta função SQL nova — o
-- bug é autocontido aqui, não replicado de lugar nenhum.
--
-- Fix: NULLIF(c.valor_pago, 0) trata 0 igual a NULL — só confia em
-- valor_pago quando ele tem um valor real diferente de zero (cenário do
-- pagamento parcial de verdade); senão cai pro valor de face da conta,
-- igual ao que o TS sempre fez.
CREATE OR REPLACE FUNCTION public.fn_extrato_eventos_raw(
  p_user_id uuid,
  p_empresa_id uuid,
  p_is_filial boolean,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS TABLE (
  data date,
  tipo text,
  origem text,
  valor numeric,
  descricao text,
  referencia_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (auth.uid() = p_user_id OR public.is_funcionario_of(p_user_id)) THEN
    RAISE EXCEPTION 'Acesso negado ao extrato financeiro deste usuário';
  END IF;

  RETURN QUERY
  WITH eventos AS (

    -- 1) VENDAS DO PDV (entrada) — inalterado, ver migration original
    -- (20260909150000_extrato_financeiro.sql) pra comentários completos.
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

    -- 5) CONTAS A RECEBER QUITADAS (entrada) — FIX: NULLIF(c.valor_pago, 0)
    -- em vez de c.valor_pago puro.
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

    -- 6) CONTAS A PAGAR QUITADAS (saída) — FIX: NULLIF(c.valor_pago, 0)
    -- em vez de c.valor_pago puro.
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

  )
  SELECT eventos.data, eventos.tipo, eventos.origem, eventos.valor, eventos.descricao, eventos.referencia_id
  FROM eventos
  WHERE eventos.valor > 0
    AND eventos.data IS NOT NULL;
END;
$$;

-- GRANT já existe da migration anterior (mesma assinatura) — CREATE OR
-- REPLACE preserva grants existentes, não precisa repetir.
