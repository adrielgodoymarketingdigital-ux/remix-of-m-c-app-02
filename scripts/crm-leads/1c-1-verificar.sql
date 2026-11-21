-- =====================================================================
-- CRM de leads — FASE 1C — VERIFICAÇÃO depois da migration
-- 20261121130000_crm_leads_1c_direcao_primeiro_contato.sql. SOMENTE LEITURA.
-- Esperado: todas as linhas com ok = true (a 9 é informativa: anotar).
-- (No SQL Editor auth.uid() é nulo: chamar admin_crm_funil_excluidos aqui
--  DEVE dar "Apenas administradores...".)
-- =====================================================================
WITH f AS (
  SELECT p.oid, p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS ret
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('crm_ingerir_mensagens', 'admin_crm_funil', 'admin_crm_funil_por_anuncio', 'admin_crm_funil_excluidos')
), prim AS (
  SELECT DISTINCT ON (m.lead_id) m.lead_id, m.direcao, m.enviada_em
    FROM public.crm_lead_mensagens m
   ORDER BY m.lead_id, m.enviada_em, m.id
), bf AS (
  SELECT count(*) FILTER (WHERE l.primeiro_contato_direcao IS DISTINCT FROM p.direcao) AS divergentes
    FROM public.crm_leads l
    JOIN prim p ON p.lead_id = l.id AND p.enviada_em = l.primeiro_contato_em
), ex AS (SELECT * FROM f WHERE proname = 'admin_crm_funil_excluidos')
SELECT * FROM (VALUES
  ('1. coluna primeiro_contato_direcao: text, aceita nulo, sem default',
     (SELECT data_type || ' / ' || is_nullable || ' / ' || coalesce(column_default, 'sem default') FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'primeiro_contato_direcao'),
     'text / YES / sem default',
     coalesce((SELECT data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'primeiro_contato_direcao'), false)),
  ('2. CHECK (nulo, entrada ou saida) existe e está validado',
     (SELECT convalidated::text FROM pg_constraint WHERE conrelid = 'public.crm_leads'::regclass
       AND conname = 'crm_leads_primeiro_contato_direcao_check'), 'true',
     coalesce((SELECT convalidated FROM pg_constraint WHERE conrelid = 'public.crm_leads'::regclass
       AND conname = 'crm_leads_primeiro_contato_direcao_check'), false)),
  ('3. backfill: lead com a 1ª mensagem guardada e direção diferente dela',
     (SELECT divergentes::text FROM bf), '0', (SELECT divergentes = 0 FROM bf)),
  ('4. crm_ingerir_mensagens = versão 1C',
     (SELECT h FROM f WHERE proname = 'crm_ingerir_mensagens'), 'a802e1b67820c64157d3611a1a443223',
     coalesce((SELECT h FROM f WHERE proname = 'crm_ingerir_mensagens') = 'a802e1b67820c64157d3611a1a443223', false)),
  ('5. admin_crm_funil e admin_crm_funil_por_anuncio = versão 1C',
     (SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio')),
     '445970a1a10092880f243b55377c8a99 / e006b431c851a362020391803e7be6c7',
     coalesce((SELECT string_agg(h, ' / ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio'))
       = '445970a1a10092880f243b55377c8a99 / e006b431c851a362020391803e7be6c7', false)),
  ('6. parâmetros e colunas de retorno das 2 funções do funil NÃO mudaram',
     (SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio')),
     '(iguais à linha 7 da conferência)',
     (SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname IN ('admin_crm_funil', 'admin_crm_funil_por_anuncio'))
       = 'admin_crm_funil(p_inicio date, p_fim date) -> TABLE(conversas bigint, conversas_anuncio bigint, ja_clientes bigint, cadastros bigint, testes bigint, assinantes bigint, opt_outs bigint, gasto_meta_centavos bigint, gasto_meta_dias bigint, gasto_manual_centavos bigint, gasto_manual_lancamentos bigint) | admin_crm_funil_por_anuncio(p_inicio date, p_fim date) -> TABLE(ad_id text, ad_titulo text, conversas bigint, cadastros bigint, testes bigint, assinantes bigint, gasto_manual_centavos bigint)'),
  ('7. admin_crm_funil_excluidos: existe, SECURITY DEFINER, has_role, search_path fixo',
     (SELECT h FROM ex), 'eed99d58377b004eed51575397bb542b',
     coalesce((SELECT p.prosecdef AND p.prosrc LIKE '%has_role(auth.uid(), ''admin'')%'
                  AND p.proconfig @> ARRAY['search_path=public'] AND ex.h = 'eed99d58377b004eed51575397bb542b'
                 FROM ex JOIN pg_proc p ON p.oid = ex.oid), false)),
  ('8. admin_crm_funil_excluidos: authenticated sim, anon não, PUBLIC não',
     (SELECT has_function_privilege('authenticated', oid, 'EXECUTE')::text || ' / ' || has_function_privilege('anon', oid, 'EXECUTE')::text
             || ' / ' || (SELECT p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) FROM pg_proc p WHERE p.oid = ex.oid)::text FROM ex),
     'true / false / false',
     coalesce((SELECT has_function_privilege('authenticated', oid, 'EXECUTE') AND NOT has_function_privilege('anon', oid, 'EXECUTE')
                  AND NOT (SELECT p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) FROM pg_proc p WHERE p.oid = ex.oid) FROM ex), false)),
  ('9. [INFORMATIVO] leads por direção do 1º contato (só contagens)',
     (SELECT 'cliente escreveu primeiro ' || count(*) FILTER (WHERE primeiro_contato_direcao = 'entrada')
             || ' · loja chamou primeiro ' || count(*) FILTER (WHERE primeiro_contato_direcao = 'saida')
             || ' · desconhecida ' || count(*) FILTER (WHERE primeiro_contato_direcao IS NULL) FROM public.crm_leads),
     '(anotar)', true)
) AS t(item, encontrado, esperado, ok);
