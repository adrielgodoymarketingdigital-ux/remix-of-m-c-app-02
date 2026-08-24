-- Adiciona o campo opcional "IMEI 2" (segundo chip) aos dispositivos.
-- Nullable: não quebra dispositivos já cadastrados.
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS imei2 text;
