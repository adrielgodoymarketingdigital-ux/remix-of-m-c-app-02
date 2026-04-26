
-- Tabela de tipos de serviço (por loja/usuário)
CREATE TABLE public.tipos_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tipos_servico"
  ON public.tipos_servico FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tipos_servico"
  ON public.tipos_servico FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tipos_servico"
  ON public.tipos_servico FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tipos_servico"
  ON public.tipos_servico FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Funcionarios podem ver tipos_servico do dono"
  ON public.tipos_servico FOR SELECT TO authenticated
  USING (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem inserir tipos_servico para o dono"
  ON public.tipos_servico FOR INSERT TO authenticated
  WITH CHECK (is_funcionario_of(user_id));

-- Tabela de comissão por tipo de serviço por funcionário
CREATE TABLE public.comissoes_tipo_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.loja_funcionarios(id) ON DELETE CASCADE,
  tipo_servico_id UUID NOT NULL REFERENCES public.tipos_servico(id) ON DELETE CASCADE,
  comissao_tipo TEXT NOT NULL DEFAULT 'porcentagem',
  comissao_valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, tipo_servico_id)
);

-- RLS
ALTER TABLE public.comissoes_tipo_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comissoes of own funcionarios"
  ON public.comissoes_tipo_servico FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loja_funcionarios lf
      WHERE lf.id = comissoes_tipo_servico.funcionario_id
      AND lf.loja_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comissoes for own funcionarios"
  ON public.comissoes_tipo_servico FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loja_funcionarios lf
      WHERE lf.id = comissoes_tipo_servico.funcionario_id
      AND lf.loja_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update comissoes of own funcionarios"
  ON public.comissoes_tipo_servico FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loja_funcionarios lf
      WHERE lf.id = comissoes_tipo_servico.funcionario_id
      AND lf.loja_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete comissoes of own funcionarios"
  ON public.comissoes_tipo_servico FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loja_funcionarios lf
      WHERE lf.id = comissoes_tipo_servico.funcionario_id
      AND lf.loja_user_id = auth.uid()
    )
  );

CREATE POLICY "Funcionarios podem ver proprias comissoes"
  ON public.comissoes_tipo_servico FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loja_funcionarios lf
      WHERE lf.id = comissoes_tipo_servico.funcionario_id
      AND lf.funcionario_user_id = auth.uid()
    )
  );

-- Adicionar coluna tipo_servico_id na ordens_servico
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tipo_servico_id UUID REFERENCES public.tipos_servico(id);
