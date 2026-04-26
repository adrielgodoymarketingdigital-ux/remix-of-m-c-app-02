-- Criar enum para tipo de feedback
CREATE TYPE public.tipo_feedback AS ENUM ('sugestao', 'reclamacao', 'melhoria');

-- Criar enum para status de feedback
CREATE TYPE public.status_feedback AS ENUM ('pendente', 'em_analise', 'resolvido', 'arquivado');

-- Criar enum para status de conversa de suporte
CREATE TYPE public.status_conversa_suporte AS ENUM ('aberta', 'em_atendimento', 'resolvida', 'fechada');

-- Criar tabela de feedbacks
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo public.tipo_feedback NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status public.status_feedback NOT NULL DEFAULT 'pendente',
  resposta_admin TEXT,
  respondido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de conversas de suporte
CREATE TABLE public.conversas_suporte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assunto TEXT NOT NULL,
  status public.status_conversa_suporte NOT NULL DEFAULT 'aberta',
  atendido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de mensagens de suporte
CREATE TABLE public.mensagens_suporte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.conversas_suporte(id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES auth.users(id),
  mensagem TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_suporte ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para feedbacks
CREATE POLICY "Usuarios podem ver seus proprios feedbacks"
ON public.feedbacks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem criar seus proprios feedbacks"
ON public.feedbacks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os feedbacks"
ON public.feedbacks
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar todos os feedbacks"
ON public.feedbacks
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para conversas_suporte
CREATE POLICY "Usuarios podem ver suas proprias conversas"
ON public.conversas_suporte
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem criar suas proprias conversas"
ON public.conversas_suporte
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as conversas"
ON public.conversas_suporte
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar todas as conversas"
ON public.conversas_suporte
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para mensagens_suporte
CREATE POLICY "Usuarios podem ver mensagens das suas conversas"
ON public.mensagens_suporte
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_suporte c
    WHERE c.id = conversa_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Usuarios podem criar mensagens nas suas conversas"
ON public.mensagens_suporte
FOR INSERT
WITH CHECK (
  auth.uid() = remetente_id AND
  EXISTS (
    SELECT 1 FROM public.conversas_suporte c
    WHERE c.id = conversa_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins podem ver todas as mensagens"
ON public.mensagens_suporte
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar mensagens em qualquer conversa"
ON public.mensagens_suporte
FOR INSERT
WITH CHECK (
  auth.uid() = remetente_id AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins podem atualizar mensagens"
ON public.mensagens_suporte
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers para updated_at
CREATE TRIGGER update_feedbacks_updated_at
BEFORE UPDATE ON public.feedbacks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversas_suporte_updated_at
BEFORE UPDATE ON public.conversas_suporte
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime para chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_suporte;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas_suporte;