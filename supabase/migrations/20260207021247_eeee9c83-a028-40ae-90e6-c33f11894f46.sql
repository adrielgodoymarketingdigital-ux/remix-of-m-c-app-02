-- Adicionar coluna data_nascimento na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS data_nascimento date;