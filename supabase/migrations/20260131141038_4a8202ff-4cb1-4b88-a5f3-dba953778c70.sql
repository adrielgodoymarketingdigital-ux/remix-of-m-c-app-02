-- Adicionar coluna fotos nas tabelas produtos e pecas
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.pecas 
ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]'::jsonb;

-- Criar bucket para fotos de produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos-fotos', 'produtos-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Política para usuários autenticados fazerem upload
CREATE POLICY "Authenticated users can upload product photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'produtos-fotos');

-- Política para acesso público de leitura
CREATE POLICY "Public read access for product photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'produtos-fotos');

-- Política para usuários poderem deletar suas próprias fotos
CREATE POLICY "Users can delete own product photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'produtos-fotos');