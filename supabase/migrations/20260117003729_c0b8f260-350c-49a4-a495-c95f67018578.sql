-- Criar bucket para armazenar imagens dos avisos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avisos-imagens', 'avisos-imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Política para leitura pública
CREATE POLICY "Imagens de avisos são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'avisos-imagens');

-- Política para admins inserirem imagens
CREATE POLICY "Admins podem inserir imagens de avisos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avisos-imagens' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Política para admins atualizarem imagens
CREATE POLICY "Admins podem atualizar imagens de avisos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avisos-imagens' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Política para admins excluírem imagens
CREATE POLICY "Admins podem excluir imagens de avisos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avisos-imagens' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);