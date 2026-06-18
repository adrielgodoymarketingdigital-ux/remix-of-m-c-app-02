
-- Tabela de trocas em garantia (produto defeituoso devolvido -> produto novo entregue)
CREATE TABLE public.trocas_garantia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  venda_id UUID REFERENCES public.vendas(id),
  cliente_nome TEXT,
  produto_defeituoso_nome TEXT NOT NULL,
  motivo_defeito TEXT,
  produto_novo_id UUID NOT NULL REFERENCES public.produtos(id),
  produto_novo_nome TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_trocas_garantia_empresa_id ON public.trocas_garantia(empresa_id);
CREATE INDEX idx_trocas_garantia_user_id ON public.trocas_garantia(user_id);

-- RLS
ALTER TABLE public.trocas_garantia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trocas_garantia"
  ON public.trocas_garantia FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trocas_garantia"
  ON public.trocas_garantia FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trocas_garantia"
  ON public.trocas_garantia FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trocas_garantia"
  ON public.trocas_garantia FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Funcionarios podem ver trocas_garantia do dono"
  ON public.trocas_garantia FOR SELECT TO authenticated
  USING (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem inserir trocas_garantia para o dono"
  ON public.trocas_garantia FOR INSERT TO authenticated
  WITH CHECK (is_funcionario_of(user_id));
