-- Adiciona campos de marca, modelo e cor do dispositivo na tabela orcamentos
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS marca_dispositivo TEXT,
  ADD COLUMN IF NOT EXISTS modelo_dispositivo TEXT,
  ADD COLUMN IF NOT EXISTS cor_dispositivo TEXT;
