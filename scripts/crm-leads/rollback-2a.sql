-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM de leads — ROLLBACK da FASE 2A
-- (20261122120000_crm_leads_2a_gasto_meta_anuncio.sql).
--
-- Apaga as 3 funções da 2A e a tabela crm_gasto_meta_anuncio.
-- APAGA DADO: o gasto automático gravado pelo n8n some. Ele não é
-- recuperável pelo banco; depois de reaplicar a 2A, o n8n só repõe a janela
-- dele (últimos 3 dias), a não ser que se rode o workflow com período maior.
--
-- Não mexe em nada das fases 1, 1C e 1D (a 2A não alterou nada delas): o
-- funil, o funil por anúncio, o teste e o gasto informado continuam iguais.
-- Com o código da 2A publicado, o card volta sozinho ao gasto informado
-- (funções inexistentes = linhas novas somem).
--
-- Desligue ANTES o workflow "gasto_meta" do n8n (senão ele recebe 500 a
-- cada envio até a 2A voltar).
--
-- Na ordem geral dos rollbacks, este vem ANTES do rollback-1d.
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

DROP FUNCTION IF EXISTS public.admin_crm_funil_gasto_por_anuncio(date, date);
DROP FUNCTION IF EXISTS public.admin_crm_funil_gasto(date, date);
DROP FUNCTION IF EXISTS public.crm_gravar_gasto_meta(jsonb);
DROP TABLE IF EXISTS public.crm_gasto_meta_anuncio;

COMMIT;
