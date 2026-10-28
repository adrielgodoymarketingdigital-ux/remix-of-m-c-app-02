-- =====================================================================
-- Conferência da migration 20261102120000_configuracao_estoque_baixo.sql
-- (rodar DEPOIS dela). Só lê estrutura e contagens: nenhum dado de cliente.
-- Um único resultado; toda linha deve ter ok = true.
-- =====================================================================
WITH
t AS (SELECT to_regclass('public.configuracao_estoque') AS oid),
pol AS (
  SELECT policyname, cmd, roles::text AS roles, qual, with_check
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'configuracao_estoque'
),
cat AS (SELECT * FROM public._zerar_catalogo()),
linhas (ordem, item, esperado, encontrado) AS (
            SELECT 1, 'tabela existe', 'true', ((SELECT oid FROM t) IS NOT NULL)::text
  UNION ALL SELECT 2, 'RLS ligada', 'true',
         (SELECT relrowsecurity::text FROM pg_class WHERE oid = (SELECT oid FROM t))
  UNION ALL SELECT 3, 'policies (nome:comando)',
         'dono atualiza a propria configuracao de estoque:UPDATE, dono insere a propria configuracao de estoque:INSERT, dono le a propria configuracao de estoque:SELECT, funcionario le configuracao de estoque do dono:SELECT, gerente de filial le configuracao de estoque do proprietario:SELECT',
         (SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname) FROM pol)
  UNION ALL SELECT 4, 'todas as policies só para authenticated', 'true',
         (SELECT bool_and(roles = '{authenticated}')::text FROM pol)
  UNION ALL SELECT 5, 'nenhuma policy de DELETE ou ALL', '0',
         (SELECT count(*)::text FROM pol WHERE cmd IN ('DELETE', 'ALL'))
  UNION ALL SELECT 6, 'escrita só pelo dono (INSERT/UPDATE comparam com auth.uid())', 'true',
         (SELECT bool_and(COALESCE(with_check, '') LIKE '%auth.uid()%' AND COALESCE(qual, 'auth.uid()') LIKE '%auth.uid()%')::text
            FROM pol WHERE cmd IN ('INSERT', 'UPDATE'))
  UNION ALL SELECT 7, 'anon sem SELECT/INSERT/UPDATE/DELETE', 'false',
         (has_table_privilege('anon', 'public.configuracao_estoque', 'SELECT')
          OR has_table_privilege('anon', 'public.configuracao_estoque', 'INSERT')
          OR has_table_privilege('anon', 'public.configuracao_estoque', 'UPDATE')
          OR has_table_privilege('anon', 'public.configuracao_estoque', 'DELETE'))::text
  UNION ALL SELECT 8, 'authenticated com SELECT/INSERT/UPDATE', 'true',
         (has_table_privilege('authenticated', 'public.configuracao_estoque', 'SELECT')
          AND has_table_privilege('authenticated', 'public.configuracao_estoque', 'INSERT')
          AND has_table_privilege('authenticated', 'public.configuracao_estoque', 'UPDATE'))::text
  UNION ALL SELECT 9, 'authenticated sem DELETE/TRUNCATE', 'false',
         (has_table_privilege('authenticated', 'public.configuracao_estoque', 'DELETE')
          OR has_table_privilege('authenticated', 'public.configuracao_estoque', 'TRUNCATE'))::text
  UNION ALL SELECT 10, 'user_id é a chave primária', 'true',
         EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ALL (c.conkey)
                  WHERE c.conrelid = (SELECT oid FROM t) AND c.contype = 'p' AND a.attname = 'user_id')::text
  UNION ALL SELECT 11, 'FK user_id -> auth.users ON DELETE CASCADE', 'true',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = (SELECT oid FROM t) AND contype = 'f'
                  AND confrelid = 'auth.users'::regclass AND confdeltype = 'c')::text
  UNION ALL SELECT 12, 'CHECK do limite (nulo ou 0 a 1000)', 'CHECK (((limite_baixo IS NULL) OR ((limite_baixo >= 0) AND (limite_baixo <= 1000))))',
         (SELECT pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conrelid = (SELECT oid FROM t) AND conname = 'configuracao_estoque_limite_baixo_check')
  UNION ALL SELECT 13, 'gatilho de updated_at', 'true',
         EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = (SELECT oid FROM t)
                  AND tgname = 'update_configuracao_estoque_updated_at' AND tgenabled = 'O')::text
  UNION ALL SELECT 14, '_zerar_catalogo: tabela como MANTER', 'MANTER',
         (SELECT lista FROM cat WHERE tabela = 'public.configuracao_estoque')
  UNION ALL SELECT 15, '_zerar_catalogo: total de linhas', '112', (SELECT count(*)::text FROM cat)
  UNION ALL SELECT 16, '_zerar_catalogo fechada para anon/authenticated', 'false',
         (has_function_privilege('anon', 'public._zerar_catalogo()', 'EXECUTE')
          OR has_function_privilege('authenticated', 'public._zerar_catalogo()', 'EXECUTE'))::text
  UNION ALL SELECT 17, 'is_funcionario_of é SECURITY DEFINER', 'true',
         (SELECT bool_and(prosecdef)::text FROM pg_proc
           WHERE oid = 'public.is_funcionario_of(uuid)'::regprocedure)
  UNION ALL SELECT 18, 'linhas com limite fora da faixa', '0',
         (SELECT count(*)::text FROM public.configuracao_estoque
           WHERE limite_baixo IS NOT NULL AND (limite_baixo < 0 OR limite_baixo > 1000))
)
SELECT ordem, item, esperado, encontrado, (encontrado IS NOT DISTINCT FROM esperado) AS ok
  FROM linhas
 ORDER BY ordem;
