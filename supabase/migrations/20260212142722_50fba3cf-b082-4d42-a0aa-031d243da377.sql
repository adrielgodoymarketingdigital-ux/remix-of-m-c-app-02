
-- Add fornecedor_id to produtos table
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Add fornecedor_id to pecas table  
ALTER TABLE public.pecas ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Create indexes for better join performance
CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor_id ON public.produtos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pecas_fornecedor_id ON public.pecas(fornecedor_id);
