CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_nome text NOT NULL,
  cliente_telefone text,
  descricao text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'confirmado', 'chegou', 'entregue', 'cancelado')),
  pago boolean NOT NULL DEFAULT false,
  valor_total numeric(10,2),
  previsao_chegada date,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_gerem_seus_pedidos" ON pedidos
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
