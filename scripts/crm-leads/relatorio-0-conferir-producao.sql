-- =====================================================================
-- CRM de leads — RELATÓRIO DE MARKETING — CONFERÊNCIA ANTES DE APLICAR.
-- SOMENTE LEITURA. Rodar em produção ANTES de
-- 20261123120000_crm_leads_relatorio_marketing.sql.
-- Só lê o catálogo do Postgres (nenhum dado de cliente sai daqui).
-- Esperado: todas as linhas com ok = true.
--
-- Linhas 1 a 8: o relatório COPIA trechos destas funções. Se alguma der
-- false, PARE e me mande: a função em produção não é a do repositório, e o
-- relatório poderia divergir do card.
-- Linha 9: as 3 funções novas ainda não existem (nenhuma função existente é
-- substituída). Se der false porque você já aplicou esta migration antes,
-- pode seguir (é idempotente); qualquer outro caso, pare.
-- admin_mkt_origens: o md5 esperado é o de PRODUÇÃO
-- (90777d7132e49d03e0959406bf4d5635), não o do arquivo do repositório
-- (d9e7a4aac4de5d5ca235a5017db53da8). Em produção o corpo da função é igual
-- em lógica ao de 20261021130000_admin_mkt_origens.sql, só sem as 4 linhas de
-- comentário de dentro do corpo ("-- Espelho de PRECOS_CENTAVOS…", "-- PIX:…",
-- "-- Cartão Pagar.me:…", "-- Gateway antigo…"); comentário entra no prosrc e
-- muda o md5. Reproduzido no PGlite tirando só essas 4 linhas. Com o valor do
-- repositório a linha dava falso alarme.
-- =====================================================================
WITH f AS (
  SELECT p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('admin_mkt_cadastros_por_dia', 'admin_mkt_origens', '_crm_pagantes',
                       'admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_teste',
                       'admin_crm_funil_gasto', 'admin_crm_funil_gasto_por_anuncio')
), esperado(n, proname, h) AS (VALUES
  (1, 'admin_mkt_cadastros_por_dia',       '7eaa6fb74dc82991e071027594f103c5'),
  (2, 'admin_mkt_origens',                 '90777d7132e49d03e0959406bf4d5635'),
  (3, '_crm_pagantes',                     '83436d28276fb79cf60bef2da5fd0890'),
  (4, 'admin_crm_funil',                   '68c3b2319c99ffb294432887dbb392db'),
  (5, 'admin_crm_funil_por_anuncio',       '91a2786178ab291e7bafda361529c768'),
  (6, 'admin_crm_funil_teste',             'b761af836793047661ad77a9fb7a0601'),
  (7, 'admin_crm_funil_gasto',             '117d524b804f5bacb4a5170a06e5acd5'),
  (8, 'admin_crm_funil_gasto_por_anuncio', '02a42ad91c4ab6a84fbea04e5800c6c6')
)
SELECT * FROM (
  SELECT e.n || '. ' || e.proname || ' = versão do repositório' AS item,
         coalesce((SELECT string_agg(f.h, ', ') FROM f WHERE f.proname = e.proname), '(não existe)') AS encontrado,
         e.h AS esperado,
         coalesce((SELECT count(*) = 1 AND bool_and(f.h = e.h) FROM f WHERE f.proname = e.proname), false) AS ok
    FROM esperado e
  UNION ALL
  SELECT '9. funções novas ainda não existem (nenhuma existente é tocada)',
         coalesce((SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                      AND p.proname IN ('crm_relatorio_marketing', '_crm_rel_cadastros', '_crm_rel_funil')), '(nenhuma)'),
         '(nenhuma)',
         NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                      AND p.proname IN ('crm_relatorio_marketing', '_crm_rel_cadastros', '_crm_rel_funil'))
  UNION ALL
  SELECT '10. tabelas da 2A e da fase 1 existem (crm_gasto_meta_anuncio, crm_gasto_manual, crm_leads)',
         concat_ws(', ', to_regclass('public.crm_gasto_meta_anuncio'), to_regclass('public.crm_gasto_manual'), to_regclass('public.crm_leads')),
         'crm_gasto_meta_anuncio, crm_gasto_manual, crm_leads',
         to_regclass('public.crm_gasto_meta_anuncio') IS NOT NULL AND to_regclass('public.crm_gasto_manual') IS NOT NULL
           AND to_regclass('public.crm_leads') IS NOT NULL
  UNION ALL
  SELECT '11. colunas usadas existem (crm_leads.primeiro_contato_direcao, assinaturas.free_trial_ends_at/trial_canceled, profiles.fbclid)',
         (SELECT count(*)::text FROM information_schema.columns
           WHERE table_schema = 'public'
             AND (table_name, column_name) IN (('crm_leads', 'primeiro_contato_direcao'), ('assinaturas', 'free_trial_ends_at'),
                                               ('assinaturas', 'trial_canceled'), ('profiles', 'fbclid'), ('profiles', 'utm_source'))),
         '5',
         (SELECT count(*) = 5 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND (table_name, column_name) IN (('crm_leads', 'primeiro_contato_direcao'), ('assinaturas', 'free_trial_ends_at'),
                                               ('assinaturas', 'trial_canceled'), ('profiles', 'fbclid'), ('profiles', 'utm_source')))
) t
ORDER BY split_part(item, '.', 1)::int;
