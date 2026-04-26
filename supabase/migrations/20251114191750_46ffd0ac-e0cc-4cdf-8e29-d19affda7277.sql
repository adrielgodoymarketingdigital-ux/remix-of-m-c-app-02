-- Criar ENUM para tipo de desconto
CREATE TYPE tipo_desconto AS ENUM ('percentual', 'valor_fixo');

-- Criar ENUM para status do cupom
CREATE TYPE status_cupom AS ENUM ('ativo', 'inativo', 'expirado');

-- Criar tabela de cupons
CREATE TABLE cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT,
  tipo_desconto tipo_desconto NOT NULL DEFAULT 'percentual',
  valor NUMERIC NOT NULL CHECK (valor > 0),
  valor_minimo_compra NUMERIC DEFAULT 0,
  quantidade_maxima_uso INTEGER,
  quantidade_usada INTEGER DEFAULT 0,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  data_validade TIMESTAMP WITH TIME ZONE,
  status status_cupom NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT cupons_codigo_user_unique UNIQUE(user_id, codigo),
  CONSTRAINT cupons_quantidade_check CHECK (quantidade_usada <= quantidade_maxima_uso OR quantidade_maxima_uso IS NULL)
);

-- Índices para performance
CREATE INDEX idx_cupons_user_id ON cupons(user_id);
CREATE INDEX idx_cupons_codigo ON cupons(codigo);
CREATE INDEX idx_cupons_status ON cupons(status);

-- RLS Policies
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coupons" 
ON cupons FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coupons" 
ON cupons FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coupons" 
ON cupons FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own coupons" 
ON cupons FOR DELETE 
USING (auth.uid() = user_id);

-- Criar tabela vendas_cupons (histórico de uso)
CREATE TABLE vendas_cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  cupom_id UUID NOT NULL REFERENCES cupons(id) ON DELETE RESTRICT,
  codigo_cupom TEXT NOT NULL,
  valor_desconto NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT vendas_cupons_unique UNIQUE(venda_id, cupom_id)
);

CREATE INDEX idx_vendas_cupons_venda_id ON vendas_cupons(venda_id);
CREATE INDEX idx_vendas_cupons_cupom_id ON vendas_cupons(cupom_id);

ALTER TABLE vendas_cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coupon usage" 
ON vendas_cupons FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM vendas 
    WHERE vendas.id = vendas_cupons.venda_id 
    AND vendas.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert coupon usage" 
ON vendas_cupons FOR INSERT 
WITH CHECK (true);

-- Adicionar campos na tabela vendas
ALTER TABLE vendas 
ADD COLUMN cupom_codigo TEXT,
ADD COLUMN valor_desconto_cupom NUMERIC DEFAULT 0;

CREATE INDEX idx_vendas_cupom_codigo ON vendas(cupom_codigo);

-- Função RPC para incrementar uso do cupom
CREATE OR REPLACE FUNCTION incrementar_uso_cupom(cupom_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE cupons 
  SET quantidade_usada = quantidade_usada + 1,
      updated_at = NOW()
  WHERE id = cupom_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;