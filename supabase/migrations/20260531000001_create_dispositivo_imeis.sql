-- Tabela de IMEIs individuais por dispositivo (para estoque com múltiplas unidades)
CREATE TABLE IF NOT EXISTS dispositivo_imeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id uuid NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  imei text NOT NULL,
  vendido boolean NOT NULL DEFAULT false,
  venda_id uuid REFERENCES vendas(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dispositivo_imeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_gerem_seus_imeis" ON dispositivo_imeis
  USING (
    EXISTS (
      SELECT 1 FROM dispositivos d
      WHERE d.id = dispositivo_imeis.dispositivo_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dispositivos d
      WHERE d.id = dispositivo_imeis.dispositivo_id
        AND d.user_id = auth.uid()
    )
  );

-- Coluna para registrar o IMEI vendido na tabela vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS imei_dispositivo text;
