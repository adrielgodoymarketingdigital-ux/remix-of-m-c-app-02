-- =====================================================================
-- Conferência da etapa 1 do i18n (rodar DEPOIS da migration 20261030120000).
-- Um único resultado (UNION ALL), ~30 linhas, só estrutura e contagens:
-- nenhum dado de cliente. Toda linha deve ter ok = true.
-- Antes da migration a consulta dá erro (as linhas 27/28 leem colunas novas).
-- =====================================================================
WITH
col AS (
  SELECT table_name || '.' || column_name AS nome,
         data_type || CASE is_nullable WHEN 'NO' THEN ' NOT NULL' ELSE ' NULL' END
           || ' default ' || COALESCE(column_default, '(nenhum)') AS def
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND ((table_name = 'profiles' AND column_name IN ('mercado', 'idioma'))
       OR (table_name = 'configuracoes_loja' AND column_name IN ('moeda', 'pais', 'fuso_horario')))
),
chk AS (
  SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass
     AND conname IN ('profiles_mercado_check', 'profiles_idioma_check')
),
trg AS (
  SELECT tgrelid::regclass::text AS tabela, tgname, tgenabled::text AS estado
    FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
),
fn AS (
  SELECT p.proname, p.prosecdef, p.provolatile::text AS vol, p.proconfig::text AS cfg, p.prosrc, p.oid
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('handle_new_user', 'get_mercado_loja', 'profiles_travar_mercado')
),
linhas (ordem, item, esperado, encontrado) AS (
  -- colunas
  SELECT 1, 'coluna profiles.mercado', 'text NOT NULL default ''BR''::text',
         (SELECT def FROM col WHERE nome = 'profiles.mercado')
  UNION ALL SELECT 2, 'coluna profiles.idioma', 'text NOT NULL default ''pt-BR''::text',
         (SELECT def FROM col WHERE nome = 'profiles.idioma')
  UNION ALL SELECT 3, 'coluna configuracoes_loja.moeda', 'text NOT NULL default ''BRL''::text',
         (SELECT def FROM col WHERE nome = 'configuracoes_loja.moeda')
  UNION ALL SELECT 4, 'coluna configuracoes_loja.pais', 'text NOT NULL default ''BR''::text',
         (SELECT def FROM col WHERE nome = 'configuracoes_loja.pais')
  UNION ALL SELECT 5, 'coluna configuracoes_loja.fuso_horario', 'text NOT NULL default ''America/Sao_Paulo''::text',
         (SELECT def FROM col WHERE nome = 'configuracoes_loja.fuso_horario')
  -- CHECKs
  UNION ALL SELECT 6, 'check profiles_mercado_check', 'BR, ES_LATAM, EN, IT',
         (SELECT CASE WHEN def LIKE '%''BR''%' AND def LIKE '%''ES_LATAM''%' AND def LIKE '%''EN''%' AND def LIKE '%''IT''%'
                      THEN 'BR, ES_LATAM, EN, IT' ELSE def END FROM chk WHERE conname = 'profiles_mercado_check')
  UNION ALL SELECT 7, 'check profiles_idioma_check', 'pt-BR, es, en, it',
         (SELECT CASE WHEN def LIKE '%''pt-BR''%' AND def LIKE '%''es''%' AND def LIKE '%''en''%' AND def LIKE '%''it''%'
                      THEN 'pt-BR, es, en, it' ELSE def END FROM chk WHERE conname = 'profiles_idioma_check')
  -- handle_new_user
  UNION ALL SELECT 8, 'handle_new_user SECURITY DEFINER', 'true',
         (SELECT prosecdef::text FROM fn WHERE proname = 'handle_new_user')
  UNION ALL SELECT 9, 'handle_new_user grava mercado e idioma', 'true',
         (SELECT (position('v_mercado' IN prosrc) > 0 AND position('v_idioma' IN prosrc) > 0)::text
            FROM fn WHERE proname = 'handle_new_user')
  UNION ALL SELECT 10, 'handle_new_user mantém nome/celular/fbc/fbp/fbclid/utm_*', 'true',
         (SELECT (prosrc LIKE '%''nome''%' AND prosrc LIKE '%''celular''%' AND prosrc LIKE '%''fbc''%'
                  AND prosrc LIKE '%''fbp''%' AND prosrc LIKE '%''fbclid''%' AND prosrc LIKE '%''utm_source''%'
                  AND prosrc LIKE '%''utm_medium''%' AND prosrc LIKE '%''utm_campaign''%'
                  AND prosrc LIKE '%''utm_content''%' AND prosrc LIKE '%''utm_term''%'
                  AND prosrc LIKE '%ON CONFLICT (user_id) DO UPDATE%')::text
            FROM fn WHERE proname = 'handle_new_user')
  -- gatilhos de cadastro (O = ligado)
  UNION ALL SELECT 11, 'gatilho auth.users on_auth_user_created', 'O',
         (SELECT estado FROM trg WHERE tabela = 'auth.users' AND tgname = 'on_auth_user_created')
  UNION ALL SELECT 12, 'gatilho auth.users on_auth_user_created_assinatura', 'O',
         (SELECT estado FROM trg WHERE tabela = 'auth.users' AND tgname = 'on_auth_user_created_assinatura')
  UNION ALL SELECT 13, 'gatilho auth.users trigger_notificar_novo_usuario', 'O',
         (SELECT estado FROM trg WHERE tabela = 'auth.users' AND tgname = 'trigger_notificar_novo_usuario')
  UNION ALL SELECT 14, 'total de gatilhos em auth.users', '3',
         (SELECT count(*)::text FROM trg WHERE tabela = 'auth.users')
  -- trava
  UNION ALL SELECT 15, 'gatilho profiles_travar_mercado_upd', 'O',
         (SELECT estado FROM trg WHERE tabela = 'profiles' AND tgname = 'profiles_travar_mercado_upd')
  UNION ALL SELECT 16, 'gatilho profiles_travar_mercado_ins', 'O',
         (SELECT estado FROM trg WHERE tabela = 'profiles' AND tgname = 'profiles_travar_mercado_ins')
  UNION ALL SELECT 17, 'gatilho update_profiles_updated_at (já existia)', 'O',
         (SELECT estado FROM trg WHERE tabela = 'profiles' AND tgname = 'update_profiles_updated_at')
  UNION ALL SELECT 18, 'profiles_travar_mercado é INVOKER', 'false',
         (SELECT prosecdef::text FROM fn WHERE proname = 'profiles_travar_mercado')
  UNION ALL SELECT 19, 'profiles_travar_mercado executável por authenticated', 'false',
         (SELECT has_function_privilege('authenticated', oid, 'EXECUTE')::text FROM fn WHERE proname = 'profiles_travar_mercado')
  -- get_mercado_loja
  UNION ALL SELECT 20, 'get_mercado_loja DEFINER / STABLE', 'true / s',
         (SELECT prosecdef::text || ' / ' || vol FROM fn WHERE proname = 'get_mercado_loja')
  UNION ALL SELECT 21, 'get_mercado_loja search_path', '{"search_path=public, pg_temp"}',
         (SELECT cfg FROM fn WHERE proname = 'get_mercado_loja')
  UNION ALL SELECT 22, 'get_mercado_loja executável por anon', 'false',
         (SELECT has_function_privilege('anon', oid, 'EXECUTE')::text FROM fn WHERE proname = 'get_mercado_loja')
  UNION ALL SELECT 23, 'get_mercado_loja executável por PUBLIC', 'false',
         (SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
                          WHERE p.oid = fn.oid AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text
            FROM fn WHERE proname = 'get_mercado_loja')
  UNION ALL SELECT 24, 'get_mercado_loja executável por authenticated', 'true',
         (SELECT has_function_privilege('authenticated', oid, 'EXECUTE')::text FROM fn WHERE proname = 'get_mercado_loja')
  -- RLS intocado (contagem de policies igual à de 2026-10-26)
  UNION ALL SELECT 25, 'policies em profiles (inalterado)', '6',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles')
  UNION ALL SELECT 26, 'policies em configuracoes_loja (inalterado)', '7',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'configuracoes_loja')
  -- dados: só contagens
  UNION ALL SELECT 27, 'profiles fora de BR / pt-BR (logo após aplicar)', '0',
         (SELECT count(*)::text FROM public.profiles WHERE mercado <> 'BR' OR idioma <> 'pt-BR')
  UNION ALL SELECT 28, 'configuracoes_loja fora de BRL / BR / America/Sao_Paulo', '0',
         (SELECT count(*)::text FROM public.configuracoes_loja
           WHERE moeda <> 'BRL' OR pais <> 'BR' OR fuso_horario <> 'America/Sao_Paulo')
  UNION ALL SELECT 29, 'cadastros das últimas 24h sem profile', '0',
         (SELECT count(*)::text FROM auth.users u
           WHERE u.created_at > now() - interval '24 hours'
             AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id))
  UNION ALL SELECT 30, 'cadastros das últimas 24h sem assinatura', '0',
         (SELECT count(*)::text FROM auth.users u
           WHERE u.created_at > now() - interval '24 hours'
             AND NOT EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.user_id = u.id))
)
SELECT ordem, item, esperado, COALESCE(encontrado, '(ausente)') AS encontrado,
       COALESCE(encontrado = esperado, false) AS ok
  FROM linhas
 ORDER BY ordem;
