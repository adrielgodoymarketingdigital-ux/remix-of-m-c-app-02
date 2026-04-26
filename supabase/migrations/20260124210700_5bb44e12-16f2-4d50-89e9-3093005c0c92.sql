-- Criar tabela de novidades
CREATE TABLE public.novidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  conteudo JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout_config JSONB DEFAULT '{}'::jsonb,
  publico_alvo TEXT[] NOT NULL DEFAULT ARRAY['trial', 'basico_mensal', 'basico_anual', 'intermediario_mensal', 'intermediario_anual', 'profissional_mensal', 'profissional_anual', 'admin']::text[],
  ativo BOOLEAN NOT NULL DEFAULT false,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim TIMESTAMPTZ,
  prioridade INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_novidades_ativo ON public.novidades(ativo);
CREATE INDEX idx_novidades_prioridade ON public.novidades(prioridade DESC);
CREATE INDEX idx_novidades_data_inicio ON public.novidades(data_inicio);

-- Trigger para updated_at
CREATE TRIGGER update_novidades_updated_at
  BEFORE UPDATE ON public.novidades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.novidades ENABLE ROW LEVEL SECURITY;

-- Política: Admin pode ver tudo
CREATE POLICY "Admin pode ver todas novidades"
  ON public.novidades
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Política: Admin pode inserir
CREATE POLICY "Admin pode criar novidades"
  ON public.novidades
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política: Admin pode atualizar
CREATE POLICY "Admin pode atualizar novidades"
  ON public.novidades
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Política: Admin pode deletar
CREATE POLICY "Admin pode deletar novidades"
  ON public.novidades
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- View pública para usuários (filtra por ativo e período)
CREATE OR REPLACE VIEW public.novidades_publico AS
SELECT 
  id,
  titulo,
  descricao,
  conteudo,
  layout_config,
  publico_alvo,
  prioridade,
  thumbnail_url,
  data_inicio,
  data_fim,
  created_at
FROM public.novidades
WHERE ativo = true
  AND data_inicio <= now()
  AND (data_fim IS NULL OR data_fim >= now());

-- Política para view: Usuários autenticados podem ver
-- (a filtragem por plano será feita no código)
CREATE POLICY "Usuarios autenticados podem ver novidades publicas"
  ON public.novidades
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND ativo = true
    AND data_inicio <= now()
    AND (data_fim IS NULL OR data_fim >= now())
  );

-- Criar bucket para assets de novidades
INSERT INTO storage.buckets (id, name, public)
VALUES ('novidades-assets', 'novidades-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para novidades-assets
CREATE POLICY "Qualquer um pode ver assets de novidades"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'novidades-assets');

CREATE POLICY "Admin pode fazer upload de assets de novidades"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'novidades-assets' 
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin pode atualizar assets de novidades"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'novidades-assets' 
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin pode deletar assets de novidades"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'novidades-assets' 
    AND public.has_role(auth.uid(), 'admin')
  );