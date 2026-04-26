-- Adicionar campo codigo_barras na tabela dispositivos
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

-- Adicionar campo codigo_barras na tabela pecas
ALTER TABLE pecas ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

-- Criar indices para buscas rapidas
CREATE INDEX IF NOT EXISTS idx_dispositivos_codigo_barras ON dispositivos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_pecas_codigo_barras ON pecas(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku);