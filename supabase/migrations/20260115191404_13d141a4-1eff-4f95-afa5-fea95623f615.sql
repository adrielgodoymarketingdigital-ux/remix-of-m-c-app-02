-- Adicionar campos para catálogo público na tabela configuracoes_loja
ALTER TABLE public.configuracoes_loja
ADD COLUMN IF NOT EXISTS catalogo_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS catalogo_config JSONB DEFAULT '{"templateId": "tecnologico", "textos": {"tituloCapa": "Catálogo de Dispositivos", "subtituloCapa": "Celulares, Tablets e Eletrônicos", "textoGarantia": "Garantia de {tempo}", "textoPreco": "A partir de", "textoContato": "Entre em contato para mais informações", "rodape": "Atualizado em {data}"}, "mostrarPrecos": true, "mostrarGarantia": true, "mostrarBateria": true, "mostrarQuantidade": true, "mostrarCondicao": true, "mostrarCapacidade": true, "mostrarCor": true, "mostrarIMEI": false, "mostrarNumeroSerie": false, "itensPerPage": 6, "layoutGrid": "2x3", "mostrarLogo": true, "mostrarContato": true, "mostrarRodape": true}'::jsonb,
ADD COLUMN IF NOT EXISTS catalogo_ativo BOOLEAN DEFAULT false;

-- Criar índice para busca rápida por slug
CREATE INDEX IF NOT EXISTS idx_configuracoes_loja_catalogo_slug ON public.configuracoes_loja(catalogo_slug) WHERE catalogo_slug IS NOT NULL;

-- Função para gerar slug único
CREATE OR REPLACE FUNCTION public.gerar_catalogo_slug(nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  slug_base TEXT;
  slug_final TEXT;
  contador INT := 0;
BEGIN
  -- Normalizar o nome para slug
  slug_base := lower(
    regexp_replace(
      regexp_replace(
        translate(nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiioooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
        '[^a-zA-Z0-9]+', '-', 'g'
      ),
      '^-+|-+$', '', 'g'
    )
  );
  
  slug_final := slug_base;
  
  -- Verificar unicidade e adicionar número se necessário
  WHILE EXISTS (SELECT 1 FROM public.configuracoes_loja WHERE catalogo_slug = slug_final) LOOP
    contador := contador + 1;
    slug_final := slug_base || '-' || contador;
  END LOOP;
  
  RETURN slug_final;
END;
$$;

-- Criar policy para acesso público ao catálogo (apenas leitura de dados públicos)
CREATE POLICY "Catálogo público pode ser visualizado por qualquer pessoa"
ON public.configuracoes_loja
FOR SELECT
USING (catalogo_ativo = true AND catalogo_slug IS NOT NULL);

-- Criar policy para acesso público aos dispositivos do catálogo
CREATE POLICY "Dispositivos do catálogo podem ser visualizados publicamente"
ON public.dispositivos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.configuracoes_loja 
    WHERE configuracoes_loja.user_id = dispositivos.user_id 
    AND configuracoes_loja.catalogo_ativo = true 
    AND configuracoes_loja.catalogo_slug IS NOT NULL
  )
  AND quantidade > 0 
  AND (vendido IS NULL OR vendido = false)
);