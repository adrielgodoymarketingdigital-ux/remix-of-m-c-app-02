-- Criar tabela de configurações da loja
CREATE TABLE configuracoes_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_loja TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO configuracoes_loja (nome_loja, telefone, email)
VALUES ('G360 System', '(00) 00000-0000', 'contato@g360system.com.br');

-- RLS Policies
ALTER TABLE configuracoes_loja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem visualizar configurações"
ON configuracoes_loja FOR SELECT
USING (true);

CREATE POLICY "Apenas autenticados podem atualizar configurações"
ON configuracoes_loja FOR UPDATE
USING (auth.role() = 'authenticated');

-- Comentário para documentação
COMMENT ON TABLE configuracoes_loja IS 'Configurações gerais da loja para recibos e documentos';