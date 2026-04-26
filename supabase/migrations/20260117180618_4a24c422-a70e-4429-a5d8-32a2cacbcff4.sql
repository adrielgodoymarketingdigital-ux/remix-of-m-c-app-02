-- ====================================================
-- CORREÇÃO DE SEGURANÇA: Criar views para ocultar campos sensíveis
-- ====================================================

-- 1. AVISOS_SISTEMA: Criar view pública que exclui created_by
-- ====================================================

-- Dropar view se existir
DROP VIEW IF EXISTS public.avisos_sistema_publico;

-- Criar view pública que exclui o campo created_by
CREATE VIEW public.avisos_sistema_publico
WITH (security_invoker = on) AS
SELECT 
  id,
  titulo,
  mensagem,
  tipo,
  icone,
  cor_fundo,
  cor_texto,
  cor_icone,
  cor_botao,
  link_url,
  link_texto,
  imagem_url,
  imagem_posicao,
  data_inicio,
  data_fim,
  ativo,
  prioridade,
  publico_alvo,
  created_at,
  updated_at
  -- Excluído: created_by
FROM public.avisos_sistema
WHERE ativo = true 
  AND data_inicio <= now() 
  AND (data_fim IS NULL OR data_fim >= now());

-- Remover política pública antiga que expõe created_by
DROP POLICY IF EXISTS "Avisos ativos são públicos" ON public.avisos_sistema;

-- Criar nova política que nega acesso direto para anônimos
CREATE POLICY "Apenas admins e usuários autenticados acessam avisos"
ON public.avisos_sistema
FOR SELECT
TO authenticated
USING (
  ativo = true 
  AND data_inicio <= now() 
  AND (data_fim IS NULL OR data_fim >= now())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 2. DISPOSITIVOS: Criar view pública para catálogo que exclui user_id
-- ====================================================

-- Dropar view se existir
DROP VIEW IF EXISTS public.dispositivos_catalogo;

-- Criar view pública para o catálogo que exclui user_id
CREATE VIEW public.dispositivos_catalogo
WITH (security_invoker = on) AS
SELECT 
  d.id,
  d.tipo,
  d.marca,
  d.modelo,
  d.cor,
  d.capacidade_gb,
  d.condicao,
  d.preco,
  d.foto_url,
  d.fotos,
  d.garantia,
  d.tempo_garantia,
  d.saude_bateria,
  d.subtipo_computador,
  d.vendido,
  d.created_at,
  -- Incluir slug do catálogo para identificação
  cl.catalogo_slug
  -- Excluídos: user_id, custo, lucro, imei, numero_serie, codigo_barras, checklist, compra_id, fornecedor_id, origem_tipo, quantidade
FROM public.dispositivos d
INNER JOIN public.configuracoes_loja cl ON cl.user_id = d.user_id
WHERE cl.catalogo_ativo = true 
  AND cl.catalogo_slug IS NOT NULL
  AND d.vendido = false
  AND d.preco IS NOT NULL
  AND d.preco > 0;

-- Remover políticas públicas antigas dos dispositivos
DROP POLICY IF EXISTS "Dispositivos do catálogo público" ON public.dispositivos;
DROP POLICY IF EXISTS "Dispositivos do catálogo podem ser visualizados publicamente" ON public.dispositivos;

-- Recriar política apenas para usuários autenticados verem seus próprios dispositivos
-- (A política "Users can select own devices" já deve existir, mas garantimos)
DROP POLICY IF EXISTS "Users can select own devices" ON public.dispositivos;
CREATE POLICY "Users can select own devices"
ON public.dispositivos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. GRANT para acesso anônimo às views
-- ====================================================
GRANT SELECT ON public.avisos_sistema_publico TO anon;
GRANT SELECT ON public.avisos_sistema_publico TO authenticated;
GRANT SELECT ON public.dispositivos_catalogo TO anon;
GRANT SELECT ON public.dispositivos_catalogo TO authenticated;