-- Marca OS criadas via Entrada Corporativa (/entrada/:itemId), permitindo
-- identificá-las e filtrá-las na listagem de Ordens de Serviço.
ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS origem_remessa_corporativa BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ordens_servico_origem_remessa_corporativa
ON public.ordens_servico (origem_remessa_corporativa)
WHERE origem_remessa_corporativa = true;
