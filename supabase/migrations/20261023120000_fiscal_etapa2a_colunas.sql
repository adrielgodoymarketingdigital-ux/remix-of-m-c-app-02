-- =====================================================================
-- Fiscal — ETAPA 2A: colunas fiscais OPCIONAIS nos cadastros existentes.
--
-- Somente ADD COLUMN IF NOT EXISTS, todas NULLABLE e SEM DEFAULT:
-- operação só de catálogo, nenhuma linha existente é reescrita nem
-- preenchida. Não altera RLS, políticas, triggers, funções, tipos ou
-- colunas existentes.
--
--   produtos, pecas, dispositivos: ncm, cest, unidade, perfil_tributario_id
--   servicos: codigo_lc116, codigo_municipal, aliquota_iss, iss_retido,
--             perfil_tributario_id
--   clientes: email, complemento, inscricao_estadual (nenhuma existia)
--
-- Locks: ADD COLUMN pega ACCESS EXCLUSIVE por instantes. A FK e o CHECK
-- são criados NOT VALID (sem varrer a tabela com esse lock) e validados
-- depois do COMMIT, com SHARE UPDATE EXCLUSIVE, que não bloqueia leitura
-- nem escrita do app. lock_timeout faz a migration falhar rápido em vez
-- de enfileirar o app atrás dela se alguma tabela estiver ocupada.
--
-- Sem índice em perfil_tributario_id nesta etapa: a coluna nasce toda
-- NULL, perfis são catálogo do admin (desativados via ativo=false, quase
-- nunca apagados) e CREATE INDEX sem CONCURRENTLY bloquearia escrita em
-- tabelas quentes. Se um dia apagar perfis virar rotina, criar com
-- CREATE INDEX CONCURRENTLY fora de transação.
--
-- O preenchimento destes campos é responsabilidade do lojista e do
-- contador dele; o sistema não preenche nem sugere valores fiscais.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- produtos
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cest text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS perfil_tributario_id uuid;

COMMENT ON COLUMN public.produtos.ncm IS
  'NCM (8 dígitos) para NF-e/NFC-e. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.produtos.cest IS
  'CEST, quando houver substituição tributária. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.produtos.unidade IS
  'Unidade comercial na nota (ex.: UN). Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.produtos.perfil_tributario_id IS
  'Perfil em fiscal_perfis_tributarios (CFOP, CSOSN/CST etc.). Opcional; a escolha é responsabilidade do lojista e do contador dele.';

-- ---------------------------------------------------------------------
-- pecas
-- ---------------------------------------------------------------------
ALTER TABLE public.pecas ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE public.pecas ADD COLUMN IF NOT EXISTS cest text;
ALTER TABLE public.pecas ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE public.pecas ADD COLUMN IF NOT EXISTS perfil_tributario_id uuid;

COMMENT ON COLUMN public.pecas.ncm IS
  'NCM (8 dígitos) para NF-e/NFC-e. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.pecas.cest IS
  'CEST, quando houver substituição tributária. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.pecas.unidade IS
  'Unidade comercial na nota (ex.: UN). Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.pecas.perfil_tributario_id IS
  'Perfil em fiscal_perfis_tributarios (CFOP, CSOSN/CST etc.). Opcional; a escolha é responsabilidade do lojista e do contador dele.';

-- ---------------------------------------------------------------------
-- dispositivos
-- ---------------------------------------------------------------------
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS cest text;
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS perfil_tributario_id uuid;

COMMENT ON COLUMN public.dispositivos.ncm IS
  'NCM (8 dígitos) para NF-e/NFC-e. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.dispositivos.cest IS
  'CEST, quando houver substituição tributária. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.dispositivos.unidade IS
  'Unidade comercial na nota (ex.: UN). Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.dispositivos.perfil_tributario_id IS
  'Perfil em fiscal_perfis_tributarios (ex.: aparelho_usado). Opcional; a escolha é responsabilidade do lojista e do contador dele.';

-- ---------------------------------------------------------------------
-- servicos
-- ---------------------------------------------------------------------
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS codigo_lc116 text;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS codigo_municipal text;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS aliquota_iss numeric(5,2);
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS iss_retido boolean;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS perfil_tributario_id uuid;

COMMENT ON COLUMN public.servicos.codigo_lc116 IS
  'Item da lista de serviços da LC 116/2003 (NFS-e). Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.servicos.codigo_municipal IS
  'Código de tributação do serviço no município (NFS-e). Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.servicos.aliquota_iss IS
  'Alíquota de ISS em % (0 a 100). Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.servicos.iss_retido IS
  'ISS retido pelo tomador. NULL = não informado. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';
COMMENT ON COLUMN public.servicos.perfil_tributario_id IS
  'Perfil em fiscal_perfis_tributarios. Opcional; a escolha é responsabilidade do lojista e do contador dele.';

-- ---------------------------------------------------------------------
-- clientes (destinatário da nota)
-- ---------------------------------------------------------------------
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricao_estadual text;

COMMENT ON COLUMN public.clientes.email IS
  'E-mail do cliente (envio da nota). Opcional; preenchimento é responsabilidade do lojista.';
COMMENT ON COLUMN public.clientes.complemento IS
  'Complemento do endereço (destinatário da nota). Opcional; preenchimento é responsabilidade do lojista.';
COMMENT ON COLUMN public.clientes.inscricao_estadual IS
  'Inscrição estadual do cliente PJ. Opcional; preenchimento é responsabilidade do lojista e do contador dele.';

-- ---------------------------------------------------------------------
-- FKs e CHECK como NOT VALID (sem varredura sob lock exclusivo)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_perfil_tributario_id_fkey'
                 AND conrelid = 'public.produtos'::regclass) THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_perfil_tributario_id_fkey
      FOREIGN KEY (perfil_tributario_id) REFERENCES public.fiscal_perfis_tributarios(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pecas_perfil_tributario_id_fkey'
                 AND conrelid = 'public.pecas'::regclass) THEN
    ALTER TABLE public.pecas ADD CONSTRAINT pecas_perfil_tributario_id_fkey
      FOREIGN KEY (perfil_tributario_id) REFERENCES public.fiscal_perfis_tributarios(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispositivos_perfil_tributario_id_fkey'
                 AND conrelid = 'public.dispositivos'::regclass) THEN
    ALTER TABLE public.dispositivos ADD CONSTRAINT dispositivos_perfil_tributario_id_fkey
      FOREIGN KEY (perfil_tributario_id) REFERENCES public.fiscal_perfis_tributarios(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicos_perfil_tributario_id_fkey'
                 AND conrelid = 'public.servicos'::regclass) THEN
    ALTER TABLE public.servicos ADD CONSTRAINT servicos_perfil_tributario_id_fkey
      FOREIGN KEY (perfil_tributario_id) REFERENCES public.fiscal_perfis_tributarios(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicos_aliquota_iss_check'
                 AND conrelid = 'public.servicos'::regclass) THEN
    ALTER TABLE public.servicos ADD CONSTRAINT servicos_aliquota_iss_check
      CHECK (aliquota_iss IS NULL OR (aliquota_iss >= 0 AND aliquota_iss <= 100)) NOT VALID;
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Validação fora da transação acima (lock leve; colunas estão todas NULL,
-- então passa sem erro). Em constraint já válida é no-op.
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos     VALIDATE CONSTRAINT produtos_perfil_tributario_id_fkey;
ALTER TABLE public.pecas        VALIDATE CONSTRAINT pecas_perfil_tributario_id_fkey;
ALTER TABLE public.dispositivos VALIDATE CONSTRAINT dispositivos_perfil_tributario_id_fkey;
ALTER TABLE public.servicos     VALIDATE CONSTRAINT servicos_perfil_tributario_id_fkey;
ALTER TABLE public.servicos     VALIDATE CONSTRAINT servicos_aliquota_iss_check;
