ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS comissao_tipo_snapshot text,
ADD COLUMN IF NOT EXISTS comissao_valor_snapshot numeric,
ADD COLUMN IF NOT EXISTS comissao_calculada_snapshot numeric,
ADD COLUMN IF NOT EXISTS tipo_servico_nome_snapshot text;