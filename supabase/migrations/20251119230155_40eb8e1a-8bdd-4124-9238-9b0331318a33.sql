-- ===== MIGRAÇÃO 1: Criar tabela kirvano_eventos =====

-- Criar tabela para logs de eventos Kirvano
CREATE TABLE IF NOT EXISTS public.kirvano_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kirvano_event_id TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  dados JSONB NOT NULL,
  processado BOOLEAN DEFAULT false,
  email_usuario TEXT,
  plano_tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX idx_kirvano_eventos_tipo ON public.kirvano_eventos(tipo);
CREATE INDEX idx_kirvano_eventos_processado ON public.kirvano_eventos(processado);
CREATE INDEX idx_kirvano_eventos_email ON public.kirvano_eventos(email_usuario);
CREATE INDEX idx_kirvano_eventos_created_at ON public.kirvano_eventos(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.kirvano_eventos ENABLE ROW LEVEL SECURITY;

-- Política para permitir sistema inserir eventos (webhook público)
CREATE POLICY "Sistema pode inserir eventos Kirvano" 
  ON public.kirvano_eventos 
  FOR INSERT 
  WITH CHECK (true);

-- Política para admins verem eventos (todos os usuários podem ver por enquanto)
CREATE POLICY "Usuarios podem ver eventos Kirvano" 
  ON public.kirvano_eventos 
  FOR SELECT 
  USING (true);

-- ===== MIGRAÇÃO 2: Modificar tabela assinaturas =====

-- Remover colunas Stripe
ALTER TABLE public.assinaturas 
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_price_id;

-- Adicionar colunas Kirvano
ALTER TABLE public.assinaturas 
  ADD COLUMN IF NOT EXISTS kirvano_customer_email TEXT,
  ADD COLUMN IF NOT EXISTS kirvano_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS kirvano_payment_link TEXT;

-- Criar índice por email
CREATE INDEX IF NOT EXISTS idx_assinaturas_kirvano_email 
  ON public.assinaturas(kirvano_customer_email);

-- ===== MIGRAÇÃO 3: Remover tabela stripe_eventos =====

-- Remover tabela antiga de eventos Stripe
DROP TABLE IF EXISTS public.stripe_eventos CASCADE;