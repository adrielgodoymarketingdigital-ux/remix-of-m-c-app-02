-- =====================================================================
-- "Começar do zero" — ETAPA 2 (banco): apoio à Edge Function zerar-dados-storage
--
-- 1) Fila zerar_dados_arquivos ganha a situação de cada arquivo:
--      pendente        → ainda vai ser removido
--      removido        → removido pela API do Storage (removido_em preenchido)
--      mantido_em_uso  → NÃO removido: ainda citado por um dado que ficou
--      ignorado        → bucket fora da lista permitida (nunca removido)
--      falhou          → 3 tentativas sem sucesso
--    e o número de tentativas.
-- 2) zerar_dados_marcar_em_uso(execucao): marca como mantido_em_uso os
--    pendentes que ainda aparecem (mesma regex de URL da etapa 1) nas linhas
--    que FICARAM do dono. Uma passada só por chamada; só service_role.
--
-- Não mexe em storage.objects. Nenhuma tabela do app é tocada além da fila.
-- Idempotente e numa transação só.
--
-- ROLLBACK:
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.zerar_dados_marcar_em_uso(uuid);
--   DROP INDEX IF EXISTS public.idx_zerar_dados_arquivos_situacao;
--   ALTER TABLE public.zerar_dados_arquivos DROP COLUMN IF EXISTS tentativas;
--   ALTER TABLE public.zerar_dados_arquivos DROP COLUMN IF EXISTS situacao;
--   COMMIT;
-- =====================================================================

BEGIN;

ALTER TABLE public.zerar_dados_arquivos
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'pendente'
    CONSTRAINT zerar_dados_arquivos_situacao_check
    CHECK (situacao IN ('pendente', 'removido', 'mantido_em_uso', 'ignorado', 'falhou'));
ALTER TABLE public.zerar_dados_arquivos
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0;

-- Linha já marcada como removida antes desta coluna existir (não deve haver).
UPDATE public.zerar_dados_arquivos SET situacao = 'removido'
 WHERE removido_em IS NOT NULL AND situacao = 'pendente';

CREATE INDEX IF NOT EXISTS idx_zerar_dados_arquivos_situacao
  ON public.zerar_dados_arquivos (execucao_id, situacao);


CREATE OR REPLACE FUNCTION public.zerar_dados_marcar_em_uso(p_execucao_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  -- As mesmas tabelas que a etapa 1 lê para montar a fila
  c_tabelas constant text[] := ARRAY['produtos', 'pecas', 'dispositivos', 'ordens_servico', 'compras_dispositivos',
                                     'origem_pessoas', 'vendas', 'orcamentos', 'clientes', 'os_dispositivos_adicionais'];
  c_url     constant text := '/storage/v1/object/(?:public|sign)/([a-z0-9_-]+)/([^"?\s\\,)]+)';
  v_uid     uuid;
  v_refs    text[] := '{}';
  v_tmp     text[];
  v_n       integer;
  v_total   integer := 0;
  t         text;
BEGIN
  SELECT user_id INTO v_uid FROM public.zerar_dados_execucoes WHERE id = p_execucao_id;
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  -- URLs citadas no que FICOU do dono (o que foi apagado já não existe)
  FOREACH t IN ARRAY c_tabelas LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT array_agg(DISTINCT m[1] || chr(31) || m[2]) FROM public.%I x, regexp_matches(x::text, $2, ''g'') m WHERE x.user_id = $1', t)
      INTO v_tmp USING v_uid, c_url;
    v_refs := v_refs || COALESCE(v_tmp, '{}');
  END LOOP;
  IF cardinality(v_refs) = 0 THEN
    RETURN 0;
  END IF;

  -- O próprio arquivo citado
  UPDATE public.zerar_dados_arquivos a SET situacao = 'mantido_em_uso'
    FROM (SELECT DISTINCT r FROM unnest(v_refs) r) refs
   WHERE a.execucao_id = p_execucao_id AND a.situacao = 'pendente'
     AND refs.r = a.bucket || chr(31) || a.caminho;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_n;

  -- A miniatura (v2-*_thumb.ext) de uma foto v2 citada fica junto com ela
  UPDATE public.zerar_dados_arquivos a SET situacao = 'mantido_em_uso'
    FROM (SELECT DISTINCT r FROM unnest(v_refs) r) refs
   WHERE a.execucao_id = p_execucao_id AND a.situacao = 'pendente'
     AND a.caminho ~ '(^|/)v2-[^/]*_thumb\.[A-Za-z0-9]+$'
     AND refs.r = a.bucket || chr(31) || regexp_replace(a.caminho, '_thumb(\.[A-Za-z0-9]+)$', '\1');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN v_total + v_n;
END
$fn$;

REVOKE ALL ON FUNCTION public.zerar_dados_marcar_em_uso(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zerar_dados_marcar_em_uso(uuid) TO service_role;

COMMIT;
