-- Adicionar coluna para termo de responsabilidade
ALTER TABLE public.configuracoes_loja
ADD COLUMN IF NOT EXISTS termo_responsabilidade_config JSONB DEFAULT NULL;