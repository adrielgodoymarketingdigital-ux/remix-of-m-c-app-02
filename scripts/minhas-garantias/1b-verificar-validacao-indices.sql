-- =====================================================================
-- "Minhas garantias" — VERIFICAÇÃO DEPOIS DA VALIDAÇÃO E DOS ÍNDICES. SOMENTE LEITURA.
-- Rodar depois de 20261120120010 (validar), 20261120120020 e 20261120120030 (índices).
-- Tudo com ok = true → pronto. Nenhum dado de cliente.
--   - constraint com ok = false: rodar 20261120120010 de novo;
--   - índice ausente: rodar o arquivo do índice; índice "inválido": rodar,
--     sozinho, DROP INDEX CONCURRENTLY public.<nome>; e o arquivo do índice de novo.
-- =====================================================================
SELECT 'constraint ' || n.nome AS item,
       CASE WHEN c.oid IS NULL THEN 'ausente' WHEN c.convalidated THEN 'validada' ELSE 'NÃO validada' END AS valor,
       coalesce(c.convalidated, false) AS ok
FROM (VALUES ('vendas_garantia_id_fkey'), ('vendas_garantia_texto_id_fkey'), ('vendas_garantia_meses_check'),
             ('vendas_garantia_nome_check'), ('vendas_garantia_copia_check'), ('dispositivos_garantia_padrao_id_fkey')) AS n(nome)
LEFT JOIN pg_constraint c ON c.conname = n.nome
UNION ALL
SELECT 'índice ' || n.nome,
       CASE WHEN i.indexrelid IS NULL THEN 'ausente' WHEN i.indisvalid AND i.indisready THEN 'válido' ELSE 'INVÁLIDO' END,
       coalesce(i.indisvalid AND i.indisready, false)
FROM (VALUES ('idx_vendas_garantia_id'), ('idx_vendas_garantia_texto_id')) AS n(nome)
LEFT JOIN pg_index i ON i.indexrelid = to_regclass('public.' || n.nome);
