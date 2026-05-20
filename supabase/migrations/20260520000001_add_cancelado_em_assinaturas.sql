-- Adicionar coluna cancelado_em na tabela assinaturas (caso não exista)
ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

-- Trigger para preencher cancelado_em automaticamente ao cancelar assinatura
CREATE OR REPLACE FUNCTION set_cancelado_em()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'canceled' AND (OLD.status IS DISTINCT FROM 'canceled') THEN
    NEW.cancelado_em = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_cancelado_em ON assinaturas;
CREATE TRIGGER trg_set_cancelado_em
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION set_cancelado_em();
