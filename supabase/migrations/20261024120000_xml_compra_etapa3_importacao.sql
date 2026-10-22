-- =====================================================================
-- Importar XML de compra (NF-e modelo 55) — ETAPA 3: só a camada de banco.
--
-- Cria:
--   1) compras_xml_importadas  — uma linha por nota importada.
--      UNIQUE (user_id, chave_acesso): a mesma nota nunca entra duas vezes
--      na mesma loja (duplo clique, duas abas, duas pessoas).
--   2) compras_xml_itens       — o que cada item da nota virou.
--   3) compras_xml_mapeamento  — "cProd do fornecedor X = produto/peça Y",
--      por loja/filial, para a próxima nota já vir vinculada.
--   4) Bucket privado notas-compra-xml (XML original, <user_id>/<chave>.xml).
--   5) RPC importar_nfe_compra(payload jsonb): grava tudo numa transação.
--
-- Acesso às tabelas: navegador só LÊ (dono, gerente da filial, admin).
-- Funcionário não lê. Nenhuma política de INSERT/UPDATE/DELETE e escrita
-- revogada de anon/authenticated: toda gravação passa pela RPC.
--
-- Identidade (empresa_id):
--   - empresa_id NULL nas tabelas novas = matriz. A matriz pode ou não ter
--     linha em empresas (tipo = 'matriz'); produtos da matriz têm
--     empresa_id = id da matriz OU NULL (mesmo filtro de useProdutos).
--   - Filial = id da empresa (tipo 'filial').
--
-- A RPC é SECURITY DEFINER porque as tabelas novas não aceitam escrita do
-- navegador. Por isso ela mesma: resolve quem chama por auth.uid() (dono ou
-- gerente da filial; funcionário e anônimo recusados), nunca usa user_id do
-- payload, confere que cada produto/peça é da loja/filial e usa a
-- registrar_entrada_estoque já existente (que confere o acesso de novo).
--
-- TRAVA TEMPORÁRIA (liberação admin-first): por enquanto a RPC só aceita
-- chamador com has_role(auth.uid(), 'admin'). Dono e gerente comuns recebem
-- 42501 'Importação de XML em liberação: disponível só para administradores'.
-- O admin grava sempre na loja do PRÓPRIO chamador (nunca na de outro).
-- Para liberar a lojistas: migration separada que recria a função sem a trava.
--
-- NÃO faz: contas a pagar, dispositivos/IMEI, campos fiscais, limite de
-- plano (hoje só existe no front, em useAssinatura.podeCadastrarProduto).
--
-- Idempotente: CREATE ... IF NOT EXISTS / CREATE OR REPLACE; os DROP
-- POLICY IF EXISTS atingem só objetos desta migration.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0) Funções auxiliares (puras). Não expostas ao navegador.
-- ---------------------------------------------------------------------

-- Chave de acesso: 44 dígitos + dígito verificador módulo 11 (pesos 2..9
-- da direita). Espelho de chaveNfeValida em src/lib/nfe/lerXmlNfe.ts.
CREATE OR REPLACE FUNCTION public.nfe_chave_acesso_valida(p_chave text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v_soma  integer := 0;
  v_peso  integer := 2;
  v_resto integer;
BEGIN
  IF p_chave IS NULL OR p_chave !~ '^[0-9]{44}$' THEN
    RETURN false;
  END IF;
  FOR i IN REVERSE 43..1 LOOP
    v_soma := v_soma + substr(p_chave, i, 1)::integer * v_peso;
    v_peso := CASE WHEN v_peso = 9 THEN 2 ELSE v_peso + 1 END;
  END LOOP;
  v_resto := v_soma % 11;
  RETURN (CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END) = substr(p_chave, 44, 1)::integer;
END;
$function$;

-- Texto com IMEI: 15 dígitos isolados com Luhn válido. Espelho de
-- extrairImeis em src/lib/nfe/lerXmlNfe.ts.
CREATE OR REPLACE FUNCTION public.nfe_texto_tem_imei(p_texto text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v_num    text;
  v_soma   integer;
  v_d      integer;
  v_dobrar boolean;
BEGIN
  IF p_texto IS NULL THEN
    RETURN false;
  END IF;
  FOR v_num IN
    SELECT m[1] FROM regexp_matches(p_texto, '(?:^|[^0-9])([0-9]{15})(?=[^0-9]|$)', 'g') AS m
  LOOP
    v_soma := 0;
    v_dobrar := false;
    FOR i IN REVERSE 15..1 LOOP
      v_d := substr(v_num, i, 1)::integer;
      IF v_dobrar THEN
        v_d := v_d * 2;
        IF v_d > 9 THEN v_d := v_d - 9; END IF;
      END IF;
      v_soma := v_soma + v_d;
      v_dobrar := NOT v_dobrar;
    END LOOP;
    IF v_soma % 10 = 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.nfe_chave_acesso_valida(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nfe_texto_tem_imei(text)      FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1) compras_xml_importadas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compras_xml_importadas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- dono da loja
  empresa_id            uuid REFERENCES public.empresas(id),                        -- NULL = matriz
  chave_acesso          text NOT NULL CHECK (chave_acesso ~ '^[0-9]{44}$'),
  numero                text NOT NULL CHECK (numero ~ '^[0-9]{1,9}$'),
  serie                 text NOT NULL CHECK (serie ~ '^[0-9]{1,3}$'),
  emitente_cnpj         text NOT NULL CHECK (emitente_cnpj ~ '^([0-9]{11}|[0-9]{14})$'), -- CNPJ ou CPF (produtor)
  emitente_nome         text NOT NULL CHECK (char_length(emitente_nome) BETWEEN 1 AND 255),
  data_emissao          timestamptz NOT NULL,
  valor_total_centavos  bigint NOT NULL CHECK (valor_total_centavos >= 0),
  xml_path              text,                                                       -- NULL = XML não anexado
  status                text NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida', 'cancelada')),
  criado_por            uuid NOT NULL DEFAULT auth.uid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compras_xml_importadas_chave_unica UNIQUE (user_id, chave_acesso)
);

COMMENT ON TABLE public.compras_xml_importadas IS
  'NF-e de compra importadas (XML). UNIQUE (user_id, chave_acesso) impede importar a mesma nota duas vezes. Escrita só por importar_nfe_compra().';
COMMENT ON COLUMN public.compras_xml_importadas.empresa_id IS
  'NULL = matriz; id da filial quando importada na filial.';
COMMENT ON COLUMN public.compras_xml_importadas.xml_path IS
  'Caminho no bucket privado notas-compra-xml (<user_id>/<chave>.xml). NULL quando o XML não estava no bucket na hora da importação.';
COMMENT ON COLUMN public.compras_xml_importadas.criado_por IS
  'auth.uid() de quem importou (dono ou gerente da filial).';

CREATE INDEX IF NOT EXISTS idx_compras_xml_importadas_user_created
  ON public.compras_xml_importadas (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compras_xml_importadas_empresa
  ON public.compras_xml_importadas (empresa_id);

-- ---------------------------------------------------------------------
-- 2) compras_xml_itens
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compras_xml_itens (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id            uuid NOT NULL REFERENCES public.compras_xml_importadas(id) ON DELETE CASCADE,
  n_item                   integer NOT NULL CHECK (n_item BETWEEN 1 AND 990),
  c_prod                   text NOT NULL CHECK (char_length(c_prod) BETWEEN 1 AND 255),
  descricao                text NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 255),
  tipo_destino             text NOT NULL CHECK (tipo_destino IN ('produto', 'peca')),
  produto_id               uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  peca_id                  uuid REFERENCES public.pecas(id)    ON DELETE SET NULL,
  acao                     text NOT NULL CHECK (acao IN ('vinculado', 'novo')),
  quantidade_entrada       integer NOT NULL CHECK (quantidade_entrada > 0),
  fator                    numeric(12,4) NOT NULL DEFAULT 1 CHECK (fator > 0),
  custo_unitario_centavos  bigint NOT NULL CHECK (custo_unitario_centavos >= 0),
  custo_medio_atualizado   boolean NOT NULL DEFAULT false,
  entrada_estoque_id       uuid REFERENCES public.entradas_estoque(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compras_xml_itens_n_item_unico UNIQUE (importacao_id, n_item),
  -- O destino bate com o tipo (o id pode virar NULL se o item for apagado).
  CONSTRAINT compras_xml_itens_destino CHECK (
    (tipo_destino = 'produto' AND peca_id IS NULL) OR
    (tipo_destino = 'peca'    AND produto_id IS NULL)
  )
);

COMMENT ON TABLE public.compras_xml_itens IS
  'Itens de uma importação de NF-e: destino (produto/peça), quantidade inteira que entrou, custo em centavos e a entrada de estoque gerada.';
COMMENT ON COLUMN public.compras_xml_itens.custo_medio_atualizado IS
  'true = o custo do cadastro foi recalculado pela média. Item novo: sempre true (o custo inicial é o da nota).';

CREATE INDEX IF NOT EXISTS idx_compras_xml_itens_produto ON public.compras_xml_itens (produto_id) WHERE produto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_xml_itens_peca    ON public.compras_xml_itens (peca_id)    WHERE peca_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compras_xml_itens_entrada ON public.compras_xml_itens (entrada_estoque_id) WHERE entrada_estoque_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3) compras_xml_mapeamento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compras_xml_mapeamento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id     uuid REFERENCES public.empresas(id),                        -- NULL = matriz
  emitente_cnpj  text NOT NULL CHECK (emitente_cnpj ~ '^([0-9]{11}|[0-9]{14})$'),
  c_prod         text NOT NULL CHECK (char_length(c_prod) BETWEEN 1 AND 255),
  tipo_destino   text NOT NULL CHECK (tipo_destino IN ('produto', 'peca')),
  produto_id     uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  peca_id        uuid REFERENCES public.pecas(id)    ON DELETE CASCADE,
  fator          numeric(12,4) NOT NULL DEFAULT 1 CHECK (fator > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compras_xml_mapeamento_destino CHECK (
    (tipo_destino = 'produto' AND produto_id IS NOT NULL AND peca_id IS NULL) OR
    (tipo_destino = 'peca'    AND peca_id IS NOT NULL    AND produto_id IS NULL)
  )
);

COMMENT ON TABLE public.compras_xml_mapeamento IS
  'Código do produto do fornecedor (cProd + CNPJ do emitente) → produto/peça da loja, por loja/filial. Gravado por importar_nfe_compra().';

-- Único por (loja, filial, fornecedor, cProd), tratando empresa_id NULL
-- (matriz) como um valor — mesmo padrão de uq_fiscal_config_user_empresa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_xml_mapeamento
  ON public.compras_xml_mapeamento (
    user_id,
    COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid),
    emitente_cnpj,
    c_prod
  );

DROP TRIGGER IF EXISTS update_compras_xml_mapeamento_updated_at ON public.compras_xml_mapeamento;
CREATE TRIGGER update_compras_xml_mapeamento_updated_at
  BEFORE UPDATE ON public.compras_xml_mapeamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 4) RLS + privilégios: navegador só lê
-- ---------------------------------------------------------------------
ALTER TABLE public.compras_xml_importadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_xml_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_xml_mapeamento ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.compras_xml_importadas FROM anon;
REVOKE ALL ON public.compras_xml_itens      FROM anon;
REVOKE ALL ON public.compras_xml_mapeamento FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.compras_xml_importadas FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.compras_xml_itens      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.compras_xml_mapeamento FROM authenticated;

GRANT SELECT ON public.compras_xml_importadas TO authenticated;
GRANT SELECT ON public.compras_xml_itens      TO authenticated;
GRANT SELECT ON public.compras_xml_mapeamento TO authenticated;

GRANT ALL ON public.compras_xml_importadas TO service_role;
GRANT ALL ON public.compras_xml_itens      TO service_role;
GRANT ALL ON public.compras_xml_mapeamento TO service_role;

-- compras_xml_importadas
DROP POLICY IF EXISTS "dono ve compras xml importadas" ON public.compras_xml_importadas;
CREATE POLICY "dono ve compras xml importadas"
  ON public.compras_xml_importadas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gerente ve compras xml importadas da filial" ON public.compras_xml_importadas;
CREATE POLICY "gerente ve compras xml importadas da filial"
  ON public.compras_xml_importadas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                 WHERE eu.gerente_id = auth.uid()
                   AND eu.proprietario_id = compras_xml_importadas.user_id
                   AND eu.empresa_id = compras_xml_importadas.empresa_id));

DROP POLICY IF EXISTS "admin ve compras xml importadas" ON public.compras_xml_importadas;
CREATE POLICY "admin ve compras xml importadas"
  ON public.compras_xml_importadas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- compras_xml_itens (acesso herdado da importação)
DROP POLICY IF EXISTS "dono ve itens de compras xml" ON public.compras_xml_itens;
CREATE POLICY "dono ve itens de compras xml"
  ON public.compras_xml_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras_xml_importadas ci
                 WHERE ci.id = compras_xml_itens.importacao_id
                   AND ci.user_id = auth.uid()));

DROP POLICY IF EXISTS "gerente ve itens de compras xml da filial" ON public.compras_xml_itens;
CREATE POLICY "gerente ve itens de compras xml da filial"
  ON public.compras_xml_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.compras_xml_importadas ci
                 JOIN public.empresa_usuarios eu
                   ON eu.proprietario_id = ci.user_id
                  AND eu.empresa_id = ci.empresa_id
                 WHERE ci.id = compras_xml_itens.importacao_id
                   AND eu.gerente_id = auth.uid()));

DROP POLICY IF EXISTS "admin ve itens de compras xml" ON public.compras_xml_itens;
CREATE POLICY "admin ve itens de compras xml"
  ON public.compras_xml_itens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- compras_xml_mapeamento
DROP POLICY IF EXISTS "dono ve mapeamento de compras xml" ON public.compras_xml_mapeamento;
CREATE POLICY "dono ve mapeamento de compras xml"
  ON public.compras_xml_mapeamento FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gerente ve mapeamento de compras xml da filial" ON public.compras_xml_mapeamento;
CREATE POLICY "gerente ve mapeamento de compras xml da filial"
  ON public.compras_xml_mapeamento FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                 WHERE eu.gerente_id = auth.uid()
                   AND eu.proprietario_id = compras_xml_mapeamento.user_id
                   AND eu.empresa_id = compras_xml_mapeamento.empresa_id));

DROP POLICY IF EXISTS "admin ve mapeamento de compras xml" ON public.compras_xml_mapeamento;
CREATE POLICY "admin ve mapeamento de compras xml"
  ON public.compras_xml_mapeamento FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 5) Bucket privado do XML original
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notas-compra-xml',
  'notas-compra-xml',
  false,
  5242880,
  ARRAY['application/xml', 'text/xml']
)
ON CONFLICT (id) DO NOTHING;

-- Caminho: <user_id do dono>/<chave de 44 dígitos>.xml
--   dono: a própria pasta;
--   gerente: a pasta do dono da loja onde é gerente. Na LEITURA, o gerente
--   só vê o XML de notas importadas na filial dele (o caminho precisa estar
--   em compras_xml_importadas daquela filial).
-- Só INSERT (sem UPDATE/DELETE): o XML original não é trocado nem apagado
-- pelo navegador. Nada para anon.
DROP POLICY IF EXISTS "dono le xml de compra" ON storage.objects;
CREATE POLICY "dono le xml de compra"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'notas-compra-xml'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "gerente le xml de compra da filial" ON storage.objects;
CREATE POLICY "gerente le xml de compra da filial"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'notas-compra-xml'
    AND EXISTS (SELECT 1 FROM public.compras_xml_importadas ci
                JOIN public.empresa_usuarios eu
                  ON eu.proprietario_id = ci.user_id
                 AND eu.empresa_id = ci.empresa_id
                WHERE ci.xml_path = objects.name
                  AND eu.gerente_id = auth.uid())
  );

DROP POLICY IF EXISTS "dono envia xml de compra" ON storage.objects;
CREATE POLICY "dono envia xml de compra"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notas-compra-xml'
    AND name ~ '^[0-9a-f-]{36}/[0-9]{44}\.xml$'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "gerente envia xml de compra" ON storage.objects;
CREATE POLICY "gerente envia xml de compra"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notas-compra-xml'
    AND name ~ '^[0-9a-f-]{36}/[0-9]{44}\.xml$'
    AND EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                WHERE eu.gerente_id = auth.uid()
                  AND eu.proprietario_id::text = (storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------
-- 6) RPC importar_nfe_compra(payload jsonb)
-- ---------------------------------------------------------------------
-- payload:
-- {
--   "empresa_id": uuid | null,          -- contexto da tela (matriz/filial); conferido aqui
--   "nota": { "chave", "numero", "serie", "modelo", "tp_amb",
--             "emitente_cnpj", "emitente_nome",
--             "data_emissao" (dhEmi como veio, ex. 2026-10-15T10:30:00-03:00),
--             "valor_total_centavos" },
--   "itens": [ {
--       "n_item", "c_prod", "descricao",
--       "tipo_destino": "produto" | "peca",
--       "acao": "vinculado" | "novo",
--       "item_id": uuid,                  -- só vinculado
--       "quantidade": inteiro > 0,        -- quantidade final que entra no estoque
--       "fator": número > 0 (padrão 1),
--       "custo_unitario_centavos": inteiro >= 0,
--       "atualizar_custo_medio": boolean, -- só vinculado
--       "novo_nome", "novo_codigo_barras", "novo_preco_centavos"  -- só novo, opcionais
--   } ]
-- }
-- Qualquer user_id no payload é ignorado.
--
-- Erros (RAISE, desfaz tudo):
--   42501 sem acesso (anônimo, não admin [trava temporária], funcionário,
--         filial/produto de outra loja)
--   23505 nota já importada nesta loja
--   22023 dados inválidos (mensagem em português, com o número do item)
--
-- Custo: custo_unitario_centavos / 100 vai para registrar_entrada_estoque,
-- que arredonda a 2 casas (exato) e faz a média com a mesma conta de
-- src/lib/estoque/custoMedio.ts — então o custo previsto na tela é o gravado.
CREATE OR REPLACE FUNCTION public.importar_nfe_compra(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c_max_itens       constant integer := 990;      -- limite da NF-e (nItem 1..990)
  c_max_quantidade  constant integer := 99999;    -- por item
  c_max_custo       constant bigint  := 9999999;  -- R$ 99.999,99 por unidade
  c_max_valor_nota  constant bigint  := 99999999999; -- R$ 999.999.999,99

  v_uid             uuid := auth.uid();
  v_dono            uuid;
  v_filial          uuid;   -- NULL = matriz
  v_matriz_id       uuid;   -- linha tipo 'matriz' em empresas (pode não existir)
  v_empresa_payload uuid;
  v_empresa_novo    uuid;   -- empresa_id gravado em produtos/peças novos

  v_nota            jsonb;
  v_chave           text;
  v_numero          text;
  v_serie           text;
  v_emit_doc        text;
  v_emit_nome       text;
  v_dh_texto        text;
  v_dh              timestamptz;
  v_valor_total     numeric;
  v_xml_path        text;
  v_xml_anexado     boolean;
  v_importacao_id   uuid;
  v_ja_importada_em timestamptz;

  v_itens           jsonb;
  v_item            jsonb;
  v_n_item          integer;
  v_vistos          integer[] := '{}';
  v_c_prod          text;
  v_descricao       text;
  v_tipo            text;
  v_acao            text;
  v_item_id         uuid;
  v_emp_item        uuid;
  v_num             numeric;
  v_qtd             integer;
  v_fator           numeric;
  v_custo           bigint;
  v_atualiza        boolean;
  v_novo_nome       text;
  v_novo_ean        text;
  v_novo_preco      numeric;
  v_obs             text;
  v_entrada_id      uuid;

  v_qt_vinculados   integer := 0;
  v_qt_novos        integer := 0;
  v_unidades        bigint  := 0;
  v_custo_total     bigint  := 0;
BEGIN
  -- ================= identidade (servidor) =================
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da importação inválidos' USING ERRCODE = '22023';
  END IF;

  -- ###################################################################
  -- TRAVA TEMPORÁRIA (liberação admin-first): remover quando a importação
  -- for liberada a lojistas. Vale para dono comum e gerente.
  -- ###################################################################
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Importação de XML em liberação: disponível só para administradores'
      USING ERRCODE = '42501';
  END IF;
  -- ################### fim da TRAVA TEMPORÁRIA #######################

  IF payload ? 'empresa_id' AND jsonb_typeof(payload->'empresa_id') <> 'null' THEN
    BEGIN
      v_empresa_payload := (payload->>'empresa_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Empresa inválida' USING ERRCODE = '22023';
    END;
  END IF;

  -- Gerente de filial tem prioridade (mesma regra de useIdentidade no front).
  IF EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.gerente_id = v_uid) THEN
    SELECT eu.proprietario_id, eu.empresa_id
      INTO v_dono, v_filial
      FROM public.empresa_usuarios eu
     WHERE eu.gerente_id = v_uid
       AND eu.empresa_id = v_empresa_payload
       AND eu.proprietario_id IS NOT NULL
     LIMIT 1;
    IF v_dono IS NULL OR v_filial IS NULL THEN
      RAISE EXCEPTION 'Sem acesso a esta filial' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Funcionário (login vinculado a outra loja) não importa.
    IF EXISTS (SELECT 1 FROM public.loja_funcionarios lf
                WHERE lf.funcionario_user_id = v_uid
                  AND lf.ativo = true
                  AND lf.loja_user_id <> v_uid) THEN
      RAISE EXCEPTION 'Funcionário não pode importar nota de compra' USING ERRCODE = '42501';
    END IF;

    v_dono := v_uid;
    SELECT e.id INTO v_matriz_id
      FROM public.empresas e
     WHERE e.proprietario_id = v_dono AND e.tipo = 'matriz' AND e.ativa = true
     ORDER BY e.created_at
     LIMIT 1;

    IF v_empresa_payload IS NULL OR v_empresa_payload = v_matriz_id THEN
      v_filial := NULL;
    ELSIF EXISTS (SELECT 1 FROM public.empresas e
                   WHERE e.id = v_empresa_payload
                     AND e.proprietario_id = v_dono
                     AND e.tipo = 'filial'
                     AND e.ativa = true) THEN
      v_filial := v_empresa_payload;
    ELSE
      RAISE EXCEPTION 'Sem acesso a esta empresa' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Produtos/peças novos: mesmo empresa_id que o cadastro manual grava
  -- (useProdutos: empresaFiltro = filial, ou id da matriz, ou NULL).
  v_empresa_novo := COALESCE(v_filial, v_matriz_id);

  -- ================= cabeçalho =================
  v_nota := payload->'nota';
  IF v_nota IS NULL OR jsonb_typeof(v_nota) <> 'object' THEN
    RAISE EXCEPTION 'Dados da nota ausentes' USING ERRCODE = '22023';
  END IF;

  v_chave     := v_nota->>'chave';
  v_numero    := v_nota->>'numero';
  v_serie     := v_nota->>'serie';
  v_emit_doc  := v_nota->>'emitente_cnpj';
  v_emit_nome := btrim(v_nota->>'emitente_nome');
  v_dh_texto  := v_nota->>'data_emissao';

  IF NOT public.nfe_chave_acesso_valida(v_chave) THEN
    RAISE EXCEPTION 'Chave de acesso inválida (44 dígitos com dígito verificador)' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_nota->>'tp_amb', '') <> '1' THEN
    RAISE EXCEPTION 'Só notas de produção podem ser importadas (tpAmb = 1)' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_nota->>'modelo', '') <> '55' OR substr(v_chave, 21, 2) <> '55' THEN
    RAISE EXCEPTION 'Só NF-e modelo 55 pode ser importada' USING ERRCODE = '22023';
  END IF;
  IF v_numero IS NULL OR v_numero !~ '^[0-9]{1,9}$' OR v_numero::bigint = 0 THEN
    RAISE EXCEPTION 'Número da nota inválido' USING ERRCODE = '22023';
  END IF;
  IF v_serie IS NULL OR v_serie !~ '^[0-9]{1,3}$' THEN
    RAISE EXCEPTION 'Série da nota inválida' USING ERRCODE = '22023';
  END IF;
  IF v_emit_doc IS NULL OR v_emit_doc !~ '^([0-9]{11}|[0-9]{14})$' THEN
    RAISE EXCEPTION 'CNPJ/CPF do emitente inválido' USING ERRCODE = '22023';
  END IF;
  IF v_emit_nome IS NULL OR char_length(v_emit_nome) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'Nome do emitente inválido' USING ERRCODE = '22023';
  END IF;
  IF v_dh_texto IS NULL OR v_dh_texto !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN
    RAISE EXCEPTION 'Data de emissão inválida' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_dh := v_dh_texto::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Data de emissão inválida' USING ERRCODE = '22023';
  END;
  IF v_dh > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Data de emissão no futuro' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_nota->'valor_total_centavos') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Valor total da nota inválido' USING ERRCODE = '22023';
  END IF;
  v_valor_total := (v_nota->>'valor_total_centavos')::numeric;
  IF v_valor_total <> trunc(v_valor_total) OR v_valor_total < 0 OR v_valor_total > c_max_valor_nota THEN
    RAISE EXCEPTION 'Valor total da nota inválido' USING ERRCODE = '22023';
  END IF;

  -- Coerência chave × cabeçalho (o AAMM vem do texto do dhEmi, no fuso do emitente).
  IF substr(v_chave, 3, 4) <> substr(v_dh_texto, 3, 2) || substr(v_dh_texto, 6, 2)
     OR substr(v_chave, 7, 14) <> lpad(v_emit_doc, 14, '0')
     OR substr(v_chave, 23, 3) <> lpad(v_serie, 3, '0')
     OR substr(v_chave, 26, 9) <> lpad(v_numero, 9, '0') THEN
    RAISE EXCEPTION 'A chave de acesso não bate com os dados da nota' USING ERRCODE = '22023';
  END IF;

  v_itens := payload->'itens';
  IF v_itens IS NULL OR jsonb_typeof(v_itens) <> 'array' OR jsonb_array_length(v_itens) = 0 THEN
    RAISE EXCEPTION 'Nenhum item para importar' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(v_itens) > c_max_itens THEN
    RAISE EXCEPTION 'A nota tem itens demais (máximo %)', c_max_itens USING ERRCODE = '22023';
  END IF;

  -- XML original: anexado se já estiver no bucket (o front envia antes).
  v_xml_path := v_dono::text || '/' || v_chave || '.xml';
  v_xml_anexado := EXISTS (SELECT 1 FROM storage.objects o
                            WHERE o.bucket_id = 'notas-compra-xml' AND o.name = v_xml_path);

  -- ================= importação primeiro (UNIQUE protege duplicata) =================
  BEGIN
    INSERT INTO public.compras_xml_importadas (
      user_id, empresa_id, chave_acesso, numero, serie, emitente_cnpj, emitente_nome,
      data_emissao, valor_total_centavos, xml_path, status, criado_por
    ) VALUES (
      v_dono, v_filial, v_chave, v_numero, v_serie, v_emit_doc, v_emit_nome,
      v_dh, v_valor_total::bigint, CASE WHEN v_xml_anexado THEN v_xml_path END, 'concluida', v_uid
    )
    RETURNING id INTO v_importacao_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT ci.created_at INTO v_ja_importada_em
      FROM public.compras_xml_importadas ci
     WHERE ci.user_id = v_dono AND ci.chave_acesso = v_chave;
    RAISE EXCEPTION 'Esta nota já foi importada nesta loja em %',
      to_char(v_ja_importada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      USING ERRCODE = '23505';
  END;

  -- ================= itens =================
  -- Vinculados em ordem de id (todas as importações travam os itens na mesma
  -- ordem → sem deadlock entre duas notas com os mesmos produtos).
  FOR v_item IN
    SELECT t.e
      FROM jsonb_array_elements(v_itens) WITH ORDINALITY AS t(e, ord)
     ORDER BY (t.e->>'item_id') NULLS LAST, t.ord
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Item inválido' USING ERRCODE = '22023';
    END IF;

    -- n_item
    IF jsonb_typeof(v_item->'n_item') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Item sem número (nItem)' USING ERRCODE = '22023';
    END IF;
    v_num := (v_item->>'n_item')::numeric;
    IF v_num <> trunc(v_num) OR v_num < 1 OR v_num > c_max_itens THEN
      RAISE EXCEPTION 'Número de item inválido: %', v_item->>'n_item' USING ERRCODE = '22023';
    END IF;
    v_n_item := v_num::integer;
    IF v_n_item = ANY (v_vistos) THEN
      RAISE EXCEPTION 'Item % repetido', v_n_item USING ERRCODE = '22023';
    END IF;
    v_vistos := v_vistos || v_n_item;

    -- textos
    v_c_prod    := btrim(v_item->>'c_prod');
    v_descricao := btrim(v_item->>'descricao');
    IF v_c_prod IS NULL OR char_length(v_c_prod) NOT BETWEEN 1 AND 255 THEN
      RAISE EXCEPTION 'Item %: código do produto (cProd) inválido', v_n_item USING ERRCODE = '22023';
    END IF;
    IF v_descricao IS NULL OR char_length(v_descricao) NOT BETWEEN 1 AND 255 THEN
      RAISE EXCEPTION 'Item %: descrição inválida', v_n_item USING ERRCODE = '22023';
    END IF;

    -- aparelho / IMEI fica fora desta etapa
    IF COALESCE((v_item->>'aparelho')::boolean, false)
       OR (jsonb_typeof(v_item->'imeis') = 'array' AND jsonb_array_length(v_item->'imeis') > 0)
       OR public.nfe_texto_tem_imei(v_descricao) THEN
      RAISE EXCEPTION 'Item %: aparelho com IMEI não pode ser importado como produto/peça', v_n_item
        USING ERRCODE = '22023';
    END IF;

    v_tipo := v_item->>'tipo_destino';
    v_acao := v_item->>'acao';
    IF v_tipo IS NULL OR v_tipo NOT IN ('produto', 'peca') THEN
      RAISE EXCEPTION 'Item %: destino inválido (produto ou peça)', v_n_item USING ERRCODE = '22023';
    END IF;
    IF v_acao IS NULL OR v_acao NOT IN ('vinculado', 'novo') THEN
      RAISE EXCEPTION 'Item %: ação inválida (vinculado ou novo)', v_n_item USING ERRCODE = '22023';
    END IF;

    -- quantidade inteira
    IF jsonb_typeof(v_item->'quantidade') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Item %: quantidade inválida', v_n_item USING ERRCODE = '22023';
    END IF;
    v_num := (v_item->>'quantidade')::numeric;
    IF v_num <> trunc(v_num) OR v_num < 1 OR v_num > c_max_quantidade THEN
      RAISE EXCEPTION 'Item %: a quantidade deve ser um número inteiro entre 1 e %', v_n_item, c_max_quantidade
        USING ERRCODE = '22023';
    END IF;
    v_qtd := v_num::integer;

    -- fator (só registro)
    IF v_item ? 'fator' AND jsonb_typeof(v_item->'fator') <> 'null' THEN
      BEGIN
        v_fator := (v_item->>'fator')::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Item %: fator inválido', v_n_item USING ERRCODE = '22023';
      END;
      IF v_fator <= 0 OR v_fator > 99999999 OR v_fator <> round(v_fator, 4) THEN
        RAISE EXCEPTION 'Item %: fator inválido', v_n_item USING ERRCODE = '22023';
      END IF;
    ELSE
      v_fator := 1;
    END IF;

    -- custo em centavos inteiros
    IF jsonb_typeof(v_item->'custo_unitario_centavos') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Item %: custo inválido', v_n_item USING ERRCODE = '22023';
    END IF;
    v_num := (v_item->>'custo_unitario_centavos')::numeric;
    IF v_num <> trunc(v_num) THEN
      RAISE EXCEPTION 'Item %: o custo deve estar em centavos inteiros', v_n_item USING ERRCODE = '22023';
    END IF;
    IF v_num < 0 THEN
      RAISE EXCEPTION 'Item %: o custo unitário não pode ser negativo', v_n_item USING ERRCODE = '22023';
    END IF;
    IF v_num > c_max_custo THEN
      RAISE EXCEPTION 'Item %: custo unitário acima do limite', v_n_item USING ERRCODE = '22023';
    END IF;
    v_custo := v_num::bigint;

    -- destino
    IF v_acao = 'vinculado' THEN
      BEGIN
        v_item_id := (v_item->>'item_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_item_id := NULL;
      END;
      IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'Item %: produto/peça a vincular não informado', v_n_item USING ERRCODE = '22023';
      END IF;

      v_emp_item := NULL;
      IF v_tipo = 'produto' THEN
        SELECT pr.empresa_id INTO v_emp_item
          FROM public.produtos pr
         WHERE pr.id = v_item_id AND pr.user_id = v_dono AND pr.deleted_at IS NULL;
      ELSE
        SELECT pc.empresa_id INTO v_emp_item
          FROM public.pecas pc
         WHERE pc.id = v_item_id AND pc.user_id = v_dono AND pc.deleted_at IS NULL;
      END IF;
      IF NOT FOUND
         OR (v_filial IS NOT NULL AND v_emp_item IS DISTINCT FROM v_filial)
         OR (v_filial IS NULL AND v_emp_item IS NOT NULL AND v_emp_item IS DISTINCT FROM v_matriz_id) THEN
        RAISE EXCEPTION 'Item %: produto/peça não encontrado nesta loja', v_n_item USING ERRCODE = '42501';
      END IF;

      v_atualiza := COALESCE((v_item->>'atualizar_custo_medio')::boolean, false);
      v_qt_vinculados := v_qt_vinculados + 1;
    ELSE
      v_novo_nome := btrim(COALESCE(NULLIF(btrim(v_item->>'novo_nome'), ''), v_descricao));
      IF char_length(v_novo_nome) > 255 THEN
        RAISE EXCEPTION 'Item %: nome do cadastro novo muito longo', v_n_item USING ERRCODE = '22023';
      END IF;
      v_novo_ean := NULLIF(btrim(v_item->>'novo_codigo_barras'), '');
      IF v_novo_ean IS NOT NULL AND v_novo_ean !~ '^[0-9]{8,14}$' THEN
        RAISE EXCEPTION 'Item %: código de barras inválido', v_n_item USING ERRCODE = '22023';
      END IF;
      v_novo_preco := NULL;
      IF v_item ? 'novo_preco_centavos' AND jsonb_typeof(v_item->'novo_preco_centavos') <> 'null' THEN
        IF jsonb_typeof(v_item->'novo_preco_centavos') <> 'number' THEN
          RAISE EXCEPTION 'Item %: preço de venda inválido', v_n_item USING ERRCODE = '22023';
        END IF;
        v_num := (v_item->>'novo_preco_centavos')::numeric;
        IF v_num <> trunc(v_num) OR v_num < 0 OR v_num > c_max_custo THEN
          RAISE EXCEPTION 'Item %: preço de venda inválido', v_n_item USING ERRCODE = '22023';
        END IF;
        v_novo_preco := v_num / 100;
      END IF;

      -- Cadastro mínimo (mesmas colunas do cadastro manual em useProdutos).
      -- Quantidade 0 e custo NULL: a entrada abaixo soma a quantidade e
      -- grava o custo da nota como custo inicial.
      IF v_tipo = 'produto' THEN
        INSERT INTO public.produtos (nome, user_id, empresa_id, quantidade, custo, preco, codigo_barras)
        VALUES (v_novo_nome, v_dono, v_empresa_novo, 0, NULL, v_novo_preco, v_novo_ean)
        RETURNING id INTO v_item_id;
      ELSE
        INSERT INTO public.pecas (nome, user_id, empresa_id, quantidade, custo, preco, codigo_barras)
        VALUES (v_novo_nome, v_dono, v_empresa_novo, 0, NULL, v_novo_preco, v_novo_ean)
        RETURNING id INTO v_item_id;
      END IF;

      v_atualiza := true;
      v_qt_novos := v_qt_novos + 1;
    END IF;

    -- Entrada de estoque: reaproveita a RPC existente (quantidade, custo
    -- médio, histórico em entradas_estoque). Sem conta a pagar nesta etapa.
    v_obs := left(
      'NF-e ' || v_numero || ' série ' || v_serie || ' — ' || v_emit_nome || ' (item ' || v_n_item || ')',
      500
    );
    SELECT r.entrada_id INTO v_entrada_id
      FROM public.registrar_entrada_estoque(
        v_tipo,
        v_item_id,
        v_qtd,
        v_custo::numeric / 100,
        NULL,      -- fornecedor
        false,     -- gerar conta
        false,     -- pago
        NULL,      -- forma de pagamento
        v_obs,
        v_atualiza
      ) AS r;

    INSERT INTO public.compras_xml_itens (
      importacao_id, n_item, c_prod, descricao, tipo_destino, produto_id, peca_id,
      acao, quantidade_entrada, fator, custo_unitario_centavos, custo_medio_atualizado,
      entrada_estoque_id
    ) VALUES (
      v_importacao_id, v_n_item, v_c_prod, v_descricao, v_tipo,
      CASE WHEN v_tipo = 'produto' THEN v_item_id END,
      CASE WHEN v_tipo = 'peca'    THEN v_item_id END,
      v_acao, v_qtd, v_fator, v_custo, v_atualiza, v_entrada_id
    );

    -- Mapeamento do fornecedor: vale para o vinculado e também para o novo
    -- (que agora existe) — a próxima nota do mesmo fornecedor já vem vinculada.
    INSERT INTO public.compras_xml_mapeamento (
      user_id, empresa_id, emitente_cnpj, c_prod, tipo_destino, produto_id, peca_id, fator
    ) VALUES (
      v_dono, v_filial, v_emit_doc, v_c_prod, v_tipo,
      CASE WHEN v_tipo = 'produto' THEN v_item_id END,
      CASE WHEN v_tipo = 'peca'    THEN v_item_id END,
      v_fator
    )
    ON CONFLICT (user_id, (COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)), emitente_cnpj, c_prod)
    DO UPDATE SET
      tipo_destino = EXCLUDED.tipo_destino,
      produto_id   = EXCLUDED.produto_id,
      peca_id      = EXCLUDED.peca_id,
      fator        = EXCLUDED.fator;

    v_unidades    := v_unidades + v_qtd;
    v_custo_total := v_custo_total + v_custo * v_qtd;
  END LOOP;

  RETURN jsonb_build_object(
    'importacao_id',        v_importacao_id,
    'itens',                v_qt_vinculados + v_qt_novos,
    'vinculados',           v_qt_vinculados,
    'novos',                v_qt_novos,
    'unidades',             v_unidades,
    'custo_total_centavos', v_custo_total,
    'xml_anexado',          v_xml_anexado
  );
END;
$function$;

COMMENT ON FUNCTION public.importar_nfe_compra(jsonb) IS
  'Importa uma NF-e de compra numa transação: grava compras_xml_importadas/itens/mapeamento, cria produtos/peças novos e registra as entradas via registrar_entrada_estoque. SECURITY DEFINER com identidade resolvida por auth.uid() (dono ou gerente da filial).';

REVOKE ALL ON FUNCTION public.importar_nfe_compra(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_nfe_compra(jsonb) TO authenticated;

COMMIT;
