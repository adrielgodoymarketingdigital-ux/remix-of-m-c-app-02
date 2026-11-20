-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM de leads (fase 1) — ROLLBACK do SQL 3 (funil e gasto do admin).
-- Tira só as funções do SQL 3; tabelas e dados ficam. O card do
-- /admin/marketing passa a mostrar "não foi possível carregar".
-- Ordem dos rollbacks: 3, depois 2, depois 1.
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DROP FUNCTION IF EXISTS public.admin_crm_gasto_remover(bigint);
DROP FUNCTION IF EXISTS public.admin_crm_gasto_informar(date, date, numeric, text, text);
DROP FUNCTION IF EXISTS public.admin_crm_funil_por_anuncio(date, date);
DROP FUNCTION IF EXISTS public.admin_crm_funil(date, date);
DROP FUNCTION IF EXISTS public._crm_pagantes(uuid[]);
COMMIT;
