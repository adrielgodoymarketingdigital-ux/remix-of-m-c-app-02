
-- Tabela para serviços avulsos
CREATE TABLE public.servicos_avulsos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  custo NUMERIC NOT NULL DEFAULT 0,
  preco NUMERIC NOT NULL DEFAULT 0,
  lucro NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'finalizado',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.servicos_avulsos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own servicos avulsos"
ON public.servicos_avulsos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own servicos avulsos"
ON public.servicos_avulsos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own servicos avulsos"
ON public.servicos_avulsos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own servicos avulsos"
ON public.servicos_avulsos FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Funcionarios podem ver servicos avulsos do dono"
ON public.servicos_avulsos FOR SELECT
USING (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem inserir servicos avulsos para o dono"
ON public.servicos_avulsos FOR INSERT
WITH CHECK (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem atualizar servicos avulsos do dono"
ON public.servicos_avulsos FOR UPDATE
USING (is_funcionario_of(user_id));

-- Trigger para updated_at
CREATE TRIGGER update_servicos_avulsos_updated_at
BEFORE UPDATE ON public.servicos_avulsos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
