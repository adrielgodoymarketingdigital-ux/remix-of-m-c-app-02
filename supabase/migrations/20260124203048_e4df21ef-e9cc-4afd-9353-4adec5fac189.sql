-- Adiciona coluna para preço promocional nos dispositivos
ALTER TABLE public.dispositivos 
ADD COLUMN IF NOT EXISTS preco_promocional numeric DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.dispositivos.preco_promocional IS 'Preço promocional para exibição no catálogo';