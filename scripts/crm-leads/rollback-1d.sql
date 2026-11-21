-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM de leads — ROLLBACK da FASE 1D (20261121140000_crm_leads_1d_teste.sql).
--
-- Volta admin_crm_funil e admin_crm_funil_por_anuncio para as versões da 1C
-- (20261121130000; texto copiado igual, o teste PGlite compara) e apaga
-- admin_crm_funil_teste. Não apaga dado nenhum: a 1D não criou tabela nem
-- coluna.
--
-- Efeito: "testes" volta a contar só trial_started_at (o card volta a mostrar
-- "0" para quem se cadastrou sozinho). Com o código da 1D publicado, as
-- linhas "Em teste agora" e "Teste acabou sem pagar" somem sozinhas (função
-- inexistente) e o card volta ao degrau "Iniciaram teste".
--
-- Na ordem geral dos rollbacks, este vem ANTES do rollback-1c-direcao.
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- 1) Funções nas versões da 1C
CREATE OR REPLACE FUNCTION public.admin_crm_funil(p_inicio date, p_fim date)
RETURNS TABLE(
  conversas bigint,
  conversas_anuncio bigint,
  ja_clientes bigint,
  cadastros bigint,
  testes bigint,
  assinantes bigint,
  opt_outs bigint,
  gasto_meta_centavos bigint,
  gasto_meta_dias bigint,
  gasto_manual_centavos bigint,
  gasto_manual_lancamentos bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ini timestamptz;
  v_fim timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN
    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';
  END IF;
  v_ini := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH coorte AS (
    SELECT l.cadastro_user_id AS uid, l.origem_ad_id, l.opt_out,
           (l.cadastro_user_id IS NOT NULL AND pr.created_at >= l.primeiro_contato_em - interval '24 hours') AS novo_cadastro,
           (l.cadastro_user_id IS NOT NULL AND pr.created_at <  l.primeiro_contato_em - interval '24 hours') AS ja_cliente
      FROM public.crm_leads l
      LEFT JOIN public.profiles pr ON pr.user_id = l.cadastro_user_id
     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim
       AND l.primeiro_contato_direcao = 'entrada'  -- 1C: só quem escreveu primeiro
  ),
  pag AS (
    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p
  ),
  meta AS (
    SELECT coalesce(round(sum(i.gasto) * 100), 0)::bigint AS centavos, count(DISTINCT i.dia)::bigint AS dias
      FROM public.meta_ads_insights_dia i
      JOIN public.crm_campanhas_whatsapp c ON c.campaign_id = i.campaign_id
     WHERE i.dia BETWEEN p_inicio AND p_fim
  ),
  manual AS (
    -- rateio: valor × dias do lançamento dentro do período ÷ dias do lançamento
    SELECT coalesce(round(sum(
             g.valor * 100
             * ((least(g.fim, p_fim) - greatest(g.inicio, p_inicio) + 1)::numeric / (g.fim - g.inicio + 1))
           )), 0)::bigint AS centavos,
           count(*)::bigint AS lancamentos
      FROM public.crm_gasto_manual g
     WHERE g.removido_em IS NULL AND g.moeda = 'BRL'
       AND g.inicio <= p_fim AND g.fim >= p_inicio
  )
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE c.origem_ad_id IS NOT NULL)::bigint,
    count(*) FILTER (WHERE c.ja_cliente)::bigint,
    count(*) FILTER (WHERE c.novo_cadastro)::bigint,
    count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (
      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_started_at IS NOT NULL))::bigint,
    count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid))::bigint,
    count(*) FILTER (WHERE c.opt_out)::bigint,
    (SELECT m.centavos FROM meta m),
    (SELECT m.dias FROM meta m),
    (SELECT g.centavos FROM manual g),
    (SELECT g.lancamentos FROM manual g)
  FROM coorte c;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_crm_funil_por_anuncio(p_inicio date, p_fim date)
RETURNS TABLE(
  ad_id text,
  ad_titulo text,
  conversas bigint,
  cadastros bigint,
  testes bigint,
  assinantes bigint,
  gasto_manual_centavos bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ini timestamptz;
  v_fim timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN
    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';
  END IF;
  v_ini := p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH coorte AS (
    -- '' = sem anúncio (orgânico / link direto); o app mostra o rótulo.
    SELECT coalesce(l.origem_ad_id, '') AS c_ad, l.origem_ad_titulo AS c_titulo, l.cadastro_user_id AS uid,
           (l.cadastro_user_id IS NOT NULL AND pr.created_at >= l.primeiro_contato_em - interval '24 hours') AS novo_cadastro
      FROM public.crm_leads l
      LEFT JOIN public.profiles pr ON pr.user_id = l.cadastro_user_id
     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim
       AND l.primeiro_contato_direcao = 'entrada'  -- 1C: só quem escreveu primeiro
  ),
  pag AS (
    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c WHERE c.novo_cadastro)) p
  ),
  gasto AS (
    SELECT g.ad_id AS g_ad, round(sum(
             g.valor * 100
             * ((least(g.fim, p_fim) - greatest(g.inicio, p_inicio) + 1)::numeric / (g.fim - g.inicio + 1))))::bigint AS centavos
      FROM public.crm_gasto_manual g
     WHERE g.ad_id IS NOT NULL AND g.removido_em IS NULL AND g.moeda = 'BRL'
       AND g.inicio <= p_fim AND g.fim >= p_inicio
     GROUP BY g.ad_id
  )
  SELECT
    c.c_ad,
    max(c.c_titulo),
    count(*)::bigint,
    count(*) FILTER (WHERE c.novo_cadastro)::bigint,
    count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (
      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_started_at IS NOT NULL))::bigint,
    count(*) FILTER (WHERE c.novo_cadastro AND EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid))::bigint,
    coalesce(max(gs.centavos), 0)::bigint
  FROM coorte c
  LEFT JOIN gasto gs ON gs.g_ad = c.c_ad
  GROUP BY c.c_ad
  ORDER BY count(*) DESC, c.c_ad
  LIMIT 200;
END;
$$;

-- 2) Função nova da 1D
DROP FUNCTION IF EXISTS public.admin_crm_funil_teste(date, date);

REVOKE ALL ON FUNCTION public.admin_crm_funil(date, date)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_crm_funil_por_anuncio(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil(date, date)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil_por_anuncio(date, date) TO authenticated;

COMMIT;
