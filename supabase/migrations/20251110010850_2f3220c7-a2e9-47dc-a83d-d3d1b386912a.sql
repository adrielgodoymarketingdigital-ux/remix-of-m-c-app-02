-- Adicionar coluna para armazenar array de URLs de fotos
ALTER TABLE dispositivos 
ADD COLUMN fotos JSONB DEFAULT '[]'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN dispositivos.fotos IS 'Array de URLs das fotos do dispositivo no formato ["url1", "url2", ...]';

-- Migrar foto_url existente para fotos (se houver dados)
UPDATE dispositivos 
SET fotos = jsonb_build_array(foto_url)
WHERE foto_url IS NOT NULL AND foto_url != '';

-- Índice GIN para consultas eficientes em JSONB
CREATE INDEX idx_dispositivos_fotos ON dispositivos USING GIN (fotos);