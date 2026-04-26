-- Criar enums para tipos de plano e status
CREATE TYPE plano_tipo AS ENUM (
  'demonstracao',
  'basico_mensal',
  'intermediario_mensal',
  'profissional_mensal',
  'basico_anual',
  'intermediario_anual',
  'profissional_anual'
);

CREATE TYPE status_assinatura AS ENUM (
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'trialing',
  'unpaid'
);

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  plano_tipo plano_tipo NOT NULL DEFAULT 'demonstracao',
  status status_assinatura NOT NULL DEFAULT 'active',
  data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_fim TIMESTAMP WITH TIME ZONE,
  data_proxima_cobranca TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabela de eventos Stripe (para auditoria)
CREATE TABLE IF NOT EXISTS public.stripe_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  dados JSONB NOT NULL,
  processado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_eventos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para assinaturas
CREATE POLICY "Usuários podem ver própria assinatura"
  ON public.assinaturas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir assinaturas"
  ON public.assinaturas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar assinaturas"
  ON public.assinaturas FOR UPDATE
  USING (true);

-- Políticas RLS para stripe_eventos (apenas sistema)
CREATE POLICY "Sistema pode inserir eventos"
  ON public.stripe_eventos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sistema pode ver eventos"
  ON public.stripe_eventos FOR SELECT
  USING (true);

-- Função para criar assinatura de demonstração automática
CREATE OR REPLACE FUNCTION public.criar_assinatura_basica_gratuita()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assinaturas (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    plano_tipo,
    status,
    data_inicio,
    data_proxima_cobranca
  ) VALUES (
    NEW.id,
    'demo_' || NEW.id,
    'sub_demo_' || NEW.id,
    'price_demo',
    'demonstracao',
    'active',
    NOW(),
    NOW() + INTERVAL '999 years'
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar assinatura ao criar usuário
DROP TRIGGER IF EXISTS on_auth_user_created_assinatura ON auth.users;
CREATE TRIGGER on_auth_user_created_assinatura
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_assinatura_basica_gratuita();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_user_id ON public.assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_customer_id ON public.assinaturas(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_eventos_event_id ON public.stripe_eventos(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_eventos_processado ON public.stripe_eventos(processado);