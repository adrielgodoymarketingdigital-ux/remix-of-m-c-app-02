
-- Make compras-documentos and compras-fotos buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('compras-documentos', 'compras-fotos');

-- Drop existing public SELECT policies for these buckets
DROP POLICY IF EXISTS "Documentos de compra são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de compras são públicas para visualização" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de compra são públicas para visualização" ON storage.objects;
DROP POLICY IF EXISTS "Documentos são públicos para visualização" ON storage.objects;
DROP POLICY IF EXISTS "Public read compras-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Public read compras-fotos" ON storage.objects;
DROP POLICY IF EXISTS "compras-documentos public select" ON storage.objects;
DROP POLICY IF EXISTS "compras-fotos public select" ON storage.objects;

-- Add owner-scoped SELECT policies
CREATE POLICY "Owner can view own compras-documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'compras-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can view own compras-fotos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'compras-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);
