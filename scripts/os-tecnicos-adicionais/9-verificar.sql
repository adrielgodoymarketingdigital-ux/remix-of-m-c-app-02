-- SOMENTE LEITURA. Rodar DEPOIS das 3 migrations. Nada é alterado.
-- Esperado: todas as colunas "ok_*" = true e problemas = {}.
WITH t AS (SELECT 'public.os_tecnicos_adicionais'::regclass AS rel)
SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid = (SELECT rel FROM t))                 AS ok_rls_ligada,
  (SELECT count(*) = 6 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'os_tecnicos_adicionais')               AS ok_6_policies,
  NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'os_tecnicos_adicionais' AND cmd = 'UPDATE') AS ok_sem_policy_update,
  NOT has_table_privilege('anon', 'public.os_tecnicos_adicionais', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.os_tecnicos_adicionais', 'INSERT')       AS ok_anon_sem_acesso,
  NOT has_table_privilege('authenticated', 'public.os_tecnicos_adicionais', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.os_tecnicos_adicionais', 'TRUNCATE') AS ok_auth_sem_update_truncate,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'os_tecnicos_adicionais_validar'
           AND tgrelid = (SELECT rel FROM t) AND NOT tgisinternal)                       AS ok_trava,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'os_tecnicos_adicionais_os_funcionario_key') AS ok_unique,
  (SELECT count(*) = 2 FROM pg_constraint
    WHERE conrelid = (SELECT rel FROM t) AND contype = 'f' AND confdeltype = 'c')        AS ok_2_fk_cascade,
  to_regprocedure('public.salvar_tecnicos_os(uuid,uuid,uuid[])') IS NOT NULL             AS ok_funcao,
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.salvar_tecnicos_os(uuid,uuid,uuid[])'::regprocedure) AS ok_funcao_invoker,
  has_function_privilege('authenticated', 'public.salvar_tecnicos_os(uuid,uuid,uuid[])', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.salvar_tecnicos_os(uuid,uuid,uuid[])', 'EXECUTE') AS ok_funcao_grants,
  EXISTS (SELECT 1 FROM public._zerar_catalogo() c
           WHERE c.tabela = 'public.os_tecnicos_adicionais' AND c.ordem = 12 AND c.lista = 'APAGAR') AS ok_no_zerar_catalogo,
  (SELECT count(DISTINCT ordem) = count(*) FROM public._zerar_catalogo())                AS ok_catalogo_sem_ordem_repetida,
  NOT has_function_privilege('authenticated', 'public._zerar_catalogo()', 'EXECUTE')     AS ok_catalogo_fechado,
  (SELECT count(*) FROM public.os_tecnicos_adicionais)                                   AS linhas_na_tabela;

SELECT policyname, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'os_tecnicos_adicionais' ORDER BY cmd, policyname;
