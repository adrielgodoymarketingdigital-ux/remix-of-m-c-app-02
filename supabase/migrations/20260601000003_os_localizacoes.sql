ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS localizacao_fisica TEXT;

CREATE TABLE IF NOT EXISTS os_localizacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE os_localizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios gerenciam suas localizacoes"
  ON os_localizacoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
