-- Suporte a venda de peças sem violar FK de produtos
-- Adiciona coluna peca_id na tabela vendas e cria FK para pecas
ALTER TABLE public.vendas
ADD COLUMN IF NOT EXISTS peca_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendas_peca_id_fkey'
  ) THEN
    ALTER TABLE public.vendas
    ADD CONSTRAINT vendas_peca_id_fkey
    FOREIGN KEY (peca_id)
    REFERENCES public.pecas(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
  END IF;
END $$;

-- Índice para performance em relatórios
CREATE INDEX IF NOT EXISTS idx_vendas_peca_id ON public.vendas(peca_id);

COMMENT ON COLUMN public.vendas.peca_id IS 'Referência opcional para peça quando a venda for de item do estoque de peças.';