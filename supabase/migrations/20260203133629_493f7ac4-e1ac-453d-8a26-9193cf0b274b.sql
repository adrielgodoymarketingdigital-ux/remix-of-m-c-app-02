-- Tabela de estágios do funil CRM
CREATE TABLE IF NOT EXISTS public.crm_estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  ordem INTEGER NOT NULL DEFAULT 0,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Estágios padrão
INSERT INTO public.crm_estagios (nome, cor, ordem, descricao) VALUES
  ('Novo Lead', '#6366f1', 0, 'Usuários recém-cadastrados'),
  ('Trial Ativo', '#22c55e', 1, 'Em período de teste'),
  ('Trial Expirado', '#f59e0b', 2, 'Trial terminou, não assinou'),
  ('Em Negociação', '#8b5cf6', 3, 'Contato feito, aguardando decisão'),
  ('Convertido', '#10b981', 4, 'Se tornou cliente pagante'),
  ('Perdido', '#ef4444', 5, 'Não converteu/desistiu');

-- RLS para estágios
ALTER TABLE public.crm_estagios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar estágios"
  ON public.crm_estagios FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de posição dos usuários no funil
CREATE TABLE IF NOT EXISTS public.crm_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  estagio_id UUID REFERENCES public.crm_estagios(id) ON DELETE SET NULL,
  notas TEXT,
  ultima_interacao TIMESTAMPTZ,
  proximo_contato TIMESTAMPTZ,
  atribuido_para UUID,
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Índices para performance
CREATE INDEX idx_crm_usuarios_estagio ON public.crm_usuarios(estagio_id);
CREATE INDEX idx_crm_usuarios_prioridade ON public.crm_usuarios(prioridade);
CREATE INDEX idx_crm_usuarios_user_id ON public.crm_usuarios(user_id);

-- RLS para crm_usuarios
ALTER TABLE public.crm_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar CRM usuarios"
  ON public.crm_usuarios FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER set_timestamp_crm_usuarios
  BEFORE UPDATE ON public.crm_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de configurações do layout CRM
CREATE TABLE IF NOT EXISTS public.crm_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  layout_tipo TEXT DEFAULT 'kanban' CHECK (layout_tipo IN ('kanban', 'lista', 'tabela')),
  campos_visiveis TEXT[] DEFAULT ARRAY['nome', 'email', 'celular', 'plano', 'dias_trial'],
  ordenacao TEXT DEFAULT 'created_at',
  ordenacao_direcao TEXT DEFAULT 'desc',
  cards_compactos BOOLEAN DEFAULT false,
  mostrar_avatar BOOLEAN DEFAULT true,
  mostrar_badges BOOLEAN DEFAULT true,
  colunas_por_linha INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS para configurações
ALTER TABLE public.crm_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario pode gerenciar propria config CRM"
  ON public.crm_configuracoes FOR ALL
  USING (user_id = auth.uid());

-- Trigger para updated_at nas configurações
CREATE TRIGGER set_timestamp_crm_configuracoes
  BEFORE UPDATE ON public.crm_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();