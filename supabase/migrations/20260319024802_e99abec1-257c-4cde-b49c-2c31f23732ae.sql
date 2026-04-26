
-- Adicionar colunas payment_provider e payment_method na tabela assinaturas
ALTER TABLE public.assinaturas 
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS payment_method TEXT;
