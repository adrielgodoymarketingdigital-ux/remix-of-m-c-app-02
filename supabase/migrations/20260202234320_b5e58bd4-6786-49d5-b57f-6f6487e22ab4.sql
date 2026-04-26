-- Adicionar campo tempo_garantia na tabela ordens_servico
ALTER TABLE public.ordens_servico 
ADD COLUMN tempo_garantia integer DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.ordens_servico.tempo_garantia IS 'Tempo de garantia do serviço em dias';