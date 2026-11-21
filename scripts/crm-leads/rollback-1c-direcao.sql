-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM de leads — ROLLBACK da FASE 1C (20261121130000_crm_leads_1c_direcao_primeiro_contato.sql).
--
-- Volta crm_ingerir_mensagens, admin_crm_funil e admin_crm_funil_por_anuncio
-- para as versões de 20261121120010 / 20261121120020 (texto copiado igual;
-- o teste PGlite compara com as migrations), apaga admin_crm_funil_excluidos
-- e a coluna crm_leads.primeiro_contato_direcao.
--
-- PERDA DE DADO: a coluna some. Ao reaplicar a 1C, o backfill recupera a
-- direção só dos leads cuja 1ª mensagem ainda está guardada. Quem teve a 1ª
-- mensagem cortada depois da 1C (máx. 30 por lead / retenção de 90 dias)
-- volta como "desconhecida" e sai do funil.
--
-- Efeito: o funil volta a contar quem a loja chamou primeiro. Com o código
-- da 1C publicado, a linha "Fora do funil" some sozinha (função inexistente =
-- "não ativado") e o card continua funcionando.
--
-- Na ordem geral dos rollbacks, este vem ANTES do rollback-3.
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- 1) Funções nas versões anteriores (não usam a coluna)
CREATE OR REPLACE FUNCTION public.crm_ingerir_mensagens(p_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item       jsonb;
  v_idx        integer := -1;
  v_tel        text;
  v_lead       uuid;
  v_em         timestamptz;
  v_dir        text;
  v_autor      text;
  v_texto      text;
  v_ref        jsonb;
  v_msg_id     bigint;
  v_inseridas  integer := 0;
  v_duplicadas integer := 0;
  v_optouts    integer := 0;
  v_rejeitadas jsonb := '[]'::jsonb;
  v_tocados    uuid[] := '{}';
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) > 200 THEN
    RAISE EXCEPTION 'lote inválido (array de até 200 itens)';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_idx := v_idx + 1;
    v_msg_id := NULL;
    BEGIN
      v_tel   := public.crm_normalizar_telefone(v_item->>'telefone');
      v_dir   := v_item->>'direcao';
      v_autor := coalesce(v_item->>'autor', CASE WHEN v_dir = 'entrada' THEN 'lead' ELSE 'humano' END);
      v_texto := left(v_item->>'texto', 2000);
      v_ref   := CASE WHEN jsonb_typeof(v_item->'referral') = 'object' THEN v_item->'referral' END;
      v_em    := (v_item->>'enviada_em')::timestamptz;

      IF v_tel IS NULL THEN
        v_rejeitadas := v_rejeitadas || jsonb_build_object('indice', v_idx, 'erro', 'telefone_invalido');
        CONTINUE;
      END IF;
      IF v_em IS NULL OR v_em > now() + interval '10 minutes' OR v_em < now() - interval '400 days' THEN
        v_rejeitadas := v_rejeitadas || jsonb_build_object('indice', v_idx, 'erro', 'data_invalida');
        CONTINUE;
      END IF;

      INSERT INTO public.crm_leads AS l (
        telefone_e164, wa_jid, nome, primeiro_contato_em, ultimo_contato_em,
        origem_ad_id, origem_ad_titulo, origem_ad_tipo, origem_ctwa_clid, origem_url, origem_em
      ) VALUES (
        v_tel, left(v_item->>'wa_jid', 100), left(nullif(btrim(v_item->>'nome'), ''), 120), v_em, v_em,
        v_ref->>'ad_id', left(v_ref->>'titulo', 200), left(v_ref->>'tipo', 20),
        left(v_ref->>'ctwa_clid', 500), left(v_ref->>'url', 500),
        CASE WHEN v_ref IS NOT NULL THEN v_em END
      )
      ON CONFLICT (telefone_e164) DO UPDATE SET
        wa_jid           = coalesce(EXCLUDED.wa_jid, l.wa_jid),
        nome             = coalesce(l.nome, EXCLUDED.nome),
        -- 1º anúncio vence (first touch): só preenche se ainda não havia
        origem_ad_id     = coalesce(l.origem_ad_id, EXCLUDED.origem_ad_id),
        origem_ad_titulo = CASE WHEN l.origem_ad_id IS NULL THEN EXCLUDED.origem_ad_titulo ELSE l.origem_ad_titulo END,
        origem_ad_tipo   = CASE WHEN l.origem_ad_id IS NULL THEN EXCLUDED.origem_ad_tipo   ELSE l.origem_ad_tipo END,
        origem_ctwa_clid = CASE WHEN l.origem_ad_id IS NULL THEN EXCLUDED.origem_ctwa_clid ELSE l.origem_ctwa_clid END,
        origem_url       = CASE WHEN l.origem_ad_id IS NULL THEN EXCLUDED.origem_url       ELSE l.origem_url END,
        origem_em        = CASE WHEN l.origem_ad_id IS NULL THEN EXCLUDED.origem_em        ELSE l.origem_em END,
        atualizado_em    = now()
      RETURNING l.id INTO v_lead;

      INSERT INTO public.crm_lead_mensagens (lead_id, wa_message_id, direcao, autor, tipo, texto, enviada_em)
      VALUES (v_lead, v_item->>'wa_message_id', v_dir, v_autor, coalesce(v_item->>'tipo', 'texto'), v_texto, v_em)
      ON CONFLICT ON CONSTRAINT crm_lead_mensagens_dedupe DO NOTHING
      RETURNING id INTO v_msg_id;

      IF v_msg_id IS NULL THEN
        v_duplicadas := v_duplicadas + 1;
        CONTINUE;
      END IF;
      v_inseridas := v_inseridas + 1;
      v_tocados := array_append(v_tocados, v_lead);

      -- Datas nunca andam para trás (mensagens podem chegar fora de ordem).
      UPDATE public.crm_leads l SET
        primeiro_contato_em = least(l.primeiro_contato_em, v_em),
        ultimo_contato_em   = greatest(l.ultimo_contato_em, v_em),
        ultimo_falou        = CASE WHEN v_em >= l.ultimo_contato_em
                                   THEN CASE WHEN v_dir = 'entrada' THEN 'lead' ELSE 'loja' END
                                   ELSE l.ultimo_falou END,
        ultima_msg_lead_em  = CASE WHEN v_dir = 'entrada' THEN greatest(l.ultima_msg_lead_em, v_em) ELSE l.ultima_msg_lead_em END,
        ultima_msg_loja_em  = CASE WHEN v_dir = 'saida'   THEN greatest(l.ultima_msg_loja_em, v_em) ELSE l.ultima_msg_loja_em END,
        etapa               = CASE WHEN l.etapa IN ('novo', 'esfriou') AND v_dir = 'entrada'
                                    AND l.ultima_msg_loja_em IS NOT NULL THEN 'em_conversa'
                                   WHEN l.etapa = 'novo' AND v_dir = 'saida' THEN 'em_conversa'
                                   ELSE l.etapa END,
        mensagens_apagadas_em = NULL,
        atualizado_em       = now()
      WHERE l.id = v_lead;

      IF v_dir = 'entrada' AND public.crm_eh_opt_out(v_texto) THEN
        UPDATE public.crm_leads
           SET opt_out = true, opt_out_em = coalesce(opt_out_em, now()),
               opt_out_origem = coalesce(opt_out_origem, 'mensagem_parar'),
               proximo_followup_em = NULL, atualizado_em = now()
         WHERE id = v_lead AND NOT opt_out;
        IF FOUND THEN v_optouts := v_optouts + 1; END IF;
      END IF;
    EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation
                OR invalid_datetime_format OR datetime_field_overflow THEN
      v_rejeitadas := v_rejeitadas || jsonb_build_object('indice', v_idx, 'erro', 'campo_invalido');
    END;
  END LOOP;

  -- Máximo de 30 mensagens por lead (as mais recentes ficam).
  DELETE FROM public.crm_lead_mensagens m
   USING (
     SELECT id FROM (
       SELECT id, row_number() OVER (PARTITION BY lead_id ORDER BY enviada_em DESC, id DESC) AS rn
         FROM public.crm_lead_mensagens
        WHERE lead_id = ANY (v_tocados)
     ) x WHERE x.rn > 30
   ) velhas
   WHERE m.id = velhas.id;

  RETURN jsonb_build_object(
    'inseridas', v_inseridas, 'duplicadas', v_duplicadas,
    'opt_outs', v_optouts, 'rejeitadas', v_rejeitadas
  );
END;
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

-- 2) Função nova e coluna
DROP FUNCTION IF EXISTS public.admin_crm_funil_excluidos(date, date);
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_primeiro_contato_direcao_check;
ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS primeiro_contato_direcao;

COMMIT;
