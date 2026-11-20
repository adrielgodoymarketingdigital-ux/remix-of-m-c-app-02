-- =====================================================================
-- CRM de leads do WhatsApp — FASE 1, SQL 2 de 3: GRAVAÇÃO (só service_role).
-- Depende do SQL 1 (20261121120000_crm_leads_1_estrutura.sql).
-- Ordem e conferências: scripts/crm-leads/LEIA-ME.md
--
-- Funções chamadas pela Edge Function crm-leads (n8n). Nenhuma é executável
-- por anon/authenticated. Só LEEM tabelas existentes (profiles,
-- loja_funcionarios, empresa_usuarios, user_roles, assinaturas) e só
-- ESCREVEM nas tabelas crm_* novas. Nenhuma tabela existente é alterada.
--
-- Idempotente (CREATE OR REPLACE). Rollback: scripts/crm-leads/rollback-2-gravacao.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- Lote de mensagens (até 200), já validado/normalizado pela Edge Function,
-- que aplica as mesmas regras. Cada item:
--   {telefone, wa_jid?, nome?, wa_message_id, direcao, autor, tipo, texto?,
--    enviada_em, referral?: {ad_id, titulo, tipo, ctwa_clid, url}}
-- Devolve {inseridas, duplicadas, opt_outs, rejeitadas:[{indice, erro}]}.
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

-- Assunto/resumo/etapa vindos da IA no n8n. Itens: {telefone, assunto?, resumo?, etapa?}.
-- etapa só aceita em_conversa | esfriou | perdido (nunca volta para novo).
CREATE OR REPLACE FUNCTION public.crm_atualizar_resumo(p_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_ok integer := 0;
  v_nao integer := 0;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) > 200 THEN
    RAISE EXCEPTION 'lote inválido (array de até 200 itens)';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    UPDATE public.crm_leads SET
      assunto   = coalesce(left(nullif(btrim(v_item->>'assunto'), ''), 120), assunto),
      resumo    = coalesce(left(nullif(btrim(v_item->>'resumo'), ''), 1500), resumo),
      resumo_em = CASE WHEN nullif(btrim(v_item->>'resumo'), '') IS NOT NULL THEN now() ELSE resumo_em END,
      etapa     = CASE WHEN v_item->>'etapa' IN ('em_conversa', 'esfriou', 'perdido') THEN v_item->>'etapa' ELSE etapa END,
      atualizado_em = now()
    WHERE telefone_e164 = public.crm_normalizar_telefone(v_item->>'telefone');
    IF FOUND THEN v_ok := v_ok + 1; ELSE v_nao := v_nao + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('atualizados', v_ok, 'nao_encontrados', v_nao);
END;
$$;

-- Opt-out por fora da mensagem. Cria o lead se não existe: o pedido vale
-- antes mesmo do 1º contato. Nunca desliga um opt-out.
CREATE OR REPLACE FUNCTION public.crm_registrar_opt_out(p_telefone text, p_origem text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text := public.crm_normalizar_telefone(p_telefone);
BEGIN
  IF v_tel IS NULL OR p_origem IS NULL OR p_origem NOT IN ('admin', 'n8n', 'mensagem_parar') THEN
    RAISE EXCEPTION 'telefone ou origem inválidos';
  END IF;
  INSERT INTO public.crm_leads (telefone_e164, primeiro_contato_em, ultimo_contato_em, opt_out, opt_out_em, opt_out_origem)
  VALUES (v_tel, now(), now(), true, now(), p_origem)
  ON CONFLICT (telefone_e164) DO UPDATE
    SET opt_out = true,
        opt_out_em = coalesce(crm_leads.opt_out_em, now()),
        opt_out_origem = coalesce(crm_leads.opt_out_origem, EXCLUDED.opt_out_origem),
        proximo_followup_em = NULL,
        atualizado_em = now();
  RETURN true;
END;
$$;

-- Cadastro que conta como "cadastro de marketing": os mesmos filtros de
-- admin_mkt_cadastros_por_dia (sem funcionário, gerente de filial, admin,
-- demonstração).
CREATE OR REPLACE FUNCTION public._crm_profile_elegivel(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.loja_funcionarios f WHERE f.funcionario_user_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.empresa_usuarios e WHERE e.gerente_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user_id AND r.role = 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.assinaturas a
                     WHERE a.user_id = p_user_id AND a.plano_tipo IN ('demonstracao', 'admin'));
$$;

-- Vínculo exato no momento do cadastro (o n8n recebe nome/telefone/user_id de
-- webhook-n8n-cadastro e repassa). Não sobrescreve vínculo manual.
CREATE OR REPLACE FUNCTION public.crm_vincular_usuario(p_telefone text, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text := public.crm_normalizar_telefone(p_telefone);
BEGIN
  IF v_tel IS NULL OR p_user_id IS NULL THEN RETURN 'invalido'; END IF;
  IF NOT public._crm_profile_elegivel(p_user_id) THEN RETURN 'profile_inelegivel'; END IF;
  UPDATE public.crm_leads
     SET cadastro_user_id = p_user_id, vinculo_metodo = 'cadastro_n8n', vinculo_em = now(),
         vinculo_ambiguo = false, proximo_followup_em = NULL, atualizado_em = now()
   WHERE telefone_e164 = v_tel
     AND vinculo_metodo IS DISTINCT FROM 'manual';
  RETURN CASE WHEN FOUND THEN 'vinculado' ELSE 'sem_lead' END;
END;
$$;

-- Vínculo em lote por DDD + 8 últimos dígitos, para quem cadastrou com outro
-- formato de número. Só leads sem vínculo e com contato nos últimos p_dias.
-- Uma única leitura de profiles (filtrada pelos finais dos leads pendentes).
-- Mais de um cadastro elegível com a mesma chave = ambíguo, não vincula.
CREATE OR REPLACE FUNCTION public.crm_vincular_cadastros(p_dias integer DEFAULT 120)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vinc integer;
  v_amb  integer;
BEGIN
  IF p_dias IS NULL OR p_dias < 1 OR p_dias > 400 THEN RAISE EXCEPTION 'p_dias entre 1 e 400'; END IF;

  WITH pend AS (
    SELECT l.id, l.telefone_e164, l.telefone_final8, l.telefone_ddd
      FROM public.crm_leads l
     WHERE l.cadastro_user_id IS NULL
       AND l.ultimo_contato_em >= now() - make_interval(days => p_dias)
  ), perf AS (
    SELECT p.user_id, public.crm_normalizar_telefone(p.celular) AS tel
      FROM public.profiles p
     WHERE p.celular IS NOT NULL
       AND right(regexp_replace(p.celular, '\D', '', 'g'), 8) IN (SELECT telefone_final8 FROM pend)
  ), cand AS (
    SELECT pd.id AS lead_id, pf.user_id
      FROM pend pd
      JOIN perf pf ON pf.tel IS NOT NULL AND right(pf.tel, 8) = pd.telefone_final8
     WHERE (pd.telefone_ddd IS NULL AND pf.tel = pd.telefone_e164)
        OR (pd.telefone_ddd IS NOT NULL AND left(pf.tel, 3) = '+55' AND substr(pf.tel, 4, 2) = pd.telefone_ddd)
  ), agg AS (
    SELECT c.lead_id, min(c.user_id::text)::uuid AS user_id, count(DISTINCT c.user_id) AS n
      FROM cand c
     WHERE public._crm_profile_elegivel(c.user_id)
     GROUP BY c.lead_id
  ), upd AS (
    UPDATE public.crm_leads l
       SET cadastro_user_id = a.user_id, vinculo_metodo = 'telefone', vinculo_em = now(),
           vinculo_ambiguo = false, proximo_followup_em = NULL, atualizado_em = now()
      FROM agg a
     WHERE a.lead_id = l.id AND a.n = 1 AND l.cadastro_user_id IS NULL
    RETURNING 1
  ), amb AS (
    UPDATE public.crm_leads l SET vinculo_ambiguo = true, atualizado_em = now()
      FROM agg a
     WHERE a.lead_id = l.id AND a.n > 1 AND NOT l.vinculo_ambiguo
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM upd), (SELECT count(*) FROM amb) INTO v_vinc, v_amb;

  RETURN jsonb_build_object('vinculados', v_vinc, 'ambiguos_novos', v_amb);
END;
$$;

-- Retenção (chamada pelo relatório diário do n8n; sem pg_cron): 90 dias sem
-- contato apaga as mensagens e o resumo. Ficam etapa, origem, datas, vínculo
-- e opt-out (para o funil e para respeitar o opt-out para sempre).
CREATE OR REPLACE FUNCTION public.crm_aplicar_retencao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msgs  integer;
  v_leads integer;
BEGIN
  WITH velhos AS (
    SELECT id FROM public.crm_leads
     WHERE ultimo_contato_em < now() - interval '90 days'
  ), del AS (
    DELETE FROM public.crm_lead_mensagens m USING velhos v WHERE m.lead_id = v.id RETURNING 1
  ) SELECT count(*) INTO v_msgs FROM del;

  UPDATE public.crm_leads
     SET resumo = NULL, resumo_em = NULL, mensagens_apagadas_em = now(), atualizado_em = now()
   WHERE ultimo_contato_em < now() - interval '90 days'
     AND mensagens_apagadas_em IS NULL;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  RETURN jsonb_build_object('mensagens_apagadas', v_msgs, 'leads_limpos', v_leads);
END;
$$;

-- Relatório diário para o n8n: só números agregados do dia (Brasília).
CREATE OR REPLACE FUNCTION public.crm_relatorio_diario(p_dia date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ini timestamptz;
  v_fim timestamptz;
  v_res jsonb;
BEGIN
  IF p_dia IS NULL THEN RAISE EXCEPTION 'dia obrigatório'; END IF;
  v_ini := p_dia::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (p_dia + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  SELECT jsonb_build_object(
    'dia', p_dia,
    'conversas_novas',   count(*) FILTER (WHERE l.primeiro_contato_em >= v_ini AND l.primeiro_contato_em < v_fim),
    'vinculados_no_dia', count(*) FILTER (WHERE l.vinculo_em >= v_ini AND l.vinculo_em < v_fim),
    'opt_outs_no_dia',   count(*) FILTER (WHERE l.opt_out_em >= v_ini AND l.opt_out_em < v_fim),
    'vinculos_ambiguos', count(*) FILTER (WHERE l.vinculo_ambiguo AND l.cadastro_user_id IS NULL)
  ) INTO v_res
  FROM public.crm_leads l;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_ingerir_mensagens(jsonb)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_atualizar_resumo(jsonb)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_registrar_opt_out(text, text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._crm_profile_elegivel(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_vincular_usuario(text, uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_vincular_cadastros(integer)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_aplicar_retencao()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_relatorio_diario(date)          FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_ingerir_mensagens(jsonb)      TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_atualizar_resumo(jsonb)       TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_registrar_opt_out(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_vincular_usuario(text, uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_vincular_cadastros(integer)   TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_aplicar_retencao()            TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_relatorio_diario(date)        TO service_role;

COMMIT;
