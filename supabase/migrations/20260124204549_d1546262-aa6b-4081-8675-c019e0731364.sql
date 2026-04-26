-- Atualizar view dispositivos_catalogo para incluir quantidade e preco_promocional
DROP VIEW IF EXISTS public.dispositivos_catalogo;

CREATE VIEW public.dispositivos_catalogo 
WITH (security_invoker = true) AS
SELECT 
  d.id,
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
FROM public.dispositivos d
INNER JOIN public.configuracoes_loja cl ON d.user_id = cl.user_id
WHERE cl.catalogo_ativo = true
  AND cl.catalogo_slug IS NOT NULL
  AND d.vendido = false
  AND d.quantidade > 0;

-- Permitir acesso público à view
GRANT SELECT ON public.dispositivos_catalogo TO anon;
GRANT SELECT ON public.dispositivos_catalogo TO authenticated;