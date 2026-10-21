-- Painel Marketing (/admin/marketing) — etapa 4: cadastros e conversão por origem.
--
-- Função de LEITURA, só para admin, que devolve apenas números agregados por
-- origem (nenhum nome, e-mail ou telefone). Mesmo molde de segurança de
-- admin_mkt_cadastros_por_dia: SECURITY DEFINER + has_role + REVOKE anon.
--
-- Cadastros: os mesmos filtros de admin_mkt_cadastros_por_dia — profiles com
-- created_at no período (datas de Brasília), sem funcionários, gerentes de
-- filial, admins e planos demonstracao/admin.
--
-- Origem (lower + trim; vazio/nulo vira 'sem origem'):
--   fonte    = utm_source; sem utm_source mas com fbclid → 'meta (sem utm)'
--   meio     = utm_medium
--   campanha = utm_campaign
--   conteudo = utm_content
--
-- Pagante = cadastro do período que tem PRIMEIRO PAGAMENTO registrado (em
-- qualquer data até hoje), com a mesma regra de eventos de pagamento da Edge
-- Function admin-financeiro (buildEventosPagamentoPorUser):
--   • PIX     → pagamentos_pix com status = 'paid' e paid_at preenchido
--   • Cartão  → assinaturas com payment_method = 'credit_card',
--               payment_provider = 'pagarme', plano pago e data_inicio preenchida
--   • Gateway → admin_notifications tipo nova_assinatura/nova_assinatura_cartao
--               com dados.user_id e evidência de cobrança (stripe_subscription_id
--               real, pagarme_order_id ou valor_centavos)
--   • Contas com assinaturas.bloqueado_admin = true não têm evento (como no
--     admin-financeiro) — continuam contando como cadastro, não como pagante.
--   Primeiro pagamento = evento mais antigo (empate: pix, cartão, gateway).
--
-- Receita = só do PRIMEIRO pagamento:
--   • receita_pix_centavos             → valor_centavos exato do 1º PIX pago
--   • receita_cartao_estimada_centavos → preço cheio do plano atual da
--     assinatura (PRECOS_CENTAVOS de supabase/functions/_shared/planos-config.ts,
--     anual = valor do ano). ESTIMATIVA: ignora cupom e troca de plano.
--   • 1º pagamento via gateway antigo → conta como pagante, receita 0.
--
-- No máximo 500 linhas, ordenadas por cadastros (decrescente).
--
-- Para reverter:
--   DROP FUNCTION IF EXISTS public.admin_mkt_origens(date, date);

CREATE OR REPLACE FUNCTION public.admin_mkt_origens(p_inicio date, p_fim date)
RETURNS TABLE(
  fonte text,
  meio text,
  campanha text,
  conteudo text,
  cadastros bigint,
  testes_iniciados bigint,
  pagantes bigint,
  receita_pix_centavos bigint,
  receita_cartao_estimada_centavos bigint,
  receita_centavos bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;

  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN
    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';
  END IF;

  RETURN QUERY
  WITH precos(plano_tipo, centavos) AS (
    -- Espelho de PRECOS_CENTAVOS (supabase/functions/_shared/planos-config.ts).
    VALUES
      ('basico_mensal', 1990), ('intermediario_mensal', 3990),
      ('profissional_mensal', 7990), ('profissional_ultra_mensal', 12990),
      ('basico_anual', 19080), ('intermediario_anual', 38280),
      ('profissional_anual', 89880), ('profissional_ultra_anual', 131880)
  ),
  base AS (
    SELECT
      p.user_id,
      CASE
        WHEN NULLIF(lower(trim(p.utm_source)), '') IS NOT NULL THEN lower(trim(p.utm_source))
        WHEN NULLIF(trim(p.fbclid), '') IS NOT NULL THEN 'meta (sem utm)'
        ELSE 'sem origem'
      END AS b_fonte,
      COALESCE(NULLIF(lower(trim(p.utm_medium)), ''), 'sem origem') AS b_meio,
      COALESCE(NULLIF(lower(trim(p.utm_campaign)), ''), 'sem origem') AS b_campanha,
      COALESCE(NULLIF(lower(trim(p.utm_content)), ''), 'sem origem') AS b_conteudo,
      EXISTS (
        SELECT 1 FROM public.assinaturas t
        WHERE t.user_id = p.user_id AND t.trial_started_at IS NOT NULL
      ) AS b_teste
    FROM public.profiles p
    WHERE p.created_at >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND p.created_at <  ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND NOT EXISTS (SELECT 1 FROM public.loja_funcionarios f WHERE f.funcionario_user_id = p.user_id)
      AND NOT EXISTS (SELECT 1 FROM public.empresa_usuarios e WHERE e.gerente_id = p.user_id)
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
      AND NOT EXISTS (
        SELECT 1 FROM public.assinaturas a
        WHERE a.user_id = p.user_id
          AND a.plano_tipo IN ('demonstracao', 'admin')
      )
  ),
  eventos AS (
    -- PIX: livro-razão real.
    SELECT pp.user_id, pp.paid_at AS ts, 1 AS ordem, pp.valor_centavos::bigint AS pix, 0::bigint AS cartao
    FROM public.pagamentos_pix pp
    JOIN base b ON b.user_id = pp.user_id
    WHERE pp.status = 'paid' AND pp.paid_at IS NOT NULL
    UNION ALL
    -- Cartão Pagar.me: data_inicio (não é sobrescrito nas renovações de cartão).
    SELECT a.user_id, a.data_inicio, 2, 0::bigint, pr.centavos::bigint
    FROM public.assinaturas a
    JOIN base b ON b.user_id = a.user_id
    JOIN precos pr ON pr.plano_tipo = a.plano_tipo::text
    WHERE a.payment_method = 'credit_card'
      AND lower(COALESCE(a.payment_provider, '')) = 'pagarme'
      AND a.data_inicio IS NOT NULL
    UNION ALL
    -- Gateway antigo (Stripe/Ticto) com evidência de cobrança.
    SELECT b.user_id, n.created_at, 3, 0::bigint, 0::bigint
    FROM public.admin_notifications n
    JOIN base b ON b.user_id::text = n.dados->>'user_id'
    WHERE n.tipo IN ('nova_assinatura', 'nova_assinatura_cartao')
      AND n.created_at IS NOT NULL
      AND jsonb_typeof(n.dados->'user_id') = 'string'
      AND (
        (jsonb_typeof(n.dados->'stripe_subscription_id') = 'string'
          AND n.dados->>'stripe_subscription_id' <> ''
          AND left(n.dados->>'stripe_subscription_id', 12) <> 'sub_pending_')
        OR COALESCE(jsonb_typeof(n.dados->'pagarme_order_id'), 'null') <> 'null'
        OR COALESCE(jsonb_typeof(n.dados->'valor_centavos'), 'null') <> 'null'
      )
  ),
  primeiro AS (
    SELECT DISTINCT ON (ev.user_id) ev.user_id, ev.pix, ev.cartao
    FROM eventos ev
    WHERE NOT EXISTS (
      SELECT 1 FROM public.assinaturas x
      WHERE x.user_id = ev.user_id AND x.bloqueado_admin = true
    )
    ORDER BY ev.user_id, ev.ts, ev.ordem
  )
  SELECT
    b.b_fonte,
    b.b_meio,
    b.b_campanha,
    b.b_conteudo,
    count(*)::bigint,
    count(*) FILTER (WHERE b.b_teste)::bigint,
    count(pm.user_id)::bigint,
    COALESCE(sum(pm.pix), 0)::bigint,
    COALESCE(sum(pm.cartao), 0)::bigint,
    COALESCE(sum(pm.pix + pm.cartao), 0)::bigint
  FROM base b
  LEFT JOIN primeiro pm ON pm.user_id = b.user_id
  GROUP BY b.b_fonte, b.b_meio, b.b_campanha, b.b_conteudo
  ORDER BY count(*) DESC, b.b_fonte, b.b_meio, b.b_campanha, b.b_conteudo
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mkt_origens(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mkt_origens(date, date) TO authenticated;

COMMENT ON FUNCTION public.admin_mkt_origens(date, date) IS 'Painel Marketing: cadastros, testes, pagantes e receita do 1º pagamento por origem (UTM), só admin, só números agregados. Receita do cartão é estimada pelo preço do plano.';
