-- =====================================================================
-- ROLLBACK da migration 20261102120000_configuracao_estoque_baixo.sql
--
-- 1) _zerar_catalogo() volta a ser a da etapa 3a (20261029120000), cópia exata.
-- 2) A tabela configuracao_estoque é apagada (os limites salvos se perdem;
--    o app volta sozinho ao padrão de cada tela, sem erro na tela).
-- Idempotente, numa transação só. Termina com autoconferência.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public._zerar_catalogo()
RETURNS TABLE (ordem int, lista text, categoria text, tabela text, filtro text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  VALUES
    -- ===== APAGAR =====
    (10,  'APAGAR', 'os',         'public.os_tecnicos',                 'os_id IN (SELECT id FROM public.ordens_servico WHERE user_id = $1)'),
    (15,  'APAGAR', 'os',         'public.os_dispositivos_adicionais',  'user_id = $1 OR os_id IN (SELECT id FROM public.ordens_servico WHERE user_id = $1)'),
    (20,  'APAGAR', 'os',         'public.os_tracking_links',           'user_id = $1 OR os_id IN (SELECT id FROM public.ordens_servico WHERE user_id = $1)'),
    (30,  'APAGAR', 'clientes',   'public.cliente_tracking_links',      'user_id = $1 OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = $1)'),
    (40,  'APAGAR', 'clientes',   'public.fidelidade_resgates',         'user_id = $1 OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = $1)'),
    (50,  'APAGAR', 'clientes',   'public.fidelidade_pontos',           'user_id = $1 OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = $1)'),
    (60,  'APAGAR', 'clientes',   'public.remessa_itens',               'user_id = $1 OR remessa_id IN (SELECT id FROM public.remessas_corporativas WHERE user_id = $1)'),
    (70,  'APAGAR', 'clientes',   'public.remessas_corporativas',       'user_id = $1'),
    (80,  'APAGAR', 'vendas',     'public.trocas_garantia',             'user_id = $1 OR venda_id IN (SELECT id FROM public.vendas WHERE user_id = $1)'),
    (90,  'APAGAR', 'vendas',     'public.vendas_trocas',               'user_id = $1'),
    (100, 'APAGAR', 'vendas',     'public.vendas_cupons',               'venda_id IN (SELECT id FROM public.vendas WHERE user_id = $1)'),
    (110, 'APAGAR', 'estoque',    'public.dispositivo_imeis',           'dispositivo_id IN (SELECT id FROM public.dispositivos WHERE user_id = $1)'),
    (120, 'APAGAR', 'vendas',     'public.vendas_alteracoes',           'user_id = $1 OR venda_id IN (SELECT id FROM public.vendas WHERE user_id = $1)'),
    (130, 'APAGAR', 'financeiro', 'public.caixa_movimentacoes',         'user_id = $1 OR caixa_id IN (SELECT id FROM public.caixas WHERE user_id = $1)'),
    (140, 'APAGAR', 'financeiro', 'public.pagamentos_contas',           'user_id = $1 OR conta_id IN (SELECT id FROM public.contas WHERE user_id = $1)'),
    (150, 'APAGAR', 'estoque',    'public.entradas_estoque',            'user_id = $1'),
    (160, 'APAGAR', 'estoque',    'public.compras_xml_itens',           'importacao_id IN (SELECT id FROM public.compras_xml_importadas WHERE user_id = $1)'),
    (170, 'APAGAR', 'estoque',    'public.compras_xml_mapeamento',      'user_id = $1'),
    (180, 'APAGAR', 'estoque',    'public.compras_xml_importadas',      'user_id = $1'),
    (190, 'APAGAR', 'os',         'public.ordens_servico',              'user_id = $1'),
    (200, 'APAGAR', 'vendas',     'public.vendas',                      'user_id = $1'),
    (210, 'APAGAR', 'vendas',     'public.vendas_avulsas',              'user_id = $1'),
    (220, 'APAGAR', 'vendas',     'public.servicos_avulsos',            'user_id = $1'),
    (225, 'APAGAR', 'vendas',     'public.pedidos',                     'user_id = $1'),
    (230, 'APAGAR', 'orcamentos', 'public.orcamentos',                  'user_id = $1'),
    (240, 'APAGAR', 'financeiro', 'public.contas',                      'user_id = $1'),
    (250, 'APAGAR', 'financeiro', 'public.extrato_lancamentos_manuais', 'user_id = $1'),
    (260, 'APAGAR', 'financeiro', 'public.caixas',                      'user_id = $1'),
    (270, 'APAGAR', 'tudo',       'public.notifications',               'user_id = $1'),
    (290, 'APAGAR', 'estoque',    'public.lista_compras',               'user_id = $1 OR lista_id IN (SELECT id FROM public.listas_compras WHERE user_id = $1)'),
    (300, 'APAGAR', 'estoque',    'public.listas_compras',              'user_id = $1'),
    (350, 'APAGAR', 'estoque',    'public.dispositivos',                'user_id = $1'),
    (360, 'APAGAR', 'estoque',    'public.compras_dispositivos',        'user_id = $1'),
    (370, 'APAGAR', 'estoque',    'public.produtos',                    'user_id = $1'),
    (380, 'APAGAR', 'estoque',    'public.pecas',                       'user_id = $1'),
    (400, 'APAGAR', 'estoque',    'public.origem_pessoas',              'user_id = $1'),
    (410, 'APAGAR', 'estoque',    'public.fornecedores',                'user_id = $1'),
    (420, 'APAGAR', 'clientes',   'public.clientes',                    'user_id = $1'),
    (430, 'APAGAR', 'tudo',       'public.os_localizacoes',             'user_id = $1'),
    (550, 'APAGAR', 'os',         'public.os_audit_log',                'user_id = $1 OR os_id = ANY($2)'),
    (560, 'APAGAR', 'clientes',   'public.clientes_audit_log',          'user_id = $1 OR cliente_id = ANY($3)'),
    -- ===== MANTER (dados do dono que ficam) =====
    (1000, 'MANTER', NULL, 'auth.users',                          'id = $1'),
    (1010, 'MANTER', NULL, 'public.profiles',                     'user_id = $1'),
    (1020, 'MANTER', NULL, 'public.assinaturas',                  'user_id = $1'),
    (1030, 'MANTER', NULL, 'public.user_roles',                   'user_id = $1'),
    (1040, 'MANTER', NULL, 'public.configuracoes_loja',           'user_id = $1'),
    (1050, 'MANTER', NULL, 'public.fiscal_config',                'user_id = $1'),
    (1060, 'MANTER', NULL, 'public.fiscal_segredos',              'config_id IN (SELECT id FROM public.fiscal_config WHERE user_id = $1)'),
    (1070, 'MANTER', NULL, 'public.fiscal_uso_mensal',            'user_id = $1'),
    (1080, 'MANTER', NULL, 'public.tiny_integrations',            'user_id = $1'),
    (1090, 'MANTER', NULL, 'public.user_notification_preferences', 'user_id = $1'),
    (1100, 'MANTER', NULL, 'public.push_subscriptions',           'user_id = $1'),
    (1110, 'MANTER', NULL, 'public.user_onboarding',              'user_id = $1'),
    (1120, 'MANTER', NULL, 'public.user_os_counters',             'user_id = $1'),
    (1130, 'MANTER', NULL, 'public.user_venda_counters',          'user_id = $1'),
    (1140, 'MANTER', NULL, 'public.os_tracking_uso',              'user_id = $1'),
    (1150, 'MANTER', NULL, 'public.user_events',                  'user_id = $1'),
    (1160, 'MANTER', NULL, 'public.pagamentos_pix',               'user_id = $1'),
    (1170, 'MANTER', NULL, 'public.liberacoes_temporarias',       'user_id = $1'),
    (1180, 'MANTER', NULL, 'public.historico_bloqueios',          'user_id = $1'),
    (1190, 'MANTER', NULL, 'public.motivos_nao_renovacao',        'user_id = $1'),
    (1200, 'MANTER', NULL, 'public.trial_emails_sent',            'user_id = $1'),
    (1210, 'MANTER', NULL, 'public.reactivation_messages',        'user_id = $1'),
    (1220, 'MANTER', NULL, 'public.followup_control',             'user_id = $1'),
    (1230, 'MANTER', NULL, 'public.crm_usuarios',                 'user_id = $1'),
    (1240, 'MANTER', NULL, 'public.crm_configuracoes',            'user_id = $1'),
    (1250, 'MANTER', NULL, 'public.conversas_suporte',            'user_id = $1'),
    (1260, 'MANTER', NULL, 'public.mensagens_suporte',            'conversa_id IN (SELECT id FROM public.conversas_suporte WHERE user_id = $1)'),
    (1270, 'MANTER', NULL, 'public.feedbacks',                    'user_id = $1'),
    (1280, 'MANTER', NULL, 'public.empresas',                     'proprietario_id = $1'),
    (1290, 'MANTER', NULL, 'public.empresa_usuarios',             'proprietario_id = $1'),
    (1300, 'MANTER', NULL, 'public.empresa_metas',                'proprietario_id = $1'),
    (1310, 'MANTER', NULL, 'public.loja_funcionarios',            'loja_user_id = $1'),
    (1320, 'MANTER', NULL, 'public.categorias_funcionarios',      'loja_user_id = $1'),
    -- configurações e cadastros de apoio (a "zona cinzenta" do B fica sempre mantida)
    (1400, 'MANTER', NULL, 'public.servicos',                     'user_id = $1'),
    (1410, 'MANTER', NULL, 'public.tipos_servico',                'user_id = $1'),
    (1420, 'MANTER', NULL, 'public.comissoes_tipo_servico',       'tipo_servico_id IN (SELECT id FROM public.tipos_servico WHERE user_id = $1)'),
    (1430, 'MANTER', NULL, 'public.categorias_produtos',          'user_id = $1'),
    (1440, 'MANTER', NULL, 'public.os_status_config',             'user_id = $1'),
    (1450, 'MANTER', NULL, 'public.taxas_cartao',                 'user_id = $1'),
    (1460, 'MANTER', NULL, 'public.formas_pagamento_customizadas', 'user_id = $1'),
    (1470, 'MANTER', NULL, 'public.tipos_garantia',               'user_id = $1'),
    (1480, 'MANTER', NULL, 'public.categorias_despesas',          'user_id = $1'),
    (1490, 'MANTER', NULL, 'public.categorias_sistema_excluidas', 'user_id = $1'),
    (1500, 'MANTER', NULL, 'public.fidelidade_niveis',            'user_id = $1'),
    (1510, 'MANTER', NULL, 'public.fidelidade_config',            'user_id = $1'),
    (1520, 'MANTER', NULL, 'public.os_metas',                     'user_id = $1'),
    (1530, 'MANTER', NULL, 'public.catalogo_dispositivos_custom', 'user_id = $1'),
    (1540, 'MANTER', NULL, 'public.notas_fiscais',                'user_id = $1'),
    -- ===== GLOBAL (sem dono) =====
    (2000, 'GLOBAL', NULL, 'public.admin_alteracoes_correcoes',   NULL),
    (2010, 'GLOBAL', NULL, 'public.admin_notifications',          NULL),
    (2020, 'GLOBAL', NULL, 'public.admin_whatsapp_templates',     NULL),
    (2030, 'GLOBAL', NULL, 'public.avisos_sistema',               NULL),
    (2040, 'GLOBAL', NULL, 'public.backups',                      NULL),
    (2050, 'GLOBAL', NULL, 'public.crm_automacoes',               NULL),
    (2060, 'GLOBAL', NULL, 'public.crm_estagios',                 NULL),
    (2070, 'GLOBAL', NULL, 'public.cupons',                       NULL),
    (2080, 'GLOBAL', NULL, 'public.fiscal_perfis_tributarios',    NULL),
    (2090, 'GLOBAL', NULL, 'public.grupo_compatibilidade_modelos', NULL),
    (2100, 'GLOBAL', NULL, 'public.grupos_compatibilidade_pelicula', NULL),
    (2110, 'GLOBAL', NULL, 'public.kirvano_eventos',              NULL),
    (2120, 'GLOBAL', NULL, 'public.meta_ads_insights_dia',        NULL),
    (2130, 'GLOBAL', NULL, 'public.meta_ads_sync',                NULL),
    (2140, 'GLOBAL', NULL, 'public.notas_fiscais_eventos',        NULL),
    (2150, 'GLOBAL', NULL, 'public.notification_rules',           NULL),
    (2160, 'GLOBAL', NULL, 'public.novidades',                    NULL),
    (2170, 'GLOBAL', NULL, 'public.onboarding_config',            NULL),
    (2180, 'GLOBAL', NULL, 'public.tutoriais_videos',             NULL),
    -- ===== SISTEMA (este recurso) =====
    (3000, 'SISTEMA', NULL, 'public.zerar_dados_execucoes',       NULL),
    (3010, 'SISTEMA', NULL, 'public.zerar_dados_arquivos',        NULL),
    -- etapa 3a: fantasmas da cota (nunca apagados pelo "Começar do zero")
    (3020, 'SISTEMA', NULL, 'public.cota_registros_apagados',     NULL)
$$;

REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS public.configuracao_estoque;

DO $$
BEGIN
  IF to_regclass('public.configuracao_estoque') IS NOT NULL THEN
    RAISE EXCEPTION 'rollback: configuracao_estoque ainda existe';
  END IF;
  IF EXISTS (SELECT 1 FROM public._zerar_catalogo() WHERE tabela = 'public.configuracao_estoque') THEN
    RAISE EXCEPTION 'rollback: _zerar_catalogo ainda cita configuracao_estoque';
  END IF;
  IF (SELECT count(*) FROM public._zerar_catalogo()) <> 111 THEN
    RAISE EXCEPTION 'rollback: _zerar_catalogo com % linhas (esperado 111)', (SELECT count(*) FROM public._zerar_catalogo());
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
