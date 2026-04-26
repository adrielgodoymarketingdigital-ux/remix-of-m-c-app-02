
-- 1. Create categorias_produtos table
CREATE TABLE public.categorias_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_categorias_produtos_user_id ON public.categorias_produtos (user_id);

ALTER TABLE public.categorias_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categorias" ON public.categorias_produtos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categorias" ON public.categorias_produtos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categorias" ON public.categorias_produtos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categorias" ON public.categorias_produtos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Funcionarios podem ver categorias do dono" ON public.categorias_produtos FOR SELECT TO authenticated USING (is_funcionario_of(user_id));
CREATE POLICY "Funcionarios podem inserir categorias para o dono" ON public.categorias_produtos FOR INSERT TO authenticated WITH CHECK (is_funcionario_of(user_id));

-- 2. Add categoria_id to produtos and pecas
ALTER TABLE public.produtos ADD COLUMN categoria_id uuid REFERENCES public.categorias_produtos(id) ON DELETE SET NULL;
ALTER TABLE public.pecas ADD COLUMN categoria_id uuid REFERENCES public.categorias_produtos(id) ON DELETE SET NULL;

CREATE INDEX idx_produtos_categoria_id ON public.produtos (categoria_id);
CREATE INDEX idx_pecas_categoria_id ON public.pecas (categoria_id);
