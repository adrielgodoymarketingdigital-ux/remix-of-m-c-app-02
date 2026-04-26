-- Adicionar coluna celular na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular TEXT;