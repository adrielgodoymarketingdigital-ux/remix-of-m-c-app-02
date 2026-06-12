-- Recriar bucket e políticas do catalogo-assets (perdidas no banco remoto)

-- Garantir que o bucket existe (ignora se já existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalogo-assets',
  'catalogo-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas antigas (podem estar com nome diferente ou ausentes)
DROP POLICY IF EXISTS "Imagens do catálogo são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem fazer upload de imagens do catálogo" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar suas imagens do catálogo" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas imagens do catálogo" ON storage.objects;
DROP POLICY IF EXISTS "Public read catalogo-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload catalogo-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update catalogo-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete catalogo-assets" ON storage.objects;

-- Leitura pública (catálogo é público)
CREATE POLICY "Public read catalogo-assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'catalogo-assets');

-- Upload por qualquer usuário autenticado (sem restrição de pasta)
CREATE POLICY "Authenticated upload catalogo-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalogo-assets');

-- Atualização por qualquer usuário autenticado
CREATE POLICY "Authenticated update catalogo-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'catalogo-assets');

-- Deleção por qualquer usuário autenticado
CREATE POLICY "Authenticated delete catalogo-assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'catalogo-assets');
