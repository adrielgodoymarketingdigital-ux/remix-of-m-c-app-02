-- =====================================================================
-- admin_notifications.tipo: aceitar todos os tipos que o código grava
-- (aplicar à mão no SQL Editor; NUNCA `supabase db push`)
--
-- Problema: admin_notifications_tipo_check só aceita os 5 tipos de
-- 20260215152816 (mais os 2 da Hotmart, se 20261101120000 já rodou). Todo
-- aviso com outro tipo é rejeitado pelo banco e o supabase-js devolve o erro
-- sem lançar, então nunca chegou ao admin: falha ao cancelar assinatura na
-- Pagar.me, webhook não confirmado, nova assinatura por cartão, Ticto,
-- Hotmart, bloqueio/exclusão de usuário etc.
--
-- O que faz: troca a CHECK por uma lista com os 5 originais + os 2 da
-- Hotmart + 20 tipos que as Edge Functions gravam hoje (27 no total).
-- A lista só cresce; nenhuma linha muda.
-- Fica de fora, por decisão: novo_cadastro_notif (notificar-novo-cadastro),
-- que continua recusado como hoje.
--
-- Guardas (abortam sem mudar nada):
--   ANT001  a CHECK atual não existe ou não tem o formato tipo = ANY(ARRAY[...]);
--   ANT002  a lista atual não é a esperada: tem que conter os 5 originais e
--           só eles, mais (opcionalmente) os 2 da Hotmart — ou já ser a
--           lista nova (reexecução);
--   ANT003  há linha gravada com tipo fora da lista nova;
--   ANT004  existe gatilho em admin_notifications (ex.: Database Webhook do
--           painel, que dispara envio externo a cada INSERT). Nenhum consta
--           nas migrations; se aparecer, traga o pg_get_triggerdef antes.
-- Autoverificação (desfaz tudo se falhar):
--   ANT010  CHECK nova ausente, não validada ou com outra lista;
--   ANT011  outras restrições, gatilhos, policies, RLS ou nº de linhas mudaram.
--
-- Ordem com a migration da Hotmart (20261101120000): se ela ainda for ser
-- aplicada, aplique-a ANTES desta. Depois desta, a guarda HOT008 dela aborta
-- (lista diferente de 5/7) e o rollback da Hotmart também não passaria.
--
-- Idempotente, numa transação só.
--
-- ---------------------------------------------------------------------
-- REVERSÃO (rodar à mão; volta à lista anterior SEM apagar avisos):
-- A CHECK antiga volta como NOT VALID: as linhas já gravadas com tipos
-- novos ficam, e só os INSERTs a partir dali voltam a ser barrados.
-- A lista anterior é a de 7 se a coluna da Hotmart existe, senão a de 5.
--
--   BEGIN;
--   SET LOCAL lock_timeout = '5s';
--   LOCK TABLE public.admin_notifications IN ACCESS EXCLUSIVE MODE;
--   ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_tipo_check;
--   DO $$
--   BEGIN
--     IF EXISTS (SELECT 1 FROM information_schema.columns
--                 WHERE table_schema = 'public' AND table_name = 'assinaturas'
--                   AND column_name = 'hotmart_transaction_id') THEN
--       ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
--         CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou',
--                                  'push_enviado', 'hotmart_oferta_nao_mapeada', 'hotmart_config_invalida']))
--         NOT VALID;
--     ELSE
--       ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
--         CHECK (tipo = ANY (ARRAY['novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou',
--                                  'push_enviado']))
--         NOT VALID;
--     END IF;
--   END;
--   $$;
--   SELECT pg_get_constraintdef(oid), convalidated FROM pg_constraint
--    WHERE conrelid = 'public.admin_notifications'::regclass
--      AND conname = 'admin_notifications_tipo_check';
--   COMMIT;
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

LOCK TABLE public.admin_notifications IN ACCESS EXCLUSIVE MODE;

-- Lista nova (ordem: 5 originais, 2 da Hotmart, depois por origem).
CREATE TEMP TABLE _ant_tipos (ordem int PRIMARY KEY, tipo text NOT NULL UNIQUE) ON COMMIT DROP;
INSERT INTO _ant_tipos (ordem, tipo) VALUES
  -- originais (20260215152816)
  ( 1, 'novo_trial'),
  ( 2, 'nova_assinatura'),
  ( 3, 'cancelamento'),
  ( 4, 'pagamento_falhou'),
  ( 5, 'push_enviado'),
  -- Hotmart (20261101120000)
  ( 6, 'hotmart_oferta_nao_mapeada'),
  ( 7, 'hotmart_config_invalida'),
  -- Pagar.me / assinatura
  ( 8, 'nova_assinatura_cartao'),        -- create-pagarme-subscription
  ( 9, 'trial_cancelado'),               -- cancel-subscription
  (10, 'cancelamento_cartao_falhou'),    -- _shared/pagarmeAssinatura, create-pagarme-subscription
  (11, 'cancelamento_pagarme_falhou'),   -- cancel-pagarme-subscription, cancel-subscription
  (12, 'webhook_nao_confirmado'),        -- pagarme-webhook
  (13, 'falha_cartao_ignorada'),         -- pagarme-webhook
  -- Ticto
  (14, 'ticto_usuario_nao_encontrado'),
  (15, 'mudanca_plano'),                 -- ticto-webhook e hotmart-webhook
  (16, 'nova_assinatura_ticto'),
  (17, 'cancelamento_ticto'),
  (18, 'cancelamento_ticto_ignorado'),
  (19, 'reembolso_ticto'),
  -- Hotmart (demais)
  (20, 'hotmart_usuario_nao_encontrado'),
  (21, 'nova_assinatura_hotmart'),
  (22, 'cancelamento_hotmart'),
  (23, 'cancelamento_hotmart_ignorado'),
  (24, 'reembolso_hotmart'),
  -- Admin
  (25, 'bloqueio_usuario'),              -- admin-block-user
  (26, 'desbloqueio_usuario'),           -- admin-block-user
  (27, 'usuario_deletado');              -- admin-delete-user


-- ---------------------------------------------------------------------
-- 0) Guardas
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_def        text;
  v_atual      text[];
  v_originais  text[] := ARRAY['cancelamento', 'nova_assinatura', 'novo_trial', 'pagamento_falhou', 'push_enviado'];
  v_hotmart    text[] := ARRAY['hotmart_config_invalida', 'hotmart_oferta_nao_mapeada'];
  v_nova       text[];
  v_fora       text;
  v_gatilhos   text;
BEGIN
  SELECT array_agg(tipo ORDER BY tipo) INTO v_nova FROM _ant_tipos;

  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.admin_notifications'::regclass
     AND c.conname = 'admin_notifications_tipo_check' AND c.contype = 'c';
  -- NOT VALID é aceito: é como a reversão abaixo deixa a CHECK.
  IF v_def IS NULL OR v_def !~ '^CHECK \(\(tipo = ANY \(ARRAY\[.*\]\)\)\)( NOT VALID)?$' THEN
    RAISE EXCEPTION 'ANT001: admin_notifications_tipo_check ausente ou com formato inesperado: %', v_def;
  END IF;

  SELECT array_agg(DISTINCT m[1] ORDER BY m[1]) INTO v_atual
    FROM regexp_matches(v_def, '''([^'']*)''', 'g') m;

  -- Aceita: os 5 originais (+ 0, 1 ou 2 da Hotmart), ou já a lista nova.
  IF NOT (
       v_atual = v_nova
       OR (v_atual @> v_originais AND v_atual <@ (v_originais || v_hotmart))
     ) THEN
    RAISE EXCEPTION 'ANT002: lista atual da CHECK diferente da esperada (alguém já mexeu?): %', v_atual;
  END IF;

  SELECT string_agg(DISTINCT n.tipo, ', ' ORDER BY n.tipo) INTO v_fora
    FROM public.admin_notifications n
   WHERE n.tipo NOT IN (SELECT tipo FROM _ant_tipos);
  IF v_fora IS NOT NULL THEN
    RAISE EXCEPTION 'ANT003: há aviso(s) gravado(s) com tipo fora da lista nova: %', v_fora;
  END IF;

  SELECT string_agg(g.tgname::text, ', ' ORDER BY g.tgname) INTO v_gatilhos
    FROM pg_trigger g
   WHERE g.tgrelid = 'public.admin_notifications'::regclass AND NOT g.tgisinternal;
  IF v_gatilhos IS NOT NULL THEN
    RAISE EXCEPTION 'ANT004: admin_notifications tem gatilho(s) (%): traga o pg_get_triggerdef antes de ampliar os tipos', v_gatilhos;
  END IF;
END;
$$;


-- Foto do que não pode mudar (antes/depois usam a mesma consulta).
CREATE TEMP VIEW _ant_estrutura AS
  SELECT 'restricao' AS tipo, k.conname::text || '|' || pg_get_constraintdef(k.oid) AS def
    FROM pg_constraint k
   WHERE k.conrelid = 'public.admin_notifications'::regclass
     AND k.conname <> 'admin_notifications_tipo_check'
  UNION ALL
  SELECT 'gatilho', g.tgname::text || '|' || g.tgenabled::text || '|' || pg_get_triggerdef(g.oid)
    FROM pg_trigger g
   WHERE g.tgrelid = 'public.admin_notifications'::regclass AND NOT g.tgisinternal
  UNION ALL
  SELECT 'policy', policyname::text || '|' || cmd || '|' || roles::text || '|'
         || COALESCE(qual, '') || '|' || COALESCE(with_check, '')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_notifications'
  UNION ALL
  SELECT 'rls', c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
    FROM pg_class c WHERE c.oid = 'public.admin_notifications'::regclass
  UNION ALL
  SELECT 'linhas', count(*)::text FROM public.admin_notifications;

CREATE TEMP TABLE _ant_antes ON COMMIT DROP AS SELECT * FROM _ant_estrutura;


-- ---------------------------------------------------------------------
-- 1) CHECK nova
-- ---------------------------------------------------------------------
ALTER TABLE public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_tipo_check;
ALTER TABLE public.admin_notifications ADD CONSTRAINT admin_notifications_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'novo_trial', 'nova_assinatura', 'cancelamento', 'pagamento_falhou', 'push_enviado',
    'hotmart_oferta_nao_mapeada', 'hotmart_config_invalida',
    'nova_assinatura_cartao', 'trial_cancelado', 'cancelamento_cartao_falhou',
    'cancelamento_pagarme_falhou', 'webhook_nao_confirmado', 'falha_cartao_ignorada',
    'ticto_usuario_nao_encontrado', 'mudanca_plano', 'nova_assinatura_ticto',
    'cancelamento_ticto', 'cancelamento_ticto_ignorado', 'reembolso_ticto',
    'hotmart_usuario_nao_encontrado', 'nova_assinatura_hotmart', 'cancelamento_hotmart',
    'cancelamento_hotmart_ignorado', 'reembolso_hotmart',
    'bloqueio_usuario', 'desbloqueio_usuario', 'usuario_deletado'
  ]));


-- ---------------------------------------------------------------------
-- 2) Autoverificação: qualquer divergência desfaz a transação inteira.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_def   text;
  v_lista text[];
  v_nova  text[];
  v_falta text;
BEGIN
  SELECT array_agg(tipo ORDER BY tipo) INTO v_nova FROM _ant_tipos;

  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.admin_notifications'::regclass
     AND c.conname = 'admin_notifications_tipo_check' AND c.contype = 'c' AND c.convalidated;
  SELECT array_agg(DISTINCT m[1] ORDER BY m[1]) INTO v_lista
    FROM regexp_matches(v_def, '''([^'']*)''', 'g') m;
  IF v_def IS NULL OR v_def NOT LIKE 'CHECK ((tipo = ANY (ARRAY[%])))' OR v_lista IS DISTINCT FROM v_nova THEN
    RAISE EXCEPTION 'ANT010: admin_notifications_tipo_check ausente, não validada ou com outra lista: %', v_def;
  END IF;

  SELECT string_agg(tipo || ': ' || def, ' ; ') INTO v_falta FROM (
    (SELECT 'sumiu/mudou ' || tipo AS tipo, def FROM
       (SELECT * FROM _ant_antes EXCEPT ALL SELECT * FROM _ant_estrutura) x)
    UNION ALL
    (SELECT 'apareceu ' || tipo, def FROM
       (SELECT * FROM _ant_estrutura EXCEPT ALL SELECT * FROM _ant_antes) y)
  ) d;
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'ANT011: estrutura de admin_notifications mudou além da CHECK: %', v_falta;
  END IF;
END;
$$;

DROP VIEW _ant_estrutura;

COMMIT;


-- ---------------------------------------------------------------------
-- 3) Conferência (só leitura): a regra nova e se está validada.
-- ---------------------------------------------------------------------
SELECT conname, convalidated, pg_get_constraintdef(oid) AS regra
  FROM pg_constraint
 WHERE conrelid = 'public.admin_notifications'::regclass
   AND conname = 'admin_notifications_tipo_check';
