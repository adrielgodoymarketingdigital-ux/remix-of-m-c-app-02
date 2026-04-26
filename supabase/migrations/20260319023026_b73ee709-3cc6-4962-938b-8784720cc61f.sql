
-- Tabela para rastrear pagamentos PIX via Pagar.me
CREATE TABLE public.pagamentos_pix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plano_tipo TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- IDs do Pagar.me
  pagarme_order_id TEXT,
  pagarme_charge_id TEXT,
  pagarme_transaction_id TEXT,
  -- Dados do QR Code PIX
  pix_qr_code TEXT,
  pix_qr_code_url TEXT,
  pix_expiration TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_pagamentos_pix_user_id ON public.pagamentos_pix(user_id);
CREATE INDEX idx_pagamentos_pix_status ON public.pagamentos_pix(status);
CREATE INDEX idx_pagamentos_pix_pagarme_order_id ON public.pagamentos_pix(pagarme_order_id);

-- RLS
ALTER TABLE public.pagamentos_pix ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver seus próprios pagamentos
CREATE POLICY "Users can view own pix payments"
  ON public.pagamentos_pix
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Apenas service_role pode inserir/atualizar (via edge functions)
CREATE POLICY "Service role can manage pix payments"
  ON public.pagamentos_pix
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_pagamentos_pix_updated_at
  BEFORE UPDATE ON public.pagamentos_pix
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
