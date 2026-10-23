-- =====================================================================
-- "Começar do zero" — ETAPA 1 (somente banco)
--
-- O próprio dono da conta escolhe o que apagar dos dados dele.
--   zerar_meus_dados_previa(categorias)  → só lê: contagens, avisos, travas
--   zerar_meus_dados_executar(categorias, 'APAGAR', impressao) → apaga tudo-ou-nada
--
-- Categorias: vendas, os, clientes, financeiro, estoque, orcamentos, tudo.
--   clientes inclui os, vendas e orcamentos; estoque inclui vendas.
-- Baseado no script manual B_zerar.sql (mesma ordem de exclusão e travas).
-- Nada é chamado pelo app nesta etapa.
--
-- Idempotente: rodar de novo não dá erro nem muda nada. Tudo numa transação
-- só: se qualquer comando falhar, nada fica aplicado.
--
-- ATENÇÃO — índices: cada CREATE INDEX trava a GRAVAÇÃO (leitura segue normal)
-- na tabela dele por alguns milissegundos enquanto é criado: ordens_servico,
-- contas, vendas, servicos, fidelidade_pontos, fidelidade_resgates,
-- remessas_corporativas, remessa_itens, trocas_garantia, caixa_movimentacoes,
-- entradas_estoque, vendas_trocas, compras_xml_mapeamento, clientes_audit_log.
-- Melhor aplicar fora do horário de pico.
--
-- ROLLBACK (apaga o log e a fila deste recurso; os índices são opcionais):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.zerar_meus_dados_executar(text[], text, text);
--   DROP FUNCTION IF EXISTS public.zerar_meus_dados_previa(text[]);
--   DROP FUNCTION IF EXISTS public._zerar_catalogo();
--   DROP TABLE IF EXISTS public.zerar_dados_arquivos;
--   DROP TABLE IF EXISTS public.zerar_dados_execucoes;
--   -- opcional (inofensivos e ajudam o app):
--   DROP INDEX IF EXISTS public.idx_ordens_servico_cliente_id, public.idx_ordens_servico_servico_fornecedor_id,
--     public.idx_contas_cliente_id, public.idx_vendas_dispositivo_id, public.idx_servicos_peca_id,
--     public.idx_fidelidade_pontos_cliente_id, public.idx_fidelidade_resgates_cliente_id,
--     public.idx_remessas_corporativas_cliente_id, public.idx_remessa_itens_remessa_id,
--     public.idx_trocas_garantia_venda_id, public.idx_trocas_garantia_produto_novo_id,
--     public.idx_trocas_garantia_produto_devolvido_id, public.idx_caixa_movimentacoes_caixa_id,
--     public.idx_entradas_estoque_conta_id, public.idx_entradas_estoque_fornecedor_id,
--     public.idx_vendas_trocas_compra_id, public.idx_compras_xml_mapeamento_produto_id,
--     public.idx_compras_xml_mapeamento_peca_id, public.idx_clientes_audit_log_cliente_id;
--   COMMIT;
-- =====================================================================

BEGIN;


-- ---------------------------------------------------------------------
-- 1) Índices nas ligações que a exclusão confere linha a linha.
--    Sem eles, apagar 4.700 clientes varre ordens_servico/contas inteiras
--    uma vez por cliente (estoura o limite de 8s do usuário logado).
--    Tabelas pequenas: cada índice leva milissegundos para criar.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_id ON public.ordens_servico (cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_servico_fornecedor_id ON public.ordens_servico (servico_fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_cliente_id ON public.contas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_dispositivo_id ON public.vendas (dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_servicos_peca_id ON public.servicos (peca_id);
CREATE INDEX IF NOT EXISTS idx_fidelidade_pontos_cliente_id ON public.fidelidade_pontos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_fidelidade_resgates_cliente_id ON public.fidelidade_resgates (cliente_id);
CREATE INDEX IF NOT EXISTS idx_remessas_corporativas_cliente_id ON public.remessas_corporativas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_remessa_itens_remessa_id ON public.remessa_itens (remessa_id);
CREATE INDEX IF NOT EXISTS idx_trocas_garantia_venda_id ON public.trocas_garantia (venda_id);
CREATE INDEX IF NOT EXISTS idx_trocas_garantia_produto_novo_id ON public.trocas_garantia (produto_novo_id);
CREATE INDEX IF NOT EXISTS idx_trocas_garantia_produto_devolvido_id ON public.trocas_garantia (produto_devolvido_id);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_caixa_id ON public.caixa_movimentacoes (caixa_id);
CREATE INDEX IF NOT EXISTS idx_entradas_estoque_conta_id ON public.entradas_estoque (conta_id);
CREATE INDEX IF NOT EXISTS idx_entradas_estoque_fornecedor_id ON public.entradas_estoque (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_trocas_compra_id ON public.vendas_trocas (compra_id);
CREATE INDEX IF NOT EXISTS idx_compras_xml_mapeamento_produto_id ON public.compras_xml_mapeamento (produto_id);
CREATE INDEX IF NOT EXISTS idx_compras_xml_mapeamento_peca_id ON public.compras_xml_mapeamento (peca_id);
CREATE INDEX IF NOT EXISTS idx_clientes_audit_log_cliente_id ON public.clientes_audit_log (cliente_id);


-- ---------------------------------------------------------------------
-- 2) Log das execuções (sem dados de cliente; guardado por 5 anos)
--    user_id sem FK de propósito: o registro fica mesmo se a conta sumir.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zerar_dados_execucoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  executado_em          timestamptz NOT NULL DEFAULT now(),
  guardar_ate           timestamptz NOT NULL DEFAULT (now() + interval '5 years'),
  categorias_pedidas    text[] NOT NULL,
  categorias_efetivas   text[] NOT NULL,
  quantidades           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- tabela → linhas apagadas
  desvinculos           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- ligações desfeitas (SET NULL)
  contador_os_zerado    boolean NOT NULL DEFAULT false,
  contador_venda_zerado boolean NOT NULL DEFAULT false,
  onboarding_reexibido  boolean NOT NULL DEFAULT false,
  arquivos_na_fila      integer NOT NULL DEFAULT 0,
  storage_status        text NOT NULL DEFAULT 'pendente'
                        CHECK (storage_status IN ('pendente', 'sem_arquivos', 'concluido', 'erro')),
  backups_status        text NOT NULL DEFAULT 'pendente'
                        CHECK (backups_status IN ('pendente', 'limpo')),
  duracao_ms            integer
);
CREATE INDEX IF NOT EXISTS idx_zerar_dados_execucoes_user ON public.zerar_dados_execucoes (user_id, executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_zerar_dados_execucoes_guardar_ate ON public.zerar_dados_execucoes (guardar_ate);

ALTER TABLE public.zerar_dados_execucoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.zerar_dados_execucoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.zerar_dados_execucoes TO authenticated;
GRANT ALL ON TABLE public.zerar_dados_execucoes TO service_role;
-- O dono lê só as dele (a tela vai mostrar "última vez" e a situação das fotos).
-- Ninguém grava por fora: só a função de execução, que roda como dona da tabela.
DROP POLICY IF EXISTS "Dono le as proprias execucoes" ON public.zerar_dados_execucoes;
CREATE POLICY "Dono le as proprias execucoes"
  ON public.zerar_dados_execucoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 3) Fila de arquivos do Storage a remover (a etapa 2 consome)
--    Fechada para o app: só service_role (Edge Function).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zerar_dados_arquivos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.zerar_dados_execucoes (id) ON DELETE CASCADE,
  bucket      text NOT NULL,
  caminho     text NOT NULL,
  motivo      text NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  removido_em timestamptz,
  erro        text,
  UNIQUE (execucao_id, bucket, caminho)
);
CREATE INDEX IF NOT EXISTS idx_zerar_dados_arquivos_pendentes ON public.zerar_dados_arquivos (execucao_id) WHERE removido_em IS NULL;

ALTER TABLE public.zerar_dados_arquivos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.zerar_dados_arquivos FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.zerar_dados_arquivos TO service_role;


-- ---------------------------------------------------------------------
-- 4) Catálogo: TODAS as tabelas de public classificadas.
--    lista:  APAGAR (por categoria, na ordem: filhas antes das mães)
--            MANTER (dados do dono que nunca mudam; contados antes/depois)
--            GLOBAL (sem dono; só para constar como classificada)
--            SISTEMA (as tabelas deste recurso)
--    filtro: $1 = usuário, $2 = ids das OS dele, $3 = ids dos clientes dele
--            (listas tiradas ANTES de apagar, para pegar o histórico gravado
--             por funcionários, como no B_zerar.sql)
--    Tabela nova no banco: precisa entrar aqui. Enquanto não entrar, a
--    prévia recusa se ela tiver dados do lojista (ver "não classificada").
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
    (3010, 'SISTEMA', NULL, 'public.zerar_dados_arquivos',        NULL)
$$;

REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------
-- 5) PRÉVIA — somente leitura
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zerar_meus_dados_previa(p_categorias text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_ordem     constant text[] := ARRAY['vendas', 'os', 'clientes', 'financeiro', 'estoque', 'orcamentos'];
  c_validas   constant text[] := ARRAY['vendas', 'os', 'clientes', 'financeiro', 'estoque', 'orcamentos', 'tudo'];
  v_uid       uuid := auth.uid();
  v_pedidas   text[];
  v_ef        text[];
  v_casar     text[];          -- categorias do catálogo que entram (inclui 'tudo')
  v_tudo      boolean;
  v_auto      jsonb := '[]'::jsonb;
  v_codigo    text;
  v_motivo    text;
  v_detalhe   text[] := '{}';
  v_os        uuid[];
  v_cli       uuid[];
  v_filiais   uuid[] := '{}';
  v_empresas  uuid[] := '{}';
  v_tab       jsonb := '{}'::jsonb;
  v_resumo    jsonb := '{}'::jsonb;
  v_desv      jsonb := '{}'::jsonb;
  v_avisos    jsonb := '[]'::jsonb;
  v_cnt       bigint;
  v_existe    boolean;
  v_os_ult    int;
  v_venda_ult int;
  v_os_zera   boolean;
  v_venda_zera boolean;
  v_login_ok  boolean;
  v_ultima    timestamptz;
  v_proxima   timestamptz;
  v_amr       jsonb;
  r           record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar.' USING ERRCODE = 'ZD000';
  END IF;

  -- Categorias pedidas: validar e expandir
  IF p_categorias IS NULL OR cardinality(p_categorias) = 0 THEN
    RAISE EXCEPTION 'Escolha pelo menos um item para apagar.' USING ERRCODE = 'ZD007';
  END IF;
  v_pedidas := ARRAY(SELECT DISTINCT lower(trim(x)) FROM unnest(p_categorias) x WHERE x IS NOT NULL ORDER BY 1);
  IF EXISTS (SELECT 1 FROM unnest(v_pedidas) x WHERE NOT x = ANY (c_validas)) OR cardinality(v_pedidas) = 0 THEN
    RAISE EXCEPTION 'Item desconhecido na lista do que apagar.' USING ERRCODE = 'ZD007';
  END IF;
  v_tudo := 'tudo' = ANY (v_pedidas);
  v_ef := CASE WHEN v_tudo THEN c_ordem ELSE array_remove(v_pedidas, 'tudo') END;

  IF 'clientes' = ANY (v_ef) THEN
    IF NOT 'os' = ANY (v_ef) THEN
      v_ef := v_ef || 'os'::text;
      v_auto := v_auto || jsonb_build_object('categoria', 'os', 'por_causa_de', 'clientes',
        'motivo', 'As ordens de serviço ficariam sem cliente.');
    END IF;
    IF NOT 'vendas' = ANY (v_ef) THEN
      v_ef := v_ef || 'vendas'::text;
      v_auto := v_auto || jsonb_build_object('categoria', 'vendas', 'por_causa_de', 'clientes',
        'motivo', 'As vendas ficariam sem cliente.');
    END IF;
    IF NOT 'orcamentos' = ANY (v_ef) THEN
      v_ef := v_ef || 'orcamentos'::text;
      v_auto := v_auto || jsonb_build_object('categoria', 'orcamentos', 'por_causa_de', 'clientes',
        'motivo', 'Os orçamentos ficariam sem cliente.');
    END IF;
  END IF;
  IF 'estoque' = ANY (v_ef) AND NOT 'vendas' = ANY (v_ef) THEN
    v_ef := v_ef || 'vendas'::text;
    v_auto := v_auto || jsonb_build_object('categoria', 'vendas', 'por_causa_de', 'estoque',
      'motivo', 'As vendas ficariam sem o produto ou aparelho vendido.');
  END IF;
  v_ef := ARRAY(SELECT x FROM unnest(c_ordem) WITH ORDINALITY u(x, i) WHERE x = ANY (v_ef) ORDER BY i);
  v_casar := v_ef || CASE WHEN v_tudo THEN ARRAY['tudo'] ELSE '{}'::text[] END;

  -- Quem pode: só o dono da conta (trava igual à do B_zerar.sql)
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role::text = 'admin') THEN
    v_codigo := 'admin';
    v_motivo := 'Contas de administrador não podem usar este recurso.';
  ELSIF EXISTS (SELECT 1 FROM public.loja_funcionarios WHERE funcionario_user_id = v_uid AND loja_user_id <> v_uid) THEN
    v_codigo := 'funcionario';
    v_motivo := 'Só o dono da conta pode apagar os dados da loja.';
  ELSIF to_regclass('public.empresa_usuarios') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE gerente_id = $1)' INTO v_existe USING v_uid;
    IF v_existe THEN
      v_codigo := 'gerente';
      v_motivo := 'Só o dono da conta pode apagar os dados da loja.';
    END IF;
  END IF;

  IF v_codigo IS NULL THEN
    v_os  := ARRAY(SELECT id FROM public.ordens_servico WHERE user_id = v_uid);
    v_cli := ARRAY(SELECT id FROM public.clientes WHERE user_id = v_uid);

    -- Filiais com dados, ou linhas de outro usuário nas empresas dele
    IF to_regclass('public.empresas') IS NOT NULL THEN
      EXECUTE 'SELECT ARRAY(SELECT id FROM public.empresas WHERE proprietario_id = $1 AND tipo = ''filial'')' INTO v_filiais USING v_uid;
      EXECUTE 'SELECT ARRAY(SELECT id FROM public.empresas WHERE proprietario_id = $1)' INTO v_empresas USING v_uid;
    END IF;
    IF cardinality(v_empresas) > 0 THEN
      FOR r IN
        SELECT c.tabela, c.filtro,
               EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass(c.tabela)
                         AND a.attname = 'user_id' AND NOT a.attisdropped) AS tem_user
        FROM public._zerar_catalogo() c
        WHERE c.lista = 'APAGAR' AND to_regclass(c.tabela) IS NOT NULL
          AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass(c.tabela)
                        AND a.attname = 'empresa_id' AND NOT a.attisdropped)
      LOOP
        IF cardinality(v_filiais) > 0 THEN
          EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE (%s) AND empresa_id = ANY ($4))', r.tabela, r.filtro)
            INTO v_existe USING v_uid, v_os, v_cli, v_filiais;
          IF v_existe THEN v_detalhe := v_detalhe || format('%s: dados de filial', r.tabela); END IF;
        END IF;
        IF r.tem_user THEN
          EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE empresa_id = ANY ($2) AND user_id IS DISTINCT FROM $1)', r.tabela)
            INTO v_existe USING v_uid, v_empresas;
          IF v_existe THEN v_detalhe := v_detalhe || format('%s: linha de outro usuário numa empresa dele', r.tabela); END IF;
        END IF;
      END LOOP;
      IF cardinality(v_detalhe) > 0 THEN
        v_codigo := 'filiais';
        v_motivo := 'Sua conta tem filiais com dados. Fale com o suporte.';
      END IF;
    END IF;
  END IF;

  IF v_codigo IS NULL THEN
    -- Tabela que o catálogo não conhece, com dados dele (pelo dono ou por ligação com o que seria apagado)
    FOR r IN
      SELECT k.oid::regclass::text AS t, a.attname AS c
      FROM pg_class k
      JOIN pg_attribute a ON a.attrelid = k.oid AND NOT a.attisdropped
      WHERE k.relnamespace = 'public'::regnamespace AND k.relkind IN ('r', 'p')
        AND a.attname IN ('user_id', 'loja_user_id', 'proprietario_id')
        AND NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE to_regclass(c.tabela) = k.oid)
    LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', r.t, r.c) INTO v_existe USING v_uid;
      IF v_existe THEN v_detalhe := v_detalhe || format('tabela não classificada %s (%s)', r.t, r.c); END IF;
    END LOOP;
    FOR r IN
      SELECT con.conrelid::regclass::text AS filha, af.attname AS col_filha,
             con.confrelid::regclass::text AS mae, am.attname AS col_mae
      FROM pg_constraint con
      JOIN pg_class kf ON kf.oid = con.conrelid
      JOIN pg_attribute af ON af.attrelid = con.conrelid AND af.attnum = con.conkey[1]
      JOIN pg_attribute am ON am.attrelid = con.confrelid AND am.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND kf.relnamespace = 'public'::regnamespace
        AND NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE to_regclass(c.tabela) = con.conrelid)
        AND EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.lista = 'APAGAR' AND to_regclass(c.tabela) = con.confrelid)
        AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = con.confrelid AND x.attname = 'user_id' AND NOT x.attisdropped)
    LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s f WHERE f.%I IN (SELECT m.%I FROM %s m WHERE m.user_id = $1))',
                     r.filha, r.col_filha, r.col_mae, r.mae)
        INTO v_existe USING v_uid;
      IF v_existe THEN v_detalhe := v_detalhe || format('tabela não classificada %s (ligada a %s)', r.filha, r.mae); END IF;
    END LOOP;
    IF cardinality(v_detalhe) > 0 THEN
      v_codigo := 'tabela_nao_classificada';
      v_motivo := 'Encontramos dados que este recurso ainda não sabe apagar com segurança. Fale com o suporte.';
    END IF;
  END IF;

  IF v_codigo IS NOT NULL THEN
    RETURN jsonb_build_object(
      'pode_usar', false, 'codigo', v_codigo, 'motivo', v_motivo,
      'detalhe_suporte', to_jsonb(v_detalhe), 'categorias_pedidas', to_jsonb(v_pedidas));
  END IF;

  -- Contagens do que será apagado
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista = 'APAGAR' AND c.categoria = ANY (v_casar) AND to_regclass(c.tabela) IS NOT NULL
    ORDER BY c.ordem
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %s', r.tabela, r.filtro) INTO v_cnt USING v_uid, v_os, v_cli;
    v_tab := v_tab || jsonb_build_object(replace(r.tabela, 'public.', ''), v_cnt);
  END LOOP;

  -- Resumo por categoria, em números que o lojista reconhece
  IF 'vendas' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('vendas', jsonb_build_object(
      -- parcelas e o 2º pagamento são linhas extras da mesma venda
      'vendas', (SELECT count(*) FROM public.vendas WHERE user_id = v_uid
                   AND (parcela_numero IS NULL OR parcela_numero = 1)
                   AND observacoes IS DISTINCT FROM 'pagamento_duplo_secundario'),
      'vendas_avulsas', COALESCE((v_tab->>'vendas_avulsas')::bigint, 0) + COALESCE((v_tab->>'servicos_avulsos')::bigint, 0),
      'pedidos', COALESCE((v_tab->>'pedidos')::bigint, 0),
      'trocas_garantia', COALESCE((v_tab->>'trocas_garantia')::bigint, 0)));
  END IF;
  IF 'os' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('os', jsonb_build_object(
      'ordens_servico', COALESCE((v_tab->>'ordens_servico')::bigint, 0),
      'na_lixeira', (SELECT count(*) FROM public.ordens_servico WHERE user_id = v_uid AND deleted_at IS NOT NULL)));
  END IF;
  IF 'clientes' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('clientes', jsonb_build_object(
      'clientes', COALESCE((v_tab->>'clientes')::bigint, 0),
      'pontos_fidelidade', COALESCE((v_tab->>'fidelidade_pontos')::bigint, 0),
      'remessas', COALESCE((v_tab->>'remessas_corporativas')::bigint, 0)));
  END IF;
  IF 'financeiro' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('financeiro', jsonb_build_object(
      'contas', COALESCE((v_tab->>'contas')::bigint, 0),
      'caixas', COALESCE((v_tab->>'caixas')::bigint, 0),
      'lancamentos_extrato', COALESCE((v_tab->>'extrato_lancamentos_manuais')::bigint, 0)));
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('estoque', jsonb_build_object(
      'produtos', COALESCE((v_tab->>'produtos')::bigint, 0),
      'pecas', COALESCE((v_tab->>'pecas')::bigint, 0),
      'aparelhos', COALESCE((v_tab->>'dispositivos')::bigint, 0),
      'compras_aparelhos', COALESCE((v_tab->>'compras_dispositivos')::bigint, 0),
      'fornecedores', COALESCE((v_tab->>'fornecedores')::bigint, 0),
      'notas_xml', COALESCE((v_tab->>'compras_xml_importadas')::bigint, 0)));
  END IF;
  IF 'orcamentos' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('orcamentos', jsonb_build_object(
      'orcamentos', COALESCE((v_tab->>'orcamentos')::bigint, 0)));
  END IF;

  -- Ligações desfeitas (SET NULL) — a execução faz exatamente estas
  IF 'clientes' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    v_desv := v_desv || jsonb_build_object('contas_sem_cliente',
      (SELECT count(*) FROM public.contas WHERE user_id = v_uid AND cliente_id = ANY (v_cli)));
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    IF NOT 'os' = ANY (v_ef) THEN
      v_desv := v_desv || jsonb_build_object('os_sem_fornecedor',
        (SELECT count(*) FROM public.ordens_servico WHERE user_id = v_uid
           AND servico_fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid)));
    END IF;
    v_desv := v_desv || jsonb_build_object('servicos_sem_peca',
      (SELECT count(*) FROM public.servicos WHERE user_id = v_uid
         AND peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid)));
    IF NOT 'financeiro' = ANY (v_ef) THEN
      v_desv := v_desv || jsonb_build_object('contas_sem_fornecedor',
        (SELECT count(*) FROM public.contas WHERE user_id = v_uid
           AND fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid)));
    END IF;
  END IF;

  -- Contadores (regra b): OS só volta a 1 se não sobrar OS nem conta citando número de OS
  SELECT ultimo_numero INTO v_os_ult FROM public.user_os_counters WHERE user_id = v_uid;
  SELECT ultimo_numero INTO v_venda_ult FROM public.user_venda_counters WHERE user_id = v_uid;
  v_venda_zera := 'vendas' = ANY (v_ef);
  v_os_zera := 'os' = ANY (v_ef) AND ('financeiro' = ANY (v_ef) OR NOT EXISTS (
    SELECT 1 FROM public.contas WHERE user_id = v_uid AND COALESCE(os_numero, '') <> ''));

  -- Avisos em português simples
  v_avisos := v_avisos || jsonb_build_object('codigo', 'sem_volta', 'quantidade', NULL,
    'texto', 'O que for apagado some de vez. Não tem como recuperar.');
  IF 'vendas' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'estoque_nao_volta', 'quantidade', NULL,
      'texto', 'Os produtos e aparelhos vendidos não voltam para o estoque.');
    SELECT count(*) INTO v_cnt FROM public.dispositivo_imeis
      WHERE venda_id IN (SELECT id FROM public.vendas WHERE user_id = v_uid);
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'imeis_sem_venda', 'quantidade', v_cnt,
        'texto', format('%s IMEI(s) de aparelhos vendidos perdem a ligação com a venda.', v_cnt));
    END IF;
  END IF;
  IF 'vendas' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.contas WHERE user_id = v_uid AND descricao LIKE 'venda_id:%';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_de_vendas_ficam', 'quantidade', v_cnt,
        'texto', format('%s conta(s) a receber de vendas continuam no Financeiro, sem a venda.', v_cnt));
    END IF;
  END IF;
  IF 'vendas' = ANY (v_ef) AND NOT 'clientes' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.fidelidade_pontos WHERE user_id = v_uid AND tipo = 'venda';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'pontos_de_vendas_ficam', 'quantidade', v_cnt,
        'texto', format('%s lançamento(s) de pontos de fidelidade vindos de vendas continuam com os clientes.', v_cnt));
    END IF;
  END IF;
  IF 'os' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'pecas_os_nao_voltam', 'quantidade', NULL,
      'texto', 'As peças usadas nas ordens de serviço não voltam para o estoque.');
  END IF;
  IF 'os' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.contas WHERE user_id = v_uid AND COALESCE(os_numero, '') <> '';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_de_os_ficam', 'quantidade', v_cnt,
        'texto', format('%s conta(s) ligadas a ordens de serviço continuam no Financeiro.', v_cnt));
    END IF;
  END IF;
  IF 'os' = ANY (v_ef) AND NOT 'clientes' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.fidelidade_pontos WHERE user_id = v_uid AND tipo = 'os';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'pontos_de_os_ficam', 'quantidade', v_cnt,
        'texto', format('%s lançamento(s) de pontos de fidelidade vindos de OS continuam com os clientes.', v_cnt));
    END IF;
  END IF;
  IF COALESCE((v_desv->>'contas_sem_cliente')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_sem_cliente', 'quantidade', (v_desv->>'contas_sem_cliente')::bigint,
      'texto', format('%s conta(s) do Financeiro continuam, mas sem o nome do cliente.', v_desv->>'contas_sem_cliente'));
  END IF;
  IF COALESCE((v_desv->>'os_sem_fornecedor')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'os_sem_fornecedor', 'quantidade', (v_desv->>'os_sem_fornecedor')::bigint,
      'texto', format('%s ordem(ns) de serviço continuam, mas sem o fornecedor do serviço terceirizado.', v_desv->>'os_sem_fornecedor'));
  END IF;
  IF COALESCE((v_desv->>'servicos_sem_peca')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'servicos_sem_peca', 'quantidade', (v_desv->>'servicos_sem_peca')::bigint,
      'texto', format('%s serviço(s) cadastrados continuam, mas sem a peça ligada a eles.', v_desv->>'servicos_sem_peca'));
  END IF;
  IF COALESCE((v_desv->>'contas_sem_fornecedor')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_sem_fornecedor', 'quantidade', (v_desv->>'contas_sem_fornecedor')::bigint,
      'texto', format('%s conta(s) do Financeiro continuam, mas sem o fornecedor.', v_desv->>'contas_sem_fornecedor'));
  END IF;
  IF 'financeiro' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.entradas_estoque
      WHERE user_id = v_uid AND conta_id IN (SELECT id FROM public.contas WHERE user_id = v_uid);
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'entradas_sem_conta', 'quantidade', v_cnt,
        'texto', format('%s entrada(s) de estoque continuam, mas sem a conta a pagar da compra.', v_cnt));
    END IF;
  END IF;
  IF 'financeiro' = ANY (v_ef) AND NOT 'vendas' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'vendas_sem_recebimento', 'quantidade', NULL,
      'texto', 'As vendas continuam, mas as contas a receber delas e os caixas somem do Financeiro.');
  END IF;
  IF 'os' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contador_os', 'quantidade', NULL,
      'texto', CASE WHEN v_os_zera THEN 'A próxima ordem de serviço volta a ser a nº 1.'
                    ELSE format('A numeração das OS continua: a próxima será a nº %s (ainda há contas citando números de OS).',
                                COALESCE(v_os_ult, 0) + 1) END);
  END IF;
  IF 'vendas' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contador_venda', 'quantidade', NULL,
      'texto', 'A próxima venda volta a ser a nº 1.');
  END IF;

  -- Senha recente (amr do token) e intervalo mínimo entre execuções
  v_amr := auth.jwt()->'amr';
  v_login_ok := jsonb_typeof(v_amr) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_amr) e
    WHERE e->>'method' = 'password' AND (e->>'timestamp') ~ '^[0-9]+$'
      AND to_timestamp((e->>'timestamp')::bigint) >= now() - interval '10 minutes');
  SELECT max(executado_em) INTO v_ultima FROM public.zerar_dados_execucoes WHERE user_id = v_uid;
  IF v_ultima IS NOT NULL AND v_ultima > now() - interval '10 minutes' THEN
    v_proxima := v_ultima + interval '10 minutes';
  END IF;

  RETURN jsonb_build_object(
    'pode_usar', true,
    'codigo', NULL,
    'motivo', NULL,
    'categorias_pedidas', to_jsonb(v_pedidas),
    'categorias_efetivas', to_jsonb(v_ef),
    'tudo', v_tudo,
    'incluidas_automaticamente', v_auto,
    'resumo', v_resumo,
    'tabelas', v_tab,
    'desvinculos', v_desv,
    'avisos', v_avisos,
    'contadores', jsonb_build_object(
      'os',    jsonb_build_object('volta_para_1', v_os_zera,
                 'proximo', CASE WHEN v_os_zera THEN 1 ELSE COALESCE(v_os_ult, 0) + 1 END),
      'venda', jsonb_build_object('volta_para_1', v_venda_zera,
                 'proximo', CASE WHEN v_venda_zera THEN 1 ELSE COALESCE(v_venda_ult, 0) + 1 END)),
    'reexibe_primeiros_passos', v_tudo,
    'login_recente', v_login_ok,
    'proxima_execucao_em', v_proxima,
    'impressao', md5(jsonb_build_object(
      'categorias', to_jsonb(v_ef), 'tudo', v_tudo, 'tabelas', v_tab, 'desvinculos', v_desv,
      'os_zera', v_os_zera, 'venda_zera', v_venda_zera)::text)
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.zerar_meus_dados_previa(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zerar_meus_dados_previa(text[]) TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 6) EXECUÇÃO — apaga numa transação só (qualquer erro desfaz tudo)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zerar_meus_dados_executar(p_categorias text[], p_confirmacao text, p_impressao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_buckets   constant text[] := ARRAY['dispositivos-fotos', 'produtos-fotos', 'compras-fotos',
                                       'compras-documentos', 'origem-documentos', 'termos-compra', 'notas-compra-xml'];
  c_url       constant text := '/storage/v1/object/(?:public|sign)/([a-z0-9_-]+)/([^"?\s\\,)]+)';
  v_inicio    timestamptz := clock_timestamp();
  v_uid       uuid := auth.uid();
  v_prev      jsonb;
  v_ef        text[];
  v_casar     text[];
  v_tudo      boolean;
  v_os        uuid[];
  v_cli       uuid[];
  v_exec      uuid;
  v_refs      text[] := '{}';
  v_tmp       text[];
  v_arquivos  int := 0;
  v_antes     jsonb := '{}'::jsonb;
  v_apagadas  jsonb := '{}'::jsonb;
  v_desv      jsonb := '{}'::jsonb;
  v_problemas text[] := '{}';
  v_cnt       bigint;
  v_n         bigint;
  v_os_zera   boolean;
  v_venda_zera boolean;
  v_onb       boolean := false;
  v_os_antes  int;
  v_venda_antes int;
  v_os_depois int;
  v_venda_depois int;
  r           record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar.' USING ERRCODE = 'ZD000';
  END IF;
  IF p_confirmacao IS DISTINCT FROM 'APAGAR' THEN
    RAISE EXCEPTION 'Digite APAGAR (em letras maiúsculas) para confirmar.' USING ERRCODE = 'ZD002';
  END IF;

  -- Uma execução por conta de cada vez (o 2º clique espera o 1º terminar)
  PERFORM pg_advisory_xact_lock(hashtextextended('zerar_meus_dados:' || v_uid::text, 0));

  v_prev := public.zerar_meus_dados_previa(p_categorias);
  IF NOT (v_prev->>'pode_usar')::boolean THEN
    RAISE EXCEPTION '%', v_prev->>'motivo' USING ERRCODE = 'ZD001';
  END IF;
  IF NOT (v_prev->>'login_recente')::boolean THEN
    RAISE EXCEPTION 'Por segurança, digite sua senha de novo antes de apagar.' USING ERRCODE = 'ZD003';
  END IF;
  IF v_prev->>'proxima_execucao_em' IS NOT NULL THEN
    RAISE EXCEPTION 'Você acabou de apagar dados. Aguarde alguns minutos para fazer de novo.' USING ERRCODE = 'ZD004';
  END IF;
  IF p_impressao IS DISTINCT FROM v_prev->>'impressao' THEN
    RAISE EXCEPTION 'Os números mudaram desde a revisão. Revise de novo antes de apagar.' USING ERRCODE = 'ZD005';
  END IF;

  v_ef := ARRAY(SELECT jsonb_array_elements_text(v_prev->'categorias_efetivas'));
  v_tudo := (v_prev->>'tudo')::boolean;
  v_casar := v_ef || CASE WHEN v_tudo THEN ARRAY['tudo'] ELSE '{}'::text[] END;
  v_os_zera := (v_prev->'contadores'->'os'->>'volta_para_1')::boolean;
  v_venda_zera := (v_prev->'contadores'->'venda'->>'volta_para_1')::boolean;
  v_os  := ARRAY(SELECT id FROM public.ordens_servico WHERE user_id = v_uid);
  v_cli := ARRAY(SELECT id FROM public.clientes WHERE user_id = v_uid);

  INSERT INTO public.zerar_dados_execucoes (user_id, categorias_pedidas, categorias_efetivas)
  VALUES (v_uid, ARRAY(SELECT jsonb_array_elements_text(v_prev->'categorias_pedidas')), v_ef)
  RETURNING id INTO v_exec;

  -- Fila de fotos: URLs citadas nas linhas que vão ser apagadas (antes de apagar).
  -- Os históricos (audit) ficam de fora: repetem as mesmas URLs das OS/clientes.
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista = 'APAGAR' AND c.categoria = ANY (v_casar) AND to_regclass(c.tabela) IS NOT NULL
      AND c.tabela NOT IN ('public.os_audit_log', 'public.clientes_audit_log')
  LOOP
    EXECUTE format('SELECT array_agg(DISTINCT m[1] || chr(31) || m[2]) FROM %s x, regexp_matches(x::text, $4, ''g'') m WHERE %s',
                   r.tabela, r.filtro)
      INTO v_tmp USING v_uid, v_os, v_cli, c_url;
    v_refs := v_refs || COALESCE(v_tmp, '{}');
  END LOOP;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO public.zerar_dados_arquivos (execucao_id, bucket, caminho, motivo)
    SELECT v_exec, o.bucket_id, o.name, string_agg(DISTINCT x.motivo, ' + ' ORDER BY x.motivo)
    FROM storage.objects o
    JOIN (
      SELECT split_part(u, chr(31), 1) AS b, split_part(u, chr(31), 2) AS n, 'citado nos dados apagados' AS motivo
      FROM unnest(v_refs) u
      UNION ALL
      SELECT split_part(u, chr(31), 1),
             regexp_replace(split_part(u, chr(31), 2), '(^|/)(v2-[^/]*)\.([A-Za-z0-9]+)$', '\1\2_thumb.\3'),
             'miniatura'
      FROM unnest(v_refs) u
      WHERE split_part(u, chr(31), 2) ~ '(^|/)v2-[^/]*\.[A-Za-z0-9]+$'
      UNION ALL
      SELECT o2.bucket_id, o2.name, 'pasta do lojista'
      FROM storage.objects o2
      WHERE v_tudo AND o2.name LIKE v_uid::text || '/%' AND o2.bucket_id = ANY (c_buckets)
    ) x ON x.b = o.bucket_id AND x.n = o.name
    WHERE o.bucket_id = ANY (c_buckets)
    GROUP BY o.bucket_id, o.name;
    GET DIAGNOSTICS v_arquivos = ROW_COUNT;
  END IF;

  -- Contagens ANTES (tudo que é do dono)
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista IN ('APAGAR', 'MANTER') AND to_regclass(c.tabela) IS NOT NULL
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %s', r.tabela, r.filtro) INTO v_cnt USING v_uid, v_os, v_cli;
    v_antes := v_antes || jsonb_build_object(r.tabela, v_cnt);
  END LOOP;
  SELECT ultimo_numero INTO v_os_antes FROM public.user_os_counters WHERE user_id = v_uid;
  SELECT ultimo_numero INTO v_venda_antes FROM public.user_venda_counters WHERE user_id = v_uid;

  -- Ligações desfeitas (as mesmas que a prévia contou)
  IF 'clientes' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    UPDATE public.contas SET cliente_id = NULL WHERE user_id = v_uid AND cliente_id = ANY (v_cli);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_desv := v_desv || jsonb_build_object('contas_sem_cliente', v_n);
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    IF NOT 'os' = ANY (v_ef) THEN
      UPDATE public.ordens_servico SET servico_fornecedor_id = NULL
       WHERE user_id = v_uid AND servico_fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_desv := v_desv || jsonb_build_object('os_sem_fornecedor', v_n);
    END IF;
    UPDATE public.servicos SET peca_id = NULL
     WHERE user_id = v_uid AND peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_desv := v_desv || jsonb_build_object('servicos_sem_peca', v_n);
    IF NOT 'financeiro' = ANY (v_ef) THEN
      UPDATE public.contas SET fornecedor_id = NULL
       WHERE user_id = v_uid AND fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_desv := v_desv || jsonb_build_object('contas_sem_fornecedor', v_n);
    END IF;
  END IF;

  -- Exclusão na ordem do catálogo (filhas antes das mães)
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista = 'APAGAR' AND c.categoria = ANY (v_casar) AND to_regclass(c.tabela) IS NOT NULL
    ORDER BY c.ordem
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %s', r.tabela, r.filtro) USING v_uid, v_os, v_cli;
    v_apagadas := v_apagadas || jsonb_build_object(replace(r.tabela, 'public.', ''), (v_antes->>r.tabela)::bigint);
  END LOOP;

  -- Primeiros Passos
  IF 'clientes' = ANY (v_ef) THEN
    UPDATE public.user_onboarding SET primeiro_cliente_id = NULL
     WHERE user_id = v_uid AND primeiro_cliente_id IS NOT NULL;
  END IF;
  IF v_tudo THEN
    UPDATE public.user_onboarding SET onboarding_dismissed = false, onboarding_dismissed_at = NULL
     WHERE user_id = v_uid;
    v_onb := FOUND;
  END IF;

  -- Contadores (regra b)
  IF v_venda_zera THEN
    UPDATE public.user_venda_counters SET ultimo_numero = 0, updated_at = now() WHERE user_id = v_uid;
  END IF;
  IF v_os_zera THEN
    UPDATE public.user_os_counters SET ultimo_numero = 0, updated_at = now() WHERE user_id = v_uid;
  END IF;

  -- Conferência: o marcado ficou em 0; o resto não perdeu nenhuma linha.
  -- "Não diminuiu" (e não "igual"): o sistema grava sozinho em algumas tabelas
  -- que ficam (user_events, notificações) e isso não pode desfazer tudo à toa.
  FOR r IN
    SELECT c.lista, c.categoria, c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista IN ('APAGAR', 'MANTER') AND to_regclass(c.tabela) IS NOT NULL
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %s', r.tabela, r.filtro) INTO v_cnt USING v_uid, v_os, v_cli;
    IF r.lista = 'APAGAR' AND r.categoria = ANY (v_casar) THEN
      IF v_cnt <> 0 THEN
        v_problemas := v_problemas || format('%s ainda tem %s linha(s)', r.tabela, v_cnt);
      END IF;
    ELSIF v_cnt < (v_antes->>r.tabela)::bigint THEN
      v_problemas := v_problemas || format('%s devia ficar com %s e ficou com %s linha(s)',
                                           r.tabela, v_antes->>r.tabela, v_cnt);
    END IF;
  END LOOP;
  SELECT ultimo_numero INTO v_os_depois FROM public.user_os_counters WHERE user_id = v_uid;
  SELECT ultimo_numero INTO v_venda_depois FROM public.user_venda_counters WHERE user_id = v_uid;
  IF v_os_zera AND COALESCE(v_os_depois, 0) <> 0 THEN
    v_problemas := v_problemas || 'contador de OS não zerou'::text;
  ELSIF NOT v_os_zera AND v_os_depois IS DISTINCT FROM v_os_antes THEN
    v_problemas := v_problemas || 'contador de OS mudou sem poder'::text;
  END IF;
  IF v_venda_zera AND COALESCE(v_venda_depois, 0) <> 0 THEN
    v_problemas := v_problemas || 'contador de vendas não zerou'::text;
  ELSIF NOT v_venda_zera AND v_venda_depois IS DISTINCT FROM v_venda_antes THEN
    v_problemas := v_problemas || 'contador de vendas mudou sem poder'::text;
  END IF;
  IF v_os_zera AND EXISTS (SELECT 1 FROM public.contas WHERE user_id = v_uid AND COALESCE(os_numero, '') <> '') THEN
    v_problemas := v_problemas || 'contador de OS zerado com contas citando OS'::text;
  END IF;
  IF v_desv IS DISTINCT FROM v_prev->'desvinculos' THEN
    v_problemas := v_problemas || format('ligações desfeitas (%s) diferentes da prévia (%s)', v_desv, v_prev->'desvinculos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    v_problemas := v_problemas || 'login sumiu'::text;
  END IF;

  IF cardinality(v_problemas) > 0 THEN
    RAISE EXCEPTION 'A conferência final não bateu. Nada foi apagado.'
      USING ERRCODE = 'ZD006', DETAIL = array_to_string(v_problemas, '; ');
  END IF;

  UPDATE public.zerar_dados_execucoes SET
    quantidades = v_apagadas,
    desvinculos = v_desv,
    contador_os_zerado = v_os_zera,
    contador_venda_zerado = v_venda_zera,
    onboarding_reexibido = v_onb,
    arquivos_na_fila = v_arquivos,
    storage_status = CASE WHEN v_arquivos = 0 THEN 'sem_arquivos' ELSE 'pendente' END,
    duracao_ms = (extract(epoch FROM clock_timestamp() - v_inicio) * 1000)::int
  WHERE id = v_exec;

  RETURN jsonb_build_object(
    'execucao_id', v_exec,
    'categorias_efetivas', to_jsonb(v_ef),
    'apagados', v_apagadas,
    'desvinculos', v_desv,
    'contador_os_zerado', v_os_zera,
    'contador_venda_zerado', v_venda_zera,
    'onboarding_reexibido', v_onb,
    'arquivos_na_fila', v_arquivos
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) TO authenticated, service_role;

COMMIT;
