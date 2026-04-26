-- Add custo_unitario column to vendas table to store cost at time of sale
ALTER TABLE vendas ADD COLUMN custo_unitario NUMERIC DEFAULT 0;

-- Add comment explaining the column purpose
COMMENT ON COLUMN vendas.custo_unitario IS 'Custo unitário do item no momento da venda';