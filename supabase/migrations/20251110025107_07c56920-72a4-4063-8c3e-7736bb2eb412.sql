-- Criar bucket para logos da loja
INSERT INTO storage.buckets (id, name, public) 
VALUES ('loja-logos', 'loja-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket loja-logos
CREATE POLICY "Logos da loja são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'loja-logos');

CREATE POLICY "Usuários autenticados podem fazer upload de logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'loja-logos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Usuários autenticados podem atualizar logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'loja-logos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Usuários autenticados podem deletar logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'loja-logos' 
  AND auth.role() = 'authenticated'
);