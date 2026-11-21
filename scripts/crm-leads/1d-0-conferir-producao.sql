-- =====================================================================
-- CRM de leads — FASE 1D — CONFERÊNCIA ANTES DE APLICAR. SOMENTE LEITURA.
-- Rodar em produção ANTES de 20261121140000_crm_leads_1d_teste.sql.
-- Só lê o catálogo do Postgres e CONTA linhas (nenhum nome, e-mail,
-- telefone ou id sai daqui).
-- Esperado: todas as linhas com ok = true. A linha 9 é [INFORMATIVO]: anotar
-- e me mandar.
-- Se 1 ou 2 der false: PARE. A função em produção não é a da 1C e o
-- rollback da 1D não a devolveria igual.
-- =====================================================================
WITH f AS (
  SELECT p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS ret
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_excluidos')
), col AS (
  SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY column_name) AS s
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'assinaturas'
     AND column_name IN ('free_trial_ends_at', 'trial_canceled', 'trial_started_at')
), coorte AS (
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
  ('1. admin_crm_funil = versão da 1C (o rollback devolve esta)',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil'), '445970a1a10092880f243b55377c8a99',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil') = '445970a1a10092880f243b55377c8a99', false)),
  ('2. admin_crm_funil_por_anuncio = versão da 1C',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil_por_anuncio'), 'e006b431c851a362020391803e7be6c7',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil_por_anuncio') = 'e006b431c851a362020391803e7be6c7', false)),
  ('3. admin_crm_funil_excluidos = versão da 1C (1C aplicada)',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil_excluidos'), 'eed99d58377b004eed51575397bb542b',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil_excluidos') = 'eed99d58377b004eed51575397bb542b', false)),
  ('4. admin_crm_funil_teste ainda não existe',
     (to_regprocedure('public.admin_crm_funil_teste(date, date)') IS NOT NULL)::text, 'false',
     to_regprocedure('public.admin_crm_funil_teste(date, date)') IS NULL),
  ('5. colunas de teste em assinaturas',
     (SELECT s FROM col),
     'free_trial_ends_at timestamp with time zone, trial_canceled boolean, trial_started_at timestamp with time zone',
     coalesce((SELECT s FROM col) = 'free_trial_ends_at timestamp with time zone, trial_canceled boolean, trial_started_at timestamp with time zone', false)),
  ('6. _crm_pagantes(uuid[]) existe (a função nova usa)',
     (to_regprocedure('public._crm_pagantes(uuid[])') IS NOT NULL)::text, 'true',
     to_regprocedure('public._crm_pagantes(uuid[])') IS NOT NULL),
  ('7. colunas de retorno das 2 funções do funil (a 1D mantém estas)',
     (SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio')),
     'admin_crm_funil(p_inicio date, p_fim date) -> TABLE(conversas bigint, conversas_anuncio bigint, ja_clientes bigint, cadastros bigint, testes bigint, assinantes bigint, opt_outs bigint, gasto_meta_centavos bigint, gasto_meta_dias bigint, gasto_manual_centavos bigint, gasto_manual_lancamentos bigint) | admin_crm_funil_por_anuncio(p_inicio date, p_fim date) -> TABLE(ad_id text, ad_titulo text, conversas bigint, cadastros bigint, testes bigint, assinantes bigint, gasto_manual_centavos bigint)',
     coalesce((SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio'))
       = 'admin_crm_funil(p_inicio date, p_fim date) -> TABLE(conversas bigint, conversas_anuncio bigint, ja_clientes bigint, cadastros bigint, testes bigint, assinantes bigint, opt_outs bigint, gasto_meta_centavos bigint, gasto_meta_dias bigint, gasto_manual_centavos bigint, gasto_manual_lancamentos bigint) | admin_crm_funil_por_anuncio(p_inicio date, p_fim date) -> TABLE(ad_id text, ad_titulo text, conversas bigint, cadastros bigint, testes bigint, assinantes bigint, gasto_manual_centavos bigint)', false)),
  ('8. coluna crm_leads.primeiro_contato_direcao existe (1C aplicada)',
     (SELECT count(*)::text FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'primeiro_contato_direcao'), '1',
     EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'primeiro_contato_direcao')),
  ('9. [INFORMATIVO] cadastros novos do funil nos últimos 30 dias (só contagens)',
     (SELECT 'cadastros ' || cadastros || ' · teste hoje no card (trial_started_at) ' || so_admin
             || ' · com teste depois da 1D ' || com_teste || ' · em teste agora ' || ativo
             || ' · prazo do teste já passou ' || vencido || ' · cancelados ' || cancelado FROM sit),
     '(anotar)', true)
) AS t(item, encontrado, esperado, ok);
