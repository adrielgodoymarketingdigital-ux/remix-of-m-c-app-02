-- ====================================================
-- CORREÇÕES DE SEGURANÇA ADICIONAIS
-- ====================================================

-- 1. CORRIGIR FUNÇÃO incrementar_uso_cupom para verificar ownership
-- ====================================================

-- Dropar função existente
DROP FUNCTION IF EXISTS public.incrementar_uso_cupom(uuid);

-- Recriar com verificação de ownership
CREATE OR REPLACE FUNCTION public.incrementar_uso_cupom(cupom_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cupom_user_id uuid;
  current_user_id uuid;
BEGIN
  -- Obter o user_id atual
  current_user_id := auth.uid();
  
  -- Verificar se o cupom pertence ao usuário atual
  SELECT user_id INTO cupom_user_id
  FROM cupons
  WHERE id = cupom_id;
  
  -- Se o cupom não existe ou não pertence ao usuário, não fazer nada
  IF cupom_user_id IS NULL OR cupom_user_id != current_user_id THEN
    RAISE EXCEPTION 'Cupom não encontrado ou acesso não autorizado';
  END IF;
  
  -- Incrementar uso do cupom
  UPDATE cupons 
  SET quantidade_usada = COALESCE(quantidade_usada, 0) + 1,
      updated_at = NOW()
  WHERE id = cupom_id
    AND user_id = current_user_id;
END;
$$;

-- 2. CRIAR VIEW PÚBLICA PARA configuracoes_loja (apenas campos públicos)
-- ====================================================

-- Dropar view se existir
DROP VIEW IF EXISTS public.configuracoes_loja_publico;

-- Criar view que expõe apenas campos necessários para o catálogo público
CREATE VIEW public.configuracoes_loja_publico
WITH (security_invoker = on) AS
SELECT 
  id,
  nome_loja,
  logo_url,
  catalogo_slug,
  catalogo_ativo,
  catalogo_config,
  -- Dados de contato opcionais (se o lojista quiser mostrar)
  whatsapp,
  instagram,
  facebook,
  site,
  cidade,
  estado
  -- Excluídos: user_id, cnpj, cpf, inscricao_estadual, inscricao_municipal, 
  -- razao_social, endereco completo, cep, logradouro, numero, bairro, complemento,
  -- telefone, email, horario_funcionamento
FROM public.configuracoes_loja
WHERE catalogo_ativo = true 
  AND catalogo_slug IS NOT NULL;

-- Remover política pública antiga que expõe todos os campos
DROP POLICY IF EXISTS "Catálogo público - acesso anônimo" ON public.configuracoes_loja;

-- Criar política que bloqueia acesso anônimo direto à tabela base
-- (forçando uso da view)
CREATE POLICY "Apenas usuários autenticados acessam configurações"
ON public.configuracoes_loja
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- GRANT para acesso às views
GRANT SELECT ON public.configuracoes_loja_publico TO anon;
GRANT SELECT ON public.configuracoes_loja_publico TO authenticated;