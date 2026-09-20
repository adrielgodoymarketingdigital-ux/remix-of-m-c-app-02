-- DIAGNÓSTICO SISTÊMICO (SOMENTE LEITURA) — parcelas de pagamento duplo órfãs / baixas dessincronizadas
-- Todas as contas do sistema. Nenhuma escrita. Rodar bloco a bloco no SQL Editor.
--
-- Definições
--   secundária = vendas.observacoes = 'pagamento_duplo_secundario' (não cancelada, não excluída)
--   principal  = mesma grupo_venda + MESMO item (dispositivo/produto/peça), observacoes <> marcador
--   órfã       = secundária ativa sem principal ATIVA (principal cancelada, ou ausente)

-- A) Parcelas secundárias órfãs, por causa e situação
WITH sec AS (
  SELECT * FROM vendas WHERE observacoes = 'pagamento_duplo_secundario' AND cancelada IS NOT TRUE AND deleted_at IS NULL
), cls AS (
  SELECT s.*,
    EXISTS (SELECT 1 FROM vendas p WHERE p.grupo_venda = s.grupo_venda AND p.observacoes IS DISTINCT FROM 'pagamento_duplo_secundario'
            AND p.dispositivo_id IS NOT DISTINCT FROM s.dispositivo_id AND p.produto_id IS NOT DISTINCT FROM s.produto_id AND p.peca_id IS NOT DISTINCT FROM s.peca_id
            AND p.cancelada IS NOT TRUE AND p.deleted_at IS NULL) AS tem_principal_ativa,
    EXISTS (SELECT 1 FROM vendas p WHERE p.grupo_venda = s.grupo_venda AND p.observacoes IS DISTINCT FROM 'pagamento_duplo_secundario'
            AND p.dispositivo_id IS NOT DISTINCT FROM s.dispositivo_id AND p.produto_id IS NOT DISTINCT FROM s.produto_id AND p.peca_id IS NOT DISTINCT FROM s.peca_id) AS tem_alguma_principal
  FROM sec s
)
SELECT CASE WHEN NOT tem_alguma_principal THEN 'principal_ausente' ELSE 'principal_cancelada_ou_excluida' END AS causa,
       forma_pagamento IN ('a_receber','a_prazo') AS a_prazo, recebido IS TRUE AS recebida,
       count(*) parcelas, count(DISTINCT user_id) contas, round(sum(total),2) valor
FROM cls WHERE NOT tem_principal_ativa
GROUP BY 1,2,3 ORDER BY 1,2,3;

-- B) Contas a Receber ABERTAS penduradas em parcelas órfãs (cobrança fantasma)
WITH orf AS (
  SELECT s.id, s.user_id FROM vendas s
  WHERE s.observacoes = 'pagamento_duplo_secundario' AND s.cancelada IS NOT TRUE AND s.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM vendas p WHERE p.grupo_venda = s.grupo_venda AND p.observacoes IS DISTINCT FROM 'pagamento_duplo_secundario'
        AND p.dispositivo_id IS NOT DISTINCT FROM s.dispositivo_id AND p.produto_id IS NOT DISTINCT FROM s.produto_id AND p.peca_id IS NOT DISTINCT FROM s.peca_id
        AND p.cancelada IS NOT TRUE AND p.deleted_at IS NULL)
)
SELECT c.status, count(*) contas_a_receber, count(DISTINCT c.user_id) contas_de_usuario, round(sum(c.valor),2) valor
FROM contas c JOIN orf ON c.descricao = 'venda_id:' || orf.id::text WHERE c.tipo = 'receber' GROUP BY 1;

-- C) Recebidas SEM custo confirmado (custo_unitario <= 0) — as que hoje ficam FORA do lucro
SELECT count(*) parcelas, count(DISTINCT user_id) contas, round(sum(total),2) receita_fora_do_lucro
FROM vendas WHERE observacoes = 'pagamento_duplo_secundario' AND forma_pagamento IN ('a_receber','a_prazo')
  AND recebido IS TRUE AND coalesce(custo_unitario,0) <= 0 AND cancelada IS NOT TRUE AND deleted_at IS NULL;

-- D) Baixa dessincronizada: conta 'recebido' mas linha da venda NÃO recebida
SELECT (v.observacoes = 'pagamento_duplo_secundario') AS secundaria,
       (c.data_pagamento < DATE '2026-08-30') AS baixa_antes_do_reconhecimento_diferido,
       count(*) linhas, count(DISTINCT v.user_id) contas, round(sum(c.valor),2) valor
FROM contas c JOIN vendas v ON c.descricao = 'venda_id:' || v.id::text
WHERE c.tipo = 'receber' AND c.status = 'recebido' AND v.recebido IS NOT TRUE
  AND v.forma_pagamento IN ('a_receber','a_prazo') AND v.cancelada IS NOT TRUE AND v.deleted_at IS NULL
GROUP BY 1,2 ORDER BY 1,2;

-- E) Sentido inverso: linha 'recebida' mas conta ainda 'pendente'
SELECT count(*) linhas, count(DISTINCT v.user_id) contas, round(sum(c.valor),2) valor
FROM contas c JOIN vendas v ON c.descricao = 'venda_id:' || v.id::text
WHERE c.tipo = 'receber' AND c.status = 'pendente' AND v.recebido IS TRUE
  AND v.forma_pagamento IN ('a_receber','a_prazo') AND v.cancelada IS NOT TRUE AND v.deleted_at IS NULL;

-- F) Tamanho da base exposta (uso da funcionalidade)
SELECT count(DISTINCT user_id) contas_com_pagto_duplo_a_receber, count(DISTINCT grupo_venda) vendas_com_2a_forma_a_receber,
       count(DISTINCT grupo_venda) FILTER (WHERE EXISTS (SELECT 1 FROM vendas p WHERE p.grupo_venda = s.grupo_venda AND p.observacoes IS DISTINCT FROM 'pagamento_duplo_secundario' AND p.cancelada IS TRUE)) AS dessas_com_principal_cancelada
FROM vendas s WHERE observacoes = 'pagamento_duplo_secundario' AND forma_pagamento IN ('a_receber','a_prazo') AND deleted_at IS NULL;
