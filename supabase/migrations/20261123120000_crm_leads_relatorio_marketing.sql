-- =====================================================================
-- CRM de leads — RELATÓRIO DE MARKETING (semanal/mensal) para o n8n.
-- Ação "relatorio_marketing" da Edge Function crm-leads (service_role).
-- Depende de: admin_mkt_cadastros_por_dia / admin_mkt_origens (20261021*),
-- fase 1 (SQL 1, 2 e 3), 1C, 1D e 2A (20261122120000), todas aplicadas.
-- Ordem e conferências: scripts/crm-leads/LEIA-ME.md (seção "Relatório de
-- marketing").
--
-- ADITIVA: só cria 3 funções novas. NÃO altera nenhuma função existente
-- (admin_mkt_*, admin_crm_*, _crm_pagantes), nenhuma tabela, nenhum dado.
--
-- Por que cópia e não chamada: as funções admin_* checam
-- has_role(auth.uid(), 'admin'), e a Edge Function roda como service_role
-- (auth.uid() nulo). Os trechos abaixo são CÓPIA das funções do card, com o
-- nome da origem em cada bloco. O teste PGlite
-- (scripts/crm-leads/teste-pglite-relatorio.mjs) roda as funções admin, passa
-- o resultado pelas MESMAS funções TypeScript do card
-- (src/lib/marketing/*.ts) e exige que este relatório dê números idênticos.
-- O pagante continua vindo de _crm_pagantes (chamada, não copiada).
--
-- Definições (iguais às do /admin/marketing):
--   cadastros    = admin_mkt_cadastros_por_dia somado no período
--                  (total, com_utm, meta -> vindos_meta)
--   receita      = total de admin_mkt_origens (receita_centavos): 1º
--                  pagamento de cada cadastro do período; PIX exato, cartão
--                  pelo preço cheio do plano. Sem o corte de 500 linhas do card.
--   funil        = admin_crm_funil (1D): conversas, cadastros, assinantes
--   teste        = admin_crm_funil_teste (1D): em teste agora, acabou sem pagar
--   amadurecendo = cadastros novos do funil com free_trial_ends_at > now()
--                  (inclui quem cancelou o teste e quem já pagou antes do fim)
--   gasto        = admin_crm_funil_gasto (2A) + regra de custosComGastoAutomatico
--                  (src/lib/marketing/gastoMetaWhatsApp.ts): automático vence o
--                  informado por anúncio+dia; fonte automatico|manual|nenhum
--   custos       = round(gasto ÷ quantidade); null quando quantidade = 0 ou
--                  sem gasto (custoPor de custoWhatsApp.ts)
--   por_anuncio  = admin_crm_funil_por_anuncio + admin_crm_funil_gasto_por_anuncio
--                  combinados como linhasAnuncioComGasto (gastoMetaWhatsApp.ts),
--                  ordenados por gasto. Único acréscimo: sem dado automático no
--                  período, anúncio com gasto informado e sem conversa também
--                  entra (no card ele não aparece).
-- Nenhuma função devolve nome, e-mail, telefone ou id de pessoa.
--
-- Idempotente (CREATE OR REPLACE). Rollback: scripts/crm-leads/rollback-relatorio.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- a) Cadastros e receita do período (painel de cadastros + card por origem)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._crm_rel_cadastros(p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  WITH precos(plano_tipo, centavos) AS (
    -- cópia de admin_mkt_origens (espelho de PRECOS_CENTAVOS)
    VALUES
      ('basico_mensal', 1990), ('intermediario_mensal', 3990),
      ('profissional_mensal', 7990), ('profissional_ultra_mensal', 12990),
      ('basico_anual', 19080), ('intermediario_anual', 38280),
      ('profissional_anual', 89880), ('profissional_ultra_anual', 131880)
  ),
  base AS (
    -- filtros de admin_mkt_cadastros_por_dia = admin_mkt_origens
    SELECT
      p.user_id,
      (p.utm_source IS NOT NULL AND p.utm_source <> '') AS b_utm,
      (p.fbclid IS NOT NULL
         OR p.utm_source ILIKE ANY (ARRAY['fb%', 'facebook%', 'ig%', 'instagram%', 'meta%'])) AS b_meta
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
    -- cópia de admin_mkt_origens (eventos)
    SELECT pp.user_id, pp.paid_at AS ts, 1 AS ordem, pp.valor_centavos::bigint AS pix, 0::bigint AS cartao
    FROM public.pagamentos_pix pp
    JOIN base b ON b.user_id = pp.user_id
    WHERE pp.status = 'paid' AND pp.paid_at IS NOT NULL
    UNION ALL
    SELECT a.user_id, a.data_inicio, 2, 0::bigint, pr.centavos::bigint
    FROM public.assinaturas a
    JOIN base b ON b.user_id = a.user_id
    JOIN precos pr ON pr.plano_tipo = a.plano_tipo::text
    WHERE a.payment_method = 'credit_card'
      AND lower(COALESCE(a.payment_provider, '')) = 'pagarme'
      AND a.data_inicio IS NOT NULL
    UNION ALL
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
    -- cópia de admin_mkt_origens (primeiro)
    SELECT DISTINCT ON (ev.user_id) ev.user_id, ev.pix, ev.cartao
    FROM eventos ev
    WHERE NOT EXISTS (
      SELECT 1 FROM public.assinaturas x
      WHERE x.user_id = ev.user_id AND x.bloqueado_admin = true
    )
    ORDER BY ev.user_id, ev.ts, ev.ordem
  )
  SELECT jsonb_build_object(
    'total',       count(*),
    'com_utm',     count(*) FILTER (WHERE b.b_utm),
    'vindos_meta', count(*) FILTER (WHERE b.b_meta),
    'receita_estimada_centavos', COALESCE(sum(pm.pix + pm.cartao), 0)::bigint
  )
  INTO v
  FROM base b
  LEFT JOIN primeiro pm ON pm.user_id = b.user_id;
  RETURN v;
END;
$$;

-- ---------------------------------------------------------------------
-- b) Funil do WhatsApp do período (1D: admin_crm_funil + admin_crm_funil_teste)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._crm_rel_funil(p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ini timestamptz := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim timestamptz := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v jsonb;
BEGIN
  WITH coorte AS (
    -- cópia da coorte de admin_crm_funil (1D)
    SELECT l.cadastro_user_id AS uid,
           (l.cadastro_user_id IS NOT NULL AND pr.created_at >= l.primeiro_contato_em - interval '24 hours') AS novo_cadastro
      FROM public.crm_leads l
      LEFT JOIN public.profiles pr ON pr.user_id = l.cadastro_user_id
     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim
       AND l.primeiro_contato_direcao = 'entrada'
  ),
  pag AS (
    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p
  )
  SELECT jsonb_build_object(
    'conversas_iniciadas', count(*),
    'cadastros',           count(*) FILTER (WHERE c.novo_cadastro),
    -- admin_crm_funil_teste.teste_ativo_agora
    'em_teste_agora',      count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (
                             SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid
                                AND t.free_trial_ends_at > now() AND t.trial_canceled IS NOT TRUE)),
    -- admin_crm_funil_teste.teste_acabou_sem_pagar
    'teste_acabou_sem_pagar', count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (
                             SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at <= now())
                             AND NOT EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid)),
    'assinantes_pagos',    count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid)),
    -- amadurecendo: o teste de 14 dias ainda não acabou (cancelado ou não)
    'cadastros_em_teste',  count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (
                             SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at > now()))
  )
  INTO v
  FROM coorte c;
  RETURN v;
END;
$$;

-- ---------------------------------------------------------------------
-- c) Relatório (service_role): período + anterior de mesmo tamanho
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_relatorio_marketing(p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje  date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dias  integer;
  v_aini  date;
  v_afim  date;
  v_ini   timestamptz;
  v_fim   timestamptz;
  v_cad   jsonb;
  v_cad_a jsonb;
  v_fun   jsonb;
  v_fun_a jsonb;
  v_g     record;
  v_fonte text;
  v_total bigint;
  v_ads   jsonb;
BEGIN
  -- mesma validação do card (intervaloFunil): até 400 dias, sem data futura
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 OR p_fim > v_hoje THEN
    RAISE EXCEPTION 'Período inválido (até 400 dias, sem datas futuras)' USING ERRCODE = '22023';
  END IF;
  v_dias := p_fim - p_inicio + 1;
  v_afim := p_inicio - 1;
  v_aini := p_inicio - v_dias;
  v_ini  := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim  := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  v_cad   := public._crm_rel_cadastros(p_inicio, p_fim);
  v_cad_a := public._crm_rel_cadastros(v_aini, v_afim);
  v_fun   := public._crm_rel_funil(p_inicio, p_fim);
  v_fun_a := public._crm_rel_funil(v_aini, v_afim);

  -- Gasto do período: cópia de admin_crm_funil_gasto (2A)
  WITH auto AS (
    SELECT a.ad_id AS a_ad, a.data AS a_dia, a.gasto_centavos
      FROM public.crm_gasto_meta_anuncio a
     WHERE a.data BETWEEN p_inicio AND p_fim AND a.moeda = 'BRL'
  ),
  manual_dia AS (
    SELECT g.id AS g_id, g.ad_id AS g_ad, greatest(g.inicio, p_inicio) + k AS g_dia,
           g.valor * 100 / (g.fim - g.inicio + 1) AS centavos
      FROM public.crm_gasto_manual g
      CROSS JOIN LATERAL generate_series(0, least(g.fim, p_fim) - greatest(g.inicio, p_inicio)) k
     WHERE g.removido_em IS NULL AND g.moeda = 'BRL'
       AND g.inicio <= p_fim AND g.fim >= p_inicio
  ),
  manual_efetivo AS (
    SELECT m.* FROM manual_dia m
     WHERE NOT EXISTS (
       SELECT 1 FROM auto x
        WHERE x.a_dia = m.g_dia
          AND (m.g_ad IS NULL OR x.a_ad = m.g_ad))
  )
  SELECT
    (SELECT coalesce(sum(x.gasto_centavos), 0)::bigint FROM auto x) AS auto_centavos,
    (SELECT count(DISTINCT x.a_dia)::bigint FROM auto x) AS dias_auto,
    (SELECT coalesce(round(sum(m.centavos)), 0)::bigint FROM manual_efetivo m) AS manual_centavos,
    (SELECT count(DISTINCT m.g_id)::bigint FROM manual_efetivo m) AS lancamentos,
    (SELECT max(t.atualizado_em) FROM public.crm_gasto_meta_anuncio t) AS atualizado_em
  INTO v_g;

  -- Fonte e total: custosComGastoAutomatico (gastoMetaWhatsApp.ts)
  v_fonte := CASE WHEN v_g.dias_auto > 0 THEN 'automatico' WHEN v_g.lancamentos > 0 THEN 'manual' ELSE 'nenhum' END;
  v_total := CASE v_fonte WHEN 'automatico' THEN v_g.auto_centavos + v_g.manual_centavos
                          WHEN 'manual' THEN v_g.manual_centavos END;

  -- Por anúncio: linhasAnuncioComGasto(admin_crm_funil_por_anuncio, admin_crm_funil_gasto_por_anuncio)
  WITH coorte AS (
    -- cópia de admin_crm_funil_por_anuncio (1D)
    SELECT coalesce(l.origem_ad_id, '') AS c_ad, l.origem_ad_titulo AS c_titulo, l.cadastro_user_id AS uid,
           (l.cadastro_user_id IS NOT NULL AND pr.created_at >= l.primeiro_contato_em - interval '24 hours') AS novo_cadastro
      FROM public.crm_leads l
      LEFT JOIN public.profiles pr ON pr.user_id = l.cadastro_user_id
     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim
       AND l.primeiro_contato_direcao = 'entrada'
  ),
  pag AS (
    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p
  ),
  gasto_inf AS (
    -- cópia de admin_crm_funil_por_anuncio (gasto informado com anúncio, rateio exato)
    SELECT g.ad_id AS g_ad, round(sum(
             g.valor * 100
             * ((least(g.fim, p_fim) - greatest(g.inicio, p_inicio) + 1)::numeric / (g.fim - g.inicio + 1))))::bigint AS centavos
      FROM public.crm_gasto_manual g
     WHERE g.ad_id IS NOT NULL AND g.removido_em IS NULL AND g.moeda = 'BRL'
       AND g.inicio <= p_fim AND g.fim >= p_inicio
     GROUP BY g.ad_id
  ),
  linhas AS (
    SELECT
      c.c_ad AS ad,
      max(c.c_titulo) AS titulo,
      count(*)::bigint AS conversas,
      count(*) FILTER (WHERE c.novo_cadastro)::bigint AS cadastros,
      count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (
        SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at IS NOT NULL UNION ALL
        SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_started_at IS NOT NULL))::bigint AS teste,
      count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid))::bigint AS assinantes,
      coalesce(max(gs.centavos), 0)::bigint AS gasto_informado
    FROM coorte c
    LEFT JOIN gasto_inf gs ON gs.g_ad = c.c_ad
    GROUP BY c.c_ad
    ORDER BY count(*) DESC, c.c_ad
    LIMIT 200
  ),
  auto AS (
    -- cópia de admin_crm_funil_gasto_por_anuncio (2A)
    SELECT a.ad_id AS a_ad, a.data AS a_dia, a.gasto_centavos
      FROM public.crm_gasto_meta_anuncio a
     WHERE a.data BETWEEN p_inicio AND p_fim AND a.moeda = 'BRL'
  ),
  auto_ad AS (
    SELECT x.a_ad, sum(x.gasto_centavos)::bigint AS gasto, count(*)::bigint AS dias
      FROM auto x GROUP BY x.a_ad
  ),
  manual_ad AS (
    SELECT g.ad_id AS m_ad, round(sum(g.valor * 100 / (g.fim - g.inicio + 1)))::bigint AS centavos
      FROM public.crm_gasto_manual g
      CROSS JOIN LATERAL generate_series(0, least(g.fim, p_fim) - greatest(g.inicio, p_inicio)) k
     WHERE g.ad_id IS NOT NULL AND g.removido_em IS NULL AND g.moeda = 'BRL'
       AND g.inicio <= p_fim AND g.fim >= p_inicio
       AND NOT EXISTS (SELECT 1 FROM auto x WHERE x.a_ad = g.ad_id AND x.a_dia = greatest(g.inicio, p_inicio) + k)
     GROUP BY g.ad_id
  ),
  gastos AS (
    SELECT coalesce(a.a_ad, m.m_ad) AS ad,
           coalesce(a.gasto, 0)::bigint AS auto,
           coalesce(a.dias, 0)::bigint AS dias,
           coalesce(m.centavos, 0)::bigint AS inf
      FROM auto_ad a
      FULL JOIN manual_ad m ON m.m_ad = a.a_ad
     ORDER BY coalesce(a.gasto, 0) + coalesce(m.centavos, 0) DESC, 1
     LIMIT 500
  ),
  modo AS (SELECT EXISTS (SELECT 1 FROM gastos WHERE gastos.dias > 0) AS com_auto),
  todas AS (
    -- anúncios com conversa (linhasAnuncioComGasto)
    SELECT l.ad, l.titulo, l.conversas, l.cadastros, l.teste, l.assinantes,
           CASE
             WHEN NOT md.com_auto THEN CASE WHEN l.gasto_informado > 0 THEN l.gasto_informado END
             WHEN coalesce(g.dias, 0) > 0 OR coalesce(g.auto, 0) + coalesce(g.inf, 0) > 0
               THEN coalesce(g.auto, 0) + coalesce(g.inf, 0)
           END AS gasto
      FROM linhas l
      CROSS JOIN modo md
      LEFT JOIN gastos g ON g.ad = l.ad
    UNION ALL
    -- com dado automático: anúncio com gasto e sem conversa (linhasAnuncioComGasto)
    SELECT g.ad, NULL, 0, 0, 0, 0, g.auto + g.inf
      FROM gastos g CROSS JOIN modo md
     WHERE md.com_auto
       AND NOT EXISTS (SELECT 1 FROM linhas l WHERE l.ad = g.ad)
       AND (g.dias > 0 OR g.inf > 0)
    UNION ALL
    -- sem dado automático: anúncio com gasto informado e sem conversa (acréscimo do relatório)
    SELECT gi.g_ad, NULL, 0, 0, 0, 0, gi.centavos
      FROM gasto_inf gi CROSS JOIN modo md
     WHERE NOT md.com_auto
       AND gi.centavos > 0
       AND NOT EXISTS (SELECT 1 FROM linhas l WHERE l.ad = gi.g_ad)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'ad_id',       nullif(t.ad, ''),
           'rotulo',      CASE WHEN t.ad = '' THEN 'Sem anúncio (orgânico / link direto)'
                               ELSE coalesce(nullif(btrim(t.titulo), ''), 'Anúncio ' || t.ad) END,
           'conversas',   t.conversas,
           'cadastros',   t.cadastros,
           'teste',       t.teste,
           'assinantes',  t.assinantes,
           'gasto_centavos', t.gasto,
           'custo_por_conversa_centavos', CASE WHEN t.gasto IS NOT NULL AND t.conversas > 0
                                               THEN round(t.gasto::numeric / t.conversas)::bigint END
         ) ORDER BY t.gasto DESC NULLS LAST, t.conversas DESC, t.ad), '[]'::jsonb)
    INTO v_ads
    FROM todas t;

  RETURN jsonb_build_object(
    'periodo',          jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias', v_dias),
    'periodo_anterior', jsonb_build_object('inicio', v_aini, 'fim', v_afim),
    'cadastros', jsonb_build_object(
      'total', v_cad->'total', 'com_utm', v_cad->'com_utm', 'vindos_meta', v_cad->'vindos_meta',
      'anterior', jsonb_build_object('total', v_cad_a->'total', 'com_utm', v_cad_a->'com_utm', 'vindos_meta', v_cad_a->'vindos_meta')),
    'funil_whatsapp', (v_fun - 'cadastros_em_teste')
      || jsonb_build_object('anterior', v_fun_a - 'cadastros_em_teste'),
    'gasto', jsonb_build_object(
      'total_centavos',      v_total,
      'meta_centavos',       v_g.auto_centavos,
      'manual_centavos',     v_g.manual_centavos,
      'fonte',               v_fonte,
      'dias_com_gasto_meta', v_g.dias_auto,
      'dias_no_periodo',     v_dias,
      'atualizado_em',       v_g.atualizado_em),
    'custos', jsonb_build_object(
      'por_conversa_centavos',  CASE WHEN v_total IS NOT NULL AND (v_fun->>'conversas_iniciadas')::bigint > 0
                                     THEN round(v_total::numeric / (v_fun->>'conversas_iniciadas')::bigint)::bigint END,
      'por_cadastro_centavos',  CASE WHEN v_total IS NOT NULL AND (v_fun->>'cadastros')::bigint > 0
                                     THEN round(v_total::numeric / (v_fun->>'cadastros')::bigint)::bigint END,
      'por_assinante_centavos', CASE WHEN v_total IS NOT NULL AND (v_fun->>'assinantes_pagos')::bigint > 0
                                     THEN round(v_total::numeric / (v_fun->>'assinantes_pagos')::bigint)::bigint END),
    'receita_estimada_centavos', v_cad->'receita_estimada_centavos',
    'amadurecendo', jsonb_build_object('cadastros_em_teste', v_fun->'cadastros_em_teste'),
    'por_anuncio', v_ads
  );
END;
$$;

COMMENT ON FUNCTION public.crm_relatorio_marketing(date, date) IS
  'CRM: relatório de marketing (n8n, via Edge Function crm-leads). Mesmos números do /admin/marketing para o período e o anterior de mesmo tamanho. Só service_role, só agregados.';
COMMENT ON FUNCTION public._crm_rel_cadastros(date, date) IS
  'CRM: interna do relatório de marketing (cadastros e receita = admin_mkt_cadastros_por_dia + admin_mkt_origens). Ninguém executa direto.';
COMMENT ON FUNCTION public._crm_rel_funil(date, date) IS
  'CRM: interna do relatório de marketing (funil do WhatsApp = admin_crm_funil + admin_crm_funil_teste). Ninguém executa direto.';

-- ---------------------------------------------------------------------
-- Privilégios: relatório só service_role; internas, ninguém (o dono executa)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._crm_rel_cadastros(date, date)      FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._crm_rel_funil(date, date)          FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_relatorio_marketing(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_relatorio_marketing(date, date) TO service_role;

COMMIT;
