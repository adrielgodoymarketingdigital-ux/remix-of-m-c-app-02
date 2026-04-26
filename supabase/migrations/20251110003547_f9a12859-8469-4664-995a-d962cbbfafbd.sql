-- Adicionar campo para tempo de garantia (em meses)
ALTER TABLE dispositivos 
ADD COLUMN tempo_garantia INTEGER;

-- Adicionar campo para subtipo de computador
ALTER TABLE dispositivos 
ADD COLUMN subtipo_computador TEXT;

-- Adicionar campo para condição do dispositivo
ALTER TABLE dispositivos 
ADD COLUMN condicao TEXT NOT NULL DEFAULT 'novo';

-- Adicionar constraint para validar valores de condição
ALTER TABLE dispositivos
ADD CONSTRAINT condicao_valida 
CHECK (condicao IN ('novo', 'semi_novo', 'usado'));

-- Adicionar índice para busca por condição
CREATE INDEX idx_dispositivos_condicao ON dispositivos(condicao);

-- Comentários para documentação
COMMENT ON COLUMN dispositivos.tempo_garantia IS 'Tempo de garantia em meses';
COMMENT ON COLUMN dispositivos.subtipo_computador IS 'Subtipo quando tipo=Computador: MacBook, iMac, Outro';
COMMENT ON COLUMN dispositivos.condicao IS 'Condição do dispositivo: novo, semi_novo, usado';