-- Corrigir políticas de storage com verificação de usuário
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos de compras" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias fotos de compras" ON storage.objects;

-- Política de upload mais restritiva
CREATE POLICY "Upload fotos compras por usuário autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compras-fotos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de delete mais restritiva
CREATE POLICY "Delete fotos compras pelo dono"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'compras-fotos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);