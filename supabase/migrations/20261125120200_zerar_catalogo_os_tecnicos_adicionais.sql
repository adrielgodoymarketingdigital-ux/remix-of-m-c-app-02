-- =====================================================================
-- RASCUNHO — NÃO APLICADO. "Começar do zero": os_tecnicos_adicionais no
-- _zerar_catalogo(). Depende de 20261125120000 (a tabela tem de existir).
--
-- Sem isto, zerar_meus_dados_previa/executar RECUSAM (tabela_nao_classificada)
-- qualquer loja que tenha técnico adicional gravado: a tabela tem user_id e
-- FK para ordens_servico (que está em APAGAR).
--
-- REMENDO da função EM VIGOR (não é cópia de arquivo do repositório): lê
-- pg_get_functiondef, coloca UMA linha logo depois da de os_tecnicos e recria.
-- Entra exatamente isto:
--   (12,  'APAGAR', 'os',         'public.os_tecnicos_adicionais',      'user_id = $1 OR os_id IN (SELECT id FROM public.ordens_servico WHERE user_id = $1)'),
-- (mesmo filtro de os_dispositivos_adicionais, ordem 15; filhas antes da OS, 190).
--
-- Recusa sem mudar nada se: a tabela não existe; a âncora (linha 10 de
-- os_tecnicos) não aparece exatamente 1 vez; a ordem 12 já está em uso; o
-- número de linhas depois não for o de antes + 1.
-- Idempotente: se a linha já está lá, só avisa.
-- ROLLBACK: scripts/os-tecnicos-adicionais/rollback-3-zerar-catalogo.sql
-- =====================================================================

BEGIN;

DO $remendo$
DECLARE
  v_def     text;
  v_novo    text;
  v_antes   int;
  v_depois  int;
  v_ancoras int;
  c_ancora  constant text :=
    '(\(10,\s*''APAGAR'',\s*''os'',\s*''public\.os_tecnicos'',\s*''os_id IN \(SELECT id FROM public\.ordens_servico WHERE user_id = \$1\)''\),)';
  c_inserir constant text :=
    E'\\1\n    -- técnicos adicionais da OS (F1): saem junto com as OS'
    || E'\n    (12,  ''APAGAR'', ''os'',         ''public.os_tecnicos_adicionais'',      ''user_id = $1 OR os_id IN (SELECT id FROM public.ordens_servico WHERE user_id = $1)''),';
BEGIN
  IF to_regclass('public.os_tecnicos_adicionais') IS NULL THEN
    RAISE EXCEPTION 'os_tecnicos_adicionais não existe: rode 20261125120000 antes';
  END IF;

  IF EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.tabela = 'public.os_tecnicos_adicionais') THEN
    RAISE NOTICE '_zerar_catalogo já tem os_tecnicos_adicionais; remendo ignorado';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.ordem = 12) THEN
    RAISE EXCEPTION '_zerar_catalogo já usa a ordem 12: conferir antes de aplicar';
  END IF;

  SELECT count(*) INTO v_antes FROM public._zerar_catalogo();

  v_def := pg_get_functiondef('public._zerar_catalogo()'::regprocedure);
  SELECT count(*) INTO v_ancoras FROM regexp_matches(v_def, c_ancora, 'g');
  IF v_ancoras <> 1 THEN
    RAISE EXCEPTION '_zerar_catalogo: linha 10 (os_tecnicos) encontrada % vezes (esperado 1)', v_ancoras;
  END IF;

  v_novo := regexp_replace(v_def, c_ancora, c_inserir);
  EXECUTE v_novo;  -- CREATE OR REPLACE da própria definição + 1 linha

  SELECT count(*) INTO v_depois FROM public._zerar_catalogo();
  IF v_depois <> v_antes + 1 THEN
    RAISE EXCEPTION '_zerar_catalogo: % linhas depois (esperado %)', v_depois, v_antes + 1;
  END IF;
  IF (SELECT count(DISTINCT ordem) FROM public._zerar_catalogo()) <> v_depois THEN
    RAISE EXCEPTION '_zerar_catalogo: ordem repetida depois do remendo';
  END IF;
END
$remendo$;

REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;

COMMIT;
