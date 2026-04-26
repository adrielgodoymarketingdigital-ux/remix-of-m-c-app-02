-- Adicionar coluna CNPJ na tabela clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cnpj TEXT;