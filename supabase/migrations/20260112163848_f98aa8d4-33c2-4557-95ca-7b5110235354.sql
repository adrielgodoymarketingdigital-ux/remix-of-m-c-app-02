-- Adicionar coluna codigo_barras na tabela produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

-- Criar índice para busca eficiente por código de barras
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);