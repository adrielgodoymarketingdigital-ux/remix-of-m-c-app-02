-- Criar tabela de avisos do sistema
CREATE TABLE public.avisos_sistema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  icone TEXT DEFAULT NULL,
  link_url TEXT DEFAULT NULL,
  link_texto TEXT DEFAULT NULL,
  publico_alvo TEXT[] NOT NULL DEFAULT ARRAY['todos']::TEXT[],
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fim TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  prioridade INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID DEFAULT NULL
);

-- Habilitar RLS
ALTER TABLE public.avisos_sistema ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ver avisos ativos (para a dashboard)
CREATE POLICY "Avisos ativos são públicos"
ON public.avisos_sistema
FOR SELECT
USING (
  ativo = true 
  AND data_inicio <= now() 
  AND (data_fim IS NULL OR data_fim >= now())
);

-- Política: Admins podem ver todos os avisos
CREATE POLICY "Admins podem ver todos os avisos"
ON public.avisos_sistema
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Política: Admins podem inserir avisos
CREATE POLICY "Admins podem criar avisos"
ON public.avisos_sistema
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Política: Admins podem atualizar avisos
CREATE POLICY "Admins podem atualizar avisos"
ON public.avisos_sistema
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Política: Admins podem deletar avisos
CREATE POLICY "Admins podem deletar avisos"
ON public.avisos_sistema
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_avisos_sistema_updated_at
BEFORE UPDATE ON public.avisos_sistema
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();