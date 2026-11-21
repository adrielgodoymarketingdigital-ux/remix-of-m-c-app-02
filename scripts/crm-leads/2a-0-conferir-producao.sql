-- =====================================================================
-- CRM de leads — FASE 2A — CONFERÊNCIA ANTES DE APLICAR. SOMENTE LEITURA.
-- Rodar em produção ANTES de 20261122120000_crm_leads_2a_gasto_meta_anuncio.sql.
-- Só lê o catálogo do Postgres e CONTA lançamentos de crm_gasto_manual
-- (nenhum telefone, nome ou texto sai daqui).
-- Esperado: todas as linhas com ok = true. As linhas [INFORMATIVO] são para
-- anotar e me mandar.
-- meta_ads_sync existe em produção (20261024130000, conferido na fase 1).
-- Se 1 a 3 derem false: PARE. As funções do funil em produção não são as da
-- 1D do repositório (a 2A não as altera, mas o teste foi feito sobre elas).
-- =====================================================================
WITH f AS (
  SELECT p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_teste')
), manual AS (
  SELECT count(*) FILTER (WHERE g.ad_id IS NOT NULL) AS com_ad,
         count(*) FILTER (WHERE g.ad_id IS NULL) AS geral
    FROM public.crm_gasto_manual g
   WHERE g.removido_em IS NULL
     AND g.fim >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 29
)
SELECT * FROM (VALUES
  ('1. admin_crm_funil = versão 1D',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil'), '68c3b2319c99ffb294432887dbb392db',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil') = '68c3b2319c99ffb294432887dbb392db', false)),
  ('2. admin_crm_funil_por_anuncio = versão 1D',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil_por_anuncio'), '91a2786178ab291e7bafda361529c768',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil_por_anuncio') = '91a2786178ab291e7bafda361529c768', false)),
  ('3. admin_crm_funil_teste = versão 1D (1D aplicada)',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil_teste'), 'b761af836793047661ad77a9fb7a0601',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil_teste') = 'b761af836793047661ad77a9fb7a0601', false)),
  ('4. tabela crm_gasto_meta_anuncio ainda não existe',
     coalesce(to_regclass('public.crm_gasto_meta_anuncio')::text, '(não existe)'), '(não existe)',
     to_regclass('public.crm_gasto_meta_anuncio') IS NULL),
  ('5. funções da 2A ainda não existem',
     concat_ws(', ', to_regprocedure('public.crm_gravar_gasto_meta(jsonb)'),
                     to_regprocedure('public.admin_crm_funil_gasto(date, date)'),
                     to_regprocedure('public.admin_crm_funil_gasto_por_anuncio(date, date)')), '',
     to_regprocedure('public.crm_gravar_gasto_meta(jsonb)') IS NULL
       AND to_regprocedure('public.admin_crm_funil_gasto(date, date)') IS NULL
       AND to_regprocedure('public.admin_crm_funil_gasto_por_anuncio(date, date)') IS NULL),
  ('6. crm_gasto_manual e has_role(uuid, app_role) existem',
     concat_ws(', ', to_regclass('public.crm_gasto_manual'), to_regprocedure('public.has_role(uuid, app_role)')),
     'crm_gasto_manual, has_role(uuid,app_role)',
     to_regclass('public.crm_gasto_manual') IS NOT NULL AND to_regprocedure('public.has_role(uuid, app_role)') IS NOT NULL),
  ('7. [INFORMATIVO] gasto informado ativo que alcança os últimos 30 dias',
     (SELECT 'com anúncio ' || com_ad || ' · geral ' || geral FROM manual), '(anotar)', true),
  ('8. [INFORMATIVO] fuso da conta de anúncios em meta_ads_sync.fuso (o dia do n8n deve ser America/Sao_Paulo)',
     coalesce((SELECT string_agg(DISTINCT coalesce(s.fuso, '(vazio)'), ', ') FROM public.meta_ads_sync s), '(sem linha)'),
     '(anotar)', true)
) AS t(item, encontrado, esperado, ok);
