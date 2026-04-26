
-- 1. Adicionar colunas na tabela loja_funcionarios
ALTER TABLE public.loja_funcionarios
  ADD COLUMN IF NOT EXISTS cargo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comissao_tipo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comissao_valor NUMERIC DEFAULT 0;

-- 2. Adicionar funcionario_id nas vendas e ordens_servico
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS funcionario_id UUID DEFAULT NULL;

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS funcionario_id UUID DEFAULT NULL;

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_vendas_funcionario_id ON public.vendas(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_funcionario_id ON public.ordens_servico(funcionario_id);

-- 3. Criar tabela categorias_funcionarios
CREATE TABLE IF NOT EXISTS public.categorias_funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categorias_funcionarios ENABLE ROW LEVEL SECURITY;

-- RLS: dono gerencia suas categorias
CREATE POLICY "Dono pode ver suas categorias"
  ON public.categorias_funcionarios FOR SELECT
  USING (auth.uid() = loja_user_id);

CREATE POLICY "Dono pode inserir suas categorias"
  ON public.categorias_funcionarios FOR INSERT
  WITH CHECK (auth.uid() = loja_user_id);

CREATE POLICY "Dono pode atualizar suas categorias"
  ON public.categorias_funcionarios FOR UPDATE
  USING (auth.uid() = loja_user_id);

CREATE POLICY "Dono pode deletar suas categorias"
  ON public.categorias_funcionarios FOR DELETE
  USING (auth.uid() = loja_user_id);
