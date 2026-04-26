-- Corrigir view para usar SECURITY INVOKER ao invés de SECURITY DEFINER
DROP VIEW IF EXISTS public.landing_page_publico;

CREATE VIEW public.landing_page_publico 
WITH (security_invoker = true) AS
SELECT 
  cl.catalogo_slug,
  cl.nome_loja,
  cl.whatsapp,
  cl.endereco,
  cl.cidade,
  cl.estado,
  cl.logo_url,
  cl.catalogo_config,
  cl.landing_page_config,
  cl.landing_page_ativa
FROM public.configuracoes_loja cl
WHERE cl.landing_page_ativa = true
  AND cl.catalogo_slug IS NOT NULL;

-- Permitir acesso público à view
GRANT SELECT ON public.landing_page_publico TO anon;
GRANT SELECT ON public.landing_page_publico TO authenticated;