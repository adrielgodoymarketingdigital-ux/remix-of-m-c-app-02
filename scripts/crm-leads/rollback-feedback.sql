-- =====================================================================
-- !!! NÃO RODE — SÓ EM EMERGÊNCIA !!!
-- CRM — ROLLBACK da PESQUISA DE FEEDBACK COM PAGANTES
-- (20261122130000_crm_feedback_pagantes.sql).
--
-- Apaga as 2 funções e a tabela crm_contato_campanha.
-- APAGA DADO: some o registro de quem já recebeu. Ao reaplicar, a PAUSA
-- entre campanhas recomeça do zero e quem já recebeu volta para a lista.
-- Antes de rodar, guarde o resultado de feedback-2-quem-recebeu.sql e
-- NÃO dispare campanha nova até a pausa (120 dias) passar.
--
-- Desligue ANTES o workflow de feedback do n8n (senão ele recebe 500).
-- Não mexe em nada das fases 1, 1C, 1D e 2A (esta migration não alterou nada delas).
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

DROP FUNCTION IF EXISTS public.crm_pagantes_contato(text, integer, integer, uuid[]);
DROP FUNCTION IF EXISTS public.crm_contato_registrar(text, jsonb);
DROP TABLE IF EXISTS public.crm_contato_campanha;

COMMIT;
