-- =====================================================================
-- CRM de leads — RELATÓRIO DE MARKETING — VERIFICAÇÃO depois da migration
-- 20261123120000_crm_leads_relatorio_marketing.sql. SOMENTE LEITURA.
-- Esperado: todas as linhas com ok = true.
-- =====================================================================
WITH f AS (
  SELECT p.oid, p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         pg_get_function_result(p.oid) AS ret,
         p.prosecdef AND p.proconfig @> ARRAY['search_path=public'] AS definer_fixo,
         p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) AS public_executa
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('crm_relatorio_marketing', '_crm_rel_cadastros', '_crm_rel_funil')
), fontes AS (
  SELECT p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('admin_mkt_cadastros_por_dia', 'admin_mkt_origens', '_crm_pagantes',
                       'admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_teste',
                       'admin_crm_funil_gasto', 'admin_crm_funil_gasto_por_anuncio')
)
SELECT * FROM (VALUES
  ('1. funções novas = versão do repositório (_crm_rel_cadastros / _crm_rel_funil / crm_relatorio_marketing)',
     (SELECT string_agg(h, ' / ' ORDER BY proname COLLATE "C") FROM f),
     '7248f2c66df5e862f722354ae26e7f7c / 780e1348dff477d4ad4f9102ab47a363 / 4e034d5e70a4d309bc362eb2c4d34ab0',
     coalesce((SELECT count(*) = 3 AND string_agg(h, ' / ' ORDER BY proname COLLATE "C") = '7248f2c66df5e862f722354ae26e7f7c / 780e1348dff477d4ad4f9102ab47a363 / 4e034d5e70a4d309bc362eb2c4d34ab0' FROM f), false)),
  ('2. as 8 funções do card NÃO mudaram',
     (SELECT string_agg(h, ' / ' ORDER BY proname COLLATE "C") FROM fontes),
     '83436d28276fb79cf60bef2da5fd0890 / 68c3b2319c99ffb294432887dbb392db / 117d524b804f5bacb4a5170a06e5acd5 / 02a42ad91c4ab6a84fbea04e5800c6c6 / 91a2786178ab291e7bafda361529c768 / b761af836793047661ad77a9fb7a0601 / 7eaa6fb74dc82991e071027594f103c5 / d9e7a4aac4de5d5ca235a5017db53da8',
     coalesce((SELECT count(*) = 8 AND string_agg(h, ' / ' ORDER BY proname COLLATE "C") = '83436d28276fb79cf60bef2da5fd0890 / 68c3b2319c99ffb294432887dbb392db / 117d524b804f5bacb4a5170a06e5acd5 / 02a42ad91c4ab6a84fbea04e5800c6c6 / 91a2786178ab291e7bafda361529c768 / b761af836793047661ad77a9fb7a0601 / 7eaa6fb74dc82991e071027594f103c5 / d9e7a4aac4de5d5ca235a5017db53da8' FROM fontes), false)),
  ('3. SECURITY DEFINER com search_path fixo, sem EXECUTE para PUBLIC, retorno jsonb',
     (SELECT string_agg(proname || ' ' || definer_fixo || '/' || public_executa || '/' || ret, ', ' ORDER BY proname COLLATE "C") FROM f),
     '_crm_rel_cadastros true/false/jsonb, _crm_rel_funil true/false/jsonb, crm_relatorio_marketing true/false/jsonb',
     coalesce((SELECT count(*) = 3 AND bool_and(definer_fixo AND NOT public_executa AND ret = 'jsonb') FROM f), false)),
  ('4. relatório: service_role executa; anon e authenticated não',
     (SELECT has_function_privilege('service_role', oid, 'EXECUTE') || ' / ' || has_function_privilege('anon', oid, 'EXECUTE')
             || ' / ' || has_function_privilege('authenticated', oid, 'EXECUTE') FROM f WHERE proname = 'crm_relatorio_marketing'),
     'true / false / false',
     coalesce((SELECT has_function_privilege('service_role', oid, 'EXECUTE') AND NOT has_function_privilege('anon', oid, 'EXECUTE')
                  AND NOT has_function_privilege('authenticated', oid, 'EXECUTE') FROM f WHERE proname = 'crm_relatorio_marketing'), false)),
  ('5. internas: ninguém executa direto (service_role / anon / authenticated)',
     (SELECT string_agg(proname || ' ' || has_function_privilege('service_role', oid, 'EXECUTE') || '/'
             || has_function_privilege('anon', oid, 'EXECUTE') || '/' || has_function_privilege('authenticated', oid, 'EXECUTE'), ', ' ORDER BY proname COLLATE "C")
        FROM f WHERE proname LIKE '\_crm\_rel\_%'),
     '_crm_rel_cadastros false/false/false, _crm_rel_funil false/false/false',
     coalesce((SELECT count(*) = 2 AND bool_and(NOT has_function_privilege('service_role', oid, 'EXECUTE')
                  AND NOT has_function_privilege('anon', oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', oid, 'EXECUTE'))
                 FROM f WHERE proname LIKE '\_crm\_rel\_%'), false))
) AS t(item, encontrado, esperado, ok);

-- Opcional (só agregados): comparar com o /admin/marketing do mesmo período.
-- No SQL Editor o papel é o dono da função, então a chamada funciona:
--   SELECT jsonb_pretty(public.crm_relatorio_marketing('2026-11-16', '2026-11-22'));
