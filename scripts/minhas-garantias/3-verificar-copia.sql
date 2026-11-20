-- =====================================================================
-- "Minhas garantias" — VERIFICAÇÃO DEPOIS DA CÓPIA. SOMENTE LEITURA.
-- Rodar logo depois de 20261120120100_minhas_garantias_copia_dados.sql.
-- Só contagens: nenhum nome, texto ou dado de cliente.
-- Compare a coluna "linhas" com a prévia (2-previa-copia.sql) rodada antes.
-- =====================================================================
SELECT 'por origem: ' || grupo AS item,
       count(*)::text AS linhas,
       count(DISTINCT (user_id, empresa_id))::text AS lojas,
       count(*) FILTER (WHERE revisar)::text AS revisar,
       true AS ok
FROM (
  SELECT g.*, g.origem || CASE
           WHEN g.origem = 'termo_global' THEN CASE WHEN g.origem_ref = 'sem' THEN ' / sem' ELSE ' / com:N' END
           WHEN g.origem = 'modelo' THEN CASE WHEN g.origem_ref LIKE '%:sem' THEN ' / sem' ELSE ' / com' END
           ELSE '' END AS grupo
  FROM public.garantias_loja g
  WHERE g.origem NOT IN ('manual', 'padrao')
) x
GROUP BY grupo
UNION ALL
SELECT 'tipos_garantia sem garantia correspondente (tem que ser 0)',
       count(*)::text, NULL, NULL, count(*) = 0
FROM public.tipos_garantia t
WHERE NOT EXISTS (SELECT 1 FROM public.garantias_loja g WHERE g.origem = 'tipos_garantia' AND g.origem_ref = t.id::text)
UNION ALL
SELECT 'vendas com garantia_* preenchida (tem que ser 0 nesta fase)',
       count(*)::text, NULL, NULL, count(*) = 0
FROM public.vendas
WHERE garantia_id IS NOT NULL OR garantia_texto_id IS NOT NULL OR garantia_meses IS NOT NULL OR garantia_nome IS NOT NULL
UNION ALL
SELECT 'textos congelados (tem que ser 0 nesta fase)',
       count(*)::text, NULL, NULL, count(*) = 0
FROM public.garantias_textos_venda;
