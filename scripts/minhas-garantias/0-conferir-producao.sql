-- =====================================================================
-- "Minhas garantias" — CONFERÊNCIA ANTES DE APLICAR. SOMENTE LEITURA.
-- Rodar em produção ANTES de 20261120120000_minhas_garantias_estrutura.sql.
-- Só SELECT em catálogo do Postgres; nenhum dado de cliente.
-- Tudo com ok = true → pode aplicar a estrutura.
--   - "zerar: md5 do corpo" pode dar false e mesmo assim ser seguro SE as
--     linhas 1 e 2 derem true (corpo com outro espaçamento): a migration só
--     depende da contagem (112) e da linha 1550. Se der false, me mande o valor.
-- =====================================================================
WITH f AS (
  SELECT p.prosrc
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public._zerar_catalogo()')
)
SELECT * FROM (VALUES
  ('1. zerar: linhas do catálogo',
     (SELECT count(*)::text FROM public._zerar_catalogo()), '112',
     (SELECT count(*) FROM public._zerar_catalogo()) = 112),
  ('2. zerar: linha 1550 (configuracao_estoque) uma vez só',
     (SELECT count(*)::text FROM f, regexp_matches(f.prosrc,
        '\(1550,\s*''MANTER'',\s*NULL,\s*''public\.configuracao_estoque'',\s*''user_id = \$1''\),', 'g')), '1',
     (SELECT count(*) FROM f, regexp_matches(f.prosrc,
        '\(1550,\s*''MANTER'',\s*NULL,\s*''public\.configuracao_estoque'',\s*''user_id = \$1''\),', 'g')) = 1),
  ('3. zerar: md5 do corpo = o de 20261102120000',
     (SELECT md5(prosrc) FROM f), 'c3f11a98a59e7814e23f76b6a34a8fe2',
     (SELECT md5(prosrc) FROM f) = 'c3f11a98a59e7814e23f76b6a34a8fe2'),
  ('4. zerar: ainda sem as tabelas de garantias',
     (SELECT count(*)::text FROM public._zerar_catalogo() c WHERE c.tabela LIKE 'public.garantias%'), '0',
     NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.tabela LIKE 'public.garantias%')),
  ('5. garantias_loja ainda não existe',
     coalesce(to_regclass('public.garantias_loja')::text, '(não existe)'), '(não existe)',
     to_regclass('public.garantias_loja') IS NULL),
  ('6. garantias_textos_venda ainda não existe',
     coalesce(to_regclass('public.garantias_textos_venda')::text, '(não existe)'), '(não existe)',
     to_regclass('public.garantias_textos_venda') IS NULL),
  ('7. vendas sem colunas garantia_*',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendas'
        AND column_name IN ('garantia_id', 'garantia_nome', 'garantia_meses', 'garantia_texto_id')), '0',
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendas'
        AND column_name IN ('garantia_id', 'garantia_nome', 'garantia_meses', 'garantia_texto_id'))),
  ('8. dispositivos sem garantia_padrao_id',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dispositivos'
        AND column_name = 'garantia_padrao_id'), '0',
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dispositivos'
        AND column_name = 'garantia_padrao_id')),
  ('9. funções usadas existem (is_funcionario_of, update_updated_at_column)',
     (to_regprocedure('public.is_funcionario_of(uuid)') IS NOT NULL)::text || '/' ||
     (to_regprocedure('public.update_updated_at_column()') IS NOT NULL)::text, 'true/true',
     to_regprocedure('public.is_funcionario_of(uuid)') IS NOT NULL AND to_regprocedure('public.update_updated_at_column()') IS NOT NULL),
  ('10. empresa_usuarios tem gerente_id, proprietario_id, empresa_id',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empresa_usuarios'
        AND column_name IN ('gerente_id', 'proprietario_id', 'empresa_id')), '3',
     (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empresa_usuarios'
        AND column_name IN ('gerente_id', 'proprietario_id', 'empresa_id')) = 3),
  ('11. empresas tem proprietario_id, tipo, ativa, created_at',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empresas'
        AND column_name IN ('proprietario_id', 'tipo', 'ativa', 'created_at')), '4',
     (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empresas'
        AND column_name IN ('proprietario_id', 'tipo', 'ativa', 'created_at')) = 4),
  ('12. configuracoes_loja tem termo_garantia_dispositivo_config e created_at',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'configuracoes_loja'
        AND column_name IN ('termo_garantia_dispositivo_config', 'created_at')), '2',
     (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'configuracoes_loja'
        AND column_name IN ('termo_garantia_dispositivo_config', 'created_at')) = 2),
  ('13. tipos_garantia existe',
     coalesce(to_regclass('public.tipos_garantia')::text, '(não existe)'), 'tipos_garantia',
     to_regclass('public.tipos_garantia') IS NOT NULL),
  ('14. versão do Postgres (>= 12 para coluna gerada)',
     current_setting('server_version'), '>= 12',
     current_setting('server_version_num')::int >= 120000)
) AS t(item, valor, esperado, ok);
