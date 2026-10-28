-- =====================================================================
-- Estoque baixo personalizável — FASE 3 (banco): estoque mínimo POR ITEM
--
-- APLICAR À MÃO NO SQL EDITOR. NUNCA usar `supabase db push`: o histórico
-- supabase_migrations.schema_migrations da produção para em 20260606000001
-- (as migrations seguintes foram aplicadas à mão), então o db push tentaria
-- reaplicar tudo o que veio depois.
--
--   1) produtos.estoque_minimo e pecas.estoque_minimo: integer, nula, SEM
--      DEFAULT. Nulo = usa o limite da loja (configuracao_estoque) e, sem
--      ele, o padrão de cada tela. X = "avisar quando restar X ou menos"
--      naquele item. 0 = nunca avisar "baixo" naquele item.
--      ADD COLUMN sem DEFAULT só mexe no catálogo: nenhuma linha é
--      reescrita (a autoverificação confere que o arquivo da tabela é o
--      mesmo de antes).
--   2) CHECK de 0 a 1000 criado NOT VALID: também só catálogo, sem varrer a
--      tabela. Já vale para toda gravação nova. A validação das linhas
--      antigas (todas nulas, a coluna é nova) fica no PASSO 2, em separado:
--      scripts/estoque-baixo/fase3/passo2-validar-check.sql, que roda com
--      SHARE UPDATE EXCLUSIVE (não bloqueia leitura nem gravação do app).
--
-- NÃO toca em RLS, policies, gatilhos, funções, grants, índices nem em
-- outras colunas ou restrições; a autoverificação confere isso, nas duas
-- tabelas, contra uma foto tirada antes do primeiro ALTER (inclui as views
-- que dependem delas, que continuam sem a coluna nova).
-- Nenhuma função muda: _zerar_catalogo é por tabela, e as funções que
-- gravam em produtos/pecas listam as colunas (ver o relatório da fase 3).
-- Idempotente, numa transação só. Reversão em
-- scripts/estoque-baixo/fase3/rollback.sql; conferência em
-- scripts/estoque-baixo/fase3/verificacao.sql.
-- =====================================================================

BEGIN;

-- Lista de Produtos, PDV e OS leem estas tabelas o tempo todo: se algo
-- segurar uma delas, desiste rápido em vez de enfileirar o app atrás do ALTER.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- As duas tabelas travadas desde já (o ALTER pegaria o mesmo lock logo
-- adiante): sem isso, um cadastro gravado entre a foto e o ALTER mudaria a
-- contagem de linhas e a autoverificação abortaria à toa. O lock dura só
-- esta transação (catálogo + duas contagens).
LOCK TABLE public.produtos, public.pecas IN ACCESS EXCLUSIVE MODE;


-- ---------------------------------------------------------------------
-- 0) Pré-condições
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t     text;
  v_col text;
  v_def text;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos', 'pecas'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'EMN001: tabela public.% não existe', t;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = t
                      AND column_name = 'quantidade' AND data_type = 'integer') THEN
      RAISE EXCEPTION 'EMN002: %.quantidade ausente ou não é integer', t;
    END IF;

    -- numa reexecução a coluna já existe: só aceita se for exatamente a nossa
    SELECT data_type || '|' || is_nullable || '|' || COALESCE(column_default, '')
      INTO v_col
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = t AND column_name = 'estoque_minimo';
    IF v_col IS NOT NULL AND v_col <> 'integer|YES|' THEN
      RAISE EXCEPTION 'EMN003: %.estoque_minimo já existe com outra definição (%)', t, v_col;
    END IF;

    -- restrição com o mesmo nome e outra definição: não sobrescreve
    SELECT pg_get_constraintdef(c.oid) INTO v_def
      FROM pg_constraint c
     WHERE c.conrelid = ('public.' || t)::regclass AND c.conname = t || '_estoque_minimo_check';
    IF v_def IS NOT NULL
       AND v_def <> 'CHECK (((estoque_minimo >= 0) AND (estoque_minimo <= 1000))) NOT VALID'
       AND v_def <> 'CHECK (((estoque_minimo >= 0) AND (estoque_minimo <= 1000)))' THEN
      RAISE EXCEPTION 'EMN004: %_estoque_minimo_check já existe com outra definição: %', t, v_def;
    END IF;
  END LOOP;
END;
$$;


-- ---------------------------------------------------------------------
-- Foto do que NÃO pode mudar. A foto (antes) e a conferência (depois) usam
-- a mesma view. Ficam de fora só a coluna e o CHECK novos.
-- 'arquivo' (relfilenode) prova que nenhuma tabela foi reescrita.
-- ---------------------------------------------------------------------
CREATE TEMP VIEW _emn_estrutura AS
  WITH tabelas(tabela) AS (VALUES ('produtos'::text), ('pecas'))
  SELECT t.tabela, 'coluna' AS tipo, column_name::text || '|' || data_type || '|' || is_nullable
         || '|' || COALESCE(column_default, '') AS def
    FROM tabelas t JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = t.tabela
   WHERE column_name <> 'estoque_minimo'
  UNION ALL
  SELECT t.tabela, 'policy', policyname::text || '|' || cmd || '|' || roles::text || '|'
         || COALESCE(qual, '') || '|' || COALESCE(with_check, '')
    FROM tabelas t JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.tabela
  UNION ALL
  SELECT t.tabela, 'rls', c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
    FROM tabelas t JOIN pg_class c ON c.oid = ('public.' || t.tabela)::regclass
  UNION ALL
  SELECT t.tabela, 'arquivo', c.relfilenode::text
    FROM tabelas t JOIN pg_class c ON c.oid = ('public.' || t.tabela)::regclass
  UNION ALL
  SELECT t.tabela, 'gatilho', g.tgname::text || '|' || g.tgenabled::text || '|' || pg_get_triggerdef(g.oid)
    FROM tabelas t JOIN pg_trigger g ON g.tgrelid = ('public.' || t.tabela)::regclass
   WHERE NOT g.tgisinternal
  UNION ALL
  SELECT t.tabela, 'restricao', k.conname::text || '|' || pg_get_constraintdef(k.oid)
    FROM tabelas t JOIN pg_constraint k ON k.conrelid = ('public.' || t.tabela)::regclass
   WHERE k.conname <> t.tabela || '_estoque_minimo_check'
  UNION ALL
  SELECT t.tabela, 'indice', i.indexname::text || '|' || i.indexdef
    FROM tabelas t JOIN pg_indexes i ON i.schemaname = 'public' AND i.tablename = t.tabela
  UNION ALL
  SELECT t.tabela, 'grant', g.grantee || '|' || g.privilege_type
    FROM tabelas t JOIN information_schema.role_table_grants g
      ON g.table_schema = 'public' AND g.table_name = t.tabela
  UNION ALL
  -- views que dependem das tabelas (catálogo público): definição inteira
  SELECT t.tabela, 'view', v.oid::regclass::text || '|' || pg_get_viewdef(v.oid)
    FROM tabelas t
    JOIN pg_depend d ON d.refobjid = ('public.' || t.tabela)::regclass AND d.classid = 'pg_rewrite'::regclass
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class v ON v.oid = r.ev_class AND v.oid <> ('public.' || t.tabela)::regclass
   GROUP BY t.tabela, v.oid
  UNION ALL
  SELECT 'produtos', 'linhas', count(*)::text FROM public.produtos
  UNION ALL
  SELECT 'pecas', 'linhas', count(*)::text FROM public.pecas;

CREATE TEMP TABLE _emn_antes ON COMMIT DROP AS SELECT * FROM _emn_estrutura;


-- ---------------------------------------------------------------------
-- 1) Colunas (nulas, sem DEFAULT: só catálogo)
-- ---------------------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estoque_minimo integer;
ALTER TABLE public.pecas    ADD COLUMN IF NOT EXISTS estoque_minimo integer;

COMMENT ON COLUMN public.produtos.estoque_minimo IS
  'Estoque mínimo do item: avisar "baixo" quando restar X ou menos. NULL = limite da loja (configuracao_estoque) ou padrão da tela; 0 = nunca avisar baixo.';
COMMENT ON COLUMN public.pecas.estoque_minimo IS
  'Estoque mínimo do item: avisar "baixo" quando restar X ou menos. NULL = limite da loja (configuracao_estoque) ou padrão da tela; 0 = nunca avisar baixo.';


-- ---------------------------------------------------------------------
-- 2) CHECK de 0 a 1000, NOT VALID (sem varrer a tabela). Nulo passa.
--    Validação das linhas antigas: passo 2, fora desta transação.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos', 'pecas'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = ('public.' || t)::regclass AND conname = t || '_estoque_minimo_check') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (estoque_minimo >= 0 AND estoque_minimo <= 1000) NOT VALID',
                     t, t || '_estoque_minimo_check');
    END IF;
  END LOOP;
END;
$$;


-- ---------------------------------------------------------------------
-- 3) Autoverificação: qualquer divergência desfaz a transação inteira.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t       text;
  v_def   text;
  v_falta text;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos', 'pecas'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = t
                      AND column_name = 'estoque_minimo' AND data_type = 'integer'
                      AND is_nullable = 'YES' AND column_default IS NULL) THEN
      RAISE EXCEPTION 'EMN010: %.estoque_minimo ausente ou com tipo/nulo/default errado', t;
    END IF;

    SELECT pg_get_constraintdef(c.oid) INTO v_def
      FROM pg_constraint c
     WHERE c.conrelid = ('public.' || t)::regclass AND c.conname = t || '_estoque_minimo_check' AND c.contype = 'c';
    IF v_def IS NULL OR v_def NOT IN ('CHECK (((estoque_minimo >= 0) AND (estoque_minimo <= 1000))) NOT VALID',
                                      'CHECK (((estoque_minimo >= 0) AND (estoque_minimo <= 1000)))') THEN
      RAISE EXCEPTION 'EMN011: %_estoque_minimo_check ausente ou com outra definição: %', t, v_def;
    END IF;
  END LOOP;

  -- colunas antigas, RLS, policies, arquivo da tabela, gatilhos, restrições,
  -- índices, grants, views dependentes e quantidade de linhas das duas
  -- tabelas: iguais à foto, nos dois sentidos
  SELECT string_agg(tabela || ' ' || tipo || ': ' || def, ' ; ') INTO v_falta FROM (
    (SELECT tabela, 'sumiu/mudou ' || tipo AS tipo, def FROM
       (SELECT * FROM _emn_antes EXCEPT ALL SELECT * FROM _emn_estrutura) x)
    UNION ALL
    (SELECT tabela, 'apareceu ' || tipo, def FROM
       (SELECT * FROM _emn_estrutura EXCEPT ALL SELECT * FROM _emn_antes) y)
  ) d;
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'EMN012: mudou além da coluna e do CHECK novos: %', v_falta;
  END IF;

  RAISE NOTICE 'EMN OK: estoque_minimo em produtos e pecas aplicado e conferido (CHECK ainda NOT VALID: rodar o passo 2)';
END;
$$;

DROP VIEW _emn_estrutura;

NOTIFY pgrst, 'reload schema';

COMMIT;
