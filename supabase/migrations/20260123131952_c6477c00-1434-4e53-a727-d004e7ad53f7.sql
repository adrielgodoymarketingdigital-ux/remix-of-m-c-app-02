-- Adicionar campos para bloqueio manual pelo admin
ALTER TABLE public.assinaturas 
ADD COLUMN IF NOT EXISTS bloqueado_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bloqueado_admin_motivo TEXT,
ADD COLUMN IF NOT EXISTS bloqueado_admin_em TIMESTAMPTZ;