-- =====================================================================
-- !!! NÃO RODE. SÓ EM EMERGÊNCIA, e só com o Adriel decidindo. !!!
-- "Minhas garantias" — desfaz o passo 1 (estrutura).
--
-- Só funciona com as tabelas VAZIAS (rodar antes rollback-2-copia.sql e
-- não ter nenhuma venda/aparelho usando garantia). Aborta se houver dado.
--   1) _zerar_catalogo(): tira as 3 linhas que o remendo pôs (comentário +
--      1560 + 1570), a partir da definição EM VIGOR — volta às 112 linhas;
--   2) apaga colunas de vendas/dispositivos e as 2 tabelas.
-- A ordem importa: sem o passo 1, o "Começar do zero" falharia procurando
-- tabelas que não existem.
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_def  text;
  v_novo text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.garantias_loja)
     OR EXISTS (SELECT 1 FROM public.garantias_textos_venda)
     OR EXISTS (SELECT 1 FROM public.vendas WHERE garantia_id IS NOT NULL OR garantia_texto_id IS NOT NULL
                  OR garantia_meses IS NOT NULL OR garantia_nome IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.dispositivos WHERE garantia_padrao_id IS NOT NULL) THEN
    RAISE EXCEPTION 'rollback da estrutura recusado: ainda há dados de garantias (rodar rollback-2 / conferir vendas)';
  END IF;

  IF EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.tabela LIKE 'public.garantias%') THEN
    v_def := pg_get_functiondef('public._zerar_catalogo()'::regprocedure);
    v_novo := regexp_replace(v_def,
      E'\\n    -- minhas garantias \\(fase A\\)[^\\n]*\\n    \\(1560, ''MANTER'', NULL, ''public\\.garantias_loja'',[^\\n]*\\n    \\(1570, ''MANTER'', NULL, ''public\\.garantias_textos_venda'',[^\\n]*', '');
    IF v_novo = v_def THEN
      RAISE EXCEPTION 'rollback: linhas de garantias não encontradas no formato esperado na _zerar_catalogo';
    END IF;
    EXECUTE v_novo;
  END IF;
  IF (SELECT count(*) FROM public._zerar_catalogo()) <> 112 THEN
    RAISE EXCEPTION 'rollback: _zerar_catalogo ficou com % linhas (esperado 112)', (SELECT count(*) FROM public._zerar_catalogo());
  END IF;
END
$$;
REVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.dispositivos DROP COLUMN IF EXISTS garantia_padrao_id;
ALTER TABLE public.vendas
  DROP COLUMN IF EXISTS garantia_texto_id,
  DROP COLUMN IF EXISTS garantia_meses,
  DROP COLUMN IF EXISTS garantia_nome,
  DROP COLUMN IF EXISTS garantia_id;
DROP TABLE IF EXISTS public.garantias_textos_venda;
DROP TABLE IF EXISTS public.garantias_loja;

NOTIFY pgrst, 'reload schema';
COMMIT;
