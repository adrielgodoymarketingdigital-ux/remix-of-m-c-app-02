-- =====================================================================
-- "Começar do zero" — ETAPA 3a (somente banco): fantasmas da cota do plano
--
-- Apagar OS, aparelhos, produtos/peças e serviços avulsos liberava a cota do
-- plano (o app conta nas próprias tabelas). Agora a execução grava, ANTES de
-- apagar e na mesma transação, uma linha por item que contava na cota:
-- só tipo + data de criação original (nada do cliente nem do item).
-- O app passa a somar essas linhas na etapa 3b; até lá nada muda para ninguém
-- (a tela do recurso ainda não existe e ninguém chama a execução).
--
--   1) tabela cota_registros_apagados (fechada; o dono só lê as dele)
--   2) _zerar_catalogo(): a tabela nova entra como SISTEMA (nunca apagada,
--      não conta como "tabela não classificada")
--   3) zerar_meus_dados_executar(): igual à da etapa 1 + gravação dos fantasmas
--      (mesma assinatura, códigos ZD000–ZD007, trava, impressão, senha recente
--      e intervalo de 10 min)
--
-- Nenhuma outra tabela existente é tocada. Idempotente, numa transação só.
--
-- ROLLBACK (nesta ordem):
--   1. BEGIN; DROP TABLE IF EXISTS public.cota_registros_apagados; COMMIT;
--   2. Rodar de novo, inteira, a migration 20261027120000_zerar_meus_dados_etapa1.sql
--      (é idempotente: só recoloca _zerar_catalogo e zerar_meus_dados_executar
--      da etapa 1; a etapa 2 não mexeu nessas funções).
--   Entre o passo 1 e o 2, uma execução daria erro e não apagaria nada
--   (a função tenta gravar na tabela que não existe e a transação desfaz).
-- =====================================================================

BEGIN;


-- ---------------------------------------------------------------------
-- 1) Fantasmas da cota
--    execucao_id: SET NULL se um dia a execução sair do log; o fantasma de
--    aparelho precisa continuar contando para sempre (regra de total).
--    criado_em aceita nulo como a origem: aparelho sem data conta no total e
--    fica fora dos filtros por mês, igual ao item vivo.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cota_registros_apagados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tipo        text NOT NULL
              CONSTRAINT cota_registros_apagados_tipo_check
              CHECK (tipo IN ('os', 'dispositivo', 'produto', 'peca', 'servico_avulso')),
  criado_em   timestamptz,
  execucao_id uuid REFERENCES public.zerar_dados_execucoes (id) ON DELETE SET NULL,
  apagado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cota_registros_apagados_contagem
  ON public.cota_registros_apagados (user_id, tipo, criado_em);

ALTER TABLE public.cota_registros_apagados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cota_registros_apagados FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cota_registros_apagados TO authenticated;
GRANT ALL ON TABLE public.cota_registros_apagados TO service_role;
-- O dono lê só as dele (o app soma na contagem da cota). Ninguém grava por fora:
-- só a função de execução, que roda como dona da tabela.
DROP POLICY IF EXISTS "Dono le os proprios registros apagados" ON public.cota_registros_apagados;
CREATE POLICY "Dono le os proprios registros apagados"
  ON public.cota_registros_apagados FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 2) Catálogo (igual ao da etapa 1 + a tabela nova como SISTEMA)
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
    (3010, 'SISTEMA', NULL, 'public.zerar_dados_arquivos',        NULL),
    -- etapa 3a: fantasmas da cota (nunca apagados pelo "Começar do zero")
    (3020, 'SISTEMA', NULL, 'public.cota_registros_apagados',     NULL)
$$;

REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;



-- ---------------------------------------------------------------------
-- 3) Execução (igual à da etapa 1 + fantasmas da cota antes de apagar)
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
  v_fantasmas jsonb := '{}'::jsonb;
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

  -- Fantasmas da cota (etapa 3a): uma linha por item que CONTAVA na cota do
  -- plano, com a data de criação original, antes de apagar. Mesma regra do app
  -- (useAssinatura / useServicosAvulsos): OS fora da lixeira e sem a marca dos
  -- Primeiros Passos; aparelhos, produtos, peças e serviços avulsos todos.
  IF 'os' = ANY (v_ef) THEN
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'os', created_at, v_exec FROM public.ordens_servico
     WHERE user_id = v_uid AND deleted_at IS NULL AND nao_conta_limite = false;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('os', v_n);
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'dispositivo', created_at, v_exec FROM public.dispositivos WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('dispositivo', v_n);
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'produto', created_at, v_exec FROM public.produtos WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('produto', v_n);
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'peca', created_at, v_exec FROM public.pecas WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('peca', v_n);
  END IF;
  IF 'vendas' = ANY (v_ef) THEN
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'servico_avulso', created_at, v_exec FROM public.servicos_avulsos WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('servico_avulso', v_n);
  END IF;

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
    'arquivos_na_fila', v_arquivos,
    'fantasmas_cota', v_fantasmas
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) TO authenticated, service_role;

COMMIT;
