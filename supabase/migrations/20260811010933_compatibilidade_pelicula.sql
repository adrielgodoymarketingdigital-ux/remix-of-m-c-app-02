-- Compatibilidade de Película: base global (não por loja), leitura para
-- qualquer usuário autenticado, escrita restrita a admin do MecApp
-- (public.has_role(auth.uid(), 'admin'), mesmo mecanismo das telas /admin/*).

CREATE TABLE public.grupos_compatibilidade_pelicula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID
);

CREATE TABLE public.grupo_compatibilidade_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos_compatibilidade_pelicula(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  UNIQUE (grupo_id, marca, modelo)
);

CREATE INDEX idx_grupo_compatibilidade_modelos_grupo_id ON public.grupo_compatibilidade_modelos(grupo_id);
CREATE INDEX idx_grupo_compatibilidade_modelos_marca_modelo ON public.grupo_compatibilidade_modelos(marca, modelo);

ALTER TABLE public.grupos_compatibilidade_pelicula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_compatibilidade_modelos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (todos os clientes do MecApp)
CREATE POLICY "Authenticated users can view coverage groups"
  ON public.grupos_compatibilidade_pelicula FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view coverage models"
  ON public.grupo_compatibilidade_modelos FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: somente admin do MecApp (user_roles.role = 'admin')
CREATE POLICY "Admins can insert coverage groups"
  ON public.grupos_compatibilidade_pelicula FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coverage groups"
  ON public.grupos_compatibilidade_pelicula FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coverage groups"
  ON public.grupos_compatibilidade_pelicula FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert coverage models"
  ON public.grupo_compatibilidade_modelos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coverage models"
  ON public.grupo_compatibilidade_modelos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coverage models"
  ON public.grupo_compatibilidade_modelos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
