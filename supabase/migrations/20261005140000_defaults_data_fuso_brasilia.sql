-- =====================================================================
-- Defaults de data no dia de Brasília.
--
-- O banco roda em UTC: CURRENT_DATE entre 21h e meia-noite de Brasília já
-- é o dia seguinte. Duas colunas DATE ainda usavam CURRENT_DATE como
-- default:
--   - pagamentos_contas.data_pagamento
--   - compras_dispositivos.data_compra
-- Passam a usar o mesmo default de entradas_estoque.data e
-- extrato_lancamentos_manuais.data: (now() AT TIME ZONE 'America/Sao_Paulo')::date.
--
-- IMPACTO: só muda o valor usado quando um INSERT omitir a coluna (hoje o
-- app sempre envia a data nesses fluxos — o default é a rede de proteção).
-- 100% ADITIVA: nenhuma linha existente é alterada; nada de backfill aqui.
-- Os pagamentos já gravados com o dia trocado ficam para uma análise à
-- parte, caso a caso.
-- =====================================================================

BEGIN;

ALTER TABLE public.pagamentos_contas
  ALTER COLUMN data_pagamento SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);

ALTER TABLE public.compras_dispositivos
  ALTER COLUMN data_compra SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);

COMMIT;
