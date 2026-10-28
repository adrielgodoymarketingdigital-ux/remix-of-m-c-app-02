-- =====================================================================
-- Estoque baixo personalizável — FASE 2 (banco): limite da loja
--
-- O dono escolhe "avisar estoque baixo quando restar X ou menos".
-- Vazio (sem linha ou limite_baixo nulo) = regra de hoje de cada tela
-- (lista 4, PDF "Menor estoque" 3, relatório de vendidos 4). 0 = não avisar.
--
--   1) tabela configuracao_estoque: uma linha por dono (user_id é a chave)
--      - grava (INSERT/UPDATE) só o dono; ninguém apaga pelo app
--      - lê: o dono, o funcionário do dono (is_funcionario_of) e o gerente
--        de filial do proprietário (mesmo EXISTS em empresa_usuarios da
--        policy "gerente de filial ve assinatura do proprietario")
--      - anon: nenhum acesso
--   2) _zerar_catalogo(): igual à da etapa 3a (20261029120000) + a tabela
--      nova como MANTER. Sem isso o "Começar do zero" recusaria quem salvou
--      o limite ("tabela não classificada").
--   3) Autoverificação: qualquer item fora do esperado desfaz tudo.
--
-- Nenhuma tabela existente é alterada. O FK para auth.users pega um lock
-- curto em auth.users; com lock_timeout de 5 s, se houver fila, a migration
-- falha sem efeito e pode ser rodada de novo. Idempotente, numa transação só.
--
-- ANTES: conferir em produção as consultas de leitura da fase 2
-- (definição atual de _zerar_catalogo, is_funcionario_of,
-- update_updated_at_column e as policies de assinaturas).
-- ROLLBACK: scripts/estoque-baixo/rollback.sql
-- CONFERÊNCIA: scripts/estoque-baixo/verificacao.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';


-- ---------------------------------------------------------------------
-- 1) Limite da loja
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracao_estoque (
  user_id      uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  limite_baixo integer
               CONSTRAINT configuracao_estoque_limite_baixo_check
               CHECK (limite_baixo IS NULL OR (limite_baixo >= 0 AND limite_baixo <= 1000)),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.configuracao_estoque IS
  'Limite de estoque baixo da loja (uma linha por dono). limite_baixo: avisar quando restar X ou menos; NULL = padrão de cada tela; 0 = não avisar.';

DROP TRIGGER IF EXISTS update_configuracao_estoque_updated_at ON public.configuracao_estoque;
CREATE TRIGGER update_configuracao_estoque_updated_at
  BEFORE UPDATE ON public.configuracao_estoque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.configuracao_estoque ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.configuracao_estoque FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.configuracao_estoque TO authenticated;
GRANT ALL ON TABLE public.configuracao_estoque TO service_role;

DROP POLICY IF EXISTS "dono le a propria configuracao de estoque" ON public.configuracao_estoque;
CREATE POLICY "dono le a propria configuracao de estoque"
  ON public.configuracao_estoque FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "funcionario le configuracao de estoque do dono" ON public.configuracao_estoque;
CREATE POLICY "funcionario le configuracao de estoque do dono"
  ON public.configuracao_estoque FOR SELECT TO authenticated
  USING (public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "gerente de filial le configuracao de estoque do proprietario" ON public.configuracao_estoque;
CREATE POLICY "gerente de filial le configuracao de estoque do proprietario"
  ON public.configuracao_estoque FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.gerente_id = auth.uid()
      AND eu.proprietario_id = configuracao_estoque.user_id
  ));

DROP POLICY IF EXISTS "dono insere a propria configuracao de estoque" ON public.configuracao_estoque;
CREATE POLICY "dono insere a propria configuracao de estoque"
  ON public.configuracao_estoque FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dono atualiza a propria configuracao de estoque" ON public.configuracao_estoque;
CREATE POLICY "dono atualiza a propria configuracao de estoque"
  ON public.configuracao_estoque FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 2) Catálogo do "Começar do zero" (igual ao da etapa 3a + a tabela nova)
-- ---------------------------------------------------------------------
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
    -- estoque baixo (fase 2): limite da loja; configuração, fica sempre
    (1550, 'MANTER', NULL, 'public.configuracao_estoque',         'user_id = $1'),
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


-- ---------------------------------------------------------------------
-- 3) Autoverificação (qualquer falha desfaz a transação inteira)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t  constant regclass := 'public.configuracao_estoque'::regclass;
  v_problemas text[] := '{}';
  v_policies  text[];
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = t) THEN
    v_problemas := v_problemas || 'RLS desligada'::text;
  END IF;

  SELECT array_agg(policyname || ':' || cmd ORDER BY policyname) INTO v_policies
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'configuracao_estoque';
  IF v_policies IS DISTINCT FROM ARRAY[
       'dono atualiza a propria configuracao de estoque:UPDATE',
       'dono insere a propria configuracao de estoque:INSERT',
       'dono le a propria configuracao de estoque:SELECT',
       'funcionario le configuracao de estoque do dono:SELECT',
       'gerente de filial le configuracao de estoque do proprietario:SELECT'] THEN
    v_problemas := v_problemas || format('policies inesperadas: %s', v_policies);
  END IF;

  IF has_table_privilege('anon', t, 'SELECT') OR has_table_privilege('anon', t, 'INSERT')
     OR has_table_privilege('anon', t, 'UPDATE') OR has_table_privilege('anon', t, 'DELETE') THEN
    v_problemas := v_problemas || 'anon tem acesso'::text;
  END IF;
  IF NOT (has_table_privilege('authenticated', t, 'SELECT') AND has_table_privilege('authenticated', t, 'INSERT')
          AND has_table_privilege('authenticated', t, 'UPDATE')) THEN
    v_problemas := v_problemas || 'authenticated sem SELECT/INSERT/UPDATE'::text;
  END IF;
  IF has_table_privilege('authenticated', t, 'DELETE') OR has_table_privilege('authenticated', t, 'TRUNCATE') THEN
    v_problemas := v_problemas || 'authenticated pode apagar'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = t AND contype = 'f'
                   AND confrelid = 'auth.users'::regclass AND confdeltype = 'c') THEN
    v_problemas := v_problemas || 'FK para auth.users com CASCADE ausente'::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = t AND contype = 'c'
                   AND conname = 'configuracao_estoque_limite_baixo_check') THEN
    v_problemas := v_problemas || 'CHECK do limite ausente'::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = t AND tgname = 'update_configuracao_estoque_updated_at') THEN
    v_problemas := v_problemas || 'gatilho de updated_at ausente'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c
                  WHERE c.tabela = 'public.configuracao_estoque' AND c.lista = 'MANTER') THEN
    v_problemas := v_problemas || 'tabela fora do _zerar_catalogo'::text;
  END IF;
  IF (SELECT count(*) FROM public._zerar_catalogo()) <> 112 THEN
    v_problemas := v_problemas || format('_zerar_catalogo com %s linhas (esperado 112)',
                                         (SELECT count(*) FROM public._zerar_catalogo()));
  END IF;
  IF has_function_privilege('authenticated', 'public._zerar_catalogo()', 'EXECUTE') THEN
    v_problemas := v_problemas || '_zerar_catalogo executável por authenticated'::text;
  END IF;

  IF cardinality(v_problemas) > 0 THEN
    RAISE EXCEPTION 'configuracao_estoque: autoverificação falhou: %', array_to_string(v_problemas, '; ');
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
