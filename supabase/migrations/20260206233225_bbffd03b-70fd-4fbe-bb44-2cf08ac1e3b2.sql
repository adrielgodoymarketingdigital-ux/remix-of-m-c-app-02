-- Tabela para gerenciar funcionários das lojas
CREATE TABLE public.loja_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_user_id UUID NOT NULL,
  funcionario_user_id UUID,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  permissoes JSONB NOT NULL DEFAULT '{
    "modulos": {
      "dashboard": true,
      "pdv": false,
      "ordem_servico": false,
      "produtos_pecas": false,
      "servicos": false,
      "dispositivos": false,
      "catalogo": false,
      "origem_dispositivos": false,
      "fornecedores": false,
      "clientes": false,
      "orcamentos": false,
      "contas": false,
      "vendas": false,
      "relatorios": false,
      "financeiro": false,
      "configuracoes": false,
      "equipe": false,
      "plano": false,
      "suporte": true,
      "novidades": true
    },
    "recursos": {
      "ver_custos": false,
      "ver_lucros": false
    }
  }'::jsonb,
  convite_token TEXT,
  convite_expira_em TIMESTAMPTZ,
  convite_aceito_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loja_user_id, email)
);

-- Enable RLS
ALTER TABLE public.loja_funcionarios ENABLE ROW LEVEL SECURITY;

-- Policy: Donos podem gerenciar seus funcionários
CREATE POLICY "Donos gerenciam funcionarios"
ON public.loja_funcionarios
FOR ALL
TO authenticated
USING (loja_user_id = auth.uid());

-- Policy: Funcionários podem ver seu próprio registro
CREATE POLICY "Funcionarios veem proprio registro"
ON public.loja_funcionarios
FOR SELECT
TO authenticated
USING (funcionario_user_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_loja_funcionarios_updated_at
BEFORE UPDATE ON public.loja_funcionarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar se usuário é funcionário e retornar o loja_user_id
CREATE OR REPLACE FUNCTION public.get_loja_owner_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
BEGIN
  -- Primeiro verifica se é funcionário
  SELECT loja_user_id INTO owner_id
  FROM public.loja_funcionarios
  WHERE funcionario_user_id = auth.uid()
    AND ativo = true
  LIMIT 1;
  
  -- Se for funcionário, retorna o ID do dono
  IF owner_id IS NOT NULL THEN
    RETURN owner_id;
  END IF;
  
  -- Senão, retorna o próprio ID (é o dono)
  RETURN auth.uid();
END;
$$;