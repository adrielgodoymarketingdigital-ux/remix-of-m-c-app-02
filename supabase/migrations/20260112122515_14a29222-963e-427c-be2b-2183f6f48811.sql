-- Adicionar colunas para soft-delete de vendas
ALTER TABLE vendas 
ADD COLUMN IF NOT EXISTS cancelada boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_cancelamento timestamp with time zone,
ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
ADD COLUMN IF NOT EXISTS estorno_estoque boolean DEFAULT false;

-- Criar política de UPDATE para vendas (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vendas' AND policyname = 'Users can update own sales'
  ) THEN
    CREATE POLICY "Users can update own sales"
    ON vendas FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;