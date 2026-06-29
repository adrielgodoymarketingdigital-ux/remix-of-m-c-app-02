-- =====================================================================
-- FIX RETROATIVO: clientes com empresa_id NULO (vítimas do bug de
-- importação em massa) ficam invisíveis na busca de cliente dentro da
-- tela de abrir OS quando o contexto é uma filial, pois essa busca
-- filtra por empresa_id = empresaInfoId e NULL nunca casa com isso.
--
-- Este script preenche empresa_id com a empresa "matriz" do
-- proprietário (mesmo critério usado em criarCliente / importarEmLote
-- após o fix), apenas para clientes cujo empresa_id está NULO hoje.
-- Não afeta clientes que já têm empresa_id preenchido (ex.: os
-- vinculados corretamente a uma filial).
--
-- Como usar: cole no SQL Editor do Supabase e rode tudo de uma vez.
-- É uma transação única: a consulta de verificação no final mostra
-- quantos clientes ficaram sem matriz encontrada (deve ser 0 ou poucos
-- casos de propietário sem empresa matriz cadastrada).
-- =====================================================================

BEGIN;

UPDATE public.clientes c
SET empresa_id = m.id
FROM public.empresas m
WHERE c.empresa_id IS NULL
  AND m.proprietario_id = c.user_id
  AND m.tipo = 'matriz';

-- Verificação: clientes que continuam com empresa_id nulo
-- (proprietário sem empresa matriz cadastrada — investigar manualmente)
SELECT c.user_id, count(*) AS clientes_sem_empresa
FROM public.clientes c
WHERE c.empresa_id IS NULL
GROUP BY c.user_id;

COMMIT;
