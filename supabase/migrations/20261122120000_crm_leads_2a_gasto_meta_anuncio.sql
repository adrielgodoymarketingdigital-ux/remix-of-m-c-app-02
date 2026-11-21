-- =====================================================================
-- CRM de leads do WhatsApp — FASE 2A: gasto da Meta POR ANÚNCIO, automático
-- (n8n -> Edge Function crm-leads, ação "gasto_meta").
-- Depende da fase 1 (SQL 1, 2 e 3), da 1C (20261121130000) e da 1D
-- (20261121140000), todas aplicadas em produção.
-- Ordem e conferências: scripts/crm-leads/LEIA-ME.md (seção 2A).
--
-- ADITIVA: não reescreve admin_crm_funil, admin_crm_funil_por_anuncio,
-- admin_crm_funil_teste, a ingestão nem tabela nenhuma da fase 1. As funções
-- antigas não leem a tabela nova (por isso nunca somam automático + manual).
--
-- O que cria:
--   a) crm_gasto_meta_anuncio: 1 linha por anúncio e dia (Insights nível ad,
--      dia da conta de anúncios = America/Sao_Paulo). Só números e IDs; sem
--      nome, e-mail ou telefone de ninguém. RLS ligada SEM política e sem
--      privilégio para PUBLIC/anon/authenticated: só pelas funções.
--   b) crm_gravar_gasto_meta(jsonb) — service_role (Edge Function). Upsert
--      idempotente por (ad_id, data); reenvio do mesmo dia ATUALIZA os
--      valores e o atualizado_em. Validação estrita por item; item ruim é
--      rejeitado com o índice, os outros gravam.
--   c) admin_crm_funil_gasto(p_inicio, p_fim) — só admin, 1 linha.
--   d) admin_crm_funil_gasto_por_anuncio(p_inicio, p_fim) — só admin.
--
-- Regra do gasto (c e d), por DIA:
--   - gasto automático = soma das linhas BRL do período;
--   - gasto informado (crm_gasto_manual) é aberto em dias (rateio igual ao
--     da fase 1: valor ÷ dias do lançamento) e um dia é DESCARTADO quando:
--       · lançamento COM anúncio: existe linha automática do MESMO anúncio
--         nesse dia;
--       · lançamento GERAL (sem anúncio): existe QUALQUER linha automática
--         nesse dia.
--     Dias sem linha automática continuam valendo. Nunca soma os dois no
--     mesmo anúncio e dia.
--   - "linha automática" = qualquer linha BRL do dia, inclusive com gasto 0
--     (o n8n manda os dias zerados da janela; ver CONTRATO.md).
--   - meta_ads_insights_dia / crm_campanhas_whatsapp NÃO são usadas aqui.
--
-- Não toca _zerar_catalogo: a tabela não tem coluna de dono (user_id).
--
-- Idempotente. Rollback: scripts/crm-leads/rollback-2a.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- a) Tabela
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_gasto_meta_anuncio (
  ad_id          text   NOT NULL CHECK (ad_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  -- A janela "400 dias para trás / 1 para frente" é checada na gravação
  -- (crm_gravar_gasto_meta): um CHECK com current_date faria um restore de
  -- backup falhar quando a linha envelhecesse. Aqui só o piso fixo.
  data           date   NOT NULL CHECK (data >= DATE '2024-01-01'),
  campaign_id    text            CHECK (campaign_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  gasto_centavos bigint NOT NULL CHECK (gasto_centavos BETWEEN 0 AND 100000000),
  impressoes     bigint NOT NULL DEFAULT 0 CHECK (impressoes BETWEEN 0 AND 1000000000),
  cliques        bigint NOT NULL DEFAULT 0 CHECK (cliques BETWEEN 0 AND 1000000000),
  conversas_meta bigint NOT NULL DEFAULT 0 CHECK (conversas_meta BETWEEN 0 AND 10000000),
  moeda          text   NOT NULL DEFAULT 'BRL' CHECK (moeda ~ '^[A-Z]{3}$'),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, data)
);
COMMENT ON TABLE public.crm_gasto_meta_anuncio IS
  'CRM 2A: gasto da Meta por anúncio e dia (Insights nível ad), gravado pelo n8n via crm_gravar_gasto_meta. Dia da conta (America/Sao_Paulo). campaign_id é só informativo. Vale no lugar do gasto informado do mesmo anúncio e dia.';
COMMENT ON COLUMN public.crm_gasto_meta_anuncio.conversas_meta IS
  'Conversas iniciadas segundo a Meta (onsite_conversion.messaging_conversation_started_7d). Não é a contagem do funil.';
COMMENT ON COLUMN public.crm_gasto_meta_anuncio.atualizado_em IS
  'Hora da última sincronização desta linha (cada reenvio atualiza), não a hora em que a Meta fechou o número.';
CREATE INDEX IF NOT EXISTS idx_crm_gasto_meta_anuncio_data ON public.crm_gasto_meta_anuncio (data);

REVOKE ALL ON public.crm_gasto_meta_anuncio FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_gasto_meta_anuncio TO service_role;
ALTER TABLE public.crm_gasto_meta_anuncio ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- b) Gravação (service_role)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_gravar_gasto_meta(p_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_item jsonb;
  v_i integer := -1;
  v_ad text;
  v_camp text;
  v_txt text;
  v_data date;
  v_moeda text;
  v_num jsonb;
  v_vals bigint[];
  v_campo text;
  v_max bigint;
  v_erro text;
  v_vistos text[] := ARRAY[]::text[];
  v_inserido boolean;
  v_inseridos integer := 0;
  v_atualizados integer := 0;
  v_rejeitadas jsonb := '[]'::jsonb;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Lote inválido';
  END IF;
  IF jsonb_array_length(p_itens) > 100 THEN
    RAISE EXCEPTION 'Lote grande (máximo de 100 itens)';
  END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_itens) e LOOP
    v_i := v_i + 1;
    v_erro := NULL;
    v_vals := ARRAY[]::bigint[];

    IF jsonb_typeof(v_item) <> 'object' THEN
      v_erro := 'nao_objeto';
    END IF;

    IF v_erro IS NULL THEN
      v_ad := CASE WHEN jsonb_typeof(v_item->'ad_id') = 'string' THEN v_item->>'ad_id' END;
      IF v_ad IS NULL OR v_ad !~ '^[A-Za-z0-9_.-]{1,64}$' THEN v_erro := 'ad_id_invalido'; END IF;
    END IF;

    IF v_erro IS NULL THEN
      IF v_item->'campaign_id' IS NULL OR jsonb_typeof(v_item->'campaign_id') = 'null' THEN
        v_camp := NULL;
      ELSIF jsonb_typeof(v_item->'campaign_id') = 'string' AND (v_item->>'campaign_id') ~ '^[A-Za-z0-9_.-]{1,64}$' THEN
        v_camp := v_item->>'campaign_id';
      ELSE
        v_erro := 'campaign_id_invalido';
      END IF;
    END IF;

    IF v_erro IS NULL THEN
      v_txt := CASE WHEN jsonb_typeof(v_item->'data') = 'string' THEN v_item->>'data' END;
      v_data := NULL;
      IF v_txt ~ '^\d{4}-\d{2}-\d{2}$' THEN
        BEGIN
          v_data := v_txt::date;
          IF to_char(v_data, 'YYYY-MM-DD') <> v_txt THEN v_data := NULL; END IF;
        EXCEPTION WHEN others THEN
          v_data := NULL;
        END;
      END IF;
      IF v_data IS NULL THEN
        v_erro := 'data_invalida';
      ELSIF v_data < v_hoje - 400 OR v_data > v_hoje + 1 OR v_data < DATE '2024-01-01' THEN
        v_erro := 'data_fora_da_janela';
      END IF;
    END IF;

    -- gasto_centavos obrigatório; os outros opcionais (ausente = 0)
    IF v_erro IS NULL THEN
      FOREACH v_campo IN ARRAY ARRAY['gasto_centavos', 'impressoes', 'cliques', 'conversas_meta'] LOOP
        EXIT WHEN v_erro IS NOT NULL;
        v_max := CASE v_campo WHEN 'gasto_centavos' THEN 100000000 WHEN 'conversas_meta' THEN 10000000 ELSE 1000000000 END;
        v_num := v_item->v_campo;
        IF v_num IS NULL OR jsonb_typeof(v_num) = 'null' THEN
          IF v_campo = 'gasto_centavos' THEN v_erro := 'gasto_invalido'; ELSE v_vals := v_vals || 0::bigint; END IF;
        ELSIF jsonb_typeof(v_num) <> 'number'
           OR (v_num::text)::numeric <> trunc((v_num::text)::numeric)
           OR (v_num::text)::numeric < 0
           OR (v_num::text)::numeric > v_max THEN
          v_erro := CASE v_campo WHEN 'gasto_centavos' THEN 'gasto_invalido' ELSE v_campo || '_invalido' END;
        ELSE
          v_vals := v_vals || (v_num::text)::numeric::bigint;
        END IF;
      END LOOP;
    END IF;

    IF v_erro IS NULL THEN
      IF v_item->'moeda' IS NULL OR jsonb_typeof(v_item->'moeda') = 'null' THEN
        v_moeda := 'BRL';
      ELSIF jsonb_typeof(v_item->'moeda') = 'string' AND (v_item->>'moeda') ~ '^[A-Z]{3}$' THEN
        v_moeda := v_item->>'moeda';
      ELSE
        v_erro := 'moeda_invalida';
      END IF;
    END IF;

    IF v_erro IS NULL AND (v_ad || '|' || v_txt) = ANY (v_vistos) THEN
      v_erro := 'duplicado_no_lote';
    END IF;

    IF v_erro IS NOT NULL THEN
      v_rejeitadas := v_rejeitadas || jsonb_build_object('indice', v_i, 'erro', v_erro);
      CONTINUE;
    END IF;
    v_vistos := v_vistos || (v_ad || '|' || v_txt);

    INSERT INTO public.crm_gasto_meta_anuncio AS g
      (ad_id, data, campaign_id, gasto_centavos, impressoes, cliques, conversas_meta, moeda, atualizado_em)
    VALUES (v_ad, v_data, v_camp, v_vals[1], v_vals[2], v_vals[3], v_vals[4], v_moeda, now())
    ON CONFLICT (ad_id, data) DO UPDATE SET
      campaign_id    = EXCLUDED.campaign_id,
      gasto_centavos = EXCLUDED.gasto_centavos,
      impressoes     = EXCLUDED.impressoes,
      cliques        = EXCLUDED.cliques,
      conversas_meta = EXCLUDED.conversas_meta,
      moeda          = EXCLUDED.moeda,
      atualizado_em  = now()
    RETURNING (xmax = 0) INTO v_inserido;

    IF v_inserido THEN v_inseridos := v_inseridos + 1; ELSE v_atualizados := v_atualizados + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('inseridos', v_inseridos, 'atualizados', v_atualizados, 'rejeitadas', v_rejeitadas);
END;
$$;

COMMENT ON FUNCTION public.crm_gravar_gasto_meta(jsonb) IS
  'CRM 2A: upsert do gasto da Meta por anúncio e dia (service_role, Edge Function crm-leads). Máx. 100 itens; rejeita por item.';

-- ---------------------------------------------------------------------
-- c) Gasto do período (geral), só admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_crm_funil_gasto(p_inicio date, p_fim date)
RETURNS TABLE(
  gasto_auto_centavos bigint,
  dias_auto bigint,
  anuncios_auto bigint,
  conversas_meta bigint,
  impressoes bigint,
  cliques bigint,
  gasto_manual_efetivo_centavos bigint,
  lancamentos_manuais_efetivos bigint,
  atualizado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN
    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';
  END IF;

  RETURN QUERY
  WITH auto AS (
    SELECT a.ad_id AS a_ad, a.data AS a_dia, a.gasto_centavos, a.impressoes AS a_imp, a.cliques AS a_cli, a.conversas_meta AS a_conv
      FROM public.crm_gasto_meta_anuncio a
     WHERE a.data BETWEEN p_inicio AND p_fim AND a.moeda = 'BRL'
  ),
  manual_dia AS (
    -- rateio igual ao da fase 1: valor × 1 dia ÷ dias do lançamento
    -- (série de inteiros somada à data: não depende do fuso da sessão)
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
    (SELECT coalesce(sum(x.gasto_centavos), 0)::bigint FROM auto x),
    (SELECT count(DISTINCT x.a_dia)::bigint FROM auto x),
    (SELECT count(DISTINCT x.a_ad)::bigint FROM auto x),
    (SELECT coalesce(sum(x.a_conv), 0)::bigint FROM auto x),
    (SELECT coalesce(sum(x.a_imp), 0)::bigint FROM auto x),
    (SELECT coalesce(sum(x.a_cli), 0)::bigint FROM auto x),
    (SELECT coalesce(round(sum(m.centavos)), 0)::bigint FROM manual_efetivo m),
    (SELECT count(DISTINCT m.g_id)::bigint FROM manual_efetivo m),
    (SELECT max(t.atualizado_em) FROM public.crm_gasto_meta_anuncio t);
END;
$$;

COMMENT ON FUNCTION public.admin_crm_funil_gasto(date, date) IS
  'CRM 2A: gasto do funil no período. Automático por anúncio + gasto informado só nos dias sem linha automática (do mesmo anúncio; geral: de nenhum anúncio). atualizado_em = última sincronização (tabela inteira). Só admin.';

-- ---------------------------------------------------------------------
-- d) Gasto por anúncio, só admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_crm_funil_gasto_por_anuncio(p_inicio date, p_fim date)
RETURNS TABLE(
  ad_id text,
  gasto_auto_centavos bigint,
  dias_auto bigint,
  conversas_meta bigint,
  impressoes bigint,
  cliques bigint,
  gasto_manual_efetivo_centavos bigint,
  atualizado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN
    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';
  END IF;

  RETURN QUERY
  WITH auto AS (
    SELECT a.ad_id AS a_ad, a.data AS a_dia, a.gasto_centavos, a.impressoes AS a_imp, a.cliques AS a_cli,
           a.conversas_meta AS a_conv, a.atualizado_em AS a_at
      FROM public.crm_gasto_meta_anuncio a
     WHERE a.data BETWEEN p_inicio AND p_fim AND a.moeda = 'BRL'
  ),
  auto_ad AS (
    SELECT x.a_ad, sum(x.gasto_centavos)::bigint AS gasto, count(*)::bigint AS dias,
           sum(x.a_conv)::bigint AS conv, sum(x.a_imp)::bigint AS imp, sum(x.a_cli)::bigint AS cli, max(x.a_at) AS at
      FROM auto x GROUP BY x.a_ad
  ),
  manual_ad AS (
    -- só lançamentos COM anúncio (o geral não tem dono por anúncio)
    SELECT g.ad_id AS m_ad, round(sum(g.valor * 100 / (g.fim - g.inicio + 1)))::bigint AS centavos
      FROM public.crm_gasto_manual g
      CROSS JOIN LATERAL generate_series(0, least(g.fim, p_fim) - greatest(g.inicio, p_inicio)) k
     WHERE g.ad_id IS NOT NULL AND g.removido_em IS NULL AND g.moeda = 'BRL'
       AND g.inicio <= p_fim AND g.fim >= p_inicio
       AND NOT EXISTS (SELECT 1 FROM auto x WHERE x.a_ad = g.ad_id AND x.a_dia = greatest(g.inicio, p_inicio) + k)
     GROUP BY g.ad_id
  )
  SELECT
    coalesce(a.a_ad, m.m_ad),
    coalesce(a.gasto, 0)::bigint,
    coalesce(a.dias, 0)::bigint,
    coalesce(a.conv, 0)::bigint,
    coalesce(a.imp, 0)::bigint,
    coalesce(a.cli, 0)::bigint,
    coalesce(m.centavos, 0)::bigint,
    a.at
  FROM auto_ad a
  FULL JOIN manual_ad m ON m.m_ad = a.a_ad
  ORDER BY coalesce(a.gasto, 0) + coalesce(m.centavos, 0) DESC, 1
  LIMIT 500;
END;
$$;

COMMENT ON FUNCTION public.admin_crm_funil_gasto_por_anuncio(date, date) IS
  'CRM 2A: gasto por anúncio no período (automático + informado com ID do anúncio só nos dias sem linha automática dele). Até 500 linhas. Só admin.';

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.crm_gravar_gasto_meta(jsonb)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_crm_funil_gasto(date, date)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_crm_funil_gasto_por_anuncio(date, date)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_gravar_gasto_meta(jsonb)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil_gasto(date, date)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_crm_funil_gasto_por_anuncio(date, date) TO authenticated;

COMMIT;
