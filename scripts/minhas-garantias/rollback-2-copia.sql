-- =====================================================================
-- !!! NÃO RODE. SÓ EM EMERGÊNCIA, e só com o Adriel decidindo. !!!
-- "Minhas garantias" — desfaz o passo 2 (cópia dos dados).
--
-- Apaga SÓ as linhas que a cópia criou (origem tipos_garantia, modelo,
-- termo_global). Não toca nas criadas pela tela (manual, padrao), em
-- tipos_garantia nem em configuracoes_loja (o app de hoje não depende de
-- garantias_loja na fase A). Aborta se alguma linha copiada já estiver em
-- uso por venda ou aparelho (fases B/D) ou tiver sido editada pela tela.
-- Depois disso a cópia pode ser rodada de novo (é idempotente).
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE v_usadas int; v_editadas int;
BEGIN
  SELECT count(*) INTO v_usadas FROM public.garantias_loja g
   WHERE g.origem IN ('tipos_garantia', 'modelo', 'termo_global')
     AND (EXISTS (SELECT 1 FROM public.vendas v WHERE v.garantia_id = g.id)
          OR EXISTS (SELECT 1 FROM public.dispositivos d WHERE d.garantia_padrao_id = g.id));
  SELECT count(*) INTO v_editadas FROM public.garantias_loja g
   WHERE g.origem IN ('tipos_garantia', 'modelo', 'termo_global')
     AND (g.updated_at > g.created_at + interval '1 second' OR g.deleted_at IS NOT NULL);
  IF v_usadas > 0 OR v_editadas > 0 THEN
    RAISE EXCEPTION 'rollback da cópia recusado: % garantias copiadas em uso, % editadas pela tela', v_usadas, v_editadas;
  END IF;
END
$$;

DELETE FROM public.garantias_loja
WHERE origem IN ('tipos_garantia', 'modelo', 'termo_global');

COMMIT;
