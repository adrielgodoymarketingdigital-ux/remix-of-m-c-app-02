
-- Add filtro column to crm_estagios for auto-classification
ALTER TABLE public.crm_estagios 
ADD COLUMN filtro jsonb DEFAULT NULL;

-- Add comment explaining the filtro column
COMMENT ON COLUMN public.crm_estagios.filtro IS 'JSON filter config: { "campo": "plano_tipo|status|whatsapp_status|...", "operador": "eq|neq|in|not_in", "valor": "value or [array]" }';
