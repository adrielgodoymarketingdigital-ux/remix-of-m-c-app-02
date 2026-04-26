-- Corrigir constraint de unicidade do numero_os para ser POR USUÁRIO, não global
-- Isso permite que cada usuário tenha sua própria sequência de OS independente

-- 1. Remover a constraint global existente
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_numero_os_key;

-- 2. Criar nova constraint composta (numero_os + user_id)
ALTER TABLE public.ordens_servico 
ADD CONSTRAINT ordens_servico_numero_os_user_id_key UNIQUE (numero_os, user_id);

-- Comentário explicativo
COMMENT ON CONSTRAINT ordens_servico_numero_os_user_id_key ON public.ordens_servico IS 
'Permite que cada usuário tenha sua própria sequência de numeração de OS independente';