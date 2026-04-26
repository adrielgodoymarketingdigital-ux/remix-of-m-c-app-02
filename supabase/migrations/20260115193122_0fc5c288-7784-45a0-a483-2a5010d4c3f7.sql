-- Remover políticas existentes de catálogo público
DROP POLICY IF EXISTS "Catálogo público pode ser visualizado por qualquer pessoa" ON public.configuracoes_loja;

-- Criar política PERMISSIVA para acesso público ao catálogo
CREATE POLICY "Catálogo público - acesso anônimo" 
ON public.configuracoes_loja 
FOR SELECT 
TO anon
USING (catalogo_ativo = true AND catalogo_slug IS NOT NULL);

-- Criar política para dispositivos serem visíveis publicamente quando o catálogo está ativo
CREATE POLICY "Dispositivos do catálogo público" 
ON public.dispositivos 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.configuracoes_loja 
    WHERE configuracoes_loja.user_id = dispositivos.user_id 
    AND configuracoes_loja.catalogo_ativo = true 
    AND configuracoes_loja.catalogo_slug IS NOT NULL
  )
);