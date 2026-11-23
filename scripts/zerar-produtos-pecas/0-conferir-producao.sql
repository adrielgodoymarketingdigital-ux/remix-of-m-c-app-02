-- =====================================================================
-- "Começar do zero" › Produtos e peças — CONFERÊNCIA ANTES DE APLICAR.
-- SOMENTE LEITURA: só SELECT em catálogo do Postgres (pg_proc, pg_constraint,
-- pg_trigger) e nas funções/tabelas de sistema. Nenhum dado de cliente.
-- Rodar em produção ANTES de 20261124120000_zerar_produtos_pecas.sql.
-- Tudo com ok = true → pode aplicar. Algum false → NÃO aplicar; me mande a
-- linha inteira (valor_atual).
--
-- SOBRE O md5 DAS FUNÇÕES (linhas 1 e 2):
--   O corpo guardado em produção (pg_proc.prosrc) pode diferir do texto do
--   repositório SÓ por comentários (o SQL Editor / quem aplicou pode ter tirado
--   linhas "-- …") ou por espaços. Por isso a decisão (ok) usa o md5
--   NORMALIZADO: corpo sem nenhum comentário "--" e com todo espaço/quebra de
--   linha virado um espaço só. Esse md5 só bate se o CÓDIGO for o mesmo da
--   versão em vigor no repositório:
--     prévia   = 20261027120000_zerar_meus_dados_etapa1.sql
--     execução = 20261029120000_zerar_cota_registros_apagados_etapa3a.sql
--   Os md5 "exato" e "sem linhas de comentário" vêm junto só para informação
--   (se o exato também bater, o corpo é idêntico byte a byte).
--   Nenhum texto entre aspas dessas funções tem "--", então tirar comentários
--   não muda código.
--
-- Esperado (calculado no PGlite com as migrations do repositório):
--   zerar_meus_dados_previa   exato eefd365a4b2aa326d2f7aee98f05d8e2
--                             sem linhas de comentário f4d3df27c4896fdaf715afc99fdd6990
--                             normalizado 04a361c6316841c9c6a7425b272a0636
--   zerar_meus_dados_executar exato 8138ea0d5c6f6ddf55e9575a138bdb74
--                             sem linhas de comentário 7159cf52105dd188a14dd81b1ba580cd
--                             normalizado f42a00788eb4dab5c5abb6c75ef713cd
-- =====================================================================
WITH f AS (
  SELECT p.proname, p.prosrc, p.prosecdef, p.proconfig, p.oid,
         md5(p.prosrc) AS exato,
         md5(regexp_replace(p.prosrc, '^[ \t]*--[^\n]*\n', '', 'gn')) AS sem_linhas,
         md5(btrim(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))) AS normalizado
  FROM pg_proc p
  WHERE p.oid IN (to_regprocedure('public.zerar_meus_dados_previa(text[])'),
                  to_regprocedure('public.zerar_meus_dados_executar(text[], text, text)'))
),
fk AS (
  SELECT string_agg(format('%s.%s:%s', con.conrelid::regclass, a.attname, con.confdeltype), ', '
                    ORDER BY con.conrelid::regclass::text, a.attname::text) AS lista
  FROM pg_constraint con
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
  WHERE con.contype = 'f'
    AND con.confrelid IN ('public.produtos'::regclass, 'public.pecas'::regclass)
),
fk2 AS (
  SELECT COALESCE(string_agg(format('%s.%s:%s', con.conrelid::regclass, a.attname, con.confdeltype), ', '
                    ORDER BY con.conrelid::regclass::text, a.attname::text), '(nenhuma)') AS lista
  FROM pg_constraint con
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
  WHERE con.contype = 'f'
    AND con.confrelid IN ('public.entradas_estoque'::regclass, 'public.compras_xml_mapeamento'::regclass)
),
cat AS (
  SELECT string_agg(format('%s:%s:%s:%s', c.ordem, c.categoria, replace(c.tabela, 'public.', ''), c.filtro), ' | ' ORDER BY c.ordem) AS lista
  FROM public._zerar_catalogo() c
  WHERE c.tabela IN ('public.trocas_garantia', 'public.entradas_estoque', 'public.compras_xml_mapeamento',
                     'public.vendas', 'public.produtos', 'public.pecas')
),
trg AS (
  SELECT COALESCE(string_agg(format('%s.%s', t.tgrelid::regclass, t.tgname), ', ' ORDER BY 1), '(nenhum)') AS lista
  FROM pg_trigger t
  WHERE NOT t.tgisinternal
    AND (t.tgtype & 8) <> 0   -- dispara em DELETE
    AND t.tgrelid IN ('public.produtos'::regclass, 'public.pecas'::regclass,
                      'public.entradas_estoque'::regclass, 'public.compras_xml_mapeamento'::regclass)
)
SELECT * FROM (VALUES
  ('1. prévia: md5 normalizado = versão em vigor (20261027120000)',
     (SELECT format('normalizado %s | exato %s | sem linhas de comentário %s', normalizado, exato, sem_linhas) FROM f WHERE proname = 'zerar_meus_dados_previa'),
     '04a361c6316841c9c6a7425b272a0636',
     (SELECT normalizado FROM f WHERE proname = 'zerar_meus_dados_previa') = '04a361c6316841c9c6a7425b272a0636'),
  ('2. execução: md5 normalizado = versão em vigor (20261029120000)',
     (SELECT format('normalizado %s | exato %s | sem linhas de comentário %s', normalizado, exato, sem_linhas) FROM f WHERE proname = 'zerar_meus_dados_executar'),
     'f42a00788eb4dab5c5abb6c75ef713cd',
     (SELECT normalizado FROM f WHERE proname = 'zerar_meus_dados_executar') = 'f42a00788eb4dab5c5abb6c75ef713cd'),
  ('3. as duas: SECURITY DEFINER e search_path = public, pg_temp',
     (SELECT string_agg(format('%s:%s:%s', proname, prosecdef, array_to_string(proconfig, ';')), ' | ' ORDER BY proname) FROM f),
     'zerar_meus_dados_executar:true:search_path=public, pg_temp | zerar_meus_dados_previa:true:search_path=public, pg_temp',
     (SELECT count(*) FROM f WHERE prosecdef AND proconfig = ARRAY['search_path=public, pg_temp']) = 2),
  ('4. as duas: anon sem EXECUTE; authenticated e service_role com',
     (SELECT string_agg(format('%s:anon=%s,authenticated=%s,service_role=%s', proname,
        has_function_privilege('anon', oid, 'EXECUTE'), has_function_privilege('authenticated', oid, 'EXECUTE'),
        has_function_privilege('service_role', oid, 'EXECUTE')), ' | ' ORDER BY proname) FROM f),
     'anon=false, authenticated=true, service_role=true nas duas',
     (SELECT count(*) FROM f WHERE NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND has_function_privilege('authenticated', oid, 'EXECUTE') AND has_function_privilege('service_role', oid, 'EXECUTE')) = 2),
  ('5. catálogo: ordem de apagar (trocas < entradas < mapeamento < vendas < produtos < peças), tudo por user_id',
     (SELECT lista FROM cat),
     '80:vendas:trocas_garantia:… | 150:estoque:entradas_estoque:user_id = $1 | 170:estoque:compras_xml_mapeamento:user_id = $1 | 200:vendas:vendas:user_id = $1 | 370:estoque:produtos:user_id = $1 | 380:estoque:pecas:user_id = $1',
     (SELECT lista FROM cat) = '80:vendas:trocas_garantia:user_id = $1 OR venda_id IN (SELECT id FROM public.vendas WHERE user_id = $1) | 150:estoque:entradas_estoque:user_id = $1 | 170:estoque:compras_xml_mapeamento:user_id = $1 | 200:vendas:vendas:user_id = $1 | 370:estoque:produtos:user_id = $1 | 380:estoque:pecas:user_id = $1'),
  ('6. catálogo: ainda sem a categoria produtos_pecas',
     (SELECT count(*)::text FROM public._zerar_catalogo() c WHERE c.categoria = 'produtos_pecas'), '0',
     NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.categoria = 'produtos_pecas')),
  ('7. FKs que apontam para produtos e peças (a=sem ação, c=cascade, n=set null)',
     (SELECT lista FROM fk),
     'compras_xml_itens.peca_id:n, compras_xml_itens.produto_id:n, compras_xml_mapeamento.peca_id:c, compras_xml_mapeamento.produto_id:c, entradas_estoque.peca_id:n, entradas_estoque.produto_id:n, pecas.peca_pai_id:a, produtos.produto_pai_id:n, servicos.peca_id:a, trocas_garantia.produto_devolvido_id:a, trocas_garantia.produto_novo_id:a, vendas.peca_id:n, vendas.produto_id:a',
     (SELECT lista FROM fk) = 'compras_xml_itens.peca_id:n, compras_xml_itens.produto_id:n, compras_xml_mapeamento.peca_id:c, compras_xml_mapeamento.produto_id:c, entradas_estoque.peca_id:n, entradas_estoque.produto_id:n, pecas.peca_pai_id:a, produtos.produto_pai_id:n, servicos.peca_id:a, trocas_garantia.produto_devolvido_id:a, trocas_garantia.produto_novo_id:a, vendas.peca_id:n, vendas.produto_id:a'),
  ('8. FKs que apontam para entradas de estoque e mapeamento XML',
     (SELECT lista FROM fk2), 'compras_xml_itens.entrada_estoque_id:n',
     (SELECT lista FROM fk2) = 'compras_xml_itens.entrada_estoque_id:n'),
  ('9. gatilhos de DELETE em produtos, peças, entradas e mapeamento',
     (SELECT lista FROM trg), '(nenhum)',
     (SELECT lista FROM trg) = '(nenhum)'),
  ('10. fantasmas da cota aceitam produto e peça',
     (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'cota_registros_apagados_tipo_check'),
     'CHECK (tipo IN (…, ''produto'', ''peca'', …))',
     (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'cota_registros_apagados_tipo_check') LIKE '%''produto''%'
       AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'cota_registros_apagados_tipo_check') LIKE '%''peca''%'),
  ('11. colunas que a função nova usa existem',
     (SELECT string_agg(format('%s.%s', table_name, column_name), ', ' ORDER BY table_name, column_name)
        FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (
          ('compras_xml_itens', 'importacao_id'), ('compras_xml_itens', 'produto_id'), ('compras_xml_itens', 'peca_id'),
          ('compras_xml_itens', 'entrada_estoque_id'), ('servicos', 'peca_id'), ('vendas', 'dispositivo_id'),
          ('vendas', 'parcela_numero'), ('vendas', 'observacoes'), ('produtos', 'created_at'), ('pecas', 'created_at'))),
     '10 colunas',
     (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (
          ('compras_xml_itens', 'importacao_id'), ('compras_xml_itens', 'produto_id'), ('compras_xml_itens', 'peca_id'),
          ('compras_xml_itens', 'entrada_estoque_id'), ('servicos', 'peca_id'), ('vendas', 'dispositivo_id'),
          ('vendas', 'parcela_numero'), ('vendas', 'observacoes'), ('produtos', 'created_at'), ('pecas', 'created_at'))) = 10),
  ('12. bucket produtos-fotos existe',
     (SELECT COALESCE(string_agg(id, ','), '(não existe)') FROM storage.buckets WHERE id = 'produtos-fotos'), 'produtos-fotos',
     EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'produtos-fotos'))
) AS t(item, valor_atual, esperado, ok);
