
-- Criar tabela de tutoriais em vídeo
CREATE TABLE public.tutoriais_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  youtube_url text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutoriais_videos ENABLE ROW LEVEL SECURITY;

-- Leitura para todos os usuários autenticados
CREATE POLICY "Usuarios autenticados podem ver tutoriais"
ON public.tutoriais_videos
FOR SELECT
TO authenticated
USING (ativo = true);

-- Admins podem ver todos (incluindo inativos)
CREATE POLICY "Admins podem ver todos tutoriais"
ON public.tutoriais_videos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem inserir
CREATE POLICY "Admins podem inserir tutoriais"
ON public.tutoriais_videos
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem atualizar
CREATE POLICY "Admins podem atualizar tutoriais"
ON public.tutoriais_videos
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem deletar
CREATE POLICY "Admins podem deletar tutoriais"
ON public.tutoriais_videos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
