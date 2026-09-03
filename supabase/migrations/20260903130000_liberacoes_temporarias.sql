-- =====================================================================
-- Liberação Temporária de Usuários
-- Tabela de controle + coluna auxiliar em assinaturas + ALTER do CHECK
-- de historico_bloqueios.acao. Reversão = snapshot & restore (Opção 1),
-- com piso "free limpo" quando o estado anterior não era ativo.
-- =====================================================================

-- 1) Tabela de controle -----------------------------------------------
CREATE TABLE public.liberacoes_temporarias (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  email              text,                 -- snapshot p/ exibição/auditoria
  admin_id           uuid NOT NULL,        -- quem concedeu

  -- o que foi concedido:
  plano_concedido    text NOT NULL,
  status_concedido   text NOT NULL,        -- 'active' | 'trialing'
  concedido_em       timestamptz NOT NULL DEFAULT now(),
  expira_em          timestamptz NOT NULL,
  duracao_texto      text,                 -- ex: "2 horas" (só p/ exibição)

  -- snapshot do estado ANTERIOR da assinatura (p/ restaurar):
  plano_anterior                    text,
  status_anterior                   text,
  data_fim_anterior                 timestamptz,
  data_proxima_cobranca_anterior    timestamptz,
  bloqueado_admin_anterior          boolean,
  bloqueado_tipo_anterior           text,
  trial_with_card_anterior          boolean,
  era_pagante_real                  boolean NOT NULL DEFAULT false, -- payment_provider + pagarme_subscription_id + active

  -- ciclo de vida:
  estado        text NOT NULL DEFAULT 'ativa'
                CHECK (estado IN ('ativa','revertida','revogada_manual','conflito_sem_reverter')),
  revertido_em  timestamptz,
  revertido_por text,                      -- 'cron' | '<admin_id>'
  motivo        text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.liberacoes_temporarias IS
  'Liberações temporárias de acesso concedidas por admin. A fonte de verdade do acesso continua sendo assinaturas; esta tabela guarda o snapshot anterior e agenda a reversão automática (cron reverter-liberacoes-temporarias a cada 10 min).';

-- Índices
CREATE INDEX idx_liberacoes_user_id ON public.liberacoes_temporarias (user_id);
CREATE INDEX idx_liberacoes_estado_expira ON public.liberacoes_temporarias (expira_em)
  WHERE estado = 'ativa';
-- No máximo UMA liberação ativa por usuário (a function revoga a anterior antes de criar a nova)
CREATE UNIQUE INDEX uq_liberacao_ativa_por_user ON public.liberacoes_temporarias (user_id)
  WHERE estado = 'ativa';

-- 2) RLS (espelha historico_bloqueios) ------------------------------
ALTER TABLE public.liberacoes_temporarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver liberacoes temporarias"
  ON public.liberacoes_temporarias
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access liberacoes"
  ON public.liberacoes_temporarias
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- (sem policy de INSERT/UPDATE/DELETE p/ authenticated: escrita só via Edge Function com service role)

-- 3) Coluna auxiliar em assinaturas --------------------------------
ALTER TABLE public.assinaturas
  ADD COLUMN liberacao_temp_id uuid
  REFERENCES public.liberacoes_temporarias(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.assinaturas.liberacao_temp_id IS
  'Quando != NULL, esta assinatura está sob uma liberação temporária ativa (FK -> liberacoes_temporarias). Usado pelo cron reverter-liberacoes-temporarias para conflict check.';

CREATE INDEX idx_assinaturas_liberacao_temp_id ON public.assinaturas (liberacao_temp_id)
  WHERE liberacao_temp_id IS NOT NULL;

-- 4) ALTER do CHECK de historico_bloqueios.acao -------------------
ALTER TABLE public.historico_bloqueios
  DROP CONSTRAINT IF EXISTS historico_bloqueios_acao_check;

ALTER TABLE public.historico_bloqueios
  ADD CONSTRAINT historico_bloqueios_acao_check
  CHECK (acao IN ('bloqueio', 'desbloqueio', 'liberacao', 'liberacao_revertida'));
