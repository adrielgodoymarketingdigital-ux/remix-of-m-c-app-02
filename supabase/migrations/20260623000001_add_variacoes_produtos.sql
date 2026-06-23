-- Suporte a variações de produto (ex: "Capa Space - iPhone 11", "Capa Space - iPhone 12")
-- Cada variação é um registro normal em produtos. produto_pai_id aponta para a
-- variação "raiz" do grupo (a primeira criada); não existe registro "pai" fictício.

ALTER TABLE public.produtos
  ADD COLUMN produto_pai_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  ADD COLUMN variacao_label TEXT;

CREATE INDEX idx_produtos_produto_pai_id
  ON public.produtos(produto_pai_id)
  WHERE produto_pai_id IS NOT NULL;
