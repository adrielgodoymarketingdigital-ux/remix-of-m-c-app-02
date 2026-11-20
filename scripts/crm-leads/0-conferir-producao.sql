-- =====================================================================
-- CRM de leads (fase 1) — CONFERÊNCIA ANTES DE APLICAR. SOMENTE LEITURA.
-- Rodar em produção ANTES do SQL 1 (20261121120000_crm_leads_1_estrutura.sql).
-- Só lê catálogo do Postgres e conta linhas de meta_ads_insights_dia;
-- nenhum dado de cliente.
-- Esperado: todas as linhas com ok = true. A linha 6 (linhas da Meta) é só
-- informativa: anote o número (0 enquanto não existir a sincronização).
-- =====================================================================
SELECT * FROM (VALUES
  -- ---- dependências que JÁ têm de existir ----
  ('1. has_role(uuid, app_role) existe',
     (to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL)::text, 'true',
     to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL),
  ('2. app_role tem o valor admin',
     (SELECT count(*)::text FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'app_role' AND e.enumlabel = 'admin'), '1',
     (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'app_role' AND e.enumlabel = 'admin') = 1),
  ('3. admin_mkt_origens(date, date) existe (regra de pagante copiada)',
     (to_regprocedure('public.admin_mkt_origens(date, date)') IS NOT NULL)::text, 'true',
     to_regprocedure('public.admin_mkt_origens(date, date)') IS NOT NULL),
  ('4. meta_ads_insights_dia existe',
     coalesce(to_regclass('public.meta_ads_insights_dia')::text, '(não existe)'), 'public.meta_ads_insights_dia',
     to_regclass('public.meta_ads_insights_dia') IS NOT NULL),
  ('5. meta_ads_insights_dia tem campaign_id (text), dia (date), gasto (numeric)',
     (SELECT string_agg(column_name || ':' || data_type, ', ' ORDER BY column_name) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'meta_ads_insights_dia' AND column_name IN ('campaign_id', 'dia', 'gasto')),
     'campaign_id:text, dia:date, gasto:numeric',
     (SELECT string_agg(column_name || ':' || data_type, ', ' ORDER BY column_name) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'meta_ads_insights_dia' AND column_name IN ('campaign_id', 'dia', 'gasto'))
       = 'campaign_id:text, dia:date, gasto:numeric'),
  ('6. [INFORMATIVO] linhas em meta_ads_insights_dia',
     (SELECT count(*)::text FROM public.meta_ads_insights_dia), '(anotar)', true),
  ('7. gen_random_uuid() existe',
     (to_regprocedure('gen_random_uuid()') IS NOT NULL)::text, 'true',
     to_regprocedure('gen_random_uuid()') IS NOT NULL),
  ('8. colunas lidas existem (profiles, assinaturas, pagamentos_pix, admin_notifications, loja_funcionarios, empresa_usuarios, user_roles)',
     (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (
        ('profiles', 'user_id'), ('profiles', 'celular'), ('profiles', 'created_at'),
        ('assinaturas', 'user_id'), ('assinaturas', 'plano_tipo'), ('assinaturas', 'trial_started_at'),
        ('assinaturas', 'payment_method'), ('assinaturas', 'payment_provider'), ('assinaturas', 'data_inicio'),
        ('assinaturas', 'bloqueado_admin'),
        ('pagamentos_pix', 'user_id'), ('pagamentos_pix', 'status'), ('pagamentos_pix', 'paid_at'),
        ('admin_notifications', 'tipo'), ('admin_notifications', 'dados'), ('admin_notifications', 'created_at'),
        ('loja_funcionarios', 'funcionario_user_id'), ('empresa_usuarios', 'gerente_id'),
        ('user_roles', 'user_id'), ('user_roles', 'role'))), '20',
     (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (
        ('profiles', 'user_id'), ('profiles', 'celular'), ('profiles', 'created_at'),
        ('assinaturas', 'user_id'), ('assinaturas', 'plano_tipo'), ('assinaturas', 'trial_started_at'),
        ('assinaturas', 'payment_method'), ('assinaturas', 'payment_provider'), ('assinaturas', 'data_inicio'),
        ('assinaturas', 'bloqueado_admin'),
        ('pagamentos_pix', 'user_id'), ('pagamentos_pix', 'status'), ('pagamentos_pix', 'paid_at'),
        ('admin_notifications', 'tipo'), ('admin_notifications', 'dados'), ('admin_notifications', 'created_at'),
        ('loja_funcionarios', 'funcionario_user_id'), ('empresa_usuarios', 'gerente_id'),
        ('user_roles', 'user_id'), ('user_roles', 'role'))) = 20),
  -- ---- o que a migration vai criar NÃO pode existir ainda ----
  ('9. tabelas novas ainda não existem (crm_leads, crm_lead_mensagens, crm_gasto_manual, crm_campanhas_whatsapp)',
     concat_ws(',', to_regclass('public.crm_leads'), to_regclass('public.crm_lead_mensagens'),
                    to_regclass('public.crm_gasto_manual'), to_regclass('public.crm_campanhas_whatsapp')), '',
     to_regclass('public.crm_leads') IS NULL AND to_regclass('public.crm_lead_mensagens') IS NULL
       AND to_regclass('public.crm_gasto_manual') IS NULL AND to_regclass('public.crm_campanhas_whatsapp') IS NULL),
  ('10. funções novas ainda não existem (16)',
     (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN (
        'crm_normalizar_telefone', 'crm_eh_opt_out', 'crm_ingerir_mensagens', 'crm_atualizar_resumo',
        'crm_registrar_opt_out', '_crm_profile_elegivel', 'crm_vincular_usuario', 'crm_vincular_cadastros',
        'crm_aplicar_retencao', 'crm_relatorio_diario', '_crm_pagantes', 'admin_crm_funil',
        'admin_crm_funil_por_anuncio', 'admin_crm_gasto_informar', 'admin_crm_gasto_remover', 'crm_listar_esfriados')), '0',
     NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN (
        'crm_normalizar_telefone', 'crm_eh_opt_out', 'crm_ingerir_mensagens', 'crm_atualizar_resumo',
        'crm_registrar_opt_out', '_crm_profile_elegivel', 'crm_vincular_usuario', 'crm_vincular_cadastros',
        'crm_aplicar_retencao', 'crm_relatorio_diario', '_crm_pagantes', 'admin_crm_funil',
        'admin_crm_funil_por_anuncio', 'admin_crm_gasto_informar', 'admin_crm_gasto_remover', 'crm_listar_esfriados'))),
  ('11. políticas novas ainda não existem',
     (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND policyname IN (
        'admin le crm_leads', 'admin le crm_lead_mensagens', 'admin le crm_gasto_manual', 'admin le crm_campanhas_whatsapp')), '0',
     NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname IN (
        'admin le crm_leads', 'admin le crm_lead_mensagens', 'admin le crm_gasto_manual', 'admin le crm_campanhas_whatsapp'))),
  -- ---- CRM antigo: só confirma que existe e que NÃO colide (não é tocado) ----
  ('12. CRM antigo presente e sem colisão de nome (crm_automacoes, crm_configuracoes, crm_estagios, crm_usuarios)',
     (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
        AND relname IN ('crm_automacoes', 'crm_configuracoes', 'crm_estagios', 'crm_usuarios')), '4',
     (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
        AND relname IN ('crm_automacoes', 'crm_configuracoes', 'crm_estagios', 'crm_usuarios')) = 4)
) AS t(item, encontrado, esperado, ok);
