-- =====================================================================
-- Internacionalização — ETAPA 1 (somente banco): mercado, idioma e
-- configuração regional da conta
--
-- Mercado é só um rótulo da conta (BR / ES_LATAM / EN / IT). O isolamento
-- continua por user_id: NENHUMA policy de RLS muda aqui, e configuracoes_loja
-- não é tocada (só ~38% dos donos têm linha nela; profiles existe para todos).
--
--   1) profiles: mercado ('BR'), idioma ('pt-BR'), pais ('BR'), moeda ('BRL'),
--      fuso_horario ('America/Sao_Paulo'), todas NOT NULL. Os usuários atuais
--      ficam todos BR pelo DEFAULT. CHECK só em mercado e idioma.
--   2) handle_new_user(): igual à de 20260525000002 (confere com a produção
--      em 2026-10-26) + grava mercado e idioma do signUp (options.data).
--      Valor ausente ou fora da lista cai no padrão; o cadastro nunca falha.
--      pais, moeda e fuso nascem pelo DEFAULT para qualquer mercado; o valor
--      certo de quem não é BR vem depois, por admin/service_role
--      (ex.: provisionar-conta). Nada é deduzido do mercado aqui.
--   3) Trava: quem vem do app (anon/authenticated) não muda o próprio mercado,
--      pais, moeda nem fuso_horario. UPDATE mantém os valores antigos; INSERT
--      direto pelo app (só possível apagando o próprio perfil antes) nasce
--      com os padrões BR. idioma continua livre. Admin, service_role, SQL
--      Editor e o cadastro passam livres.
--   4) get_mercado_loja(): mercado da loja de quem chama. Funcionário herda
--      do dono, gerente de filial herda do proprietário da matriz.
--
-- Idempotente, numa transação só. Reversão em
-- scripts/i18n-etapa1/rollback.sql; conferência em
-- scripts/i18n-etapa1/verificacao.sql.
-- =====================================================================

BEGIN;

-- profiles é lida em toda tela: se algo segurar a tabela, desiste em vez de
-- enfileirar o app inteiro atrás do ALTER.
SET LOCAL lock_timeout = '5s';


-- ---------------------------------------------------------------------
-- 1) profiles: mercado, idioma, pais, moeda, fuso_horario
--    ADD COLUMN com DEFAULT constante não reescreve a tabela (PG 11+).
--    O segundo ALTER só garante default/NOT NULL numa reexecução.
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mercado      text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS idioma       text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS pais         text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS moeda        text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS fuso_horario text NOT NULL DEFAULT 'America/Sao_Paulo';

ALTER TABLE public.profiles
  ALTER COLUMN mercado      SET DEFAULT 'BR',
  ALTER COLUMN mercado      SET NOT NULL,
  ALTER COLUMN idioma       SET DEFAULT 'pt-BR',
  ALTER COLUMN idioma       SET NOT NULL,
  ALTER COLUMN pais         SET DEFAULT 'BR',
  ALTER COLUMN pais         SET NOT NULL,
  ALTER COLUMN moeda        SET DEFAULT 'BRL',
  ALTER COLUMN moeda        SET NOT NULL,
  ALTER COLUMN fuso_horario SET DEFAULT 'America/Sao_Paulo',
  ALTER COLUMN fuso_horario SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_mercado_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_mercado_check
  CHECK (mercado IN ('BR', 'ES_LATAM', 'EN', 'IT'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_idioma_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_idioma_check
  CHECK (idioma IN ('pt-BR', 'es', 'en', 'it'));

COMMENT ON COLUMN public.profiles.mercado IS
  'Mercado da conta (BR, ES_LATAM, EN, IT). Gravado no cadastro; o próprio usuário não altera (trigger profiles_travar_mercado).';
COMMENT ON COLUMN public.profiles.idioma IS
  'Idioma da interface (pt-BR, es, en, it). O usuário pode alterar.';
COMMENT ON COLUMN public.profiles.pais IS
  'País da conta. Padrão BR; só admin/service_role altera (trigger profiles_travar_mercado).';
COMMENT ON COLUMN public.profiles.moeda IS
  'Moeda da conta. Padrão BRL; só admin/service_role altera (trigger profiles_travar_mercado).';
COMMENT ON COLUMN public.profiles.fuso_horario IS
  'Fuso da conta. Padrão America/Sao_Paulo; só admin/service_role altera (trigger profiles_travar_mercado).';


-- ---------------------------------------------------------------------
-- 2) handle_new_user(): corpo igual ao de 20260525000002 + mercado/idioma.
--    O ON CONFLICT continua sem tocar nas colunas novas (perfil que já
--    existia fica como está).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  -- Fora da lista (ou ausente, ou metadata nula) cai no padrão: o cadastro
  -- nunca falha por causa desses dois campos.
  v_mercado text := CASE
    WHEN NEW.raw_user_meta_data->>'mercado' IN ('BR', 'ES_LATAM', 'EN', 'IT')
      THEN NEW.raw_user_meta_data->>'mercado'
    ELSE 'BR'
  END;
  v_idioma text := CASE
    WHEN NEW.raw_user_meta_data->>'idioma' IN ('pt-BR', 'es', 'en', 'it')
      THEN NEW.raw_user_meta_data->>'idioma'
    ELSE 'pt-BR'
  END;
BEGIN
  INSERT INTO public.profiles (
    user_id, nome, email, celular,
    fbc, fbp, fbclid,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    mercado, idioma
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'celular',
    NEW.raw_user_meta_data->>'fbc',
    NEW.raw_user_meta_data->>'fbp',
    NEW.raw_user_meta_data->>'fbclid',
    NEW.raw_user_meta_data->>'utm_source',
    NEW.raw_user_meta_data->>'utm_medium',
    NEW.raw_user_meta_data->>'utm_campaign',
    NEW.raw_user_meta_data->>'utm_content',
    NEW.raw_user_meta_data->>'utm_term',
    v_mercado,
    v_idioma
  )
  ON CONFLICT (user_id) DO UPDATE SET
    celular      = COALESCE(EXCLUDED.celular,      profiles.celular),
    fbc          = COALESCE(EXCLUDED.fbc,          profiles.fbc),
    fbp          = COALESCE(EXCLUDED.fbp,          profiles.fbp),
    fbclid       = COALESCE(EXCLUDED.fbclid,       profiles.fbclid),
    utm_source   = COALESCE(EXCLUDED.utm_source,   profiles.utm_source),
    utm_medium   = COALESCE(EXCLUDED.utm_medium,   profiles.utm_medium),
    utm_campaign = COALESCE(EXCLUDED.utm_campaign, profiles.utm_campaign),
    utm_content  = COALESCE(EXCLUDED.utm_content,  profiles.utm_content),
    utm_term     = COALESCE(EXCLUDED.utm_term,     profiles.utm_term);
  RETURN NEW;
END;
$function$;


-- ---------------------------------------------------------------------
-- 3) Trava de mercado, pais, moeda e fuso_horario (idioma fica livre)
--    SECURITY INVOKER de propósito: current_user precisa ser quem chamou.
--    - Pedido do app (PostgREST): current_user = anon/authenticated.
--    - Função SECURITY DEFINER chamada pelo app: current_user = postgres,
--      mas auth.role() continua 'authenticated' -> também trava.
--    - Cadastro (GoTrue -> handle_new_user): current_user = postgres e sem
--      JWT -> livre. Edge Function com service_role, SQL Editor -> livres.
--    - Admin do MecApp (has_role 'admin') -> livre.
--    Os gatilhos só disparam quando há algo a travar (WHEN), então os UPDATE
--    de sempre (crm_stage, preferencias_os, login...) nem chamam a função.
--    Trigger não confere EXECUTE na hora de disparar: a função fica fechada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_travar_mercado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Só INSERT direto do app; o cadastro passa por handle_new_user como postgres.
    IF current_user IN ('anon', 'authenticated')
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.mercado      := 'BR';
      NEW.pais         := 'BR';
      NEW.moeda        := 'BRL';
      NEW.fuso_horario := 'America/Sao_Paulo';
    END IF;
    RETURN NEW;
  END IF;

  IF (current_user IN ('anon', 'authenticated')
      OR COALESCE(auth.role(), '') IN ('anon', 'authenticated'))
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.mercado      := OLD.mercado;
    NEW.pais         := OLD.pais;
    NEW.moeda        := OLD.moeda;
    NEW.fuso_horario := OLD.fuso_horario;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_travar_mercado() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS profiles_travar_mercado_upd ON public.profiles;
CREATE TRIGGER profiles_travar_mercado_upd
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN ((NEW.mercado, NEW.pais, NEW.moeda, NEW.fuso_horario)
        IS DISTINCT FROM (OLD.mercado, OLD.pais, OLD.moeda, OLD.fuso_horario))
  EXECUTE FUNCTION public.profiles_travar_mercado();

DROP TRIGGER IF EXISTS profiles_travar_mercado_ins ON public.profiles;
CREATE TRIGGER profiles_travar_mercado_ins
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN ((NEW.mercado, NEW.pais, NEW.moeda, NEW.fuso_horario)
        IS DISTINCT FROM ('BR'::text, 'BR'::text, 'BRL'::text, 'America/Sao_Paulo'::text))
  EXECUTE FUNCTION public.profiles_travar_mercado();


-- ---------------------------------------------------------------------
-- 4) get_mercado_loja(): mesmo molde de get_loja_owner_id()
--    funcionário ativo -> dono; gerente de filial -> proprietário da matriz
--    (mesma ordem de storage_mesma_loja); senão, o próprio usuário.
--    Sem perfil: 'BR'. Sem login: NULL.
--    plpgsql só valida as colunas ao executar: a autoverificação abaixo
--    confere as colunas e roda a função de verdade.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mercado_loja()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dono    uuid;
  v_matriz  uuid;
  v_mercado text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  v_dono := public.get_loja_owner_id();

  IF v_dono = auth.uid() THEN
    SELECT eu.proprietario_id INTO v_matriz
      FROM public.empresa_usuarios eu
     WHERE eu.gerente_id = auth.uid()
       AND eu.proprietario_id IS NOT NULL
     ORDER BY eu.ativa DESC NULLS LAST, eu.created_at
     LIMIT 1;
    v_dono := COALESCE(v_matriz, v_dono);
  END IF;

  SELECT p.mercado INTO v_mercado
    FROM public.profiles p
   WHERE p.user_id = v_dono;

  RETURN COALESCE(v_mercado, 'BR');
END;
$$;

REVOKE ALL ON FUNCTION public.get_mercado_loja() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mercado_loja() TO authenticated;


-- ---------------------------------------------------------------------
-- 5) Autoverificação: qualquer divergência desfaz a transação inteira.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r        record;
  v_src    text;
  v_def    text;
  v_falta  text;
  v_claims text;
  v_res    text;
BEGIN
  -- colunas novas: tipo, NOT NULL e default
  FOR r IN
    SELECT * FROM (VALUES
      ('mercado',      '''BR''::text'),
      ('idioma',       '''pt-BR''::text'),
      ('pais',         '''BR''::text'),
      ('moeda',        '''BRL''::text'),
      ('fuso_horario', '''America/Sao_Paulo''::text')
    ) AS t(coluna, padrao)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
         AND c.column_name = r.coluna AND c.data_type = 'text'
         AND c.is_nullable = 'NO' AND c.column_default = r.padrao
    ) THEN
      RAISE EXCEPTION 'I18N001: coluna profiles.% ausente ou com tipo/NOT NULL/default errado', r.coluna;
    END IF;
  END LOOP;

  -- CHECKs
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_mercado_check';
  IF v_def IS NULL OR v_def NOT LIKE '%''BR''%' OR v_def NOT LIKE '%''ES_LATAM''%'
     OR v_def NOT LIKE '%''EN''%' OR v_def NOT LIKE '%''IT''%' THEN
    RAISE EXCEPTION 'I18N002: profiles_mercado_check ausente ou incompleta: %', v_def;
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_idioma_check';
  IF v_def IS NULL OR v_def NOT LIKE '%''pt-BR''%' OR v_def NOT LIKE '%''es''%'
     OR v_def NOT LIKE '%''en''%' OR v_def NOT LIKE '%''it''%' THEN
    RAISE EXCEPTION 'I18N003: profiles_idioma_check ausente ou incompleta: %', v_def;
  END IF;

  -- handle_new_user: tudo o que já fazia + mercado/idioma, ainda DEFINER
  SELECT p.prosrc INTO v_src FROM pg_proc p
   WHERE p.oid = 'public.handle_new_user()'::regprocedure AND p.prosecdef;
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'I18N004: handle_new_user ausente ou sem SECURITY DEFINER';
  END IF;
  SELECT string_agg(k, ', ') INTO v_falta
    FROM unnest(ARRAY['nome', 'celular', 'fbc', 'fbp', 'fbclid', 'utm_source',
                      'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                      'v_mercado', 'v_idioma', 'ON CONFLICT (user_id)']) k
   WHERE position(k IN v_src) = 0;
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'I18N005: handle_new_user sem: %', v_falta;
  END IF;

  -- gatilhos de cadastro em auth.users (os dois que estão no repositório)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass
                  AND tgname = 'on_auth_user_created' AND tgenabled <> 'D'
                  AND tgfoid = 'public.handle_new_user()'::regprocedure) THEN
    RAISE EXCEPTION 'I18N006: gatilho on_auth_user_created ausente ou desligado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass
                  AND tgname = 'on_auth_user_created_assinatura' AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'I18N007: gatilho on_auth_user_created_assinatura ausente ou desligado';
  END IF;
  -- o de notificação existe só na produção (não está em nenhuma migration)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass
                  AND tgname = 'trigger_notificar_novo_usuario' AND tgenabled <> 'D') THEN
    RAISE WARNING 'I18N008: gatilho trigger_notificar_novo_usuario não encontrado (esperado só fora da produção)';
  END IF;

  -- trava: os dois gatilhos ligados, função fechada e INVOKER
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass
       AND tgname IN ('profiles_travar_mercado_upd', 'profiles_travar_mercado_ins')
       AND tgenabled <> 'D'
       AND tgfoid = 'public.profiles_travar_mercado()'::regprocedure) <> 2 THEN
    RAISE EXCEPTION 'I18N009: gatilhos da trava ausentes ou desligados';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.profiles_travar_mercado()'::regprocedure) THEN
    RAISE EXCEPTION 'I18N010: profiles_travar_mercado não pode ser SECURITY DEFINER (perde o current_user)';
  END IF;
  IF has_function_privilege('anon', 'public.profiles_travar_mercado()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.profiles_travar_mercado()', 'EXECUTE') THEN
    RAISE EXCEPTION 'I18N011: profiles_travar_mercado aberta para anon/authenticated';
  END IF;

  -- get_mercado_loja: DEFINER, search_path fixo, só authenticated executa
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.get_mercado_loja()'::regprocedure
                  AND prosecdef AND provolatile = 's'
                  AND proconfig::text LIKE '%search_path=public, pg_temp%') THEN
    RAISE EXCEPTION 'I18N012: get_mercado_loja ausente, sem DEFINER/STABLE ou sem search_path';
  END IF;
  IF has_function_privilege('anon', 'public.get_mercado_loja()', 'EXECUTE') THEN
    RAISE EXCEPTION 'I18N013: get_mercado_loja aberta para anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.oid = 'public.get_mercado_loja()'::regprocedure
                AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'I18N014: get_mercado_loja aberta para PUBLIC';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_mercado_loja()', 'EXECUTE') THEN
    RAISE EXCEPTION 'I18N015: get_mercado_loja sem EXECUTE para authenticated';
  END IF;

  -- get_mercado_loja: colunas que ela (e get_loja_owner_id) leem
  SELECT string_agg(t.tabela || '.' || t.coluna, ', ') INTO v_falta
    FROM (VALUES
      ('empresa_usuarios',  'gerente_id'),
      ('empresa_usuarios',  'proprietario_id'),
      ('empresa_usuarios',  'ativa'),
      ('empresa_usuarios',  'created_at'),
      ('loja_funcionarios', 'loja_user_id'),
      ('loja_funcionarios', 'funcionario_user_id'),
      ('loja_funcionarios', 'ativo')
    ) AS t(tabela, coluna)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public'
                        AND c.table_name = t.tabela AND c.column_name = t.coluna);
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'I18N016: get_mercado_loja depende de coluna inexistente: %', v_falta;
  END IF;
  IF to_regprocedure('public.get_loja_owner_id()') IS NULL THEN
    RAISE EXCEPTION 'I18N017: get_loja_owner_id() não existe';
  END IF;

  -- get_mercado_loja de verdade, com um uid que não existe: percorre as três
  -- consultas (funcionário, filial, perfil) e tem de responder 'BR'.
  -- O JWT falso vale só aqui e é desfeito logo em seguida.
  v_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
  BEGIN
    v_res := public.get_mercado_loja();
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
    RAISE EXCEPTION 'I18N018: get_mercado_loja falhou ao executar: %', SQLERRM;
  END;
  PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
  IF v_res IS DISTINCT FROM 'BR' THEN
    RAISE EXCEPTION 'I18N019: get_mercado_loja devolveu % para uid inexistente (esperado BR)', v_res;
  END IF;

  RAISE NOTICE 'I18N OK: etapa 1 aplicada e conferida';
END;
$$;

COMMIT;
