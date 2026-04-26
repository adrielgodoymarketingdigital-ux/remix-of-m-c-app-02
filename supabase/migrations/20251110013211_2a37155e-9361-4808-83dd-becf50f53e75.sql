-- Adicionar campo quantidade na tabela dispositivos
ALTER TABLE dispositivos 
ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 1;

-- Adicionar constraint para garantir quantidade >= 0
ALTER TABLE dispositivos
ADD CONSTRAINT quantidade_positiva CHECK (quantidade >= 0);

-- Adicionar índice para consultas de estoque
CREATE INDEX idx_dispositivos_quantidade ON dispositivos(quantidade);

-- Comentário para documentação
COMMENT ON COLUMN dispositivos.quantidade IS 'Quantidade em estoque do dispositivo';