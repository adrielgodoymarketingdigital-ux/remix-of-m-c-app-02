-- =====================================================================
-- CRM — PESQUISA DE FEEDBACK COM PAGANTES — VERIFICAÇÃO depois da migration
-- 20261122130000_crm_feedback_pagantes.sql. SOMENTE LEITURA.
-- Esperado: todas as linhas com ok = true (a 10 é informativa: anotar).
-- =====================================================================
WITH f AS (
  SELECT p.oid, p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         p.prosecdef AND p.proconfig @> ARRAY['search_path=public'] AS definer_fixo,
         p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) AS public_executa
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('_crm_pagantes', '_crm_profile_elegivel', 'crm_normalizar_telefone',
                       'crm_pagantes_contato', 'crm_contato_registrar')
), novas AS (SELECT * FROM f WHERE proname IN ('crm_pagantes_contato', 'crm_contato_registrar'))
SELECT * FROM (VALUES
  ('1. dependências NÃO mudaram (_crm_pagantes / _crm_profile_elegivel / crm_normalizar_telefone)',
     (SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('_crm_pagantes', '_crm_profile_elegivel', 'crm_normalizar_telefone')),
     '83436d28276fb79cf60bef2da5fd0890 / 62d97936d613da5e272e0e70cacc4047 / 743b00cfd292a0196daded7f16ef5e4c',
     coalesce((SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('_crm_pagantes', '_crm_profile_elegivel', 'crm_normalizar_telefone'))
       = '83436d28276fb79cf60bef2da5fd0890 / 62d97936d613da5e272e0e70cacc4047 / 743b00cfd292a0196daded7f16ef5e4c', false)),
  ('2. funções novas = versão do repositório (registrar / pagantes)',
     (SELECT string_agg(h, ' / ' ORDER BY proname) FROM novas),
     'f2f3e2383f4f54ebd7482afd4c699f44 / 9210dba791075eb14b10df247606f061',
     coalesce((SELECT string_agg(h, ' / ' ORDER BY proname) FROM novas) = 'f2f3e2383f4f54ebd7482afd4c699f44 / 9210dba791075eb14b10df247606f061', false)),
  ('3. funções novas: assinatura exata',
     (SELECT string_agg(proname || '(' || pg_get_function_identity_arguments(oid) || ') -> ' || pg_get_function_result(oid), ' | ' ORDER BY proname) FROM novas),
     'crm_contato_registrar(p_campanha text, p_itens jsonb) -> jsonb | crm_pagantes_contato(p_campanha text, p_limite integer, p_pausa_dias integer, p_user_ids uuid[]) -> jsonb',
     coalesce((SELECT string_agg(proname || '(' || pg_get_function_identity_arguments(oid) || ') -> ' || pg_get_function_result(oid), ' | ' ORDER BY proname) FROM novas)
       = 'crm_contato_registrar(p_campanha text, p_itens jsonb) -> jsonb | crm_pagantes_contato(p_campanha text, p_limite integer, p_pausa_dias integer, p_user_ids uuid[]) -> jsonb', false)),
  ('4. funções novas: SECURITY DEFINER com search_path fixo, sem EXECUTE para PUBLIC',
     (SELECT string_agg(proname || ' ' || definer_fixo || '/' || public_executa, ', ' ORDER BY proname) FROM novas),
     'crm_contato_registrar true/false, crm_pagantes_contato true/false',
     coalesce((SELECT count(*) = 2 AND bool_and(definer_fixo AND NOT public_executa) FROM novas), false)),
  ('5. funções novas: só service_role executa (service_role / anon / authenticated)',
     (SELECT string_agg(proname || ' ' || has_function_privilege('service_role', oid, 'EXECUTE') || '/' || has_function_privilege('anon', oid, 'EXECUTE')
                        || '/' || has_function_privilege('authenticated', oid, 'EXECUTE'), ', ' ORDER BY proname) FROM novas),
     'crm_contato_registrar true/false/false, crm_pagantes_contato true/false/false',
     coalesce((SELECT count(*) = 2 AND bool_and(has_function_privilege('service_role', oid, 'EXECUTE') AND NOT has_function_privilege('anon', oid, 'EXECUTE')
                  AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')) FROM novas), false)),
  ('6. tabela: RLS ligada, nenhuma política, chave (campanha, destinatario_user_id)',
     (SELECT c.relrowsecurity || ' / políticas ' || (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)
             || ' / ' || (SELECT pg_get_constraintdef(k.oid) FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p')
        FROM pg_class c WHERE c.oid = to_regclass('public.crm_contato_campanha')),
     'true / políticas 0 / PRIMARY KEY (campanha, destinatario_user_id)',
     coalesce((SELECT c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
                  AND (SELECT pg_get_constraintdef(k.oid) FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p') = 'PRIMARY KEY (campanha, destinatario_user_id)'
                 FROM pg_class c WHERE c.oid = to_regclass('public.crm_contato_campanha')), false)),
  ('7. tabela: anon e authenticated sem nenhum privilégio; service_role lê e grava',
     (SELECT string_agg(r || ' ' || has_table_privilege(r, 'public.crm_contato_campanha', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'), ', ' ORDER BY r)
        FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) r),
     'anon false, authenticated false, service_role true',
     coalesce(NOT has_table_privilege('anon', 'public.crm_contato_campanha', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          AND NOT has_table_privilege('authenticated', 'public.crm_contato_campanha', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          AND has_table_privilege('service_role', 'public.crm_contato_campanha', 'SELECT')
          AND has_table_privilege('service_role', 'public.crm_contato_campanha', 'INSERT')
          AND has_table_privilege('service_role', 'public.crm_contato_campanha', 'UPDATE'), false)),
  ('8. tabela: regras (campanha, resultado e enviado_em só quando enviado)',
     (SELECT string_agg(pg_get_constraintdef(k.oid), ' | ' ORDER BY pg_get_constraintdef(k.oid))
        FROM pg_constraint k WHERE k.conrelid = to_regclass('public.crm_contato_campanha') AND k.contype = 'c'),
     '3 CHECK',
     coalesce((SELECT count(*) = 3 FROM pg_constraint k WHERE k.conrelid = to_regclass('public.crm_contato_campanha') AND k.contype = 'c'), false)),
  ('9. "Começar do zero" não enxerga a tabela (sem coluna user_id / loja_user_id / proprietario_id, sem FK)',
     (SELECT coalesce(string_agg(a.attname, ', '), '(nenhuma)') FROM pg_attribute a
       WHERE a.attrelid = to_regclass('public.crm_contato_campanha') AND NOT a.attisdropped
         AND a.attname IN ('user_id', 'loja_user_id', 'proprietario_id'))
       || ' / FKs ' || (SELECT count(*) FROM pg_constraint k WHERE k.conrelid = to_regclass('public.crm_contato_campanha') AND k.contype = 'f'),
     '(nenhuma) / FKs 0',
     coalesce(to_regclass('public.crm_contato_campanha') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass('public.crm_contato_campanha') AND NOT a.attisdropped
                        AND a.attname IN ('user_id', 'loja_user_id', 'proprietario_id'))
       AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = to_regclass('public.crm_contato_campanha') AND k.contype = 'f'), false)),
  ('10. [INFORMATIVO] linhas gravadas (enviado / falhou / campanhas)',
     (SELECT count(*) FILTER (WHERE resultado = 'enviado') || ' / ' || count(*) FILTER (WHERE resultado = 'falhou') || ' / ' || count(DISTINCT campanha)
        FROM public.crm_contato_campanha),
     '(anotar; logo depois de aplicar: 0 / 0 / 0)', true)
) AS t(item, encontrado, esperado, ok);
