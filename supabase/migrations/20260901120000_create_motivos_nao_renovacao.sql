-- "Por que você não renovou?" — motivo de NÃO RENOVAÇÃO auto-reportado pelo usuário.
--
-- Por que uma TABELA nova e não o campo assinaturas.motivo_cancelamento:
--   1. motivo_cancelamento é semanticamente o motivo do CANCELAMENTO da
--      assinatura (registrado por webhook/admin/gateway). Aqui é o usuário
--      dizendo por que não voltou — não é a mesma coisa e não deve misturar.
--   2. assinaturas é 1 linha por usuário e é sobrescrita a cada
--      renovação/re-assinatura. Um usuário pode vencer, voltar e vencer de
--      novo — cada ciclo de vencimento tem seu próprio motivo. Um único
--      campo perderia esse histórico.
--   3. Precisamos de vários campos (categoria + texto livre + timestamp de
--      exibição + timestamp de resposta + snapshot de plano/status), o que
--      pede tabela própria.
--
-- O par (user_id, ciclo_vencimento_ref) é único: garante "pergunta UMA vez
-- por ciclo de vencimento". A linha é criada no momento em que o modal é
-- exibido (modal_exibido_em) — então, mesmo que o usuário feche sem
-- responder, a linha já existe e o modal não reaparece nesse ciclo.
-- respondido_em/motivo_categoria/motivo_texto ficam nulos até (se) responder.

CREATE TABLE public.motivos_nao_renovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  -- Identificador estável do episódio de vencimento (id da assinatura +
  -- status + data marco). Muda quando o usuário re-assina e vence de novo.
  ciclo_vencimento_ref TEXT NOT NULL,
  -- Quando o modal foi exibido pela primeira vez neste ciclo.
  modal_exibido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Quando (e se) o usuário escolheu uma opção. Nulo = fechou sem responder.
  respondido_em TIMESTAMPTZ,
  -- Uma das 6 categorias de botão. Nulo = fechou sem responder.
  --   preco_alto | nao_usei | outra_solucao | problema_tecnico | volto_em_breve | outro
  motivo_categoria TEXT,
  -- Texto livre opcional — só preenchido quando motivo_categoria = 'outro'.
  motivo_texto TEXT,
  -- Snapshots do estado da assinatura no momento do vencimento.
  plano_tipo TEXT,
  status_assinatura TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT motivos_nao_renovacao_user_ciclo_unico UNIQUE (user_id, ciclo_vencimento_ref),
  CONSTRAINT motivos_nao_renovacao_categoria_valida CHECK (
    motivo_categoria IS NULL OR motivo_categoria IN (
      'preco_alto', 'nao_usei', 'outra_solucao', 'problema_tecnico', 'volto_em_breve', 'outro'
    )
  )
);

CREATE INDEX idx_motivos_nao_renovacao_user_id ON public.motivos_nao_renovacao(user_id);
CREATE INDEX idx_motivos_nao_renovacao_categoria ON public.motivos_nao_renovacao(motivo_categoria);
CREATE INDEX idx_motivos_nao_renovacao_respondido_em ON public.motivos_nao_renovacao(respondido_em);

ALTER TABLE public.motivos_nao_renovacao ENABLE ROW LEVEL SECURITY;

-- Usuário gerencia apenas as próprias linhas (o modal roda no client dele).
CREATE POLICY "Users can view own motivos_nao_renovacao"
  ON public.motivos_nao_renovacao FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own motivos_nao_renovacao"
  ON public.motivos_nao_renovacao FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own motivos_nao_renovacao"
  ON public.motivos_nao_renovacao FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Admin do MecApp lê tudo (painel /admin/financeiro), mesmo mecanismo das
-- demais políticas de admin (user_roles.role = 'admin').
CREATE POLICY "Admins podem ver todos motivos_nao_renovacao"
  ON public.motivos_nao_renovacao FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

COMMENT ON TABLE public.motivos_nao_renovacao IS 'Resposta auto-reportada do usuário ao modal "Por que você não renovou?", uma por ciclo de vencimento (user_id + ciclo_vencimento_ref). Linha criada na exibição do modal; resposta é opcional.';
