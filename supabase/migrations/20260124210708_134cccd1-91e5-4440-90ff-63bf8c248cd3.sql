-- Corrigir view para usar SECURITY INVOKER (padrão mais seguro)
DROP VIEW IF EXISTS public.novidades_publico;

CREATE VIEW public.novidades_publico 
WITH (security_invoker = true)
AS
SELECT 
  id,
  titulo,
  descricao,
  conteudo,
  layout_config,
  publico_alvo,
  prioridade,
  thumbnail_url,
  data_inicio,
  data_fim,
  created_at
FROM public.novidades
WHERE ativo = true
  AND data_inicio <= now()
  AND (data_fim IS NULL OR data_fim >= now());