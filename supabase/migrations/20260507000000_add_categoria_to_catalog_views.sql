-- Adicionar categoria_id, categoria_nome e categoria_cor nas views de catálogo público
-- para que as categorias de produtos/peças apareçam no link compartilhável

DROP VIEW IF EXISTS public.produtos_catalogo;
CREATE VIEW public.produtos_catalogo AS
SELECT
    p.id,
    'produto'::text AS tipo_item,
    p.nome,
    p.preco,
    p.fotos,
    p.quantidade,
    p.sku,
    p.codigo_barras,
    p.created_at,
    cl.catalogo_slug,
    p.categoria_id,
    cp.nome AS categoria_nome,
    cp.cor  AS categoria_cor
FROM produtos p
JOIN configuracoes_loja cl ON p.user_id = cl.user_id
LEFT JOIN categorias_produtos cp ON cp.id = p.categoria_id AND cp.user_id = p.user_id
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL;

DROP VIEW IF EXISTS public.pecas_catalogo;
CREATE VIEW public.pecas_catalogo AS
SELECT
    p.id,
    'peca'::text AS tipo_item,
    p.nome,
    p.preco,
    p.fotos,
    p.quantidade,
    p.codigo_barras,
    p.created_at,
    cl.catalogo_slug,
    p.categoria_id,
    cp.nome AS categoria_nome,
    cp.cor  AS categoria_cor
FROM pecas p
JOIN configuracoes_loja cl ON p.user_id = cl.user_id
LEFT JOIN categorias_produtos cp ON cp.id = p.categoria_id AND cp.user_id = p.user_id
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL;
