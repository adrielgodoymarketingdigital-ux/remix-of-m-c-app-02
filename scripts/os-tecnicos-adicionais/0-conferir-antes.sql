-- SOMENTE LEITURA. Rodar ANTES da 20261125120000. Nada é alterado.
-- Esperado: tabela_existe = false, funcao_existe = false, ancora_os_tecnicos = 1,
-- ordem_12_livre = true, policies de ordens_servico iguais às listadas no relatório F1.
SELECT
  to_regclass('public.os_tecnicos_adicionais') IS NOT NULL                       AS tabela_existe,
  to_regprocedure('public.salvar_tecnicos_os(uuid,uuid,uuid[])') IS NOT NULL      AS funcao_existe,
  (SELECT count(*) FROM regexp_matches(
      pg_get_functiondef('public._zerar_catalogo()'::regprocedure),
      '\(10,\s*''APAGAR'',\s*''os'',\s*''public\.os_tecnicos'',', 'g'))           AS ancora_os_tecnicos,
  NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.ordem = 12)        AS ordem_12_livre,
  (SELECT count(*) FROM public._zerar_catalogo())                                 AS linhas_catalogo,
  to_regprocedure('public.is_funcionario_of(uuid)') IS NOT NULL                   AS tem_is_funcionario_of,
  to_regprocedure('public.update_updated_at_column()') IS NOT NULL                AS tem_update_updated_at;

-- Policies em vigor de ordens_servico (para comparar com o mapeamento do repositório).
SELECT policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'ordens_servico'
 ORDER BY cmd, policyname;
