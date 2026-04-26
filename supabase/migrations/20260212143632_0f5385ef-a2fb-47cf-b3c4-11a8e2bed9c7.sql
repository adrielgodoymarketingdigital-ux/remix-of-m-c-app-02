
ALTER TABLE public.ordens_servico
ADD COLUMN data_saida timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.ordens_servico.data_saida IS 'Data de saída do dispositivo, preenchida quando status muda para entregue';
