-- =====================================================================
-- CRM de leads — FASE 1D — VERIFICAÇÃO depois da migration
-- 20261121140000_crm_leads_1d_teste.sql. SOMENTE LEITURA.
-- Esperado: todas as linhas com ok = true (a 7 é informativa: anotar e
-- comparar com a linha 9 da conferência).
-- (No SQL Editor auth.uid() é nulo: chamar admin_crm_funil_teste aqui DEVE
--  dar "Apenas administradores...".)
-- =====================================================================
WITH f AS (
  SELECT p.oid, p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS ret
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_teste')
), ex AS (SELECT * FROM f WHERE proname = 'admin_crm_funil_teste'),
coorte AS (
  -- Coorte do card no padrão "Últimos 30 dias" (datas de Brasília): 1º contato
  -- no período, o cliente escreveu primeiro, cadastro novo. Só contagens.
  SELECT l.cadastro_user_id AS uid
    FROM public.crm_leads l
    JOIN public.profiles pr ON pr.user_id = l.cadastro_user_id
   WHERE l.primeiro_contato_em >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 29)::timestamp AT TIME ZONE 'America/Sao_Paulo'
     AND l.primeiro_contato_direcao = 'entrada'
     AND pr.created_at >= l.primeiro_contato_em - interval '24 hours'
), sit AS (
  SELECT count(*) AS cadastros,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_started_at IS NOT NULL)) AS so_admin,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND (t.trial_started_at IS NOT NULL OR t.free_trial_ends_at IS NOT NULL))) AS com_teste,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at > now() AND t.trial_canceled IS NOT TRUE)) AS ativo,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.free_trial_ends_at <= now())) AS vencido,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.assinaturas t WHERE t.user_id = c.uid AND t.trial_canceled IS TRUE)) AS cancelado
    FROM coorte c
)
SELECT * FROM (VALUES
  ('1. admin_crm_funil e admin_crm_funil_por_anuncio = versão 1D',
     (SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio')),
     '68c3b2319c99ffb294432887dbb392db / 91a2786178ab291e7bafda361529c768',
     coalesce((SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio'))
       = '68c3b2319c99ffb294432887dbb392db / 91a2786178ab291e7bafda361529c768', false)),
  ('2. parâmetros e colunas de retorno das 2 funções do funil NÃO mudaram',
     (SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio')),
     '(iguais à linha 7 da conferência)',
     coalesce((SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio'))
       = 'admin_crm_funil(p_inicio date, p_fim date) -> TABLE(conversas bigint, conversas_anuncio bigint, ja_clientes bigint, cadastros bigint, testes bigint, assinantes bigint, opt_outs bigint, gasto_meta_centavos bigint, gasto_meta_dias bigint, gasto_manual_centavos bigint, gasto_manual_lancamentos bigint) | admin_crm_funil_por_anuncio(p_inicio date, p_fim date) -> TABLE(ad_id text, ad_titulo text, conversas bigint, cadastros bigint, testes bigint, assinantes bigint, gasto_manual_centavos bigint)', false)),
  ('3. admin_crm_funil_teste: existe, SECURITY DEFINER, STABLE, has_role, search_path fixo',
     (SELECT h FROM ex), 'b761af836793047661ad77a9fb7a0601',
     coalesce((SELECT p.prosecdef AND p.provolatile = 's' AND p.prosrc LIKE '%has_role(auth.uid(), ''admin'')%'
                  AND p.proconfig @> ARRAY['search_path=public'] AND ex.h = 'b761af836793047661ad77a9fb7a0601'
                 FROM ex JOIN pg_proc p ON p.oid = ex.oid), false)),
  ('4. admin_crm_funil_teste: parâmetros e colunas (só contagens)',
     (SELECT args || ' -> ' || ret FROM ex),
     'p_inicio date, p_fim date -> TABLE(teste_ativo_agora bigint, teste_acabou_sem_pagar bigint, teste_cancelado bigint, assinantes bigint)',
     coalesce((SELECT args || ' -> ' || ret FROM ex)
       = 'p_inicio date, p_fim date -> TABLE(teste_ativo_agora bigint, teste_acabou_sem_pagar bigint, teste_cancelado bigint, assinantes bigint)', false)),
  ('5. admin_crm_funil_teste: authenticated sim, anon não, PUBLIC não',
     (SELECT has_function_privilege('authenticated', oid, 'EXECUTE')::text || ' / ' || has_function_privilege('anon', oid, 'EXECUTE')::text
             || ' / ' || (SELECT p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) FROM pg_proc p WHERE p.oid = ex.oid)::text FROM ex),
     'true / false / false',
     coalesce((SELECT has_function_privilege('authenticated', oid, 'EXECUTE') AND NOT has_function_privilege('anon', oid, 'EXECUTE')
                  AND NOT (SELECT p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) FROM pg_proc p WHERE p.oid = ex.oid) FROM ex), false)),
  ('6. funil e funil por anúncio: anon continua sem executar',
     (SELECT string_agg(has_function_privilege('anon', oid, 'EXECUTE')::text, ' / ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio')),
     'false / false',
     coalesce((SELECT bool_and(NOT has_function_privilege('anon', oid, 'EXECUTE')) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio')), false)),
  ('7. [INFORMATIVO] cadastros novos do funil nos últimos 30 dias (só contagens)',
     (SELECT 'cadastros ' || cadastros || ' · com teste (coluna testes) ' || com_teste || ' · em teste agora ' || ativo
             || ' · prazo do teste já passou ' || vencido || ' · cancelados ' || cancelado FROM sit),
     '(anotar)', true)
) AS t(item, encontrado, esperado, ok);
