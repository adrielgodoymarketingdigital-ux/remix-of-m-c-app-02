-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM de leads (fase 1) — ROLLBACK do SQL 2 (gravação).
-- Tira as funções que a Edge Function crm-leads chama: a partir daqui ela
-- responde 500 e o n8n deve ser pausado. Tabelas e dados ficam.
-- Rodar DEPOIS do rollback-3.
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DROP FUNCTION IF EXISTS public.crm_relatorio_diario(date);
DROP FUNCTION IF EXISTS public.crm_aplicar_retencao();
DROP FUNCTION IF EXISTS public.crm_vincular_cadastros(integer);
DROP FUNCTION IF EXISTS public.crm_vincular_usuario(text, uuid);
DROP FUNCTION IF EXISTS public._crm_profile_elegivel(uuid);
DROP FUNCTION IF EXISTS public.crm_registrar_opt_out(text, text);
DROP FUNCTION IF EXISTS public.crm_atualizar_resumo(jsonb);
DROP FUNCTION IF EXISTS public.crm_ingerir_mensagens(jsonb);
COMMIT;
