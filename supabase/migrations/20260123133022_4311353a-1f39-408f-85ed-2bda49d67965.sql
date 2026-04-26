-- Adicionar campo para tipo de bloqueio (indeterminado ou até assinar plano)
ALTER TABLE public.assinaturas 
ADD COLUMN IF NOT EXISTS bloqueado_tipo TEXT CHECK (bloqueado_tipo IN ('indeterminado', 'ate_assinar'));

COMMENT ON COLUMN public.assinaturas.bloqueado_tipo IS 'Tipo de bloqueio: indeterminado (permanente até admin desbloquear) ou ate_assinar (auto-desbloqueia ao assinar plano pago)';