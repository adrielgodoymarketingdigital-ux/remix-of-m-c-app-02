-- =====================================================================
-- CRM de leads (fase 1) — VERIFICAÇÃO depois do SQL 3 (funil e gasto).
-- SOMENTE LEITURA. Esperado: todas as linhas com ok = true.
-- (No SQL Editor auth.uid() é nulo: chamar admin_crm_funil aqui DEVE dar
--  "Apenas administradores..." — é a prova de que a trava está ativa.)
-- =====================================================================
WITH f(assinatura) AS (VALUES
  ('public.admin_crm_funil(date, date)'), ('public.admin_crm_funil_por_anuncio(date, date)'),
  ('public.admin_crm_gasto_informar(date, date, numeric, text, text)'), ('public.admin_crm_gasto_remover(bigint)')
), g AS (SELECT assinatura, to_regprocedure(assinatura) AS oid FROM f)
SELECT * FROM (VALUES
  ('1. 4 funções do admin existem e conferem has_role',
     (SELECT count(*)::text FROM g JOIN pg_proc p ON p.oid = g.oid
        WHERE p.prosecdef AND p.prosrc LIKE '%has_role(auth.uid(), ''admin'')%'), '4',
     (SELECT count(*) FROM g JOIN pg_proc p ON p.oid = g.oid
        WHERE p.prosecdef AND p.prosrc LIKE '%has_role(auth.uid(), ''admin'')%') = 4),
  ('2. authenticated executa as 4; anon nenhuma',
     (SELECT count(*) FILTER (WHERE has_function_privilege('authenticated', oid, 'EXECUTE'))::text || ' / '
           || count(*) FILTER (WHERE has_function_privilege('anon', oid, 'EXECUTE'))::text FROM g), '4 / 0',
     (SELECT count(*) FILTER (WHERE has_function_privilege('authenticated', oid, 'EXECUTE')) = 4
         AND count(*) FILTER (WHERE has_function_privilege('anon', oid, 'EXECUTE')) = 0 FROM g)),
  ('3. _crm_pagantes existe e só o dono executa',
     (to_regprocedure('public._crm_pagantes(uuid[])') IS NOT NULL)::text || ' / '
       || has_function_privilege('authenticated', 'public._crm_pagantes(uuid[])', 'EXECUTE')::text, 'true / false',
     to_regprocedure('public._crm_pagantes(uuid[])') IS NOT NULL
       AND NOT has_function_privilege('authenticated', 'public._crm_pagantes(uuid[])', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public._crm_pagantes(uuid[])', 'EXECUTE')),
  ('4. meta_ads_insights_dia intocada (mesmas colunas da migration 20261024130000)',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meta_ads_insights_dia'), '17',
     (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meta_ads_insights_dia') = 17)
) AS t(item, encontrado, esperado, ok);
