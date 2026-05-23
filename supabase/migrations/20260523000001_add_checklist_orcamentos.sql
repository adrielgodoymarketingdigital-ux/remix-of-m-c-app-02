-- Adiciona campos de checklist e dispositivo na tabela orcamentos
-- Permite registrar o checklist de entrada/saída do dispositivo no orçamento

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS tipo_dispositivo text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sistema_operacional text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fabricante text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT NULL;

COMMENT ON COLUMN orcamentos.tipo_dispositivo IS 'Tipo do dispositivo (celular, tablet, notebook, etc.)';
COMMENT ON COLUMN orcamentos.sistema_operacional IS 'Sistema operacional (ios, android) para celular/tablet';
COMMENT ON COLUMN orcamentos.fabricante IS 'Fabricante do notebook (macbook, outro)';
COMMENT ON COLUMN orcamentos.checklist IS 'Checklist de entrada/saída do dispositivo. Ex: {"entrada": {"tela": true}, "saida": {}}';
