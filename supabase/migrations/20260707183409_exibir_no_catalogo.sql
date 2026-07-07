-- Adiciona controle de exibição no catálogo público para dispositivos, produtos e peças.
-- exibir_no_catalogo = false permite ocultar um item do catálogo público (/c/:slug)
-- sem removê-lo do estoque interno.

ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS exibir_no_catalogo boolean NOT NULL DEFAULT true;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS exibir_no_catalogo boolean NOT NULL DEFAULT true;
ALTER TABLE public.pecas ADD COLUMN IF NOT EXISTS exibir_no_catalogo boolean NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public.dispositivos_catalogo;
CREATE VIEW public.dispositivos_catalogo AS
SELECT d.id,
    d.tipo,
    d.marca,
    d.modelo,
    d.cor,
    d.capacidade_gb,
    d.condicao,
    d.preco,
    d.preco_promocional,
    d.foto_url,
    d.fotos,
    d.garantia,
    d.tempo_garantia,
    d.saude_bateria,
    d.subtipo_computador,
    d.vendido,
    d.quantidade,
    d.created_at,
    cl.catalogo_slug
FROM dispositivos d
JOIN configuracoes_loja cl ON d.user_id = cl.user_id
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL AND d.vendido = false
    AND d.exibir_no_catalogo = true;

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
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL
    AND p.exibir_no_catalogo = true;

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
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL
    AND p.exibir_no_catalogo = true;
