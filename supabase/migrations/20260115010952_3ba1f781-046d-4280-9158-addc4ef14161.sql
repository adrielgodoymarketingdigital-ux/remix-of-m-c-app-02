-- Criar tabela de orçamentos
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  numero_orcamento TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  cliente_nome TEXT,
  cliente_telefone TEXT,
  cliente_email TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'expirado', 'convertido')),
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  validade_dias INTEGER NOT NULL DEFAULT 30,
  data_validade TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  termos_condicoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios orçamentos"
ON public.orcamentos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios orçamentos"
ON public.orcamentos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios orçamentos"
ON public.orcamentos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios orçamentos"
ON public.orcamentos FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_orcamentos_updated_at
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar número do orçamento
CREATE OR REPLACE FUNCTION public.generate_orcamento_number()
RETURNS TRIGGER AS $$
DECLARE
  ano TEXT;
  seq INTEGER;
BEGIN
  ano := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_orcamento FROM 5 FOR 6) AS INTEGER)), 0) + 1
  INTO seq
  FROM public.orcamentos
  WHERE numero_orcamento LIKE 'ORC-' || ano || '%'
  AND user_id = NEW.user_id;
  
  NEW.numero_orcamento := 'ORC-' || ano || '-' || LPAD(seq::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para gerar número automaticamente
CREATE TRIGGER generate_orcamento_number_trigger
BEFORE INSERT ON public.orcamentos
FOR EACH ROW
WHEN (NEW.numero_orcamento IS NULL OR NEW.numero_orcamento = '')
EXECUTE FUNCTION public.generate_orcamento_number();

-- Índices
CREATE INDEX idx_orcamentos_user_id ON public.orcamentos(user_id);
CREATE INDEX idx_orcamentos_cliente_id ON public.orcamentos(cliente_id);
CREATE INDEX idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX idx_orcamentos_created_at ON public.orcamentos(created_at DESC);