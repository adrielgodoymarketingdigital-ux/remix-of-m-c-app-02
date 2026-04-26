-- Adicionar colunas para configuração da landing page
ALTER TABLE public.configuracoes_loja 
ADD COLUMN IF NOT EXISTS landing_page_config jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS landing_page_ativa boolean DEFAULT false;

-- Criar view pública para landing page (apenas dados necessários)
CREATE OR REPLACE VIEW public.landing_page_publico AS
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