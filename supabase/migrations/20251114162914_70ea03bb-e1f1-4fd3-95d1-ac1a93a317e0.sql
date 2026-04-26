-- Garantir que o bucket termos-compra seja público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'termos-compra';

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Todos podem ver termos de compra" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own purchase terms" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own purchase terms" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own purchase terms" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own purchase terms" ON storage.objects;

-- Criar política para acesso público de leitura aos recibos
CREATE POLICY "Acesso público aos recibos de compra"
ON storage.objects FOR SELECT
USING (bucket_id = 'termos-compra');

-- Política para usuários autenticados fazerem upload dos próprios recibos
CREATE POLICY "Usuários podem fazer upload de recibos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'termos-compra' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para usuários autenticados atualizarem os próprios recibos
CREATE POLICY "Usuários podem atualizar próprios recibos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'termos-compra' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para usuários autenticados deletarem os próprios recibos
CREATE POLICY "Usuários podem deletar próprios recibos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'termos-compra' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);