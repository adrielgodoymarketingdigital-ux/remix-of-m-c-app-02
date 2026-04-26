-- Adicionar campos para documentos do vendedor na tabela compras_dispositivos
ALTER TABLE public.compras_dispositivos
ADD COLUMN IF NOT EXISTS documento_vendedor_frente TEXT,
ADD COLUMN IF NOT EXISTS documento_vendedor_verso TEXT;

-- Criar bucket para documentos de compra se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('compras-documentos', 'compras-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o bucket de documentos
CREATE POLICY "Usuários autenticados podem fazer upload de documentos de compra"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'compras-documentos');

CREATE POLICY "Usuários autenticados podem deletar seus documentos de compra"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'compras-documentos');

CREATE POLICY "Documentos de compra são publicamente acessíveis"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'compras-documentos');