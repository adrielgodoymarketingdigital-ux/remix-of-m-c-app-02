-- =====================================================================
-- CRM de leads — FASE 2A — VERIFICAÇÃO depois da migration
-- 20261122120000_crm_leads_2a_gasto_meta_anuncio.sql. SOMENTE LEITURA.
-- Esperado: todas as linhas com ok = true (a 9 é informativa: anotar).
-- (No SQL Editor auth.uid() é nulo: chamar admin_crm_funil_gasto aqui DEVE
--  dar "Apenas administradores...".)
-- =====================================================================
WITH f AS (
  SELECT p.oid, p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS ret,
         p.prosecdef AND p.proconfig @> ARRAY['search_path=public'] AS definer_fixo,
         p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) AS public_executa
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_teste',
                       'crm_gravar_gasto_meta', 'admin_crm_funil_gasto', 'admin_crm_funil_gasto_por_anuncio')
), novas AS (SELECT * FROM f WHERE proname IN ('crm_gravar_gasto_meta', 'admin_crm_funil_gasto', 'admin_crm_funil_gasto_por_anuncio'))
SELECT * FROM (VALUES
  ('1. funções da 1D NÃO mudaram (funil / por anúncio / teste)',
     (SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_teste')),
     '68c3b2319c99ffb294432887dbb392db / 91a2786178ab291e7bafda361529c768 / b761af836793047661ad77a9fb7a0601',
     coalesce((SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_teste'))
       = '68c3b2319c99ffb294432887dbb392db / 91a2786178ab291e7bafda361529c768 / b761af836793047661ad77a9fb7a0601', false)),
  ('2. funções da 2A = versão do repositório (gasto / gasto por anúncio / gravar)',
     (SELECT string_agg(h, ' / ' ORDER BY proname) FROM novas),
     '24be4e3ef0ad1e15faed84e42b8522e7 / 3ef7774f880789f53217111cd7f02c17 / 1591a093ebeec9df263b38bd88b46190',
     coalesce((SELECT string_agg(h, ' / ' ORDER BY proname) FROM novas) = '24be4e3ef0ad1e15faed84e42b8522e7 / 3ef7774f880789f53217111cd7f02c17 / 1591a093ebeec9df263b38bd88b46190', false)),
  ('3. funções da 2A: SECURITY DEFINER com search_path fixo, sem EXECUTE para PUBLIC',
     (SELECT string_agg(proname || ' ' || definer_fixo || '/' || public_executa, ', ' ORDER BY proname) FROM novas),
     'admin_crm_funil_gasto true/false, admin_crm_funil_gasto_por_anuncio true/false, crm_gravar_gasto_meta true/false',
     coalesce((SELECT count(*) = 3 AND bool_and(definer_fixo AND NOT public_executa) FROM novas), false)),
  ('4. gravar: só service_role (anon e authenticated não executam)',
     (SELECT has_function_privilege('service_role', oid, 'EXECUTE') || ' / ' || has_function_privilege('anon', oid, 'EXECUTE')
             || ' / ' || has_function_privilege('authenticated', oid, 'EXECUTE') FROM novas WHERE proname = 'crm_gravar_gasto_meta'),
     'true / false / false',
     coalesce((SELECT has_function_privilege('service_role', oid, 'EXECUTE') AND NOT has_function_privilege('anon', oid, 'EXECUTE')
                  AND NOT has_function_privilege('authenticated', oid, 'EXECUTE') FROM novas WHERE proname = 'crm_gravar_gasto_meta'), false)),
  ('5. funções do card: authenticated sim (has_role dentro), anon não',
     (SELECT string_agg(has_function_privilege('authenticated', oid, 'EXECUTE') || '/' || has_function_privilege('anon', oid, 'EXECUTE'), ', ' ORDER BY proname)
        FROM novas WHERE proname LIKE 'admin_%'),
     'true/false, true/false',
     coalesce((SELECT bool_and(has_function_privilege('authenticated', oid, 'EXECUTE') AND NOT has_function_privilege('anon', oid, 'EXECUTE')
                  AND (SELECT p.prosrc LIKE '%has_role(auth.uid(), ''admin'')%' FROM pg_proc p WHERE p.oid = novas.oid))
                 FROM novas WHERE proname LIKE 'admin_%'), false)),
  ('6. colunas de retorno das funções do card (sem nome, e-mail ou telefone)',
     (SELECT string_agg(proname || ' -> ' || ret, ' | ' ORDER BY proname) FROM novas WHERE proname LIKE 'admin_%'),
     'admin_crm_funil_gasto -> TABLE(gasto_auto_centavos bigint, dias_auto bigint, anuncios_auto bigint, conversas_meta bigint, impressoes bigint, cliques bigint, gasto_manual_efetivo_centavos bigint, lancamentos_manuais_efetivos bigint, atualizado_em timestamp with time zone) | admin_crm_funil_gasto_por_anuncio -> TABLE(ad_id text, gasto_auto_centavos bigint, dias_auto bigint, conversas_meta bigint, impressoes bigint, cliques bigint, gasto_manual_efetivo_centavos bigint, atualizado_em timestamp with time zone)',
     coalesce((SELECT string_agg(proname || ' -> ' || ret, ' | ' ORDER BY proname) FROM novas WHERE proname LIKE 'admin_%')
       = 'admin_crm_funil_gasto -> TABLE(gasto_auto_centavos bigint, dias_auto bigint, anuncios_auto bigint, conversas_meta bigint, impressoes bigint, cliques bigint, gasto_manual_efetivo_centavos bigint, lancamentos_manuais_efetivos bigint, atualizado_em timestamp with time zone) | admin_crm_funil_gasto_por_anuncio -> TABLE(ad_id text, gasto_auto_centavos bigint, dias_auto bigint, conversas_meta bigint, impressoes bigint, cliques bigint, gasto_manual_efetivo_centavos bigint, atualizado_em timestamp with time zone)', false)),
  ('7. tabela: RLS ligada, nenhuma política, chave (ad_id, data)',
     (SELECT c.relrowsecurity || ' / políticas ' || (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)
             || ' / ' || (SELECT pg_get_constraintdef(k.oid) FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p')
        FROM pg_class c WHERE c.oid = to_regclass('public.crm_gasto_meta_anuncio')),
     'true / políticas 0 / PRIMARY KEY (ad_id, data)',
     coalesce((SELECT c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
                  AND (SELECT pg_get_constraintdef(k.oid) FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p') = 'PRIMARY KEY (ad_id, data)'
                 FROM pg_class c WHERE c.oid = to_regclass('public.crm_gasto_meta_anuncio')), false)),
  ('8. tabela: anon e authenticated sem nenhum privilégio; service_role lê e grava',
     (SELECT string_agg(r || ' ' || (has_table_privilege(r, 'public.crm_gasto_meta_anuncio', 'SELECT')
                                     OR has_table_privilege(r, 'public.crm_gasto_meta_anuncio', 'INSERT')
                                     OR has_table_privilege(r, 'public.crm_gasto_meta_anuncio', 'UPDATE')
                                     OR has_table_privilege(r, 'public.crm_gasto_meta_anuncio', 'DELETE')
                                     OR has_table_privilege(r, 'public.crm_gasto_meta_anuncio', 'TRUNCATE')), ', ' ORDER BY r)
        FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) r),
     'anon false, authenticated false, service_role true',
     coalesce(NOT has_table_privilege('anon', 'public.crm_gasto_meta_anuncio', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          AND NOT has_table_privilege('authenticated', 'public.crm_gasto_meta_anuncio', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          AND has_table_privilege('service_role', 'public.crm_gasto_meta_anuncio', 'SELECT'), false)),
  ('9. [INFORMATIVO] linhas gravadas e última sincronização',
     (SELECT count(*) || ' linhas · ' || count(DISTINCT ad_id) || ' anúncios · última ' || coalesce(to_char(max(atualizado_em) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'), '—')
        FROM public.crm_gasto_meta_anuncio),
     '(anotar; logo depois de aplicar: 0 linhas)', true)
) AS t(item, encontrado, esperado, ok);
