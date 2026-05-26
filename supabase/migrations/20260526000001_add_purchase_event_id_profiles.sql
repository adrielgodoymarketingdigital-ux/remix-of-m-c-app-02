-- Adiciona coluna purchase_event_id na tabela profiles para deduplicação
-- do evento Purchase entre Meta Pixel (front) e CAPI (server-side via webhook).
-- A coluna pode já existir no banco de produção (criada manualmente);
-- o IF NOT EXISTS garante idempotência.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purchase_event_id text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.purchase_event_id IS
  'ID único do evento Purchase gerado pelo webhook da Pagar.me, usado para deduplicação entre o Meta Pixel (client-side) e a CAPI (server-side).';
