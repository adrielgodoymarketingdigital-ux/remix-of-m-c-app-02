-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM de leads (fase 1) — ROLLBACK do SQL 1 (estrutura). APAGA os leads,
-- as mensagens, o gasto informado e a lista de OPT-OUT (quem pediu para
-- parar). Rodar DEPOIS do rollback-3 e do rollback-2.
--
-- Trava: recusa se houver qualquer lead ou gasto informado. Para apagar
-- mesmo assim, exporte antes (principalmente os opt-outs) e troque
-- 'NAO' por 'SIM' na linha marcada.
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE
  v_confirmo_apagar_dados text := 'NAO';   -- <<< linha marcada
  v_leads bigint := 0;
  v_gasto bigint := 0;
BEGIN
  IF to_regclass('public.crm_leads') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.crm_leads' INTO v_leads;
  END IF;
  IF to_regclass('public.crm_gasto_manual') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.crm_gasto_manual' INTO v_gasto;
  END IF;
  IF (v_leads > 0 OR v_gasto > 0) AND v_confirmo_apagar_dados <> 'SIM' THEN
    RAISE EXCEPTION 'rollback-1 recusado: % leads e % lançamentos de gasto seriam apagados (inclui opt-outs). Exporte e confirme.', v_leads, v_gasto;
  END IF;
END $$;
DROP TABLE IF EXISTS public.crm_lead_mensagens;
DROP TABLE IF EXISTS public.crm_leads;
DROP TABLE IF EXISTS public.crm_gasto_manual;
DROP TABLE IF EXISTS public.crm_campanhas_whatsapp;
DROP FUNCTION IF EXISTS public.crm_eh_opt_out(text);
DROP FUNCTION IF EXISTS public.crm_normalizar_telefone(text);
COMMIT;
