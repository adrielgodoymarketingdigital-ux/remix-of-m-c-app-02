
-- Suporte a dois tipos de troca: garantia (defeito, produto descartado)
-- e troca_comercial (produto devolvido volta ao estoque)
ALTER TABLE public.trocas_garantia
  ADD COLUMN tipo TEXT NOT NULL DEFAULT 'garantia' CHECK (tipo IN ('garantia', 'troca_comercial')),
  ADD COLUMN produto_devolvido_id UUID REFERENCES public.produtos(id);
