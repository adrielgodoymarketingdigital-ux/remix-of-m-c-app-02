-- =====================================================================
-- Extrato: lançamento manual de entrada/saída + "Balanço do caixa".
--
-- 1) Tabela nova extrato_lancamentos_manuais. Cada linha é uma entrada ou
--    saída digitada no Extrato (categoria 'manual') ou o ajuste gerado pelo
--    Balanço do caixa (categoria 'balanco': diferença entre o saldo real
--    informado e o saldo calculado). Independe de caixa aberto no PDV.
--    user_id = dono da loja (funcionário grava com o id do dono);
--    criado_por = quem estava logado.
--
-- 2) RLS: dono + funcionário (is_funcionario_of), como em contas e
--    vendas_avulsas. Excluir é só do dono, como em contas.
--
-- 3) fn_extrato_eventos_raw ganha o bloco 8 lendo essa tabela. Os blocos
--    1 a 7 estão IDÊNTICOS à versão em produção
--    (20261001120000_extrato_sangria_suprimento_pdv.sql). Assinatura e
--    colunas de retorno não mudam; fn_extrato_lista/fn_extrato_resumo
--    não mudam. Nenhum dado existente é alterado (a tabela nasce vazia).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.extrato_lancamentos_manuais (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id  uuid REFERENCES public.empresas(id),
  tipo        text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  valor       numeric(12,2) NOT NULL CHECK (valor > 0),
  motivo      text,
  data        date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  categoria   text NOT NULL DEFAULT 'manual' CHECK (categoria IN ('manual', 'balanco')),
  criado_por  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.extrato_lancamentos_manuais IS
  'Entradas/saídas lançadas à mão no Extrato (categoria manual) e ajustes do Balanço do caixa (categoria balanco). Lida pelo bloco 8 de fn_extrato_eventos_raw.';

CREATE INDEX IF NOT EXISTS idx_extrato_lancamentos_manuais_user_data
  ON public.extrato_lancamentos_manuais (user_id, data);

ALTER TABLE public.extrato_lancamentos_manuais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dono e funcionarios veem lancamentos manuais" ON public.extrato_lancamentos_manuais;
CREATE POLICY "dono e funcionarios veem lancamentos manuais"
  ON public.extrato_lancamentos_manuais FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "dono e funcionarios inserem lancamentos manuais" ON public.extrato_lancamentos_manuais;
CREATE POLICY "dono e funcionarios inserem lancamentos manuais"
  ON public.extrato_lancamentos_manuais FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "dono e funcionarios atualizam lancamentos manuais" ON public.extrato_lancamentos_manuais;
CREATE POLICY "dono e funcionarios atualizam lancamentos manuais"
  ON public.extrato_lancamentos_manuais FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_funcionario_of(user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "dono exclui lancamentos manuais" ON public.extrato_lancamentos_manuais;
CREATE POLICY "dono exclui lancamentos manuais"
  ON public.extrato_lancamentos_manuais FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

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

    UNION ALL

    -- 7) SANGRIA / SUPRIMENTO DO PDV — NOVO. Sangria = saída, suprimento =
    -- entrada, com o motivo digitado no PDV na descrição. O dono da loja vem
    -- do caixa (proprietario_id; caixas antigos só têm user_id), não de
    -- caixa_movimentacoes.user_id, que é quem estava logado (pode ser funcionário).
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

    -- 8) LANÇAMENTOS MANUAIS E BALANÇO DO CAIXA — NOVO. Entrada/saída
    -- digitada direto no Extrato ('lancamento_manual') ou gerada pelo
    -- "Balanço do caixa" ('balanco_caixa') para o saldo bater com o real.
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
