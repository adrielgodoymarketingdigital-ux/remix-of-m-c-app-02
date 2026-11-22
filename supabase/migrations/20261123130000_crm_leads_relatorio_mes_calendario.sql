-- =====================================================================
-- CRM de leads — RELATÓRIO DE MARKETING: período anterior do MÊS DE
-- CALENDÁRIO. Depende de 20261123120000_crm_leads_relatorio_marketing.sql
-- (aplicada em produção). Ordem e conferências: scripts/crm-leads/LEIA-ME.md
-- (seção "Relatório de marketing: mês contra mês anterior").
--
-- Só CREATE OR REPLACE de public.crm_relatorio_marketing(date, date), com o
-- MESMO texto da 20261123120000 exceto o cálculo de v_aini:
--   - p_inicio = dia 1 e p_fim = último dia do MESMO mês -> periodo_anterior =
--     mês de calendário anterior inteiro (01/11–30/11 compara com
--     01/10–31/10; 01/03–31/03 com 01/02–28/02 ou 29/02; 01/01–31/01 com
--     01/12–31/12 do ano anterior);
--   - qualquer outro período (semana, personalizado, mês incompleto) -> os
--     mesmos N dias imediatamente antes, como antes.
-- periodo.dias continua = dias do período atual; nenhum campo novo no JSON
-- (contrato com o n8n igual).
-- O anterior só alimenta cadastros.anterior e funil_whatsapp.anterior, via
-- _crm_rel_cadastros(v_aini, v_afim) e _crm_rel_funil(v_aini, v_afim), que
-- recebem as duas datas e não usam o tamanho do período atual. Gasto, custos
-- e por anúncio são só do período atual (p_inicio..p_fim).
-- _crm_rel_cadastros e _crm_rel_funil NÃO mudam. Nenhuma tabela, nenhum dado.
--
-- Idempotente (CREATE OR REPLACE). Rollback: scripts/crm-leads/rollback-relatorio-mes.sql
-- (volta ao texto da 20261123120000; não apaga nada).
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

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
  -- Período anterior. Mês de calendário inteiro (dia 1 até o último dia do
  -- MESMO mês) -> o mês de calendário anterior inteiro (pode ter outro número
  -- de dias). Qualquer outro período -> os mesmos N dias imediatamente antes.
  -- Conta em timestamp sem fuso: não depende do TimeZone da sessão.
  IF extract(day FROM p_inicio) = 1
     AND p_fim = (p_inicio::timestamp + interval '1 month')::date - 1 THEN
    v_aini := (p_inicio::timestamp - interval '1 month')::date;
  ELSE
    v_aini := p_inicio - v_dias;
  END IF;
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
  'CRM: relatório de marketing (n8n, via Edge Function crm-leads). Mesmos números do /admin/marketing para o período e o anterior: mês de calendário inteiro compara com o mês de calendário anterior inteiro; outros períodos, com os mesmos N dias imediatamente antes. Só service_role, só agregados.';

REVOKE ALL ON FUNCTION public.crm_relatorio_marketing(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_relatorio_marketing(date, date) TO service_role;

COMMIT;
