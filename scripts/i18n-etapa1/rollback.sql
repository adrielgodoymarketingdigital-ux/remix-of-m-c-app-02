-- =====================================================================
-- REVERSÃO da migration 20261030120000_i18n_mercado_idioma_etapa1.sql
--
-- Ordem importa: handle_new_user volta ao corpo de 20260525000002 ANTES de
-- apagar as colunas (senão o próximo cadastro falharia ao gravar mercado).
--
-- Guarda: se já existir conta/loja fora do padrão BR, a reversão aborta,
-- porque apagaria rótulos verdadeiros. Nesse caso, fale com o Adriel antes.
-- Só serve enquanto o app ainda não lê essas colunas (etapas seguintes).
-- Idempotente, numa transação só.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 0) Guarda
DO $$
DECLARE
  v_qtd bigint := 0;
  v_tmp bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'mercado') THEN
    EXECUTE $q$SELECT count(*) FROM public.profiles WHERE mercado <> 'BR' OR idioma <> 'pt-BR'$q$ INTO v_tmp;
    v_qtd := v_qtd + v_tmp;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'configuracoes_loja' AND column_name = 'moeda') THEN
    EXECUTE $q$SELECT count(*) FROM public.configuracoes_loja
               WHERE moeda <> 'BRL' OR pais <> 'BR' OR fuso_horario <> 'America/Sao_Paulo'$q$ INTO v_tmp;
    v_qtd := v_qtd + v_tmp;
  END IF;
  IF v_qtd > 0 THEN
    RAISE EXCEPTION 'I18N-RB001: % linha(s) fora do padrão BR; a reversão apagaria esses rótulos. Nada foi alterado.', v_qtd;
  END IF;
END;
$$;

-- 1) handle_new_user exatamente como em 20260525000002 (e na produção em 2026-10-26)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, nome, email, celular,
    fbc, fbp, fbclid,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term
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
    NEW.raw_user_meta_data->>'utm_term'
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

-- 2) Trava e função de leitura (sem CASCADE: se algo novo depender delas, para aqui)
DROP TRIGGER IF EXISTS profiles_travar_mercado_upd ON public.profiles;
DROP TRIGGER IF EXISTS profiles_travar_mercado_ins ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_travar_mercado();
DROP FUNCTION IF EXISTS public.get_mercado_loja();

-- 3) Colunas
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_mercado_check,
  DROP CONSTRAINT IF EXISTS profiles_idioma_check,
  DROP COLUMN IF EXISTS mercado,
  DROP COLUMN IF EXISTS idioma;

ALTER TABLE public.configuracoes_loja
  DROP COLUMN IF EXISTS moeda,
  DROP COLUMN IF EXISTS pais,
  DROP COLUMN IF EXISTS fuso_horario;

-- 4) Conferência
DO $$
DECLARE
  v_src text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND ((table_name = 'profiles' AND column_name IN ('mercado', 'idioma'))
                  OR (table_name = 'configuracoes_loja' AND column_name IN ('moeda', 'pais', 'fuso_horario')))) THEN
    RAISE EXCEPTION 'I18N-RB002: ainda há coluna da etapa 1';
  END IF;
  IF to_regprocedure('public.get_mercado_loja()') IS NOT NULL
     OR to_regprocedure('public.profiles_travar_mercado()') IS NOT NULL THEN
    RAISE EXCEPTION 'I18N-RB003: ainda há função da etapa 1';
  END IF;
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.handle_new_user()'::regprocedure AND prosecdef;
  IF v_src IS NULL OR position('mercado' IN v_src) > 0 OR position('utm_term' IN v_src) = 0 THEN
    RAISE EXCEPTION 'I18N-RB004: handle_new_user não voltou ao corpo anterior';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass
                  AND tgname = 'on_auth_user_created' AND tgenabled <> 'D') THEN
    RAISE EXCEPTION 'I18N-RB005: gatilho on_auth_user_created ausente';
  END IF;
  RAISE NOTICE 'I18N ROLLBACK OK';
END;
$$;

COMMIT;
