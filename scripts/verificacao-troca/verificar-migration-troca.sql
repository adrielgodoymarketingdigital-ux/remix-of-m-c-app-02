-- =====================================================================
-- Verificação da migration 20261006120000_troca_registrada_na_venda.sql
-- SOMENTE LEITURA. Rodar DEPOIS de aplicar a migration.
--
-- Como rodar: colar este arquivo inteiro no SQL Editor do Supabase e
-- executar. É UM único SELECT (o editor mostra só o resultado do último
-- statement), sem tabela temporária e sem criar nada. Devolve UMA linha;
-- a coluna "resultado" deve ser 'OK'. Qualquer outra coisa lista o que falhou.
--
-- Como a comparação "função nova x antiga" é feita, sem guardar a antiga:
--  1) Prova textual: a migration só INSERE uma linha na seção 1. Tirando
--     essa linha da definição viva da função nova, o md5 tem que ser
--     exatamente o da definição antiga lida em 06/10/2026
--     (3274bc7143eb266489eb639c140bce19). Isso garante que todo o resto
--     (assinatura, SECURITY DEFINER, search_path, as outras 7 seções) é
--     byte a byte o de antes.
--  2) Prova nos dados: para TODAS as linhas venda_pdv que a função nova
--     devolve (todas as contas com vendas), recalcula o valor com a fórmula
--     antiga da seção 1 direto da tabela vendas. Linha com valor_troca NULL
--     tem que bater exatamente (diferença zero). Linha com troca tem que
--     diferir exatamente pela troca (limitada ao valor da linha).
--
-- Antes da migration (opcional, linha de base): este SELECT deve dar
-- 3274bc7143eb266489eb639c140bce19
--   SELECT md5(pg_get_functiondef('public.fn_extrato_eventos_raw(uuid,uuid,boolean,date,date)'::regprocedure));
-- =====================================================================
WITH
fn AS (
  SELECT p.oid, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  WHERE p.oid = 'public.fn_extrato_eventos_raw(uuid,uuid,boolean,date,date)'::regprocedure
),
textual AS (
  SELECT
    md5(replace(def,
      E'          - COALESCE(v.valor_troca, 0) -- aparelho recebido na troca: pagamento em espécie, não entra no caixa\n',
      '')) = '3274bc7143eb266489eb639c140bce19' AS funcao_igual_fora_da_linha_da_troca,
    position('COALESCE(v.valor_troca, 0)' IN def) > 0 AS funcao_tem_linha_da_troca,
    prosecdef AS funcao_security_definer,
    proconfig::text = '{search_path=public}' AS funcao_search_path_public
  FROM fn
),
grants_fn AS (
  SELECT
    bool_and(NOT has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_sem_execute_extrato,
    bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS authenticated_executa_extrato,
    count(*) AS funcoes_extrato
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('fn_extrato_eventos_raw', 'fn_extrato_lista', 'fn_extrato_resumo')
),
estrutura AS (
  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'vendas' AND column_name = 'valor_troca'
              AND data_type = 'numeric' AND numeric_precision = 12 AND numeric_scale = 2) AS coluna_valor_troca_ok,
    (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.vendas_trocas'::regclass) AS vendas_trocas_rls_ligada,
    NOT (has_table_privilege('anon', 'public.vendas_trocas', 'SELECT')
         OR has_table_privilege('anon', 'public.vendas_trocas', 'INSERT')
         OR has_table_privilege('anon', 'public.vendas_trocas', 'UPDATE')
         OR has_table_privilege('anon', 'public.vendas_trocas', 'DELETE')
         OR has_table_privilege('anon', 'public.vendas_trocas', 'TRUNCATE')) AS vendas_trocas_anon_sem_acesso,
    NOT (has_table_privilege('authenticated', 'public.vendas_trocas', 'DELETE')
         OR has_table_privilege('authenticated', 'public.vendas_trocas', 'TRUNCATE')) AS vendas_trocas_sem_delete_truncate,
    (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendas_trocas') AS vendas_trocas_policies,
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.vendas_trocas'::regclass AND contype = 'u'
              AND conname = 'vendas_trocas_grupo_venda_unico') AS vendas_trocas_unique_grupo
),
ev AS (
  SELECT e.referencia_id, e.valor
  FROM (SELECT DISTINCT v.user_id FROM public.vendas v WHERE v.user_id IS NOT NULL) u
  CROSS JOIN LATERAL public.fn_extrato_eventos_raw(u.user_id, NULL, false, NULL, NULL) e
  WHERE e.origem = 'venda_pdv'
),
cmp AS (
  SELECT
    ev.valor AS valor_novo,
    v.valor_troca,
    -- fórmula ANTIGA da seção 1 (sem a troca)
    GREATEST(
      COALESCE(v.total, 0)
        - COALESCE(v.valor_desconto_manual, 0)
        - COALESCE(v.valor_desconto_cupom, 0)
        - (CASE WHEN v.segunda_forma_pagamento = 'a_receber' AND COALESCE(v.valor_segunda_forma, 0) > 0
                THEN v.valor_segunda_forma ELSE 0 END),
      0
    ) AS valor_antigo
  FROM ev JOIN public.vendas v ON v.id = ev.referencia_id
),
dados AS (
  SELECT
    count(*) FILTER (WHERE valor_troca IS NULL) AS linhas_sem_troca,
    count(*) FILTER (WHERE valor_troca IS NULL AND valor_novo <> valor_antigo) AS linhas_sem_troca_com_diferenca,
    count(*) FILTER (WHERE valor_troca IS NOT NULL) AS linhas_com_troca,
    count(*) FILTER (WHERE valor_troca IS NOT NULL
                       AND valor_novo <> valor_antigo - LEAST(valor_troca, valor_antigo)) AS linhas_com_troca_inconsistentes
  FROM cmp
)
SELECT
  CASE WHEN t.funcao_igual_fora_da_linha_da_troca AND t.funcao_tem_linha_da_troca
         AND t.funcao_security_definer AND t.funcao_search_path_public
         AND g.anon_sem_execute_extrato AND g.authenticated_executa_extrato AND g.funcoes_extrato = 3
         AND s.coluna_valor_troca_ok AND s.vendas_trocas_rls_ligada AND s.vendas_trocas_anon_sem_acesso
         AND s.vendas_trocas_sem_delete_truncate AND s.vendas_trocas_policies = 6 AND s.vendas_trocas_unique_grupo
         AND d.linhas_sem_troca > 0 AND d.linhas_sem_troca_com_diferenca = 0 AND d.linhas_com_troca_inconsistentes = 0
       THEN 'OK'
       ELSE 'FALHOU: ' || concat_ws(', ',
         CASE WHEN NOT t.funcao_igual_fora_da_linha_da_troca THEN 'função difere da antiga além da linha da troca' END,
         CASE WHEN NOT t.funcao_tem_linha_da_troca THEN 'função sem a linha da troca' END,
         CASE WHEN NOT t.funcao_security_definer THEN 'função perdeu SECURITY DEFINER' END,
         CASE WHEN NOT t.funcao_search_path_public THEN 'search_path mudou' END,
         CASE WHEN NOT g.anon_sem_execute_extrato THEN 'anon executa o extrato' END,
         CASE WHEN NOT g.authenticated_executa_extrato THEN 'authenticated sem EXECUTE' END,
         CASE WHEN g.funcoes_extrato <> 3 THEN 'número de funções do extrato <> 3' END,
         CASE WHEN NOT s.coluna_valor_troca_ok THEN 'vendas.valor_troca ausente ou tipo errado' END,
         CASE WHEN NOT s.vendas_trocas_rls_ligada THEN 'RLS desligada em vendas_trocas' END,
         CASE WHEN NOT s.vendas_trocas_anon_sem_acesso THEN 'anon tem acesso a vendas_trocas' END,
         CASE WHEN NOT s.vendas_trocas_sem_delete_truncate THEN 'authenticated tem DELETE/TRUNCATE em vendas_trocas' END,
         CASE WHEN s.vendas_trocas_policies <> 6 THEN 'vendas_trocas não tem 6 policies' END,
         CASE WHEN NOT s.vendas_trocas_unique_grupo THEN 'falta UNIQUE(grupo_venda)' END,
         CASE WHEN d.linhas_sem_troca = 0 THEN 'nenhuma linha venda_pdv comparada' END,
         CASE WHEN d.linhas_sem_troca_com_diferenca > 0 THEN d.linhas_sem_troca_com_diferenca || ' linha(s) sem troca mudaram de valor' END,
         CASE WHEN d.linhas_com_troca_inconsistentes > 0 THEN d.linhas_com_troca_inconsistentes || ' linha(s) com troca com valor inesperado' END)
  END AS resultado,
  t.*, g.*, s.*, d.*
FROM textual t, grants_fn g, estrutura s, dados d;
