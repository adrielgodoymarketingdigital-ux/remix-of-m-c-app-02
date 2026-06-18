
-- Tempo de garantia (em meses) escolhido no momento da venda do dispositivo,
-- usado para gerar o termo de garantia no recibo do PDV.
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS tempo_garantia INTEGER;
