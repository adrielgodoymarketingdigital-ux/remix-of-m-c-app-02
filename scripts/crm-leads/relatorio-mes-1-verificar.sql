-- =====================================================================
-- CRM de leads — RELATÓRIO: mês contra mês anterior — VERIFICAÇÃO depois
-- da migration 20261123130000_crm_leads_relatorio_mes_calendario.sql.
-- SOMENTE LEITURA. Esperado: todas as linhas com ok = true.
-- (Depois desta migration, a linha 1 de relatorio-1-verificar.sql dá false:
--  ela confere a versão da 20261123120000. É esperado.)
-- =====================================================================
WITH f AS (
  SELECT p.oid, p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         pg_get_function_result(p.oid) AS ret,
         p.prosecdef AND p.proconfig @> ARRAY['search_path=public'] AS definer_fixo,
         p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) AS public_executa
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('crm_relatorio_marketing', '_crm_rel_cadastros', '_crm_rel_funil')
)
SELECT * FROM (VALUES
  ('1. crm_relatorio_marketing = versão nova (mês contra mês anterior)',
     (SELECT string_agg(h, ', ') FROM f WHERE proname = 'crm_relatorio_marketing'),
     '34e689704d8f45199d721a0458deeb85',
     coalesce((SELECT count(*) = 1 AND bool_and(h = '34e689704d8f45199d721a0458deeb85') FROM f WHERE proname = 'crm_relatorio_marketing'), false)),
  ('2. internas NÃO mudaram (_crm_rel_cadastros / _crm_rel_funil)',
     (SELECT string_agg(h, ' / ' ORDER BY proname COLLATE "C") FROM f WHERE proname LIKE '\_crm\_rel\_%'),
     '7248f2c66df5e862f722354ae26e7f7c / 780e1348dff477d4ad4f9102ab47a363',
     coalesce((SELECT count(*) = 2 AND string_agg(h, ' / ' ORDER BY proname COLLATE "C") = '7248f2c66df5e862f722354ae26e7f7c / 780e1348dff477d4ad4f9102ab47a363'
                 FROM f WHERE proname LIKE '\_crm\_rel\_%'), false)),
  ('3. crm_relatorio_marketing: SECURITY DEFINER com search_path fixo, sem EXECUTE para PUBLIC, retorno jsonb',
     (SELECT definer_fixo || '/' || public_executa || '/' || ret FROM f WHERE proname = 'crm_relatorio_marketing'),
     'true/false/jsonb',
     coalesce((SELECT definer_fixo AND NOT public_executa AND ret = 'jsonb' FROM f WHERE proname = 'crm_relatorio_marketing'), false)),
  ('4. crm_relatorio_marketing: service_role executa; anon e authenticated não',
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

-- Opcional (só agregados): mês inteiro deve comparar com o mês anterior inteiro.
--   SELECT public.crm_relatorio_marketing('2026-11-01', '2026-11-30') -> 'periodo_anterior';
--   esperado: {"fim": "2026-10-31", "inicio": "2026-10-01"}
