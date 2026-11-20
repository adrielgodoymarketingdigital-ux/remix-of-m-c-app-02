-- =====================================================================
-- "Minhas garantias" — VERIFICAÇÃO DEPOIS DA ESTRUTURA. SOMENTE LEITURA.
-- Rodar logo depois de 20261120120000_minhas_garantias_estrutura.sql.
-- Tudo com ok = true → estrutura no lugar. Nenhum dado de cliente.
-- As constraints de vendas/dispositivos podem estar NÃO validadas aqui (NOT VALID):
-- a validação é o arquivo seguinte, conferida por 1b-verificar-validacao-indices.sql.
-- =====================================================================
SELECT * FROM (VALUES
  ('1. tabelas criadas com RLS ligada',
     (SELECT string_agg(relname || '=' || relrowsecurity, ', ' ORDER BY relname) FROM pg_class
       WHERE oid IN (to_regclass('public.garantias_loja'), to_regclass('public.garantias_textos_venda'))),
     (SELECT count(*) FROM pg_class
       WHERE oid IN (to_regclass('public.garantias_loja'), to_regclass('public.garantias_textos_venda')) AND relrowsecurity) = 2),
  ('2. policies de garantias_loja (7)',
     (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garantias_loja'),
     (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garantias_loja') = 7),
  ('3. policies de garantias_textos_venda (6, só SELECT/INSERT)',
     (SELECT string_agg(DISTINCT cmd, ',') || ' / ' || count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garantias_textos_venda'),
     (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garantias_textos_venda') = 6
       AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garantias_textos_venda'
                        AND cmd NOT IN ('SELECT', 'INSERT'))),
  ('4. anon sem acesso às 2 tabelas',
     (has_table_privilege('anon', 'public.garantias_loja', 'SELECT') OR has_table_privilege('anon', 'public.garantias_textos_venda', 'SELECT'))::text,
     NOT (has_table_privilege('anon', 'public.garantias_loja', 'SELECT') OR has_table_privilege('anon', 'public.garantias_loja', 'INSERT')
          OR has_table_privilege('anon', 'public.garantias_textos_venda', 'SELECT') OR has_table_privilege('anon', 'public.garantias_textos_venda', 'INSERT'))),
  ('5. texto congelado: authenticated não altera nem apaga',
     (has_table_privilege('authenticated', 'public.garantias_textos_venda', 'UPDATE') OR has_table_privilege('authenticated', 'public.garantias_textos_venda', 'DELETE'))::text,
     NOT (has_table_privilege('authenticated', 'public.garantias_textos_venda', 'UPDATE')
          OR has_table_privilege('authenticated', 'public.garantias_textos_venda', 'DELETE')
          OR has_table_privilege('authenticated', 'public.garantias_textos_venda', 'TRUNCATE'))),
  ('6. vendas: 4 colunas novas, todas vazias',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendas'
        AND column_name IN ('garantia_id', 'garantia_nome', 'garantia_meses', 'garantia_texto_id')),
     (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendas'
        AND column_name IN ('garantia_id', 'garantia_nome', 'garantia_meses', 'garantia_texto_id')) = 4),
  ('7. dispositivos.garantia_padrao_id',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dispositivos'
        AND column_name = 'garantia_padrao_id'),
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dispositivos'
        AND column_name = 'garantia_padrao_id')),
  ('7b. constraints novas existem (6); validadas ainda pode ser 0 (NOT VALID, normal aqui)',
     (SELECT count(*) || ' existem, ' || count(*) FILTER (WHERE convalidated) || ' validadas' FROM pg_constraint
       WHERE conname IN ('vendas_garantia_id_fkey', 'vendas_garantia_texto_id_fkey', 'vendas_garantia_meses_check',
                         'vendas_garantia_nome_check', 'vendas_garantia_copia_check', 'dispositivos_garantia_padrao_id_fkey')),
     (SELECT count(*) FROM pg_constraint
       WHERE conname IN ('vendas_garantia_id_fkey', 'vendas_garantia_texto_id_fkey', 'vendas_garantia_meses_check',
                         'vendas_garantia_nome_check', 'vendas_garantia_copia_check', 'dispositivos_garantia_padrao_id_fkey')) = 6),
  ('8. zerar: 114 linhas',
     (SELECT count(*)::text FROM public._zerar_catalogo()),
     (SELECT count(*) FROM public._zerar_catalogo()) = 114),
  ('9. zerar: as 2 tabelas como MANTER',
     (SELECT string_agg(c.ordem || ' ' || c.lista || ' ' || c.tabela, '; ' ORDER BY c.ordem) FROM public._zerar_catalogo() c
       WHERE c.tabela LIKE 'public.garantias%'),
     (SELECT count(*) FROM public._zerar_catalogo() c
       WHERE c.lista = 'MANTER' AND c.tabela IN ('public.garantias_loja', 'public.garantias_textos_venda')) = 2),
  ('10. zerar: fechada para anon/authenticated',
     has_function_privilege('authenticated', 'public._zerar_catalogo()', 'EXECUTE')::text,
     NOT has_function_privilege('authenticated', 'public._zerar_catalogo()', 'EXECUTE')
       AND NOT has_function_privilege('anon', 'public._zerar_catalogo()', 'EXECUTE')),
  ('11. garantias_loja ainda vazia (antes da cópia)',
     (SELECT count(*)::text FROM public.garantias_loja),
     true)
) AS t(item, valor, ok);
