
-- Tabela de configuração de status personalizáveis de OS
CREATE TABLE public.os_status_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  ordem INTEGER NOT NULL DEFAULT 0,
  gera_conta BOOLEAN NOT NULL DEFAULT false,
  tipo_conta TEXT DEFAULT 'receber',
  pedir_data_vencimento BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_sistema BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, slug)
);

-- Enable RLS
ALTER TABLE public.os_status_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own status config" ON public.os_status_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own status config" ON public.os_status_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own status config" ON public.os_status_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own non-system status config" ON public.os_status_config
  FOR DELETE USING (auth.uid() = user_id AND is_sistema = false);

-- Funcionários podem ver a config do dono da loja
CREATE POLICY "Employees can view owner status config" ON public.os_status_config
  FOR SELECT USING (public.is_funcionario_of(user_id));
