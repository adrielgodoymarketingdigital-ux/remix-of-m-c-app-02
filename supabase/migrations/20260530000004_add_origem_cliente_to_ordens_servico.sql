-- Adiciona campos de origem do cliente na OS
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS origem_cliente text,
  ADD COLUMN IF NOT EXISTS tipo_midia text;
