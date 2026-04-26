-- Adicionar colunas categoria e descricao na tabela contas
ALTER TABLE public.contas 
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS descricao TEXT;