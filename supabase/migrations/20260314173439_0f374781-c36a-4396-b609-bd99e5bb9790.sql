
-- Backfill observacoes for existing OS-linked vendas (vendas with peca_id set, which are pieces used in OS)
UPDATE public.vendas 
SET observacoes = 'Peça/Produto utilizado na OS (backfill)'
WHERE peca_id IS NOT NULL 
  AND observacoes IS NULL;
