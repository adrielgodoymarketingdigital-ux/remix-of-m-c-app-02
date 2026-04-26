
-- Recriar configuracoes_loja_publico sem security_invoker
DROP VIEW IF EXISTS public.configuracoes_loja_publico;
CREATE VIEW public.configuracoes_loja_publico AS
  SELECT id, nome_loja, logo_url, catalogo_slug, catalogo_ativo,
         catalogo_config, whatsapp, instagram, facebook, site, cidade, estado
  FROM configuracoes_loja
  WHERE catalogo_ativo = true AND catalogo_slug IS NOT NULL;

GRANT SELECT ON public.configuracoes_loja_publico TO anon, authenticated;

-- Recriar dispositivos_catalogo sem security_invoker
DROP VIEW IF EXISTS public.dispositivos_catalogo;
CREATE VIEW public.dispositivos_catalogo AS
  SELECT d.id, d.tipo, d.marca, d.modelo, d.cor, d.capacidade_gb,
         d.condicao, d.preco, d.preco_promocional, d.foto_url, d.fotos,
         d.garantia, d.tempo_garantia, d.saude_bateria, d.subtipo_computador,
         d.vendido, d.quantidade, d.created_at, cl.catalogo_slug
  FROM dispositivos d
  JOIN configuracoes_loja cl ON d.user_id = cl.user_id
  WHERE cl.catalogo_ativo = true AND cl.catalogo_slug IS NOT NULL
    AND d.vendido = false AND d.quantidade > 0;

GRANT SELECT ON public.dispositivos_catalogo TO anon, authenticated;

-- Recriar landing_page_publico sem security_invoker
DROP VIEW IF EXISTS public.landing_page_publico;
CREATE VIEW public.landing_page_publico AS
  SELECT catalogo_config, landing_page_config, landing_page_ativa,
         catalogo_slug, nome_loja, whatsapp, endereco, cidade, estado, logo_url
  FROM configuracoes_loja
  WHERE landing_page_ativa = true AND catalogo_slug IS NOT NULL;

GRANT SELECT ON public.landing_page_publico TO anon, authenticated;
