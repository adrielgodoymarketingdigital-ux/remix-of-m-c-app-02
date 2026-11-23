-- =====================================================================
-- "Começar do zero" › Produtos e peças — VERIFICAÇÃO DEPOIS DE APLICAR.
-- SOMENTE LEITURA. Rodar em produção logo depois de
-- 20261124120000_zerar_produtos_pecas.sql. Tudo com ok = true → aplicada.
-- Algum false → rodar scripts/zerar-produtos-pecas/rollback.sql e me mandar
-- a linha inteira.
-- md5 NORMALIZADO (sem comentários "--" e com espaços colapsados): ver a
-- explicação no topo de 0-conferir-producao.sql.
--   zerar_meus_dados_previa   exato c50d68e5001125aad81c19e7744b173b  normalizado dde29d23c95e58bd38acc4763f457389
--   zerar_meus_dados_executar exato 09eae24ffb3b56b86d62df354ef4441d  normalizado 2879d571ef93b589a4bd5f20e82950d7
-- =====================================================================
WITH f AS (
  SELECT p.proname, p.prosecdef, p.proconfig, p.oid,
         md5(p.prosrc) AS exato,
         md5(btrim(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))) AS normalizado
  FROM pg_proc p
  WHERE p.oid IN (to_regprocedure('public.zerar_meus_dados_previa(text[])'),
                  to_regprocedure('public.zerar_meus_dados_executar(text[], text, text)'))
)
SELECT * FROM (VALUES
  ('1. prévia nova (md5 normalizado)',
     (SELECT format('normalizado %s | exato %s', normalizado, exato) FROM f WHERE proname = 'zerar_meus_dados_previa'),
     'dde29d23c95e58bd38acc4763f457389',
     (SELECT normalizado FROM f WHERE proname = 'zerar_meus_dados_previa') = 'dde29d23c95e58bd38acc4763f457389'),
  ('2. execução nova (md5 normalizado)',
     (SELECT format('normalizado %s | exato %s', normalizado, exato) FROM f WHERE proname = 'zerar_meus_dados_executar'),
     '2879d571ef93b589a4bd5f20e82950d7',
     (SELECT normalizado FROM f WHERE proname = 'zerar_meus_dados_executar') = '2879d571ef93b589a4bd5f20e82950d7'),
  ('3. as duas: SECURITY DEFINER e search_path = public, pg_temp',
     (SELECT string_agg(format('%s:%s:%s', proname, prosecdef, array_to_string(proconfig, ';')), ' | ' ORDER BY proname) FROM f),
     'true e search_path=public, pg_temp nas duas',
     (SELECT count(*) FROM f WHERE prosecdef AND proconfig = ARRAY['search_path=public, pg_temp']) = 2),
  ('4. as duas: anon sem EXECUTE; authenticated e service_role com',
     (SELECT string_agg(format('%s:anon=%s,authenticated=%s,service_role=%s', proname,
        has_function_privilege('anon', oid, 'EXECUTE'), has_function_privilege('authenticated', oid, 'EXECUTE'),
        has_function_privilege('service_role', oid, 'EXECUTE')), ' | ' ORDER BY proname) FROM f),
     'anon=false, authenticated=true, service_role=true nas duas',
     (SELECT count(*) FROM f WHERE NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND has_function_privilege('authenticated', oid, 'EXECUTE') AND has_function_privilege('service_role', oid, 'EXECUTE')) = 2),
  ('5. catálogo não mudou: sem a categoria produtos_pecas',
     (SELECT count(*)::text FROM public._zerar_catalogo() c WHERE c.categoria = 'produtos_pecas'), '0',
     NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.categoria = 'produtos_pecas'))
) AS t(item, valor_atual, esperado, ok);
