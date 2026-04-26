-- Add codigo and quantidade columns to servicos table
ALTER TABLE public.servicos
ADD COLUMN codigo TEXT,
ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 0;

-- Create indexes for better search performance
CREATE INDEX idx_servicos_codigo ON public.servicos(codigo);
CREATE INDEX idx_servicos_nome ON public.servicos(nome);

-- Add comment to columns
COMMENT ON COLUMN public.servicos.codigo IS 'Código único do serviço para identificação';
COMMENT ON COLUMN public.servicos.quantidade IS 'Quantidade de serviços disponíveis';