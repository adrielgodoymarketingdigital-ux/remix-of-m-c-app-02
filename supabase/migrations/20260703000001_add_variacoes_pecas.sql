-- Adicionar suporte a variações na tabela pecas (mesmo padrão de produtos)
ALTER TABLE pecas
  ADD COLUMN IF NOT EXISTS peca_pai_id uuid REFERENCES pecas(id),
  ADD COLUMN IF NOT EXISTS variacao_label text;

CREATE INDEX IF NOT EXISTS idx_pecas_peca_pai_id ON pecas(peca_pai_id);
