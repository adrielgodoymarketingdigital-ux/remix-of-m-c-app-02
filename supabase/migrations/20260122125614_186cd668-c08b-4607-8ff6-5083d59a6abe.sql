-- Adicionar coluna para agrupar vendas da mesma transação
ALTER TABLE vendas 
ADD COLUMN IF NOT EXISTS grupo_venda UUID DEFAULT NULL;

-- Adicionar coluna para valor do desconto manual
ALTER TABLE vendas 
ADD COLUMN IF NOT EXISTS valor_desconto_manual NUMERIC DEFAULT 0;

-- Índice para melhorar performance de consultas por grupo
CREATE INDEX IF NOT EXISTS idx_vendas_grupo_venda ON vendas(grupo_venda);