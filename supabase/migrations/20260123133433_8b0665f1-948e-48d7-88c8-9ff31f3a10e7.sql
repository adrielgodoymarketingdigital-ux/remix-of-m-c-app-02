-- Criar tabela de histórico de bloqueios/desbloqueios para auditoria
CREATE TABLE public.historico_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('bloqueio', 'desbloqueio')),
  tipo_bloqueio TEXT CHECK (tipo_bloqueio IN ('indeterminado', 'ate_assinar')),
  motivo TEXT,
  user_nome TEXT,
  user_email TEXT,
  admin_nome TEXT,
  admin_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar índice para busca por usuário
CREATE INDEX idx_historico_bloqueios_user_id ON public.historico_bloqueios(user_id);
CREATE INDEX idx_historico_bloqueios_created_at ON public.historico_bloqueios(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.historico_bloqueios ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver o histórico
CREATE POLICY "Admins podem ver histórico de bloqueios"
ON public.historico_bloqueios
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Apenas via service role pode inserir (edge function)
CREATE POLICY "Service role pode inserir histórico"
ON public.historico_bloqueios
FOR INSERT
TO authenticated
WITH CHECK (false);

COMMENT ON TABLE public.historico_bloqueios IS 'Histórico de todas as ações de bloqueio/desbloqueio realizadas por admins';