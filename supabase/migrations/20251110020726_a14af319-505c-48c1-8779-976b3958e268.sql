-- Criar tabela de fornecedores
CREATE TABLE fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  cpf TEXT UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('juridica', 'fisica')),
  email TEXT,
  telefone TEXT,
  celular TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_fornecedores_nome ON fornecedores(nome);
CREATE INDEX idx_fornecedores_cnpj ON fornecedores(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX idx_fornecedores_ativo ON fornecedores(ativo);

-- RLS
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fornecedores"
ON fornecedores FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert fornecedores"
ON fornecedores FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update fornecedores"
ON fornecedores FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete fornecedores"
ON fornecedores FOR DELETE
USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Adicionar coluna fornecedor_id na tabela dispositivos
ALTER TABLE dispositivos
ADD COLUMN fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL;

-- Índice para melhor performance em joins
CREATE INDEX idx_dispositivos_fornecedor ON dispositivos(fornecedor_id);

-- Comentários
COMMENT ON TABLE fornecedores IS 'Cadastro de fornecedores de dispositivos e produtos';
COMMENT ON COLUMN dispositivos.fornecedor_id IS 'Fornecedor do dispositivo';