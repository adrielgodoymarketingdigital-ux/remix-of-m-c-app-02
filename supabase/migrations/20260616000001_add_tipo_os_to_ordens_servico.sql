-- Diferencia OS criada pelo fluxo completo do fluxo simplificado
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS tipo_os text NOT NULL DEFAULT 'completa';

ALTER TABLE ordens_servico
  ADD CONSTRAINT ordens_servico_tipo_os_check
  CHECK (tipo_os IN ('completa', 'simplificada'));

CREATE INDEX IF NOT EXISTS idx_ordens_servico_tipo_os
  ON ordens_servico (tipo_os)
  WHERE deleted_at IS NULL;
