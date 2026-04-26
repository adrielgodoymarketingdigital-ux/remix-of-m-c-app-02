-- Criar bucket para assets do catálogo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalogo-assets', 
  'catalogo-assets', 
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Política para leitura pública
CREATE POLICY "Imagens do catálogo são públicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'catalogo-assets');

-- Política para upload pelo proprietário
CREATE POLICY "Usuários podem fazer upload de imagens do catálogo" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'catalogo-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para atualização pelo proprietário
CREATE POLICY "Usuários podem atualizar suas imagens do catálogo" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'catalogo-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para deleção pelo proprietário
CREATE POLICY "Usuários podem deletar suas imagens do catálogo" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'catalogo-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);