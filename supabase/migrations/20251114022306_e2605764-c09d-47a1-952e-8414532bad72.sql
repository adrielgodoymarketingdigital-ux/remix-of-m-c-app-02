-- Migration: Adicionar módulo de Origem de Dispositivos e corrigir enum

-- 1. Adicionar tipo 'admin' ao enum plano_tipo (se ainda não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'admin' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'plano_tipo')
  ) THEN
    ALTER TYPE plano_tipo ADD VALUE 'admin';
  END IF;
END $$;

-- 2. Criar tabela origem_pessoas
CREATE TABLE IF NOT EXISTS public.origem_pessoas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Dados básicos
  tipo TEXT NOT NULL CHECK (tipo IN ('fisica', 'juridica')),
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT,
  rg TEXT,
  data_nascimento DATE,
  
  -- Contato
  telefone TEXT,
  email TEXT,
  
  -- Endereço
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  
  -- Documentos
  documento_frente_url TEXT,
  documento_verso_url TEXT,
  
  -- Controle
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para origem_pessoas
CREATE INDEX IF NOT EXISTS idx_origem_pessoas_user_id ON origem_pessoas(user_id);
CREATE INDEX IF NOT EXISTS idx_origem_pessoas_cpf_cnpj ON origem_pessoas(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_origem_pessoas_tipo ON origem_pessoas(tipo);

-- RLS Policies para origem_pessoas
ALTER TABLE origem_pessoas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own origem_pessoas" ON origem_pessoas;
CREATE POLICY "Users can view own origem_pessoas"
  ON origem_pessoas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own origem_pessoas" ON origem_pessoas;
CREATE POLICY "Users can insert own origem_pessoas"
  ON origem_pessoas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own origem_pessoas" ON origem_pessoas;
CREATE POLICY "Users can update own origem_pessoas"
  ON origem_pessoas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own origem_pessoas" ON origem_pessoas;
CREATE POLICY "Users can delete own origem_pessoas"
  ON origem_pessoas FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Criar tabela compras_dispositivos
CREATE TABLE IF NOT EXISTS public.compras_dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Relacionamentos
  pessoa_id UUID REFERENCES origem_pessoas(id) ON DELETE RESTRICT,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE RESTRICT,
  dispositivo_id UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  
  -- Dados da compra
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_pago NUMERIC(10,2) NOT NULL,
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao_debito', 'cartao_credito', 'transferencia', 'boleto')),
  
  -- Informações adicionais
  funcionario_responsavel TEXT,
  unidade TEXT,
  condicao_aparelho TEXT NOT NULL DEFAULT 'usado',
  situacao_conta TEXT,
  checklist JSONB,
  observacoes TEXT,
  
  -- Documento legal
  termo_pdf_url TEXT,
  
  -- Controle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_origem CHECK (
    (pessoa_id IS NOT NULL AND fornecedor_id IS NULL) OR
    (pessoa_id IS NULL AND fornecedor_id IS NOT NULL)
  )
);

-- Índices para compras_dispositivos
CREATE INDEX IF NOT EXISTS idx_compras_user_id ON compras_dispositivos(user_id);
CREATE INDEX IF NOT EXISTS idx_compras_pessoa_id ON compras_dispositivos(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_compras_fornecedor_id ON compras_dispositivos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_dispositivo_id ON compras_dispositivos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_compras_data ON compras_dispositivos(data_compra);

-- RLS Policies para compras_dispositivos
ALTER TABLE compras_dispositivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own compras" ON compras_dispositivos;
CREATE POLICY "Users can view own compras"
  ON compras_dispositivos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own compras" ON compras_dispositivos;
CREATE POLICY "Users can insert own compras"
  ON compras_dispositivos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own compras" ON compras_dispositivos;
CREATE POLICY "Users can update own compras"
  ON compras_dispositivos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own compras" ON compras_dispositivos;
CREATE POLICY "Users can delete own compras"
  ON compras_dispositivos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Adicionar campos à tabela dispositivos
ALTER TABLE dispositivos 
ADD COLUMN IF NOT EXISTS origem_tipo TEXT 
CHECK (origem_tipo IN ('estoque_proprio', 'fornecedor', 'terceiro'));

ALTER TABLE dispositivos
ADD COLUMN IF NOT EXISTS compra_id UUID REFERENCES compras_dispositivos(id) ON DELETE SET NULL;

-- Índices para dispositivos
CREATE INDEX IF NOT EXISTS idx_dispositivos_origem_tipo ON dispositivos(origem_tipo);
CREATE INDEX IF NOT EXISTS idx_dispositivos_compra_id ON dispositivos(compra_id);

-- 5. Storage buckets (serão criados via insert, não criam automaticamente se já existirem)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('origem-documentos', 'origem-documentos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('termos-compra', 'termos-compra', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para origem-documentos
DROP POLICY IF EXISTS "Users can upload own origem docs" ON storage.objects;
CREATE POLICY "Users can upload own origem docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'origem-documentos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view own origem docs" ON storage.objects;
CREATE POLICY "Users can view own origem docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'origem-documentos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own origem docs" ON storage.objects;
CREATE POLICY "Users can delete own origem docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'origem-documentos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Políticas de storage para termos-compra
DROP POLICY IF EXISTS "Users can upload own termos" ON storage.objects;
CREATE POLICY "Users can upload own termos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'termos-compra' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Public can view termos" ON storage.objects;
CREATE POLICY "Public can view termos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'termos-compra');