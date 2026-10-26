-- CONFERÊNCIA de supabase/migrations/20261030120000_acompanhamento_dispositivos_adicionais.sql
-- Rodar DEPOIS da migration, inteiro, no SQL Editor: um único resultado (UNION ALL),
-- 23 linhas, sem nenhum dado de cliente (só metadados e contagens).
-- Esperado: ok = true em TODAS as linhas.
--   1-2 = funções alteradas (retorno termina em dispositivos_adicionais jsonb)
--   3-4 = funções de polling (*_status), que não podem ter mudado
--   5   = tabela os_dispositivos_adicionais continua fechada para anon
--   6   = as funções rodam (token inexistente: 0 linhas, não grava nada)
-- Depois do ROLLBACK, as linhas 1b e 2b passam a dar false (retorno sem a coluna),
-- e todas as outras continuam true.

SELECT '1a get_os_tracking: existe, 1 assinatura' AS verificacao,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'get_os_tracking') = 1 AND to_regprocedure('public.get_os_tracking(text)') IS NOT NULL AS ok,
       coalesce(to_regprocedure('public.get_os_tracking(text)')::text, 'AUSENTE') AS detalhe
UNION ALL
SELECT '1b get_os_tracking: retorno esperado (colunas e ordem)',
       pg_get_function_result(to_regprocedure('public.get_os_tracking(text)')) = 'TABLE(numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, cliente_nome text, cliente_telefone text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, status_nome text, fotos jsonb, dispositivos_adicionais jsonb)',
       CASE WHEN pg_get_function_result(to_regprocedure('public.get_os_tracking(text)')) LIKE '%dispositivos_adicionais jsonb)' THEN 'termina em dispositivos_adicionais jsonb' ELSE 'sem dispositivos_adicionais' END
UNION ALL
SELECT '1c get_os_tracking: SECURITY DEFINER, search_path=public, dono postgres',
       p.prosecdef AND p.proconfig = ARRAY['search_path=public'] AND pg_get_userbyid(p.proowner) = 'postgres',
       format('secdef=%s config=%s dono=%s', p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner))
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_os_tracking(text)')
UNION ALL
SELECT '1d get_os_tracking: EXECUTE só postgres/anon/authenticated/service_role',
       coalesce(array_agg(x.item ORDER BY x.item)
         = ARRAY['anon:EXECUTE:postgres:false','authenticated:EXECUTE:postgres:false','postgres:EXECUTE:postgres:false','service_role:EXECUTE:postgres:false'], false),
       coalesce(string_agg(x.item, ', ' ORDER BY x.item), 'SEM ACL')
  FROM (SELECT format('%s:%s:%s:%s', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
                      a.privilege_type, pg_get_userbyid(a.grantor), a.is_grantable::text) AS item
          FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = to_regprocedure('public.get_os_tracking(text)')) x
UNION ALL
SELECT '2a get_cliente_tracking: existe, 1 assinatura' AS verificacao,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'get_cliente_tracking') = 1 AND to_regprocedure('public.get_cliente_tracking(text)') IS NOT NULL AS ok,
       coalesce(to_regprocedure('public.get_cliente_tracking(text)')::text, 'AUSENTE') AS detalhe
UNION ALL
SELECT '2b get_cliente_tracking: retorno esperado (colunas e ordem)',
       pg_get_function_result(to_regprocedure('public.get_cliente_tracking(text)')) = 'TABLE(cliente_nome text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, os_id uuid, numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, dispositivo_imei text, status_nome text, fotos jsonb, dispositivos_adicionais jsonb)',
       CASE WHEN pg_get_function_result(to_regprocedure('public.get_cliente_tracking(text)')) LIKE '%dispositivos_adicionais jsonb)' THEN 'termina em dispositivos_adicionais jsonb' ELSE 'sem dispositivos_adicionais' END
UNION ALL
SELECT '2c get_cliente_tracking: SECURITY DEFINER, search_path=public, dono postgres',
       p.prosecdef AND p.proconfig = ARRAY['search_path=public'] AND pg_get_userbyid(p.proowner) = 'postgres',
       format('secdef=%s config=%s dono=%s', p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner))
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_cliente_tracking(text)')
UNION ALL
SELECT '2d get_cliente_tracking: EXECUTE só postgres/anon/authenticated/service_role',
       coalesce(array_agg(x.item ORDER BY x.item)
         = ARRAY['anon:EXECUTE:postgres:false','authenticated:EXECUTE:postgres:false','postgres:EXECUTE:postgres:false','service_role:EXECUTE:postgres:false'], false),
       coalesce(string_agg(x.item, ', ' ORDER BY x.item), 'SEM ACL')
  FROM (SELECT format('%s:%s:%s:%s', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
                      a.privilege_type, pg_get_userbyid(a.grantor), a.is_grantable::text) AS item
          FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = to_regprocedure('public.get_cliente_tracking(text)')) x
UNION ALL
SELECT '3a get_os_tracking_status: existe, 1 assinatura' AS verificacao,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'get_os_tracking_status') = 1 AND to_regprocedure('public.get_os_tracking_status(text)') IS NOT NULL AS ok,
       coalesce(to_regprocedure('public.get_os_tracking_status(text)')::text, 'AUSENTE') AS detalhe
UNION ALL
SELECT '3b get_os_tracking_status: retorno esperado (colunas e ordem)',
       pg_get_function_result(to_regprocedure('public.get_os_tracking_status(text)')) = 'TABLE(numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, cliente_nome text, cliente_telefone text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, status_nome text)',
       CASE WHEN pg_get_function_result(to_regprocedure('public.get_os_tracking_status(text)')) LIKE '%dispositivos_adicionais jsonb)' THEN 'termina em dispositivos_adicionais jsonb' ELSE 'sem dispositivos_adicionais' END
UNION ALL
SELECT '3c get_os_tracking_status: SECURITY DEFINER, search_path=public, dono postgres',
       p.prosecdef AND p.proconfig = ARRAY['search_path=public'] AND pg_get_userbyid(p.proowner) = 'postgres',
       format('secdef=%s config=%s dono=%s', p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner))
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_os_tracking_status(text)')
UNION ALL
SELECT '3d get_os_tracking_status: EXECUTE só postgres/anon/authenticated/service_role',
       coalesce(array_agg(x.item ORDER BY x.item)
         = ARRAY['anon:EXECUTE:postgres:false','authenticated:EXECUTE:postgres:false','postgres:EXECUTE:postgres:false','service_role:EXECUTE:postgres:false'], false),
       coalesce(string_agg(x.item, ', ' ORDER BY x.item), 'SEM ACL')
  FROM (SELECT format('%s:%s:%s:%s', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
                      a.privilege_type, pg_get_userbyid(a.grantor), a.is_grantable::text) AS item
          FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = to_regprocedure('public.get_os_tracking_status(text)')) x
UNION ALL
SELECT '4a get_cliente_tracking_status: existe, 1 assinatura' AS verificacao,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'get_cliente_tracking_status') = 1 AND to_regprocedure('public.get_cliente_tracking_status(text)') IS NOT NULL AS ok,
       coalesce(to_regprocedure('public.get_cliente_tracking_status(text)')::text, 'AUSENTE') AS detalhe
UNION ALL
SELECT '4b get_cliente_tracking_status: retorno esperado (colunas e ordem)',
       pg_get_function_result(to_regprocedure('public.get_cliente_tracking_status(text)')) = 'TABLE(cliente_nome text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, os_id uuid, numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, dispositivo_imei text, status_nome text)',
       CASE WHEN pg_get_function_result(to_regprocedure('public.get_cliente_tracking_status(text)')) LIKE '%dispositivos_adicionais jsonb)' THEN 'termina em dispositivos_adicionais jsonb' ELSE 'sem dispositivos_adicionais' END
UNION ALL
SELECT '4c get_cliente_tracking_status: SECURITY DEFINER, search_path=public, dono postgres',
       p.prosecdef AND p.proconfig = ARRAY['search_path=public'] AND pg_get_userbyid(p.proowner) = 'postgres',
       format('secdef=%s config=%s dono=%s', p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner))
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_cliente_tracking_status(text)')
UNION ALL
SELECT '4d get_cliente_tracking_status: EXECUTE só postgres/anon/authenticated/service_role',
       coalesce(array_agg(x.item ORDER BY x.item)
         = ARRAY['anon:EXECUTE:postgres:false','authenticated:EXECUTE:postgres:false','postgres:EXECUTE:postgres:false','service_role:EXECUTE:postgres:false'], false),
       coalesce(string_agg(x.item, ', ' ORDER BY x.item), 'SEM ACL')
  FROM (SELECT format('%s:%s:%s:%s', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
                      a.privilege_type, pg_get_userbyid(a.grantor), a.is_grantable::text) AS item
          FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = to_regprocedure('public.get_cliente_tracking_status(text)')) x
UNION ALL
SELECT '5a tabela: anon sem nenhum privilégio',
       NOT has_table_privilege('anon', 'public.os_dispositivos_adicionais', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
       'anon'
UNION ALL
SELECT '5b tabela: authenticated com os mesmos 4 privilégios de antes',
       string_agg(privilege_type, ',' ORDER BY privilege_type) = 'DELETE,INSERT,SELECT,UPDATE',
       string_agg(privilege_type, ',' ORDER BY privilege_type)
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'os_dispositivos_adicionais' AND grantee = 'authenticated'
UNION ALL
SELECT '5c tabela: RLS ligado',
       relrowsecurity, format('rls=%s force=%s', relrowsecurity, relforcerowsecurity)
  FROM pg_class WHERE oid = 'public.os_dispositivos_adicionais'::regclass
UNION ALL
SELECT '5d tabela: as mesmas 8 policies, todas só authenticated',
       count(*) = 8 AND bool_and(roles = ARRAY['authenticated']::name[]),
       format('%s policies; papeis: %s', count(*), string_agg(DISTINCT array_to_string(roles, '+'), ','))
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'os_dispositivos_adicionais'
UNION ALL
SELECT '6a chamada com token inexistente: get_os_tracking devolve 0 linhas',
       (SELECT count(*) FROM public.get_os_tracking('__verificacao_token_inexistente__')) = 0,
       'não grava nada (UPDATE sem linha casada)'
UNION ALL
SELECT '6b chamada com token inexistente: get_cliente_tracking devolve 0 linhas',
       (SELECT count(*) FROM public.get_cliente_tracking('__verificacao_token_inexistente__')) = 0,
       'não grava nada (UPDATE sem linha casada)'
UNION ALL
SELECT '7a contagem (só números): OS com extras / extras / extras de dono diferente da OS',
       count(*) FILTER (WHERE d.user_id <> o.user_id) = 0,
       format('%s OS, %s extras, %s com dono diferente', count(DISTINCT d.os_id), count(*), count(*) FILTER (WHERE d.user_id <> o.user_id))
  FROM public.os_dispositivos_adicionais d JOIN public.ordens_servico o ON o.id = d.os_id
ORDER BY 1;
