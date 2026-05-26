-- Tabela de cupons de desconto
-- Usada no checkout (cartão e PIX) para aplicar descontos nos planos.

CREATE TABLE IF NOT EXISTS public.cupons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text UNIQUE NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('percent', 'flat')),
  valor       integer NOT NULL,            -- centavos (flat) ou % inteiro (percent)
  ativo       boolean NOT NULL DEFAULT true,
  usos_maximos  integer,                   -- NULL = ilimitado
  usos_atuais   integer NOT NULL DEFAULT 0,
  expira_em   timestamptz,                 -- NULL = sem expiração
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.cupons IS 'Cupons de desconto aplicáveis no checkout de assinaturas.';
COMMENT ON COLUMN public.cupons.tipo   IS 'percent = desconto percentual; flat = desconto em centavos';
COMMENT ON COLUMN public.cupons.valor  IS 'Para tipo=percent: valor 1-100. Para tipo=flat: valor em centavos.';

-- RLS
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler/escrever
CREATE POLICY "cupons_admin_all"
  ON public.cupons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );
