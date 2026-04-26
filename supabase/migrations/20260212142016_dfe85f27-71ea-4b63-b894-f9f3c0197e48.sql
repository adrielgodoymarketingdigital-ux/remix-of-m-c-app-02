
ALTER TABLE public.configuracoes_loja ADD COLUMN IF NOT EXISTS layout_pdv_config jsonb DEFAULT NULL;
ALTER TABLE public.configuracoes_loja ADD COLUMN IF NOT EXISTS layout_vendas_config jsonb DEFAULT NULL;
