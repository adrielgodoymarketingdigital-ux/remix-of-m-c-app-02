-- =====================================================================
-- CRM de leads (fase 1) — VERIFICAÇÃO depois do SQL 1 (estrutura).
-- SOMENTE LEITURA. Esperado: todas as linhas com ok = true.
-- =====================================================================
SELECT * FROM (VALUES
  ('1. 4 tabelas criadas',
     (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
        AND relname IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp')), '4',
     (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
        AND relname IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp')) = 4),
  ('2. RLS ligado nas 4',
     (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
        AND relname IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp')), '4',
     (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
        AND relname IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp')) = 4),
  ('3. só políticas de SELECT com has_role admin (4)',
     (SELECT count(*)::text || ' / outras: ' || count(*) FILTER (WHERE cmd <> 'SELECT' OR qual NOT LIKE '%has_role%admin%')
        FROM pg_policies WHERE schemaname = 'public'
        AND tablename IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp')), '4 / outras: 0',
     (SELECT count(*) = 4 AND count(*) FILTER (WHERE cmd <> 'SELECT' OR qual NOT LIKE '%has_role%admin%') = 0
        FROM pg_policies WHERE schemaname = 'public'
        AND tablename IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp'))),
  ('4. anon sem SELECT; authenticated só SELECT (sem INSERT/UPDATE/DELETE)',
     (SELECT string_agg(t || ':' || has_table_privilege('anon', t, 'SELECT')::text || '/'
            || has_table_privilege('authenticated', t, 'INSERT,UPDATE,DELETE')::text, ' ')
        FROM unnest(ARRAY['public.crm_leads', 'public.crm_lead_mensagens', 'public.crm_gasto_manual', 'public.crm_campanhas_whatsapp']) t),
     'todas false/false',
     NOT EXISTS (SELECT 1 FROM unnest(ARRAY['public.crm_leads', 'public.crm_lead_mensagens', 'public.crm_gasto_manual', 'public.crm_campanhas_whatsapp']) t
        WHERE has_table_privilege('anon', t, 'SELECT') OR has_table_privilege('authenticated', t, 'INSERT,UPDATE,DELETE'))),
  ('5. tabelas vazias',
     ((SELECT count(*) FROM public.crm_leads) + (SELECT count(*) FROM public.crm_lead_mensagens)
      + (SELECT count(*) FROM public.crm_gasto_manual) + (SELECT count(*) FROM public.crm_campanhas_whatsapp))::text, '0',
     (SELECT count(*) FROM public.crm_leads) + (SELECT count(*) FROM public.crm_lead_mensagens)
      + (SELECT count(*) FROM public.crm_gasto_manual) + (SELECT count(*) FROM public.crm_campanhas_whatsapp) = 0),
  ('6. "Começar do zero" não enxerga as tabelas novas (sem coluna user_id/loja_user_id/proprietario_id)',
     (SELECT count(*)::text FROM pg_attribute a JOIN pg_class k ON k.oid = a.attrelid
        WHERE k.relnamespace = 'public'::regnamespace AND k.relname LIKE 'crm\_%' AND NOT a.attisdropped
          AND k.relname IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp')
          AND a.attname IN ('user_id', 'loja_user_id', 'proprietario_id')), '0',
     NOT EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class k ON k.oid = a.attrelid
        WHERE k.relnamespace = 'public'::regnamespace AND NOT a.attisdropped
          AND k.relname IN ('crm_leads', 'crm_lead_mensagens', 'crm_gasto_manual', 'crm_campanhas_whatsapp')
          AND a.attname IN ('user_id', 'loja_user_id', 'proprietario_id'))),
  ('7. nenhuma FK das tabelas novas para tabela existente',
     (SELECT coalesce(string_agg(conrelid::regclass || '->' || confrelid::regclass, ', '), '') FROM pg_constraint
        WHERE contype = 'f' AND conrelid IN ('public.crm_leads'::regclass, 'public.crm_lead_mensagens'::regclass, 'public.crm_gasto_manual'::regclass, 'public.crm_campanhas_whatsapp'::regclass)
          AND confrelid <> 'public.crm_leads'::regclass), '',
     NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE contype = 'f' AND conrelid IN ('public.crm_leads'::regclass, 'public.crm_lead_mensagens'::regclass, 'public.crm_gasto_manual'::regclass, 'public.crm_campanhas_whatsapp'::regclass)
          AND confrelid <> 'public.crm_leads'::regclass)),
  ('8. normalizar: "(11) 9000-0001" -> +5511990000001; "...@lid" -> nulo',
     coalesce(public.crm_normalizar_telefone('(11) 9000-0001'), 'nulo') || ' / ' || coalesce(public.crm_normalizar_telefone('11990000001@lid'), 'nulo'),
     '+5511990000001 / nulo',
     public.crm_normalizar_telefone('(11) 9000-0001') = '+5511990000001' AND public.crm_normalizar_telefone('11990000001@lid') IS NULL),
  ('9. opt-out: "PARAR" sim, "não quero parar de usar" não',
     public.crm_eh_opt_out('PARAR')::text || ' / ' || public.crm_eh_opt_out('não quero parar de usar')::text, 'true / false',
     public.crm_eh_opt_out('PARAR') AND NOT public.crm_eh_opt_out('não quero parar de usar')),
  ('10. índice de dedupe e de cruzamento existem',
     (SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public'
        AND indexname IN ('crm_lead_mensagens_dedupe', 'idx_crm_leads_ddd_final8')), '2',
     (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
        AND indexname IN ('crm_lead_mensagens_dedupe', 'idx_crm_leads_ddd_final8')) = 2)
) AS t(item, encontrado, esperado, ok);
