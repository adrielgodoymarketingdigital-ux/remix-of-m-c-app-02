-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM de leads — ROLLBACK do RELATÓRIO DE MARKETING
-- (20261123120000_crm_leads_relatorio_marketing.sql).
--
-- Apaga só as 3 funções novas. Não apaga dado nenhum (elas só leem) e não
-- mexe em nada das fases 1, 1C, 1D, 2A nem no /admin/marketing.
--
-- Desligue ANTES os workflows de relatório semanal/mensal do n8n: sem a
-- função, a ação relatorio_marketing responde 500 (codigo PGRST202).
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

DROP FUNCTION IF EXISTS public.crm_relatorio_marketing(date, date);
DROP FUNCTION IF EXISTS public._crm_rel_funil(date, date);
DROP FUNCTION IF EXISTS public._crm_rel_cadastros(date, date);

COMMIT;
