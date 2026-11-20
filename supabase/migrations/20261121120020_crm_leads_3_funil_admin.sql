-- =====================================================================
-- CRM de leads do WhatsApp — FASE 1, SQL 3 de 3: FUNIL e GASTO (admin).
-- Depende do SQL 1 e 2 e de objetos que JÁ EXISTEM em produção:
--   has_role(uuid, app_role), meta_ads_insights_dia (vazia até existir a
--   sincronização com a Meta), profiles, assinaturas, pagamentos_pix,
--   admin_notifications. Nada disso é alterado.
-- Ordem e conferências: scripts/crm-leads/LEIA-ME.md
--
-- Definições (iguais ao /admin/marketing):
--   coorte     = leads cujo 1º contato caiu no período (datas de Brasília);
--                conversões contam em qualquer data até hoje.
--   cadastrou  = lead vinculado (cadastro_user_id) a cadastro criado a partir
--                de 24 h antes do 1º contato. Mais antigo = "já era cliente".
--                (Elegibilidade — sem funcionário, gerente, admin,
--                demonstração — é garantida no vínculo, SQL 2.)
--   testou     = assinaturas.trial_started_at preenchido (= testes_iniciados
--                de admin_mkt_origens). Cumulativo.
--   assinante  = 1º pagamento pela regra de admin_mkt_origens (_crm_pagantes).
--
-- Gasto — UMA FONTE SÓ, nunca somadas (a escolha é do app, src/lib/marketing/custoWhatsApp.ts):
--   gasto_meta_*   = meta_ads_insights_dia só das campanhas em crm_campanhas_whatsapp
--   gasto_manual_* = crm_gasto_manual ativo, rateado por dia dentro do período
-- admin_crm_gasto_informar recusa sobreposição que contaria o mesmo dinheiro
-- duas vezes (mesmo anúncio, ou um dos lançamentos sendo "geral").
--
-- Idempotente (CREATE OR REPLACE). Rollback: scripts/crm-leads/rollback-3-funil-admin.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- 1º pagamento — MESMA regra de admin_mkt_origens (CTEs eventos/primeiro),
-- copiada para não alterar a função em produção. O teste PGlite roda as duas
-- com os mesmos dados e exige o mesmo conjunto de pagantes.
CREATE OR REPLACE FUNCTION public._crm_pagantes(p_users uuid[])
RETURNS TABLE(user_id uuid, primeiro_pagamento_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH precos(plano_tipo) AS (
    -- Espelho dos planos pagos de PRECOS_CENTAVOS (_shared/planos-config.ts)
    VALUES ('basico_mensal'), ('intermediario_mensal'), ('profissional_mensal'), ('profissional_ultra_mensal'),
           ('basico_anual'), ('intermediario_anual'), ('profissional_anual'), ('profissional_ultra_anual')
  ),
  alvo AS (SELECT DISTINCT u AS uid FROM unnest(p_users) u WHERE u IS NOT NULL),
  eventos AS (
    SELECT pp.user_id AS uid, pp.paid_at AS ts
      FROM public.pagamentos_pix pp
      JOIN alvo ON alvo.uid = pp.user_id
     WHERE pp.status = 'paid' AND pp.paid_at IS NOT NULL
    UNION ALL
    SELECT a.user_id, a.data_inicio
      FROM public.assinaturas a
      JOIN alvo ON alvo.uid = a.user_id
      JOIN precos pr ON pr.plano_tipo = a.plano_tipo::text
     WHERE a.payment_method = 'credit_card'
       AND lower(coalesce(a.payment_provider, '')) = 'pagarme'
       AND a.data_inicio IS NOT NULL
    UNION ALL
    SELECT alvo.uid, n.created_at
      FROM public.admin_notifications n
      JOIN alvo ON alvo.uid::text = n.dados->>'user_id'
     WHERE n.tipo IN ('nova_assinatura', 'nova_assinatura_cartao')
       AND n.created_at IS NOT NULL
       AND jsonb_typeof(n.dados->'user_id') = 'string'
       AND (
         (jsonb_typeof(n.dados->'stripe_subscription_id') = 'string'
           AND n.dados->>'stripe_subscription_id' <> ''
           AND left(n.dados->>'stripe_subscription_id', 12) <> 'sub_pending_')
         OR coalesce(jsonb_typeof(n.dados->'pagarme_order_id'), 'null') <> 'null'
         OR coalesce(jsonb_typeof(n.dados->'valor_centavos'), 'null') <> 'null'
       )
  )
  SELECT e.uid, min(e.ts)
    FROM eventos e
   WHERE NOT EXISTS (SELECT 1 FROM public.assinaturas x WHERE x.user_id = e.uid AND x.bloqueado_admin = true)
   GROUP BY e.uid;
$$;

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

-- Mesmo funil por anúncio (até 200 linhas). Gasto aqui só o informado COM
-- anúncio: o cache da Meta é por campanha, não por anúncio.
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

-- Gasto informado no card (só admin). Devolve o id do lançamento.
-- Recusa: período inválido/futuro, valor fora de 0,01..1.000.000,00 ou com
-- mais de 2 casas, anúncio com caracteres inválidos, e sobreposição que
-- contaria o mesmo dinheiro duas vezes.
CREATE OR REPLACE FUNCTION public.admin_crm_gasto_informar(
  p_inicio date, p_fim date, p_valor numeric, p_ad_id text DEFAULT NULL, p_descricao text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad   text := nullif(btrim(coalesce(p_ad_id, '')), '');
  v_desc text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_id   bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 OR p_fim > v_hoje THEN
    RAISE EXCEPTION 'Período inválido (até 400 dias, sem datas futuras)' USING ERRCODE = '22023';
  END IF;
  IF p_valor IS NULL OR p_valor = 'NaN' OR p_valor < 0.01 OR p_valor > 1000000 OR p_valor <> round(p_valor, 2) THEN
    RAISE EXCEPTION 'Valor inválido (de 0,01 a 1.000.000,00, com até 2 casas)' USING ERRCODE = '22023';
  END IF;
  IF v_ad IS NOT NULL AND v_ad !~ '^[A-Za-z0-9_.-]{1,64}$' THEN
    RAISE EXCEPTION 'ID do anúncio inválido' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_desc) > 200 THEN
    RAISE EXCEPTION 'Descrição com mais de 200 caracteres' USING ERRCODE = '22023';
  END IF;

  -- Um lançamento por vez (dois admins ao mesmo tempo não furam a regra).
  PERFORM pg_advisory_xact_lock(hashtext('crm_gasto_manual'));
  IF EXISTS (
    SELECT 1 FROM public.crm_gasto_manual g
     WHERE g.removido_em IS NULL
       AND g.inicio <= p_fim AND g.fim >= p_inicio
       AND (g.ad_id IS NULL OR v_ad IS NULL OR g.ad_id = v_ad)
  ) THEN
    RAISE EXCEPTION 'Já existe gasto informado neste período que se sobrepõe a este (mesmo anúncio ou gasto geral). Remova o anterior antes.'
      USING ERRCODE = '23P01';
  END IF;

  INSERT INTO public.crm_gasto_manual (inicio, fim, ad_id, descricao, valor, criado_por)
  VALUES (p_inicio, p_fim, v_ad, v_desc, p_valor, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Remoção lógica (fica o histórico de quem informou e quem removeu).
CREATE OR REPLACE FUNCTION public.admin_crm_gasto_remover(p_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;
  UPDATE public.crm_gasto_manual
     SET removido_em = now(), removido_por = auth.uid()
   WHERE id = p_id AND removido_em IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public._crm_pagantes(uuid[]) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_crm_funil(date, date)                                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_crm_funil_por_anuncio(date, date)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_crm_gasto_informar(date, date, numeric, text, text)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_crm_gasto_remover(bigint)                            FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil(date, date)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil_por_anuncio(date, date)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_crm_gasto_informar(date, date, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_crm_gasto_remover(bigint)                           TO authenticated;

COMMIT;
