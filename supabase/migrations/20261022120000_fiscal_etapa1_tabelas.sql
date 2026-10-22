-- =====================================================================
-- Fiscal — ETAPA 1: somente estrutura de banco (NFS-e, NF-e, NFC-e via Spedy).
--
-- Cria 6 tabelas novas, todas com RLS ligado. Nenhuma tabela, função,
-- tela ou Edge Function existente é alterada. Nenhum dado é inserido.
--
-- Acesso:
--   - Usuário autenticado: só SELECT. Padrão do projeto
--     (entradas_estoque, extrato_lancamentos_manuais):
--       dono  -> auth.uid() = user_id
--       funcionário -> public.is_funcionario_of(user_id)
--       gerente de filial -> empresa_usuarios (gerente_id, proprietario_id,
--                            empresa_id) restrito à empresa da linha
--   - Admin: SELECT em tudo via public.has_role(auth.uid(), 'admin').
--   - Escrita (INSERT/UPDATE/DELETE): nenhuma política; só a service role
--     (Edge Functions das próximas etapas). Os privilégios de escrita de
--     anon/authenticated também são revogados, como defesa extra.
--   - fiscal_segredos: RLS ligado, NENHUMA política e REVOKE ALL de
--     anon/authenticated. Nunca é lida pelo navegador. A cifragem da
--     X-API-Key da Spedy e do token CSC é feita na Edge Function (etapa 3).
--
-- Certificado digital (.pfx) e senha NÃO são armazenados aqui: ficam na
-- Spedy. Guardamos só validade e status para avisos.
--
-- Idempotente: CREATE ... IF NOT EXISTS; os DROP POLICY/TRIGGER IF EXISTS
-- atingem apenas objetos destas tabelas novas (padrão do projeto).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) fiscal_config — uma por loja (matriz: empresa_id NULL) ou filial
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_config (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id             uuid REFERENCES public.empresas(id),
  regime_tributario      text CHECK (regime_tributario IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real')),
  cnae                   text,
  codigo_ibge_municipio  text,
  ambiente               text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  serie_nfse             text,
  serie_nfe              text,
  serie_nfce             text,
  spedy_company_id       text,
  certificado_validade   date,
  certificado_status     text,
  ativo                  boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fiscal_config IS
  'Configuração fiscal por loja/filial (empresa_id NULL = matriz). Segredos ficam em fiscal_segredos.';

-- Único por (user_id, empresa_id), tratando empresa_id NULL (matriz) como
-- um valor: um UNIQUE comum deixaria várias linhas com empresa_id NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_config_user_empresa
  ON public.fiscal_config (user_id, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------
-- 2) fiscal_segredos — só service role
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_segredos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id          uuid NOT NULL UNIQUE REFERENCES public.fiscal_config(id) ON DELETE CASCADE,
  api_key_cifrada    text,
  csc_id             text,
  csc_token_cifrado  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fiscal_segredos IS
  'X-API-Key da Spedy e token CSC (NFC-e), cifrados pela Edge Function. Sem políticas: acesso só pela service role.';

-- ---------------------------------------------------------------------
-- 3) fiscal_perfis_tributarios — catálogo global, sem dados nesta etapa
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_perfis_tributarios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  descricao          text,
  regime_tributario  text CHECK (regime_tributario IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real')),
  cfop               text,
  csosn_cst          text,
  origem             text,
  pis_cofins         text,
  uf                 text,
  tipo_item          text NOT NULL CHECK (tipo_item IN ('produto', 'servico', 'aparelho_usado')),
  validado_por       text,
  validado_em        date,
  versao             integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  ativo              boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fiscal_perfis_tributarios IS
  'Perfis tributários (CFOP, CSOSN/CST, origem, PIS/COFINS) validados pelo contador. Usuários leem só os ativos.';
COMMENT ON COLUMN public.fiscal_perfis_tributarios.uf IS
  'Estado do perfil (ex.: SP). NULL = vale para qualquer UF.';
COMMENT ON COLUMN public.fiscal_perfis_tributarios.validado_por IS
  'Quem validou o perfil (ex.: nome do contador).';
-- REGRA para as próximas etapas: perfil com validado_em NULL NUNCA pode ser
-- oferecido como padrão ao usuário (nem pré-selecionado, nem aplicado
-- automaticamente em produto/peça/serviço/aparelho).
COMMENT ON COLUMN public.fiscal_perfis_tributarios.validado_em IS
  'Data da validação pelo contador. Perfil sem validado_em NÃO pode ser oferecido como padrão ao usuário.';
COMMENT ON COLUMN public.fiscal_perfis_tributarios.versao IS
  'Versão do perfil; incrementar a cada revisão das regras tributárias.';

-- ---------------------------------------------------------------------
-- 4) notas_fiscais
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id           uuid REFERENCES public.empresas(id),
  tipo                 text NOT NULL CHECK (tipo IN ('nfse', 'nfe', 'nfce')),
  origem               text NOT NULL CHECK (origem IN ('venda', 'os')),
  origem_id            uuid NOT NULL,
  referencia           text NOT NULL UNIQUE,
  status               text NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'autorizada', 'rejeitada', 'cancelada', 'erro')),
  ambiente             text NOT NULL CHECK (ambiente IN ('homologacao', 'producao')),
  numero               text,
  serie                text,
  chave                text,
  protocolo            text,
  valor_total          numeric(12,2),
  payload_enviado      jsonb,
  retorno              jsonb,
  motivo_erro          text,
  xml_url              text,
  pdf_url              text,
  emitida_por          uuid,
  emitida_em           timestamptz,
  cancelada_em         timestamptz,
  motivo_cancelamento  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notas_fiscais IS
  'Notas emitidas pela Spedy. referencia é única (impede emitir a mesma venda/OS duas vezes). Escrita só pela service role.';
COMMENT ON COLUMN public.notas_fiscais.emitida_por IS
  'auth.uid() de quem pediu a emissão (dono, funcionário ou gerente).';

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_user_status
  ON public.notas_fiscais (user_id, status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_origem
  ON public.notas_fiscais (origem, origem_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_created_at
  ON public.notas_fiscais (created_at);

-- ---------------------------------------------------------------------
-- 5) notas_fiscais_eventos — conteúdo bruto dos webhooks
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notas_fiscais_eventos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id          text NOT NULL UNIQUE,
  nota_id            uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  tipo               text,
  payload            jsonb,
  assinatura_valida  boolean NOT NULL DEFAULT false,
  processado         boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notas_fiscais_eventos IS
  'Webhooks recebidos da Spedy, brutos. evento_id único garante idempotência. Leitura só do admin.';

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_eventos_nota
  ON public.notas_fiscais_eventos (nota_id);

-- ---------------------------------------------------------------------
-- 6) fiscal_uso_mensal — contador de notas AUTORIZADAS por mês
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_uso_mensal (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes                 date NOT NULL CHECK (mes = date_trunc('month', mes)::date),
  notas_autorizadas   integer NOT NULL DEFAULT 0 CHECK (notas_autorizadas >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes)
);

COMMENT ON TABLE public.fiscal_uso_mensal IS
  'Notas autorizadas por mês (mes = 1º dia do mês em America/Sao_Paulo). Canceladas e rejeitadas não contam. Só informativo: NÃO bloqueia emissão.';

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_fiscal_config_updated_at ON public.fiscal_config;
CREATE TRIGGER update_fiscal_config_updated_at
  BEFORE UPDATE ON public.fiscal_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_segredos_updated_at ON public.fiscal_segredos;
CREATE TRIGGER update_fiscal_segredos_updated_at
  BEFORE UPDATE ON public.fiscal_segredos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_perfis_tributarios_updated_at ON public.fiscal_perfis_tributarios;
CREATE TRIGGER update_fiscal_perfis_tributarios_updated_at
  BEFORE UPDATE ON public.fiscal_perfis_tributarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notas_fiscais_updated_at ON public.notas_fiscais;
CREATE TRIGGER update_notas_fiscais_updated_at
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_uso_mensal_updated_at ON public.fiscal_uso_mensal;
CREATE TRIGGER update_fiscal_uso_mensal_updated_at
  BEFORE UPDATE ON public.fiscal_uso_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- RLS ligado em todas
-- ---------------------------------------------------------------------
ALTER TABLE public.fiscal_config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_segredos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_perfis_tributarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais_eventos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_uso_mensal         ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Privilégios: navegador só lê; segredos nem isso
-- ---------------------------------------------------------------------
REVOKE ALL ON public.fiscal_segredos FROM anon, authenticated;

REVOKE ALL ON public.fiscal_config             FROM anon;
REVOKE ALL ON public.fiscal_perfis_tributarios FROM anon;
REVOKE ALL ON public.notas_fiscais             FROM anon;
REVOKE ALL ON public.notas_fiscais_eventos     FROM anon;
REVOKE ALL ON public.fiscal_uso_mensal         FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.fiscal_config             FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.fiscal_perfis_tributarios FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.notas_fiscais             FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.notas_fiscais_eventos     FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.fiscal_uso_mensal         FROM authenticated;

GRANT SELECT ON public.fiscal_config             TO authenticated;
GRANT SELECT ON public.fiscal_perfis_tributarios TO authenticated;
GRANT SELECT ON public.notas_fiscais             TO authenticated;
GRANT SELECT ON public.notas_fiscais_eventos     TO authenticated;
GRANT SELECT ON public.fiscal_uso_mensal         TO authenticated;

GRANT ALL ON public.fiscal_config             TO service_role;
GRANT ALL ON public.fiscal_segredos           TO service_role;
GRANT ALL ON public.fiscal_perfis_tributarios TO service_role;
GRANT ALL ON public.notas_fiscais             TO service_role;
GRANT ALL ON public.notas_fiscais_eventos     TO service_role;
GRANT ALL ON public.fiscal_uso_mensal         TO service_role;

-- ---------------------------------------------------------------------
-- Políticas (somente SELECT)
-- ---------------------------------------------------------------------

-- fiscal_config
DROP POLICY IF EXISTS "dono e funcionarios veem fiscal_config" ON public.fiscal_config;
CREATE POLICY "dono e funcionarios veem fiscal_config"
  ON public.fiscal_config FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "gerente ve fiscal_config da filial" ON public.fiscal_config;
CREATE POLICY "gerente ve fiscal_config da filial"
  ON public.fiscal_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                 WHERE eu.gerente_id = auth.uid()
                   AND eu.proprietario_id = fiscal_config.user_id
                   AND eu.empresa_id = fiscal_config.empresa_id));

DROP POLICY IF EXISTS "admin ve fiscal_config" ON public.fiscal_config;
CREATE POLICY "admin ve fiscal_config"
  ON public.fiscal_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- fiscal_segredos: propositalmente SEM políticas.

-- fiscal_perfis_tributarios
DROP POLICY IF EXISTS "autenticados veem perfis tributarios ativos" ON public.fiscal_perfis_tributarios;
CREATE POLICY "autenticados veem perfis tributarios ativos"
  ON public.fiscal_perfis_tributarios FOR SELECT TO authenticated
  USING (ativo = true);

DROP POLICY IF EXISTS "admin ve perfis tributarios" ON public.fiscal_perfis_tributarios;
CREATE POLICY "admin ve perfis tributarios"
  ON public.fiscal_perfis_tributarios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- notas_fiscais
DROP POLICY IF EXISTS "dono e funcionarios veem notas fiscais" ON public.notas_fiscais;
CREATE POLICY "dono e funcionarios veem notas fiscais"
  ON public.notas_fiscais FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "gerente ve notas fiscais da filial" ON public.notas_fiscais;
CREATE POLICY "gerente ve notas fiscais da filial"
  ON public.notas_fiscais FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                 WHERE eu.gerente_id = auth.uid()
                   AND eu.proprietario_id = notas_fiscais.user_id
                   AND eu.empresa_id = notas_fiscais.empresa_id));

DROP POLICY IF EXISTS "admin ve notas fiscais" ON public.notas_fiscais;
CREATE POLICY "admin ve notas fiscais"
  ON public.notas_fiscais FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- notas_fiscais_eventos: payload bruto do webhook, só admin.
DROP POLICY IF EXISTS "admin ve eventos de notas fiscais" ON public.notas_fiscais_eventos;
CREATE POLICY "admin ve eventos de notas fiscais"
  ON public.notas_fiscais_eventos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- fiscal_uso_mensal (por dono; filial não tem contador próprio)
DROP POLICY IF EXISTS "dono e funcionarios veem uso fiscal" ON public.fiscal_uso_mensal;
CREATE POLICY "dono e funcionarios veem uso fiscal"
  ON public.fiscal_uso_mensal FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "admin ve uso fiscal" ON public.fiscal_uso_mensal;
CREATE POLICY "admin ve uso fiscal"
  ON public.fiscal_uso_mensal FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMIT;
