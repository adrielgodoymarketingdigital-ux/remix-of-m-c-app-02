-- Recriar políticas de storage que estão ausentes no banco remoto
-- Apenas a política allow_service_role_all existe — todas as demais foram perdidas

-- ===== dispositivos-fotos =====
DROP POLICY IF EXISTS "Authenticated users can upload device photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view device photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete device photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update device photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload device photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dispositivos-fotos');

CREATE POLICY "Anyone can view device photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dispositivos-fotos');

CREATE POLICY "Authenticated users can delete device photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dispositivos-fotos');

CREATE POLICY "Authenticated users can update device photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'dispositivos-fotos');

-- ===== produtos-fotos =====
DROP POLICY IF EXISTS "Authenticated users can upload product photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for product photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload product photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'produtos-fotos');

CREATE POLICY "Public read access for product photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'produtos-fotos');

CREATE POLICY "Users can delete own product photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'produtos-fotos');

-- ===== loja-logos =====
DROP POLICY IF EXISTS "Authenticated users can upload logo" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logo" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logo" ON storage.objects;

CREATE POLICY "Public read access for logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'loja-logos');

CREATE POLICY "Authenticated users can upload logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'loja-logos');

CREATE POLICY "Authenticated users can update logo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'loja-logos');

CREATE POLICY "Authenticated users can delete logo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'loja-logos');

-- ===== compras-fotos =====
DROP POLICY IF EXISTS "Authenticated users can upload compra photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can view compra photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete compra photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update compra photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload compra photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'compras-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can view compra photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'compras-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete compra photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'compras-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ===== compras-documentos =====
DROP POLICY IF EXISTS "Authenticated users can upload compra docs" ON storage.objects;
DROP POLICY IF EXISTS "Owners can view compra docs" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete compra docs" ON storage.objects;

CREATE POLICY "Authenticated users can upload compra docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'compras-documentos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can view compra docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'compras-documentos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete compra docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'compras-documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
