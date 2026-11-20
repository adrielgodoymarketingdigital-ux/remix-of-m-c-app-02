-- =====================================================================
-- "Minhas garantias" — FASE A, passo 1 de 2: ESTRUTURA (só banco)
--
-- Quem aplica em produção é o Adriel, no SQL Editor, um arquivo por vez.
-- NUNCA `supabase db push`. Idempotente (pode rodar 2 vezes), numa transação
-- só; não apaga nem altera nenhum dado existente.
--
--   1) garantias_loja: garantias da loja (nome + prazo + texto do termo), por
--      dono e filial (user_id, empresa_id).
--        dono ............... lê, cria, altera, apaga (igual a tipos_garantia)
--        funcionário do dono  lê e cria                (igual a tipos_garantia)
--        gerente de filial .. SÓ lê as da filial dele (empresa_id da filial)
--        anon ............... nada
--   2) garantias_textos_venda: cópia congelada do TEXTO usado numa venda.
--      Imutável: ninguém altera nem apaga pelo app. 1 linha por texto distinto
--      por dono (md5). Fora de `vendas` porque useVendas/Relatorios/Exportação
--      leem `vendas` com select("*").
--        dono / funcionário do dono / gerente de filial do proprietário: lê e cria
--   3) vendas: garantia_id, garantia_nome, garantia_meses, garantia_texto_id
--      (nulas; NULL = venda antiga → recibo exatamente como hoje). Nesta fase
--      o app NÃO grava nem lê estas colunas.
--   4) dispositivos.garantia_padrao_id (nula; uso só na fase D).
--   5) _zerar_catalogo(): REMENDO da função ATUAL de produção (não é cópia):
--      lê a definição em vigor, confere que tem 112 linhas e a linha 1550
--      (configuracao_estoque), e insere logo depois dela as 2 tabelas novas
--      como MANTER (112 → 114). Se a função atual não for a esperada, ABORTA.
--   6) Autoverificação: qualquer coisa fora do esperado desfaz tudo.
--
-- ANTES: rodar a consulta de leitura scripts/minhas-garantias/0-conferir-producao.sql.
-- DEPOIS: scripts/minhas-garantias/1-verificar-estrutura.sql.
-- ROLLBACK (NÃO RODE, só em emergência): scripts/minhas-garantias/rollback-1-estrutura.sql.
-- LOCKS: ADD COLUMN nulo sem default é só metadado; os FKs pegam lock curto
--   em vendas/dispositivos. lock_timeout 5 s: com fila, falha sem efeito.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1) Garantias da loja
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garantias_loja (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  empresa_id  uuid REFERENCES public.empresas (id),
  nome        text NOT NULL
              CONSTRAINT garantias_loja_nome_check CHECK (char_length(btrim(nome)) BETWEEN 1 AND 80),
  -- 0 = sem garantia contratual (termo "sem garantia")
  meses       integer NOT NULL
              CONSTRAINT garantias_loja_meses_check CHECK (meses BETWEEN 0 AND 120),
  texto       text NOT NULL
              CONSTRAINT garantias_loja_texto_check CHECK (octet_length(texto) <= 20000),
  ativo       boolean NOT NULL DEFAULT true,
  ordem       integer NOT NULL DEFAULT 0,
  -- importada sem prazo claro (modelo antigo): a tela pede revisão
  revisar     boolean NOT NULL DEFAULT false,
  -- rastreio da cópia (manual | padrao | tipos_garantia | modelo | termo_global)
  origem      text NOT NULL DEFAULT 'manual'
              CONSTRAINT garantias_loja_origem_check
              CHECK (origem IN ('manual', 'padrao', 'tipos_garantia', 'modelo', 'termo_global')),
  origem_ref  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- excluir pelo app = preencher deleted_at (vendas guardam a própria cópia)
  deleted_at  timestamptz
);
COMMENT ON TABLE public.garantias_loja IS
  'Minhas garantias: nome + prazo (meses, 0 = sem garantia) + texto do termo com variáveis {{...}}. A venda guarda cópia congelada (vendas.garantia_* + garantias_textos_venda).';

CREATE INDEX IF NOT EXISTS idx_garantias_loja_dono
  ON public.garantias_loja (user_id, empresa_id, ordem) WHERE deleted_at IS NULL;
-- cópia idempotente: no máximo 1 linha por item de origem
CREATE UNIQUE INDEX IF NOT EXISTS uq_garantias_loja_origem
  ON public.garantias_loja (user_id, (COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)), origem, origem_ref)
  WHERE origem_ref IS NOT NULL;

DROP TRIGGER IF EXISTS update_garantias_loja_updated_at ON public.garantias_loja;
CREATE TRIGGER update_garantias_loja_updated_at
  BEFORE UPDATE ON public.garantias_loja
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.garantias_loja ENABLE ROW LEVEL SECURITY;
-- O Supabase dá ALL por padrão (default privileges): zera e concede só o necessário.
REVOKE ALL ON TABLE public.garantias_loja FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.garantias_loja TO authenticated;
GRANT ALL ON TABLE public.garantias_loja TO service_role;

-- As 6 de tipos_garantia (20260617000001) + leitura do gerente de filial
DROP POLICY IF EXISTS "Users can view own garantias_loja" ON public.garantias_loja;
CREATE POLICY "Users can view own garantias_loja"
  ON public.garantias_loja FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own garantias_loja" ON public.garantias_loja;
CREATE POLICY "Users can insert own garantias_loja"
  ON public.garantias_loja FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own garantias_loja" ON public.garantias_loja;
CREATE POLICY "Users can update own garantias_loja"
  ON public.garantias_loja FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own garantias_loja" ON public.garantias_loja;
CREATE POLICY "Users can delete own garantias_loja"
  ON public.garantias_loja FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Funcionarios podem ver garantias_loja do dono" ON public.garantias_loja;
CREATE POLICY "Funcionarios podem ver garantias_loja do dono"
  ON public.garantias_loja FOR SELECT TO authenticated USING (public.is_funcionario_of(user_id));
DROP POLICY IF EXISTS "Funcionarios podem inserir garantias_loja para o dono" ON public.garantias_loja;
CREATE POLICY "Funcionarios podem inserir garantias_loja para o dono"
  ON public.garantias_loja FOR INSERT TO authenticated WITH CHECK (public.is_funcionario_of(user_id));
-- Mesmo EXISTS das policies de vendas do gerente (20260515000003): proprietário E filial.
DROP POLICY IF EXISTS "gerente de filial le garantias_loja da filial" ON public.garantias_loja;
CREATE POLICY "gerente de filial le garantias_loja da filial"
  ON public.garantias_loja FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.gerente_id = auth.uid()
      AND eu.proprietario_id = garantias_loja.user_id
      AND eu.empresa_id = garantias_loja.empresa_id
  ));

-- ---------------------------------------------------------------------
-- 2) Cópia congelada do texto (imutável, sem repetição)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garantias_textos_venda (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  texto       text NOT NULL
              CONSTRAINT garantias_textos_venda_texto_check CHECK (octet_length(texto) <= 20000),
  texto_md5   text GENERATED ALWAYS AS (md5(texto)) STORED,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.garantias_textos_venda IS
  'Texto (modelo, antes de trocar as variáveis) do termo usado numa venda. Imutável: a reimpressão sai igual à original mesmo se a garantia for editada ou apagada.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_garantias_textos_venda_dono_md5
  ON public.garantias_textos_venda (user_id, texto_md5);

ALTER TABLE public.garantias_textos_venda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.garantias_textos_venda FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.garantias_textos_venda TO authenticated;
GRANT ALL ON TABLE public.garantias_textos_venda TO service_role;

DROP POLICY IF EXISTS "dono le textos de garantia das vendas" ON public.garantias_textos_venda;
CREATE POLICY "dono le textos de garantia das vendas"
  ON public.garantias_textos_venda FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "dono grava textos de garantia das vendas" ON public.garantias_textos_venda;
CREATE POLICY "dono grava textos de garantia das vendas"
  ON public.garantias_textos_venda FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "funcionario le textos de garantia do dono" ON public.garantias_textos_venda;
CREATE POLICY "funcionario le textos de garantia do dono"
  ON public.garantias_textos_venda FOR SELECT TO authenticated USING (public.is_funcionario_of(user_id));
DROP POLICY IF EXISTS "funcionario grava textos de garantia do dono" ON public.garantias_textos_venda;
CREATE POLICY "funcionario grava textos de garantia do dono"
  ON public.garantias_textos_venda FOR INSERT TO authenticated WITH CHECK (public.is_funcionario_of(user_id));
-- Texto não tem filial: basta ser gerente de alguma filial do proprietário.
DROP POLICY IF EXISTS "gerente de filial le textos de garantia do proprietario" ON public.garantias_textos_venda;
CREATE POLICY "gerente de filial le textos de garantia do proprietario"
  ON public.garantias_textos_venda FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                  WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = garantias_textos_venda.user_id));
DROP POLICY IF EXISTS "gerente de filial grava textos de garantia do proprietario" ON public.garantias_textos_venda;
CREATE POLICY "gerente de filial grava textos de garantia do proprietario"
  ON public.garantias_textos_venda FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                       WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = garantias_textos_venda.user_id));

-- ---------------------------------------------------------------------
-- 3) Venda: cópia congelada (nome, prazo, texto) + id da garantia usada
-- ---------------------------------------------------------------------
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS garantia_id       uuid;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS garantia_nome     text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS garantia_meses    integer;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS garantia_texto_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_garantia_id_fkey'
                   AND conrelid = 'public.vendas'::regclass) THEN
    ALTER TABLE public.vendas ADD CONSTRAINT vendas_garantia_id_fkey
      FOREIGN KEY (garantia_id) REFERENCES public.garantias_loja (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_garantia_texto_id_fkey'
                   AND conrelid = 'public.vendas'::regclass) THEN
    ALTER TABLE public.vendas ADD CONSTRAINT vendas_garantia_texto_id_fkey
      FOREIGN KEY (garantia_texto_id) REFERENCES public.garantias_textos_venda (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_garantia_meses_check'
                   AND conrelid = 'public.vendas'::regclass) THEN
    ALTER TABLE public.vendas ADD CONSTRAINT vendas_garantia_meses_check
      CHECK (garantia_meses IS NULL OR garantia_meses BETWEEN 0 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_garantia_nome_check'
                   AND conrelid = 'public.vendas'::regclass) THEN
    ALTER TABLE public.vendas ADD CONSTRAINT vendas_garantia_nome_check
      CHECK (garantia_nome IS NULL OR char_length(garantia_nome) <= 80);
  END IF;
  -- cópia é tudo ou nada: texto congelado exige prazo congelado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_garantia_copia_check'
                   AND conrelid = 'public.vendas'::regclass) THEN
    ALTER TABLE public.vendas ADD CONSTRAINT vendas_garantia_copia_check
      CHECK (garantia_texto_id IS NULL OR garantia_meses IS NOT NULL);
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_vendas_garantia_id ON public.vendas (garantia_id) WHERE garantia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_garantia_texto_id ON public.vendas (garantia_texto_id) WHERE garantia_texto_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4) Dispositivo: garantia sugerida na venda (uso só na fase D)
-- ---------------------------------------------------------------------
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS garantia_padrao_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispositivos_garantia_padrao_id_fkey'
                   AND conrelid = 'public.dispositivos'::regclass) THEN
    ALTER TABLE public.dispositivos ADD CONSTRAINT dispositivos_garantia_padrao_id_fkey
      FOREIGN KEY (garantia_padrao_id) REFERENCES public.garantias_loja (id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 5) "Começar do zero": remendo da _zerar_catalogo() EM VIGOR
--    Entra exatamente isto, logo depois da linha 1550:
--      (1560, 'MANTER', NULL, 'public.garantias_loja',               'user_id = $1'),
--      (1570, 'MANTER', NULL, 'public.garantias_textos_venda',       'user_id = $1'),
-- ---------------------------------------------------------------------
DO $remendo$
DECLARE
  v_def      text;
  v_novo     text;
  v_linhas   int;
  v_ancoras  int;
  c_ancora   constant text :=
    '(\(1550,\s*''MANTER'',\s*NULL,\s*''public\.configuracao_estoque'',\s*''user_id = \$1''\),)';
  c_inserir  constant text :=
    E'\\1\n    -- minhas garantias (fase A): configuração da loja e textos congelados (sem dado de cliente)'
    || E'\n    (1560, ''MANTER'', NULL, ''public.garantias_loja'',               ''user_id = $1''),'
    || E'\n    (1570, ''MANTER'', NULL, ''public.garantias_textos_venda'',       ''user_id = $1''),';
BEGIN
  -- Já remendada (2ª execução): nada a fazer.
  IF EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.tabela = 'public.garantias_loja') THEN
    RAISE NOTICE '_zerar_catalogo já tem as tabelas de garantias; remendo ignorado';
    RETURN;
  END IF;

  SELECT count(*) INTO v_linhas FROM public._zerar_catalogo();
  IF v_linhas <> 112 THEN
    RAISE EXCEPTION '_zerar_catalogo em produção tem % linhas (esperado 112): conferir antes de aplicar', v_linhas;
  END IF;

  v_def := pg_get_functiondef('public._zerar_catalogo()'::regprocedure);
  SELECT count(*) INTO v_ancoras FROM regexp_matches(v_def, c_ancora, 'g');
  IF v_ancoras <> 1 THEN
    RAISE EXCEPTION '_zerar_catalogo: linha 1550 (configuracao_estoque) encontrada % vezes (esperado 1)', v_ancoras;
  END IF;

  v_novo := regexp_replace(v_def, c_ancora, c_inserir);
  EXECUTE v_novo;  -- CREATE OR REPLACE da própria definição + 2 linhas
END
$remendo$;

REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) Autoverificação (qualquer falha desfaz a transação inteira)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_problemas text[] := '{}';
  v_policies  text[];
  v_priv      text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.garantias_loja'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.garantias_textos_venda'::regclass) THEN
    v_problemas := v_problemas || 'RLS desligada'::text;
  END IF;

  SELECT array_agg(policyname || ':' || cmd ORDER BY policyname) INTO v_policies
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garantias_loja';
  IF v_policies IS DISTINCT FROM ARRAY[
       'Funcionarios podem inserir garantias_loja para o dono:INSERT',
       'Funcionarios podem ver garantias_loja do dono:SELECT',
       'Users can delete own garantias_loja:DELETE',
       'Users can insert own garantias_loja:INSERT',
       'Users can update own garantias_loja:UPDATE',
       'Users can view own garantias_loja:SELECT',
       'gerente de filial le garantias_loja da filial:SELECT'] THEN
    v_problemas := v_problemas || format('policies de garantias_loja inesperadas: %s', v_policies);
  END IF;

  SELECT array_agg(policyname || ':' || cmd ORDER BY policyname) INTO v_policies
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garantias_textos_venda';
  IF v_policies IS DISTINCT FROM ARRAY[
       'dono grava textos de garantia das vendas:INSERT',
       'dono le textos de garantia das vendas:SELECT',
       'funcionario grava textos de garantia do dono:INSERT',
       'funcionario le textos de garantia do dono:SELECT',
       'gerente de filial grava textos de garantia do proprietario:INSERT',
       'gerente de filial le textos de garantia do proprietario:SELECT'] THEN
    v_problemas := v_problemas || format('policies de garantias_textos_venda inesperadas: %s', v_policies);
  END IF;

  FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
    IF has_table_privilege('anon', 'public.garantias_loja', v_priv)
       OR has_table_privilege('anon', 'public.garantias_textos_venda', v_priv) THEN
      v_problemas := v_problemas || format('anon tem %s', v_priv);
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.garantias_textos_venda', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.garantias_textos_venda', 'DELETE')
     OR has_table_privilege('authenticated', 'public.garantias_textos_venda', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.garantias_loja', 'TRUNCATE') THEN
    v_problemas := v_problemas || 'authenticated pode alterar/apagar texto congelado ou truncar'::text;
  END IF;

  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendas'
        AND column_name IN ('garantia_id', 'garantia_nome', 'garantia_meses', 'garantia_texto_id')) <> 4 THEN
    v_problemas := v_problemas || 'colunas de garantia em vendas ausentes'::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                   AND table_name = 'dispositivos' AND column_name = 'garantia_padrao_id') THEN
    v_problemas := v_problemas || 'dispositivos.garantia_padrao_id ausente'::text;
  END IF;

  IF (SELECT count(*) FROM public._zerar_catalogo() c
       WHERE c.lista = 'MANTER' AND c.categoria IS NULL AND c.filtro = 'user_id = $1'
         AND c.tabela IN ('public.garantias_loja', 'public.garantias_textos_venda')) <> 2 THEN
    v_problemas := v_problemas || 'tabelas fora do _zerar_catalogo'::text;
  END IF;
  IF (SELECT count(*) FROM public._zerar_catalogo()) <> 114 THEN
    v_problemas := v_problemas || format('_zerar_catalogo com %s linhas (esperado 114)',
                                         (SELECT count(*) FROM public._zerar_catalogo()));
  END IF;
  IF (SELECT count(DISTINCT ordem) FROM public._zerar_catalogo()) <> 114 THEN
    v_problemas := v_problemas || '_zerar_catalogo com ordem repetida'::text;
  END IF;
  IF has_function_privilege('authenticated', 'public._zerar_catalogo()', 'EXECUTE')
     OR has_function_privilege('anon', 'public._zerar_catalogo()', 'EXECUTE') THEN
    v_problemas := v_problemas || '_zerar_catalogo executável por anon/authenticated'::text;
  END IF;

  IF cardinality(v_problemas) > 0 THEN
    RAISE EXCEPTION 'minhas garantias (estrutura): autoverificação falhou: %', array_to_string(v_problemas, '; ');
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
