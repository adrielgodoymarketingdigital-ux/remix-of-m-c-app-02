-- =====================================================================
-- CRM de leads — FASE 1C — CONFERÊNCIA ANTES DE APLICAR. SOMENTE LEITURA.
-- Rodar em produção ANTES de 20261121130000_crm_leads_1c_direcao_primeiro_contato.sql.
-- Só lê o catálogo do Postgres e CONTA linhas de crm_leads/crm_lead_mensagens
-- (nenhum telefone, nome ou texto sai daqui).
-- Esperado: todas as linhas com ok = true. As linhas [INFORMATIVO] são para
-- anotar e me mandar.
-- Se 4, 5 ou 6 der false: PARE. A função em produção não é a do repositório
-- e o rollback da 1C não a devolveria igual.
-- =====================================================================
WITH f AS (
  SELECT p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h,
         pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS ret
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('crm_ingerir_mensagens', 'admin_crm_funil', 'admin_crm_funil_por_anuncio')
), prim AS (
  SELECT DISTINCT ON (m.lead_id) m.lead_id, m.direcao, m.enviada_em
    FROM public.crm_lead_mensagens m
   ORDER BY m.lead_id, m.enviada_em, m.id
), sit AS (
  SELECT count(*) FILTER (WHERE p.lead_id IS NOT NULL AND p.enviada_em = l.primeiro_contato_em AND p.direcao = 'entrada') AS entrada,
         count(*) FILTER (WHERE p.lead_id IS NOT NULL AND p.enviada_em = l.primeiro_contato_em AND p.direcao = 'saida')   AS saida,
         count(*) FILTER (WHERE p.lead_id IS NOT NULL AND p.enviada_em <> l.primeiro_contato_em) AS cortada,
         count(*) FILTER (WHERE p.lead_id IS NULL) AS sem_msg,
         count(*) AS total
    FROM public.crm_leads l
    LEFT JOIN prim p ON p.lead_id = l.id
)
SELECT * FROM (VALUES
  ('1. crm_leads e crm_lead_mensagens existem (fase 1 aplicada)',
     concat_ws(', ', to_regclass('public.crm_leads'), to_regclass('public.crm_lead_mensagens')),
     'crm_leads, crm_lead_mensagens',
     to_regclass('public.crm_leads') IS NOT NULL AND to_regclass('public.crm_lead_mensagens') IS NOT NULL),
  ('2. coluna crm_leads.primeiro_contato_direcao ainda não existe',
     (SELECT count(*)::text FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'primeiro_contato_direcao'), '0',
     NOT EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'crm_leads' AND column_name = 'primeiro_contato_direcao')),
  ('3. admin_crm_funil_excluidos ainda não existe',
     (to_regprocedure('public.admin_crm_funil_excluidos(date, date)') IS NOT NULL)::text, 'false',
     to_regprocedure('public.admin_crm_funil_excluidos(date, date)') IS NULL),
  ('4. crm_ingerir_mensagens = versão de 20261121120010 (o rollback devolve esta)',
     (SELECT h FROM f WHERE proname = 'crm_ingerir_mensagens'), '6745a59229885a0fa58490d2391ef560',
     coalesce((SELECT h FROM f WHERE proname = 'crm_ingerir_mensagens') = '6745a59229885a0fa58490d2391ef560', false)),
  ('5. admin_crm_funil = versão de 20261121120020',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil'), '821e88f2f1bf52997399c53a2e4af7d6',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil') = '821e88f2f1bf52997399c53a2e4af7d6', false)),
  ('6. admin_crm_funil_por_anuncio = versão de 20261121120020',
     (SELECT h FROM f WHERE proname = 'admin_crm_funil_por_anuncio'), '4d1c8ad9c8e985e61a86a988f01473c6',
     coalesce((SELECT h FROM f WHERE proname = 'admin_crm_funil_por_anuncio') = '4d1c8ad9c8e985e61a86a988f01473c6', false)),
  ('7. colunas de retorno das 2 funções do funil (a 1C mantém estas)',
     (SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname LIKE 'admin\_crm\_funil%'),
     'admin_crm_funil(p_inicio date, p_fim date) -> TABLE(conversas bigint, conversas_anuncio bigint, ja_clientes bigint, cadastros bigint, testes bigint, assinantes bigint, opt_outs bigint, gasto_meta_centavos bigint, gasto_meta_dias bigint, gasto_manual_centavos bigint, gasto_manual_lancamentos bigint) | admin_crm_funil_por_anuncio(p_inicio date, p_fim date) -> TABLE(ad_id text, ad_titulo text, conversas bigint, cadastros bigint, testes bigint, assinantes bigint, gasto_manual_centavos bigint)',
     (SELECT string_agg(proname || '(' || args || ') -> ' || ret, ' | ' ORDER BY proname) FROM f WHERE proname LIKE 'admin\_crm\_funil%')
       = 'admin_crm_funil(p_inicio date, p_fim date) -> TABLE(conversas bigint, conversas_anuncio bigint, ja_clientes bigint, cadastros bigint, testes bigint, assinantes bigint, opt_outs bigint, gasto_meta_centavos bigint, gasto_meta_dias bigint, gasto_manual_centavos bigint, gasto_manual_lancamentos bigint) | admin_crm_funil_por_anuncio(p_inicio date, p_fim date) -> TABLE(ad_id text, ad_titulo text, conversas bigint, cadastros bigint, testes bigint, assinantes bigint, gasto_manual_centavos bigint)'),
  ('8. crm_leads é pequena (menos de 100 mil linhas)',
     (SELECT total::text FROM sit), '< 100000', (SELECT total < 100000 FROM sit)),
  ('9. [INFORMATIVO] como o backfill vai classificar (só contagens)',
     (SELECT 'cliente escreveu primeiro ' || entrada || ' · loja chamou primeiro ' || saida
             || ' · 1ª mensagem já cortada (vira desconhecida) ' || cortada || ' · sem mensagem (vira desconhecida) ' || sem_msg FROM sit),
     '(anotar)', true),
  ('10. [INFORMATIVO] travas de outras sessões em crm_leads agora (ideal 0)',
     (SELECT count(*)::text FROM pg_locks k WHERE k.relation = 'public.crm_leads'::regclass AND k.pid <> pg_backend_pid()),
     '0', true)
) AS t(item, encontrado, esperado, ok);
