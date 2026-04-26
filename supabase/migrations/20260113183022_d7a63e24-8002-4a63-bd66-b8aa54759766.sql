-- Adicionar colunas para fotos e assinaturas na tabela compras_dispositivos
ALTER TABLE public.compras_dispositivos
ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS assinatura_vendedor TEXT,
ADD COLUMN IF NOT EXISTS assinatura_vendedor_ip TEXT,
ADD COLUMN IF NOT EXISTS assinatura_vendedor_data TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assinatura_cliente TEXT,
ADD COLUMN IF NOT EXISTS assinatura_cliente_ip TEXT,
ADD COLUMN IF NOT EXISTS assinatura_cliente_data TIMESTAMPTZ;

-- Criar bucket para fotos de compras
INSERT INTO storage.buckets (id, name, public)
VALUES ('compras-fotos', 'compras-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket compras-fotos
CREATE POLICY "Usuários autenticados podem fazer upload de fotos de compras"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'compras-fotos');

CREATE POLICY "Usuários podem ver suas próprias fotos de compras"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'compras-fotos');

CREATE POLICY "Fotos de compras são públicas para visualização"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'compras-fotos');

CREATE POLICY "Usuários podem deletar suas próprias fotos de compras"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'compras-fotos');