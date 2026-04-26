
-- Create a public view for products/parts in catalog (similar to dispositivos_catalogo)
CREATE VIEW public.produtos_catalogo AS
  SELECT p.id, 'produto' as tipo_item, p.nome, p.preco, p.fotos, p.quantidade, p.sku, p.codigo_barras, p.created_at, cl.catalogo_slug
  FROM produtos p
  JOIN configuracoes_loja cl ON p.user_id = cl.user_id
  WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL
    AND p.quantidade > 0;

GRANT SELECT ON public.produtos_catalogo TO anon, authenticated;

-- Create a public view for parts in catalog
CREATE VIEW public.pecas_catalogo AS
  SELECT p.id, 'peca' as tipo_item, p.nome, p.preco, p.fotos, p.quantidade, p.codigo_barras, p.created_at, cl.catalogo_slug
  FROM pecas p
  JOIN configuracoes_loja cl ON p.user_id = cl.user_id
  WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL
    AND p.quantidade > 0;

GRANT SELECT ON public.pecas_catalogo TO anon, authenticated;
