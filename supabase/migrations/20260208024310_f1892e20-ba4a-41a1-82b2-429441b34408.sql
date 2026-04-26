-- Adicionar campo para configuração de cores personalizadas
ALTER TABLE public.configuracoes_loja 
ADD COLUMN IF NOT EXISTS cores_personalizadas JSONB DEFAULT NULL;