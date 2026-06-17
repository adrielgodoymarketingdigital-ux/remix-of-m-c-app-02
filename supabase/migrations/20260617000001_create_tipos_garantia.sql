
-- Tabela de tipos de garantia (por loja/usuário)
CREATE TABLE public.tipos_garantia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  nome TEXT NOT NULL,
  meses INTEGER NOT NULL CHECK (meses > 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tipos_garantia_empresa_id ON public.tipos_garantia(empresa_id);

-- RLS
ALTER TABLE public.tipos_garantia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tipos_garantia"
  ON public.tipos_garantia FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tipos_garantia"
  ON public.tipos_garantia FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tipos_garantia"
  ON public.tipos_garantia FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tipos_garantia"
  ON public.tipos_garantia FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Funcionarios podem ver tipos_garantia do dono"
  ON public.tipos_garantia FOR SELECT TO authenticated
  USING (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem inserir tipos_garantia para o dono"
  ON public.tipos_garantia FOR INSERT TO authenticated
  WITH CHECK (is_funcionario_of(user_id));
