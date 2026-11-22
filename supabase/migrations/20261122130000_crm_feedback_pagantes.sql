-- =====================================================================
-- CRM — PESQUISA DE FEEDBACK COM PAGANTES (n8n -> Edge Function crm-leads,
-- ações "pagantes_contato" e "contato_registrar").
-- Depende da fase 1 do CRM (SQL 1, 2 e 3), aplicada em produção:
--   crm_leads (opt-out), crm_normalizar_telefone, _crm_pagantes,
--   _crm_profile_elegivel. Nenhuma delas é alterada aqui.
-- Ordem e conferências: scripts/crm-leads/LEIA-ME.md (seção "Feedback").
--
-- ADITIVA: cria 1 tabela e 2 funções. Não altera tabela nem função existente.
--
-- a) crm_contato_campanha: quem recebeu (ou falhou) em cada campanha.
--    A coluna da pessoa chama-se destinatario_user_id DE PROPÓSITO (mesmo
--    motivo do cadastro_user_id da fase 1): com o nome user_id, o "Começar do
--    zero" (zerar_meus_dados) acharia a coluna e recusaria o lojista que já
--    recebeu uma pesquisa (tabela_nao_classificada). Sem FK pelo mesmo motivo.
--    Sem telefone, nome ou texto: só o id, a campanha e as datas.
--    RLS ligada SEM política; só service_role (pelas funções).
-- b) crm_pagantes_contato(campanha, limite, pausa_dias, user_ids) — service_role.
-- c) crm_contato_registrar(campanha, itens) — service_role.
--
-- Elegível (b) = TODAS:
--   1. assinatura status 'active' em plano pago (lista de PRECOS_CENTAVOS /
--      _crm_pagantes), dentro do prazo (data_fim nula ou futura);
--   2. já pagou de verdade (_crm_pagantes: PIX pago, cartão Pagar.me ou
--      notificação com cobrança; e nenhuma linha com bloqueado_admin).
--      Cortesia liberada pelo admin fica fora;
--   3. _crm_profile_elegivel: não é admin (user_roles), nem plano
--      demonstracao/admin (conta de teste), nem funcionário, nem gerente de filial;
--   4. profiles.celular vira celular brasileiro (crm_normalizar_telefone,
--      espelho do normalizarTelefone, e depois +55 DDD 9XXXXXXXX);
--   5. o telefone não tem opt-out em crm_leads, e a conta não está ligada
--      (cadastro_user_id) a um lead com opt-out;
--   6. ninguém com esse telefone recebeu ('enviado') NESTA campanha;
--   7. PAUSA: ninguém com esse telefone recebeu ('enviado') em QUALQUER
--      campanha nos últimos pausa_dias dias. 'falhou' não conta.
--   Um telefone = uma pessoa: as regras 5–7 valem para o telefone inteiro
--   (todas as contas com o mesmo número) e sai 1 conta por telefone (a de
--   menor user_id). Ordem estável: quem nunca falhou nesta campanha primeiro,
--   depois quem falhou; dentro de cada grupo, por user_id.
--
-- Idempotente. Rollback: scripts/crm-leads/rollback-feedback.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- a) Tabela de controle
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_contato_campanha (
  campanha             text NOT NULL CHECK (campanha ~ '^[a-z0-9_-]{3,40}$'),
  destinatario_user_id uuid NOT NULL,
  resultado            text NOT NULL CHECK (resultado IN ('enviado', 'falhou')),
  enviado_em           timestamptz,
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campanha, destinatario_user_id),
  CONSTRAINT crm_contato_campanha_enviado_em CHECK ((resultado = 'enviado') = (enviado_em IS NOT NULL))
);
COMMENT ON TABLE public.crm_contato_campanha IS
  'CRM feedback: quem recebeu (enviado) ou não (falhou) a mensagem de cada campanha, gravado pelo n8n via crm_contato_registrar. destinatario_user_id = profiles.user_id (nome diferente de user_id de propósito: ver migration).';
COMMENT ON COLUMN public.crm_contato_campanha.enviado_em IS
  'Hora do 1º registro como enviado. Nunca muda depois (reenviar "enviado" não estende a pausa). Nula enquanto resultado = falhou.';
CREATE INDEX IF NOT EXISTS idx_crm_contato_campanha_enviado
  ON public.crm_contato_campanha (destinatario_user_id, enviado_em) WHERE resultado = 'enviado';

REVOKE ALL ON public.crm_contato_campanha FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contato_campanha TO service_role;
ALTER TABLE public.crm_contato_campanha ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- b) Lista de pagantes elegíveis (service_role)
-- Devolve {itens:[{user_id, primeira_palavra, telefone}], total_elegiveis,
-- excluidos_por_pausa}. primeira_palavra = 1ª palavra de profiles.nome, sem
-- formatar (a Edge Function põe a maiúscula, que no Postgres depende do
-- locale). p_user_ids (opcional, até 10) restringe a essas contas, para o
-- teste; as regras continuam todas valendo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_pagantes_contato(
  p_campanha text, p_limite integer, p_pausa_dias integer, p_user_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
BEGIN
  IF p_campanha IS NULL OR p_campanha !~ '^[a-z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'campanha inválida' USING ERRCODE = '22023';
  END IF;
  IF p_limite IS NULL OR p_limite < 1 OR p_limite > 50 THEN
    RAISE EXCEPTION 'limite inválido (1 a 50)' USING ERRCODE = '22023';
  END IF;
  IF p_pausa_dias IS NULL OR p_pausa_dias < 30 OR p_pausa_dias > 365 THEN
    RAISE EXCEPTION 'pausa_dias inválido (30 a 365)' USING ERRCODE = '22023';
  END IF;
  IF p_user_ids IS NOT NULL AND (cardinality(p_user_ids) < 1 OR cardinality(p_user_ids) > 10) THEN
    RAISE EXCEPTION 'user_ids inválido (1 a 10)' USING ERRCODE = '22023';
  END IF;

  WITH precos(plano_tipo) AS (
    -- Espelho dos planos pagos de PRECOS_CENTAVOS (_shared/planos-config.ts) = _crm_pagantes
    VALUES ('basico_mensal'), ('intermediario_mensal'), ('profissional_mensal'), ('profissional_ultra_mensal'),
           ('basico_anual'), ('intermediario_anual'), ('profissional_anual'), ('profissional_ultra_anual')
  ),
  ativos AS (
    SELECT DISTINCT a.user_id AS uid
      FROM public.assinaturas a
      JOIN precos pr ON pr.plano_tipo = a.plano_tipo::text
     WHERE a.status::text = 'active'
       AND (a.data_fim IS NULL OR a.data_fim > now())
       AND (p_user_ids IS NULL OR a.user_id = ANY (p_user_ids))
  ),
  pagantes AS (
    -- já pagou de verdade; _crm_pagantes também tira quem tem bloqueado_admin
    SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT uid FROM ativos)) p
  ),
  base AS (
    SELECT pf.user_id AS uid,
           public.crm_normalizar_telefone(pf.celular) AS tel,
           split_part(btrim(regexp_replace(coalesce(pf.nome, ''), '\s+', ' ', 'g')), ' ', 1) AS palavra
      FROM pagantes pg
      JOIN public.profiles pf ON pf.user_id = pg.uid
     WHERE public._crm_profile_elegivel(pf.user_id)
  ),
  cel AS (
    SELECT * FROM base WHERE tel ~ '^\+55[1-9]{2}9[0-9]{8}$'
  ),
  contatos AS (
    -- telefone ATUAL de quem já foi contatado: bloqueia o número em todas as contas
    SELECT c.campanha, c.resultado, c.enviado_em, c.destinatario_user_id AS uid,
           public.crm_normalizar_telefone(pf.celular) AS tel
      FROM public.crm_contato_campanha c
      LEFT JOIN public.profiles pf ON pf.user_id = c.destinatario_user_id
  ),
  avaliados AS (
    SELECT cel.uid, cel.tel, cel.palavra,
           (EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.opt_out AND l.telefone_e164 = cel.tel)
             OR EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.opt_out AND l.cadastro_user_id = cel.uid)) AS optout,
           EXISTS (SELECT 1 FROM contatos k
                    WHERE k.campanha = p_campanha AND k.resultado = 'enviado'
                      AND (k.uid = cel.uid OR k.tel = cel.tel)) AS ja_nesta,
           EXISTS (SELECT 1 FROM contatos k
                    WHERE k.resultado = 'enviado' AND k.enviado_em > now() - make_interval(days => p_pausa_dias)
                      AND (k.uid = cel.uid OR k.tel = cel.tel)) AS em_pausa,
           EXISTS (SELECT 1 FROM contatos k
                    WHERE k.campanha = p_campanha AND k.resultado = 'falhou' AND k.uid = cel.uid) AS falhou_antes
      FROM cel
  ),
  grupos AS (
    -- 1 telefone = 1 pessoa; regras de bloqueio valem para o número inteiro
    SELECT a.tel,
           (array_agg(a.uid ORDER BY a.uid))[1] AS uid,
           (array_agg(a.palavra ORDER BY a.uid))[1] AS palavra,
           bool_or(a.optout) AS optout, bool_or(a.ja_nesta) AS ja_nesta,
           bool_or(a.em_pausa) AS em_pausa, bool_or(a.falhou_antes) AS falhou_antes
      FROM avaliados a
     GROUP BY a.tel
  ),
  elegiveis AS (
    SELECT * FROM grupos g WHERE NOT g.optout AND NOT g.ja_nesta AND NOT g.em_pausa
  ),
  lote AS (
    SELECT e.uid, e.palavra, e.tel, e.falhou_antes
      FROM elegiveis e
     ORDER BY e.falhou_antes, e.uid
     LIMIT p_limite
  )
  SELECT jsonb_build_object(
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', l.uid, 'primeira_palavra', l.palavra, 'telefone', l.tel)
                                        ORDER BY l.falhou_antes, l.uid) FROM lote l), '[]'::jsonb),
    'total_elegiveis', (SELECT count(*) FROM elegiveis),
    'excluidos_por_pausa', (SELECT count(*) FROM grupos g WHERE NOT g.optout AND NOT g.ja_nesta AND g.em_pausa)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- ---------------------------------------------------------------------
-- c) Registro de envio (service_role)
-- p_itens = [{user_id, resultado: 'enviado'|'falhou'}], até 100.
-- Idempotente por (campanha, user_id):
--   novo                 -> insere (enviado_em = now() se 'enviado')   = inseridos
--   'falhou' -> 'enviado'-> troca, enviado_em = now()                  = atualizados
--   'falhou' -> 'falhou' -> só atualizado_em                           = atualizados
--   'enviado' -> qualquer-> NADA muda (enviado_em fica; pausa não estica) = inalterados
-- Item ruim é rejeitado com o índice; os outros gravam.
-- Devolve {inseridos, atualizados, inalterados, rejeitadas:[{indice, erro}]}.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_contato_registrar(p_campanha text, p_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_i integer := -1;
  v_txt text;
  v_uid uuid;
  v_res text;
  v_erro text;
  v_vistos uuid[] := ARRAY[]::uuid[];
  v_inserido boolean;
  v_inseridos integer := 0;
  v_atualizados integer := 0;
  v_inalterados integer := 0;
  v_rejeitadas jsonb := '[]'::jsonb;
BEGIN
  IF p_campanha IS NULL OR p_campanha !~ '^[a-z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'campanha inválida' USING ERRCODE = '22023';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Lote inválido' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_itens) > 100 THEN
    RAISE EXCEPTION 'Lote grande (máximo de 100 itens)' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_itens) e LOOP
    v_i := v_i + 1;
    v_erro := NULL;
    v_uid := NULL;

    IF jsonb_typeof(v_item) <> 'object' THEN
      v_erro := 'nao_objeto';
    ELSE
      v_txt := CASE WHEN jsonb_typeof(v_item->'user_id') = 'string' THEN v_item->>'user_id' END;
      v_res := CASE WHEN jsonb_typeof(v_item->'resultado') = 'string' THEN v_item->>'resultado' END;
      IF v_txt IS NULL OR v_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_erro := 'user_id_invalido';
      ELSIF v_res IS NULL OR v_res NOT IN ('enviado', 'falhou') THEN
        v_erro := 'resultado_invalido';
      ELSE
        v_uid := v_txt::uuid;
        IF v_uid = ANY (v_vistos) THEN
          v_erro := 'duplicado_no_lote';
        ELSIF NOT EXISTS (SELECT 1 FROM public.profiles pf WHERE pf.user_id = v_uid) THEN
          v_erro := 'usuario_inexistente';
        END IF;
      END IF;
    END IF;

    IF v_erro IS NOT NULL THEN
      v_rejeitadas := v_rejeitadas || jsonb_build_object('indice', v_i, 'erro', v_erro);
      CONTINUE;
    END IF;
    v_vistos := v_vistos || v_uid;

    v_inserido := NULL;
    INSERT INTO public.crm_contato_campanha AS c (campanha, destinatario_user_id, resultado, enviado_em, atualizado_em)
    VALUES (p_campanha, v_uid, v_res, CASE WHEN v_res = 'enviado' THEN now() END, now())
    ON CONFLICT (campanha, destinatario_user_id) DO UPDATE
      SET resultado     = EXCLUDED.resultado,
          enviado_em    = EXCLUDED.enviado_em,
          atualizado_em = now()
      WHERE c.resultado = 'falhou'
    RETURNING (c.xmax = 0) INTO v_inserido;

    IF v_inserido IS NULL THEN
      v_inalterados := v_inalterados + 1;   -- já estava 'enviado'
    ELSIF v_inserido THEN
      v_inseridos := v_inseridos + 1;
    ELSE
      v_atualizados := v_atualizados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inseridos', v_inseridos, 'atualizados', v_atualizados, 'inalterados', v_inalterados,
    'rejeitadas', v_rejeitadas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_pagantes_contato(text, integer, integer, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_contato_registrar(text, jsonb)                   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_pagantes_contato(text, integer, integer, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_contato_registrar(text, jsonb)                   TO service_role;

COMMIT;
