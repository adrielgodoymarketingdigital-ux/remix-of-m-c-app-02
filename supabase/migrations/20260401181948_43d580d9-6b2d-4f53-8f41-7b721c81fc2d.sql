ALTER TABLE public.configuracoes_loja 
ADD COLUMN IF NOT EXISTS layout_dispositivos_config jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS termo_garantia_dispositivo_config jsonb DEFAULT NULL;