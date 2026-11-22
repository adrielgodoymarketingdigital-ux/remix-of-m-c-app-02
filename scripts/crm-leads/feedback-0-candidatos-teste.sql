-- =====================================================================
-- CRM — PESQUISA DE FEEDBACK — CANDIDATOS PARA O TESTE. SOMENTE LEITURA.
-- Rodar DEPOIS da migration 20261122130000_crm_feedback_pagantes.sql e do
-- feedback-1-verificar.sql (usa a MESMA função que o n8n vai chamar, então
-- as regras são exatamente as da lista real).
--
-- Devolve até 10 pagantes elegíveis: só user_id e dias desde o 1º pagamento.
-- Nada de nome, e-mail ou telefone (a função calcula o telefone por dentro,
-- mas esta consulta só tira o user_id). Para saber quem é cada um, abra o
-- user_id no painel admin.
--
-- Troque 'feedback_teste' pela campanha que o teste vai usar: quem já recebeu
-- NESTA campanha não aparece; quem recebeu em outra nos últimos 120 dias
-- também não.
-- Depois de escolher 2, o teste no n8n chama pagantes_contato com
-- "user_ids": ["<id 1>", "<id 2>"] (CONTRATO.md, 4.8) para mandar só para eles.
-- =====================================================================
WITH params AS (
  SELECT 'feedback_teste'::text AS campanha, 120 AS pausa_dias
),
lista AS (
  SELECT (e->>'user_id')::uuid AS user_id, ord
    FROM params p,
         jsonb_array_elements(public.crm_pagantes_contato(p.campanha, 10, p.pausa_dias)->'itens') WITH ORDINALITY AS x(e, ord)
)
SELECT l.user_id,
       floor(extract(epoch FROM now() - pg.primeiro_pagamento_em) / 86400)::int AS dias_assinatura
  FROM lista l
  JOIN public._crm_pagantes(ARRAY(SELECT user_id FROM lista)) pg ON pg.user_id = l.user_id
 ORDER BY l.ord;
