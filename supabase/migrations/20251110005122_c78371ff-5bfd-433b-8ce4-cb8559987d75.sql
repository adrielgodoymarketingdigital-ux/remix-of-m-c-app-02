-- Adicionar coluna para URL da foto principal do dispositivo
ALTER TABLE dispositivos 
ADD COLUMN foto_url TEXT;

-- Adicionar coluna para armazenar checklist de verificação
ALTER TABLE dispositivos 
ADD COLUMN checklist JSONB;

-- Criar índices para melhor performance
CREATE INDEX idx_dispositivos_foto ON dispositivos(foto_url);

-- Comentários para documentação
COMMENT ON COLUMN dispositivos.foto_url IS 'URL da foto principal do dispositivo armazenada no Storage';
COMMENT ON COLUMN dispositivos.checklist IS 'Checklist de verificação do dispositivo no formato {entrada: {item: boolean}, saida: {item: boolean}}';

-- Criar bucket público para fotos de dispositivos
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispositivos-fotos', 'dispositivos-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Política RLS: Usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload device photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dispositivos-fotos');

-- Política RLS: Todos podem visualizar fotos
CREATE POLICY "Anyone can view device photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dispositivos-fotos');

-- Política RLS: Usuários autenticados podem deletar fotos
CREATE POLICY "Authenticated users can delete device photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dispositivos-fotos');

-- Política RLS: Usuários autenticados podem atualizar fotos
CREATE POLICY "Authenticated users can update device photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dispositivos-fotos');