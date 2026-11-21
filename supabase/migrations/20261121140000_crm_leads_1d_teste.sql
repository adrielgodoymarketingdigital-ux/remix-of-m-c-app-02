-- =====================================================================
-- CRM de leads do WhatsApp — FASE 1D: o degrau "teste" do funil lê o
-- teste certo.
-- Depende da fase 1 (SQL 1, 2 e 3) e da 1C (20261121130000).
-- Ordem e conferências: scripts/crm-leads/LEIA-ME.md (seção 1D).
--
-- Problema: "testes" contava só assinaturas.trial_started_at, que só as
-- funções de admin preenchem (admin-grant-access e
-- admin-liberar-acesso-temporario). Quem se cadastra sozinho ganha o teste no
-- plano free, com assinaturas.free_trial_ends_at (e trial_canceled). Medido em
-- produção: os cadastros do período têm free_trial_ends_at e
-- trial_started_at nulo, e o card mostrava "Iniciaram teste = 0".
--
-- O que muda:
--   a) admin_crm_funil e admin_crm_funil_por_anuncio: MESMOS parâmetros,
--      nomes e colunas de retorno. "testes" passa a contar o cadastro novo
--      com trial_started_at OU free_trial_ends_at preenchido (uma linha a
--      mais dentro do EXISTS, ligada por UNION ALL). Nada mais muda.
--   b) admin_crm_funil_teste (nova, aditiva, só admin): para a MESMA coorte
--      do funil (1º contato no período, o cliente escreveu primeiro, cadastro
--      novo), só contagens:
--        teste_ativo_agora      free_trial_ends_at > now() e não cancelado
--        teste_acabou_sem_pagar free_trial_ends_at <= now() e não está em
--                               _crm_pagantes
--        teste_cancelado        trial_canceled = true
--        assinantes             mesma regra do funil (_crm_pagantes)
--      As três primeiras podem se sobrepor (ex.: cancelou e o prazo já
--      passou conta em "cancelado" e em "acabou sem pagar").
--
-- As 2 funções alteradas são CÓPIA EXATA das versões da 1C
-- (20261121130000) mais as linhas marcadas "-- 1D" (só linhas acrescentadas;
-- o teste PGlite tira essas linhas e exige o texto da 1C).
--
-- Não altera tabela nenhuma, nem _crm_pagantes, admin_mkt_origens, a
-- ingestão ou o CRM antigo.
--
-- Idempotente. Rollback: scripts/crm-leads/rollback-1d.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- a) Funil e funil por anúncio (cópia da 1C + linha "-- 1D")
-- ---------------------------------------------------------------------
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
      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at IS NOT NULL UNION ALL  -- 1D: teste de quem se cadastrou sozinho (plano free)
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
      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at IS NOT NULL UNION ALL  -- 1D: teste de quem se cadastrou sozinho (plano free)
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

-- ---------------------------------------------------------------------
-- b) Situação do teste da coorte do funil (só contagens)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_crm_funil_teste(p_inicio date, p_fim date)
RETURNS TABLE(
  teste_ativo_agora bigint,
  teste_acabou_sem_pagar bigint,
  teste_cancelado bigint,
  assinantes bigint
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
    -- Mesma coorte de admin_crm_funil com novo_cadastro (1 linha por lead).
    SELECT l.cadastro_user_id AS uid
      FROM public.crm_leads l
      JOIN public.profiles pr ON pr.user_id = l.cadastro_user_id
     WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim
       AND l.primeiro_contato_direcao = 'entrada'
       AND pr.created_at >= l.primeiro_contato_em - interval '24 hours'
  ),
  pag AS (
    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT c.uid FROM coorte c)) p
  )
  SELECT
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid
         AND t.free_trial_ends_at > now() AND t.trial_canceled IS NOT TRUE))::bigint,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at <= now())
      AND NOT EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid))::bigint,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_canceled IS TRUE))::bigint,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM pag WHERE pag.uid = c.uid))::bigint
  FROM coorte c;
END;
$$;

COMMENT ON FUNCTION public.admin_crm_funil_teste(date, date) IS
  'CRM 1D: situação do teste (plano free, free_trial_ends_at) dos cadastros novos do funil do WhatsApp. Só admin, só contagens.';

-- Privilégios (CREATE OR REPLACE mantém os das funções existentes; repetidos
-- aqui para ficar explícito).
REVOKE ALL ON FUNCTION public.admin_crm_funil(date, date)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_crm_funil_por_anuncio(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_crm_funil_teste(date, date)       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil(date, date)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil_por_anuncio(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil_teste(date, date)       TO authenticated;

COMMIT;
