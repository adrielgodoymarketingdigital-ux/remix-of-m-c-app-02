-- Tabela de links de acompanhamento de OS
CREATE TABLE IF NOT EXISTS public.os_tracking_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  visualizacoes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de controle de uso mensal de compartilhamentos
CREATE TABLE IF NOT EXISTS public.os_tracking_uso (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  total_compartilhamentos integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT os_tracking_uso_user_mes_ano_key UNIQUE (user_id, mes, ano)
);

-- Índices
CREATE INDEX IF NOT EXISTS os_tracking_links_os_id_idx ON public.os_tracking_links(os_id);
CREATE INDEX IF NOT EXISTS os_tracking_links_user_id_idx ON public.os_tracking_links(user_id);
CREATE INDEX IF NOT EXISTS os_tracking_links_token_idx ON public.os_tracking_links(token);
CREATE INDEX IF NOT EXISTS os_tracking_uso_user_id_idx ON public.os_tracking_uso(user_id);

-- RLS
ALTER TABLE public.os_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_tracking_uso ENABLE ROW LEVEL SECURITY;

-- Políticas os_tracking_links
CREATE POLICY "Usuários veem seus próprios links"
  ON public.os_tracking_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários criam seus próprios links"
  ON public.os_tracking_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Leitura pública por token"
  ON public.os_tracking_links FOR SELECT
  USING (ativo = true);

-- Políticas os_tracking_uso
CREATE POLICY "Usuários veem seu próprio uso"
  ON public.os_tracking_uso FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários inserem seu próprio uso"
  ON public.os_tracking_uso FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários atualizam seu próprio uso"
  ON public.os_tracking_uso FOR UPDATE
  USING (auth.uid() = user_id);

-- Política para incremento público de visualizações
CREATE POLICY "Incremento público de visualizações"
  ON public.os_tracking_links FOR UPDATE
  USING (ativo = true)
  WITH CHECK (ativo = true);

-- Políticas de leitura pública para a página de acompanhamento do cliente
CREATE POLICY "Leitura pública via tracking token"
  ON public.ordens_servico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.os_tracking_links
      WHERE os_tracking_links.os_id = ordens_servico.id
        AND os_tracking_links.ativo = true
    )
  );

CREATE POLICY "Leitura pública via tracking token"
  ON public.clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.os_tracking_links tl ON tl.os_id = os.id
      WHERE os.cliente_id = clientes.id
        AND tl.ativo = true
    )
  );

CREATE POLICY "Leitura pública via tracking token"
  ON public.configuracoes_loja FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.os_tracking_links tl
      WHERE tl.user_id = configuracoes_loja.user_id
        AND tl.ativo = true
    )
  );
