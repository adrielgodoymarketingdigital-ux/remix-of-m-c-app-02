
-- Recreate views WITHOUT security_invoker so anonymous users can access the public catalog

DROP VIEW IF EXISTS public.produtos_catalogo;
CREATE VIEW public.produtos_catalogo AS
SELECT p.id,
    'produto'::text AS tipo_item,
    p.nome,
    p.preco,
    p.fotos,
    p.quantidade,
    p.sku,
    p.codigo_barras,
    p.created_at,
    cl.catalogo_slug
FROM produtos p
JOIN configuracoes_loja cl ON p.user_id = cl.user_id
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL;

DROP VIEW IF EXISTS public.pecas_catalogo;
CREATE VIEW public.pecas_catalogo AS
SELECT p.id,
    'peca'::text AS tipo_item,
    p.nome,
    p.preco,
    p.fotos,
    p.quantidade,
    p.codigo_barras,
    p.created_at,
    cl.catalogo_slug
FROM pecas p
JOIN configuracoes_loja cl ON p.user_id = cl.user_id
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL;

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
WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL AND d.vendido = false;
