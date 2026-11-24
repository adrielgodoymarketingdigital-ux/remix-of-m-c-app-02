-- !!! NÃO RODE. Só em emergência. !!!
-- Desfaz 20261125120200: tira a linha de os_tecnicos_adicionais do _zerar_catalogo()
-- (remendo inverso da definição EM VIGOR). Não apaga dado.
-- Rodar ANTES do rollback-1 (senão o catálogo aponta para tabela inexistente).
BEGIN;
DO $desfaz$
DECLARE
  v_def text; v_novo text; v_antes int; v_qtd int;
  c_linha constant text :=
    '\n\s*-- técnicos adicionais da OS \(F1\): saem junto com as OS\n\s*\(12,\s*''APAGAR'',\s*''os'',\s*''public\.os_tecnicos_adicionais'',[^\n]*\),';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.tabela = 'public.os_tecnicos_adicionais') THEN
    RAISE NOTICE 'catálogo já está sem os_tecnicos_adicionais'; RETURN;
  END IF;
  SELECT count(*) INTO v_antes FROM public._zerar_catalogo();
  v_def := pg_get_functiondef('public._zerar_catalogo()'::regprocedure);
  SELECT count(*) INTO v_qtd FROM regexp_matches(v_def, c_linha, 'g');
  IF v_qtd <> 1 THEN RAISE EXCEPTION 'linha do remendo encontrada % vezes (esperado 1)', v_qtd; END IF;
  v_novo := regexp_replace(v_def, c_linha, '');
  EXECUTE v_novo;
  IF (SELECT count(*) FROM public._zerar_catalogo()) <> v_antes - 1 THEN
    RAISE EXCEPTION 'contagem do catálogo não bateu depois do rollback';
  END IF;
END
$desfaz$;
REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;
COMMIT;
