-- =====================================================================
-- Verificação da migration 20261007120000_troca_devolucao_diferenca.sql (Fase 2A)
-- SOMENTE LEITURA. Rodar DEPOIS de aplicar a migration. Um único SELECT
-- (o SQL Editor mostra só o último resultado), sem tabela temporária.
-- Devolve UMA linha; a coluna "resultado" deve ser 'OK' (ou 'FALHOU: motivo').
--
-- O que prova:
--  1) Texto: tirando a seção 9 da definição viva da função, o md5 é exatamente
--     o da Fase 1 (33285ff50d1700e8b074867a686dccfc) → seções 1–8, assinatura,
--     SECURITY DEFINER e search_path iguais aos de antes.
--  2) Dados: toda linha venda_pdv que a função devolve (todas as contas com
--     vendas) bate com a fórmula da Fase 1 (total − descontos − troca − 2ª forma
--     a receber, limitado a 0): 0 diferenças, com e sem troca.
--  3) Seção 9: o número de linhas devolucao_troca é exatamente o número de
--     devoluções ativas em vendas_trocas (hoje 0) e o total bate.
--  4) Estrutura: caixa_id com FK para caixas, os 2 CHECKs, o índice parcial,
--     anon sem EXECUTE nas 3 funções do Extrato.
--
-- Antes da migration (linha de base): deve dar 33285ff50d1700e8b074867a686dccfc
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
    md5(replace(def, $secao9$
    UNION ALL

    -- 9) DEVOLUÇÃO DA DIFERENÇA DA TROCA (saída) — Fase 2: o aparelho recebido
    -- valeu mais que a venda e a loja devolveu a diferença (dinheiro ou Pix).
    -- Data = data da venda (acompanha "alterar data"); some com a troca cancelada
    -- ou quando não sobra nenhuma linha ativa da venda.
    SELECT
      (gv.data AT TIME ZONE 'America/Sao_Paulo')::date,
      'saida',
      'devolucao_troca',
      vt.valor_devolvido,
      'Devolução de troca (' || CASE vt.forma_devolucao WHEN 'pix' THEN 'Pix' ELSE 'Dinheiro' END || ')',
      vt.id,
      true
    FROM public.vendas_trocas vt
    JOIN LATERAL (
      SELECT min(v.data) AS data
      FROM public.vendas v
      WHERE v.grupo_venda = vt.grupo_venda
        AND v.user_id = vt.user_id
        AND v.deleted_at IS NULL
        AND COALESCE(v.cancelada, false) = false
    ) gv ON gv.data IS NOT NULL
    WHERE vt.user_id = p_user_id
      AND (p_empresa_id IS NULL OR (
            CASE WHEN p_is_filial THEN vt.empresa_id = p_empresa_id
                 ELSE (vt.empresa_id = p_empresa_id OR vt.empresa_id IS NULL) END
          ))
      AND vt.cancelada = false
      AND vt.valor_devolvido > 0
      AND (p_data_inicio IS NULL OR (gv.data AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio)
      AND (p_data_fim IS NULL OR (gv.data AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim)
$secao9$, '')) = '33285ff50d1700e8b074867a686dccfc' AS funcao_igual_fase1_fora_secao9,
    position('devolucao_troca' IN def) > 0 AS funcao_tem_secao9,
    position('COALESCE(v.valor_troca, 0)' IN def) > 0 AS funcao_mantem_troca_fase1,
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
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.vendas_trocas'::regclass AND contype = 'f'
              AND confrelid = 'public.caixas'::regclass) AS caixa_id_fk_ok,
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.vendas_trocas'::regclass
            AND conname = 'vendas_trocas_devolucao_coerente') AS check_coerente_ok,
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.vendas_trocas'::regclass
            AND conname = 'vendas_trocas_devolucao_menor_que_entrada') AS check_menor_entrada_ok,
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'vendas_trocas'
            AND indexname = 'idx_vendas_trocas_caixa_devolucao') AS indice_ok
),
usuarios AS (
  SELECT user_id FROM public.vendas WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.vendas_trocas
),
ev AS (
  SELECT e.origem, e.referencia_id, e.valor
  FROM usuarios u
  CROSS JOIN LATERAL public.fn_extrato_eventos_raw(u.user_id, NULL, false, NULL, NULL) e
  WHERE e.origem IN ('venda_pdv', 'devolucao_troca')
),
cmp AS (
  SELECT
    ev.valor AS valor_novo,
    GREATEST(
      COALESCE(v.total, 0)
        - COALESCE(v.valor_desconto_manual, 0)
        - COALESCE(v.valor_desconto_cupom, 0)
        - COALESCE(v.valor_troca, 0)
        - (CASE WHEN v.segunda_forma_pagamento = 'a_receber' AND COALESCE(v.valor_segunda_forma, 0) > 0
                THEN v.valor_segunda_forma ELSE 0 END),
      0
    ) AS valor_fase1,
    v.valor_troca IS NOT NULL AS com_troca
  FROM ev JOIN public.vendas v ON v.id = ev.referencia_id
  WHERE ev.origem = 'venda_pdv'
),
dados AS (
  SELECT
    count(*) AS linhas_venda_pdv,
    count(*) FILTER (WHERE com_troca) AS linhas_com_troca,
    count(*) FILTER (WHERE valor_novo <> valor_fase1) AS linhas_venda_com_diferenca
  FROM cmp
),
devolucoes AS (
  SELECT vt.valor_devolvido
  FROM public.vendas_trocas vt
  WHERE vt.cancelada = false AND vt.valor_devolvido > 0
    AND EXISTS (SELECT 1 FROM public.vendas v
                WHERE v.grupo_venda = vt.grupo_venda AND v.user_id = vt.user_id
                  AND v.deleted_at IS NULL AND COALESCE(v.cancelada, false) = false)
),
secao9 AS (
  SELECT
    (SELECT count(*) FROM ev WHERE origem = 'devolucao_troca') AS linhas_secao9,
    (SELECT COALESCE(sum(valor), 0) FROM ev WHERE origem = 'devolucao_troca') AS total_secao9,
    (SELECT count(*) FROM devolucoes) AS devolucoes_ativas,
    (SELECT COALESCE(sum(valor_devolvido), 0) FROM devolucoes) AS total_devolucoes_ativas
)
SELECT
  CASE WHEN t.funcao_igual_fase1_fora_secao9 AND t.funcao_tem_secao9 AND t.funcao_mantem_troca_fase1
         AND t.funcao_security_definer AND t.funcao_search_path_public
         AND g.anon_sem_execute_extrato AND g.authenticated_executa_extrato AND g.funcoes_extrato = 3
         AND s.caixa_id_fk_ok AND s.check_coerente_ok AND s.check_menor_entrada_ok AND s.indice_ok
         AND d.linhas_venda_pdv > 0 AND d.linhas_venda_com_diferenca = 0
         AND n.linhas_secao9 = n.devolucoes_ativas AND n.total_secao9 = n.total_devolucoes_ativas
       THEN 'OK'
       ELSE 'FALHOU: ' || concat_ws(', ',
         CASE WHEN NOT t.funcao_igual_fase1_fora_secao9 THEN 'função difere da Fase 1 além da seção 9' END,
         CASE WHEN NOT t.funcao_tem_secao9 THEN 'função sem a seção 9' END,
         CASE WHEN NOT t.funcao_mantem_troca_fase1 THEN 'função perdeu a linha da troca da Fase 1' END,
         CASE WHEN NOT t.funcao_security_definer THEN 'função perdeu SECURITY DEFINER' END,
         CASE WHEN NOT t.funcao_search_path_public THEN 'search_path mudou' END,
         CASE WHEN NOT g.anon_sem_execute_extrato THEN 'anon executa o extrato' END,
         CASE WHEN NOT g.authenticated_executa_extrato THEN 'authenticated sem EXECUTE' END,
         CASE WHEN g.funcoes_extrato <> 3 THEN 'número de funções do extrato <> 3' END,
         CASE WHEN NOT s.caixa_id_fk_ok THEN 'vendas_trocas.caixa_id sem FK para caixas' END,
         CASE WHEN NOT s.check_coerente_ok THEN 'falta CHECK de devolução coerente' END,
         CASE WHEN NOT s.check_menor_entrada_ok THEN 'falta CHECK devolução < entrada' END,
         CASE WHEN NOT s.indice_ok THEN 'falta índice das devoluções por caixa' END,
         CASE WHEN d.linhas_venda_pdv = 0 THEN 'nenhuma linha venda_pdv comparada' END,
         CASE WHEN d.linhas_venda_com_diferenca > 0 THEN d.linhas_venda_com_diferenca || ' linha(s) de venda mudaram de valor' END,
         CASE WHEN n.linhas_secao9 <> n.devolucoes_ativas THEN 'seção 9 com ' || n.linhas_secao9 || ' linha(s), esperado ' || n.devolucoes_ativas END,
         CASE WHEN n.total_secao9 <> n.total_devolucoes_ativas THEN 'total da seção 9 não bate com as devoluções' END)
  END AS resultado,
  t.*, g.*, s.*, d.*, n.*
FROM textual t, grants_fn g, estrutura s, dados d, secao9 n;
