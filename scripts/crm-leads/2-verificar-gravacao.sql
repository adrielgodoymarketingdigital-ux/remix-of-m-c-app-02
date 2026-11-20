-- =====================================================================
-- CRM de leads (fase 1) — VERIFICAÇÃO depois do SQL 2 (gravação).
-- SOMENTE LEITURA. Esperado: todas as linhas com ok = true.
-- =====================================================================
WITH f(assinatura) AS (VALUES
  ('public.crm_ingerir_mensagens(jsonb)'), ('public.crm_atualizar_resumo(jsonb)'),
  ('public.crm_registrar_opt_out(text, text)'), ('public._crm_profile_elegivel(uuid)'),
  ('public.crm_vincular_usuario(text, uuid)'), ('public.crm_vincular_cadastros(integer)'),
  ('public.crm_aplicar_retencao()'), ('public.crm_relatorio_diario(date)')
), g AS (
  SELECT assinatura, to_regprocedure(assinatura) AS oid FROM f
)
SELECT * FROM (VALUES
  ('1. 8 funções de gravação existem',
     (SELECT count(oid)::text FROM g), '8', (SELECT count(oid) FROM g) = 8),
  ('2. todas SECURITY DEFINER com search_path fixo',
     (SELECT count(*)::text FROM g JOIN pg_proc p ON p.oid = g.oid WHERE p.prosecdef AND p.proconfig::text LIKE '%search_path=public%'), '8',
     (SELECT count(*) FROM g JOIN pg_proc p ON p.oid = g.oid WHERE p.prosecdef AND p.proconfig::text LIKE '%search_path=public%') = 8),
  ('3. anon e authenticated NÃO executam nenhuma',
     (SELECT coalesce(string_agg(assinatura, ', '), '') FROM g
        WHERE has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE')), '',
     NOT EXISTS (SELECT 1 FROM g WHERE has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE'))),
  ('4. service_role executa as 7 chamadas pela Edge Function',
     (SELECT count(*)::text FROM g WHERE assinatura <> 'public._crm_profile_elegivel(uuid)' AND has_function_privilege('service_role', oid, 'EXECUTE')), '7',
     (SELECT count(*) FROM g WHERE assinatura <> 'public._crm_profile_elegivel(uuid)' AND has_function_privilege('service_role', oid, 'EXECUTE')) = 7),
  ('5. tabelas crm_* continuam vazias (nada foi gravado)',
     ((SELECT count(*) FROM public.crm_leads) + (SELECT count(*) FROM public.crm_lead_mensagens))::text, '0',
     (SELECT count(*) FROM public.crm_leads) + (SELECT count(*) FROM public.crm_lead_mensagens) = 0)
) AS t(item, encontrado, esperado, ok);
