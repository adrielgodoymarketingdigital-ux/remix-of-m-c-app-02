-- Extrato / Fluxo de Caixa — agregação SQL de todas as fontes de entrada e
-- saída de dinheiro, para a tela Financeiro → Extrato.
--
-- ATENÇÃO — DUPLICAÇÃO DELIBERADA DE REGRAS DE NEGÓCIO
-- As regras de inclusão/exclusão abaixo (o que conta como "dinheiro que já
-- entrou/saiu de fato") hoje só existem em TypeScript, em:
--   - src/lib/vendasFinanceiras.ts (getValorFaturavelOS, getVendaReceitaLiquida,
--     shouldIncludeVendaInFinancialTotals)
--   - src/hooks/useRelatorios.ts (isContaReceitaManual)
-- Esta função replica essas regras em SQL pra poder agregar (SUM) no banco em
-- vez de trazer todas as linhas pro cliente. Cada bloco abaixo cita o
-- arquivo:linha exato que replica — se uma dessas regras mudar no TS, este
-- arquivo PRECISA ser atualizado junto, senão o Extrato diverge do
-- Relatório/Fechamento de Caixa. Os mesmos arquivos TS têm um comentário
-- simétrico apontando pra cá. Ver também o script de verificação em
-- scripts/verificar-extrato-financeiro/ (compara esta função com as funções
-- TS reais sobre uma amostra de dados reais — rodar depois de qualquer
-- mudança nessas regras).
--
-- CORRIGIDO EM 20260909160000_fix_extrato_valor_pago_zero.sql: a versão
-- original dos blocos 5 e 6 (contas a receber/pagar) usava
-- COALESCE(c.valor_pago, c.valor, 0), que só cai pro fallback `valor` quando
-- valor_pago é NULL. Só que valor_pago é 0 (não NULL) em ~95-99% das contas
-- quitadas do modelo antigo (nunca foi populado antes da feature de
-- pagamento parcial) — então essas linhas somavam R$ 0,00 e desapareciam do
-- Extrato (filtro final `valor > 0`). Achado pelo script de verificação
-- rodado contra dados reais de produção (~R$ 2 milhões em contas quitadas
-- some silenciosamente). Ver a migration de correção pro texto completo do
-- fix (NULLIF(c.valor_pago, 0) em vez de c.valor_pago puro).

-- ---------------------------------------------------------------------------
-- ÍNDICES — nenhuma dessas 4 tabelas tinha índice em user_id (confirmado via
-- pg_indexes antes de escrever esta migration). Sem eles, cada bloco do UNION
-- ALL abaixo faz Seq Scan na tabela inteira. Testado com EXPLAIN ANALYZE numa
-- conta real com ~1800 vendas / ~12k linhas nas tabelas: 606ms sem índice →
-- 37ms com índice (mesmo resultado, mesma query). Como bônus, esses índices
-- também aceleram useVendas.ts/useContas.ts/useRelatorios.ts/
-- useOrdensServico.ts/useServicosAvulsos.ts, que já filtram por user_id hoje
-- sem indice nenhum.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vendas_user_ativo
  ON public.vendas (user_id) WHERE deleted_at IS NULL AND cancelada IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_ordens_servico_user_data_caixa
  ON public.ordens_servico (user_id, data_caixa) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contas_user_tipo_status_data_pagamento
  ON public.contas (user_id, tipo, status, data_pagamento);

CREATE INDEX IF NOT EXISTS idx_servicos_avulsos_user_status
  ON public.servicos_avulsos (user_id, status);

-- ANALYZE logo após criar os índices: garante que o planner já tem
-- estatísticas atualizadas no primeiro uso, em vez de depender do timing do
-- autovacuum (índice novo sem stats pode levar o planner a escolher Seq Scan
-- mesmo tendo o índice disponível).
ANALYZE public.vendas;
ANALYZE public.ordens_servico;
ANALYZE public.contas;
ANALYZE public.servicos_avulsos;

-- ---------------------------------------------------------------------------
-- fn_extrato_eventos_raw: cada movimento de dinheiro normalizado (1 linha por
-- evento). p_data_inicio/p_data_fim são OPCIONAIS (default NULL = sem
-- filtro = todo o histórico) e são aplicados DENTRO de cada bloco do UNION
-- ALL, não por fora — testado com EXPLAIN ANALYZE: filtrar por fora faz o
-- Postgres materializar o histórico inteiro antes de filtrar (a função é
-- plpgsql, não é "inlineável" como uma CTE); filtrando dentro de cada bloco,
-- o planner usa os índices de data (idx_ordens_servico_user_data_caixa,
-- idx_contas_user_tipo_status_data_pagamento) e cada bloco fica proporcional
-- ao tamanho do PERÍODO pedido, não ao histórico total — importante pra
-- fn_extrato_lista (só quer os últimos N dias) em lojas antigas com muito
-- histórico. fn_extrato_resumo chama isto com NULL/NULL (o saldo acumulado
-- precisa do histórico completo mesmo — isso é inevitável).
-- SECURITY DEFINER porque precisa ler várias tabelas com RLS diferentes sob
-- um user_id já resolvido no client (useIdentidade() — pode ser o próprio
-- usuário OU o dono da loja, se quem está pedindo é funcionário) — por isso
-- valida explicitamente no início.
-- ---------------------------------------------------------------------------
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
  -- Autorização: só o próprio dono da loja (p_user_id) ou um funcionário dele
  -- pode pedir o extrato de p_user_id. Mesma função is_funcionario_of() já
  -- usada em categorias_produtos/tipos_servico/catalogo_dispositivos_custom.
  -- auth.uid() IS NULL = chamada sem contexto de sessão (service_role, SQL
  -- Editor, script de verificação rodando como postgres) — mesmo tratamento
  -- que RLS já dá a service_role em todo o resto do projeto: não bloqueia.
  -- Só bloqueia quando HÁ uma sessão autenticada e ela não é dona nem
  -- funcionária de p_user_id.
  IF auth.uid() IS NOT NULL AND NOT (auth.uid() = p_user_id OR public.is_funcionario_of(p_user_id)) THEN
    RAISE EXCEPTION 'Acesso negado ao extrato financeiro deste usuário';
  END IF;

  RETURN QUERY
  WITH eventos AS (

    -- =======================================================================
    -- 1) VENDAS DO PDV (entrada)
    -- Réplica de shouldIncludeVendaInFinancialTotals (vendasFinanceiras.ts:87-98)
    -- + getVendaReceitaLiquida (vendasFinanceiras.ts:159-188, só a parte de
    -- receita — a parte de custo/lucro dessas funções não é usada aqui, o
    -- Extrato não calcula lucro).
    -- Exclui também:
    --   - a linha secundária de pagamento duplo (observacoes =
    --     'pagamento_duplo_secundario', gravada em PDV.tsx:636): seu valor já
    --     está embutido no total da linha principal (PDV.tsx:471,
    --     totalBrutoItem) — mesma exclusão aplicada pela maioria dos
    --     consumidores de "faturamento simples" hoje (useVendas.ts:158,397;
    --     useDashboardResumo.ts:19; DialogFechamentoCaixa.tsx:150). NOTA: isso
    --     significa que, se a 2ª forma for "a_receber" e for paga depois, o
    --     Extrato NÃO reconhece esse recebimento — mesma limitação conhecida
    --     documentada em scripts/investigacao-lucro-vendas/DIVIDA-TECNICA.md
    --     (só o cálculo de LUCRO, via deveContarSecundarioNoLucro, reconhece;
    --     "faturamento simples" não).
    --   - vendas geradas pelo consumo de peça/produto numa OS (já contadas no
    --     total da OS) — useRelatorios.ts:191-193, servicosCaixa.ts:166-171.
    -- =======================================================================
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

    -- =======================================================================
    -- 2) VENDAS AVULSAS (PDV rápido) (entrada)
    -- Tabela sem empresa_id (schema atual) — não dá pra filtrar por filial;
    -- sem cancelada — só soft delete via deleted_at.
    -- =======================================================================
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

    -- =======================================================================
    -- 3) SERVIÇOS AVULSOS (entrada)
    -- Fonte própria, separada da linha-espelho em `contas` (bloco 5 exige
    -- status='recebido'; a linha do Serviço Avulso nasce com status='pago' —
    -- bug de nomenclatura em useServicosAvulsos.ts:126 — então nunca aparece
    -- no bloco 5; contar aqui direto da tabela original evita perder o valor
    -- SEM duplicar, replicando useRelatorios.ts:131-136).
    -- =======================================================================
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

    -- =======================================================================
    -- 4) ORDENS DE SERVIÇO ENTREGUES (entrada)
    -- Réplica exata de getValorFaturavelOS (vendasFinanceiras.ts:296-315), com
    -- LEFT JOIN na conta a receber vinculada (contas.os_numero) pro status —
    -- no TS esse status vem resolvido à parte pelo chamador
    -- (statusContaVinculada). Status de OS considerados: useRelatorios.ts:106.
    -- Data do evento = data_caixa (não data_saida — escolha já usada no
    -- fechamento de caixa por causa de fuso horário, ver servicosCaixa.ts).
    -- =======================================================================
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

    -- =======================================================================
    -- 5) CONTAS A RECEBER QUITADAS (entrada)
    -- status='recebido' estrito — replica useRelatorios.ts:1073 (é essa
    -- exigência estrita que mantém o Serviço Avulso fora daqui, ver bloco 3).
    -- isContaReceitaManual (useRelatorios.ts:36-42): exclui contas já
    -- contadas via OS (os_numero) ou via venda (descricao 'venda_id:%').
    -- =======================================================================
    SELECT
      c.data_pagamento AS data,
      'entrada',
      'conta_receber',
      COALESCE(c.valor_pago, c.valor, 0),
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

    -- =======================================================================
    -- 6) CONTAS A PAGAR QUITADAS (saída)
    -- status='pago'. Exclui contas a pagar órfãs de OS excluída: ao excluir
    -- uma OS, só a conta 'receber' é apagada junto (useOrdensServico.ts) — a
    -- 'pagar' de peça/fornecedor (handleSubmitOrdemServico.ts:1198-1220) fica
    -- órfã na tabela. Decisão explícita: filtrar aqui na query, não confiar
    -- no filtro client-side que a tela de Contas já tem.
    -- =======================================================================
    SELECT
      c.data_pagamento AS data,
      'saida',
      'conta_pagar',
      COALESCE(c.valor_pago, c.valor, 0),
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

GRANT EXECUTE ON FUNCTION public.fn_extrato_eventos_raw(uuid, uuid, boolean, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- fn_extrato_resumo: os 3 números dos cards, numa única passada agregada.
-- saldo_atual = histórico completo (sem filtro de data — decisão explícita:
-- "saldo acumulado, tipo extrato bancário"; chama a função raw com
-- p_data_inicio/p_data_fim NULL de propósito). entradas/saidas_periodo =
-- calculados com FILTER sobre esse MESMO resultado (não é uma segunda
-- passada) — dado que o saldo já exige o histórico inteiro mesmo, não há
-- ganho em separar essa chamada em duas.
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
    COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0) AS saldo_atual,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND data BETWEEN p_data_inicio AND p_data_fim), 0) AS entradas_periodo,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND data BETWEEN p_data_inicio AND p_data_fim), 0) AS saidas_periodo
  FROM public.fn_extrato_eventos_raw(p_user_id, p_empresa_id, p_is_filial, NULL, NULL);
$$;

GRANT EXECUTE ON FUNCTION public.fn_extrato_resumo(uuid, uuid, boolean, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- fn_extrato_lista: as linhas do extrato pro período visível, paginadas.
-- Passa p_data_inicio/p_data_fim DIRETO pra fn_extrato_eventos_raw (não
-- filtra por fora) — é isso que permite ao Postgres usar os índices de data
-- em vez de materializar o histórico inteiro primeiro. Ver EXPLAIN ANALYZE
-- comparando as duas formas nos comentários acima de fn_extrato_eventos_raw.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_extrato_lista(
  p_user_id uuid,
  p_empresa_id uuid,
  p_is_filial boolean,
  p_data_inicio date,
  p_data_fim date,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  data date,
  tipo text,
  origem text,
  valor numeric,
  descricao text,
  referencia_id uuid
)
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.fn_extrato_eventos_raw(p_user_id, p_empresa_id, p_is_filial, p_data_inicio, p_data_fim)
  ORDER BY data DESC, tipo, origem
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.fn_extrato_lista(uuid, uuid, boolean, date, date, integer, integer) TO authenticated;
