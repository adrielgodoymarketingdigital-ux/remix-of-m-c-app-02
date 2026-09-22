-- PARTE 0 — correção de segurança independente
--
-- "Incremento público de visualizações" (UPDATE ... USING (ativo=true) WITH CHECK
-- (ativo=true)) sobrou da época em que a página pública lia a tabela direto. Desde
-- a migration 20260711154233 (get_os_tracking_functions), o incremento acontece
-- dentro da função SECURITY DEFINER get_os_tracking, que roda como owner e não
-- depende de nenhuma policy de RLS. A policy hoje só serve para permitir que
-- QUALQUER chamada REST anônima dê UPDATE em qualquer linha ativa de
-- os_tracking_links (os_id, token, user_id incluídos) sem checar dono nem token.
DROP POLICY IF EXISTS "Incremento público de visualizações" ON public.os_tracking_links;

-- PARTE 2 — filtro que faltava no link individual
--
-- get_os_tracking/get_os_tracking_status não filtravam ordens_servico.deleted_at:
-- uma OS soft-deletada continuava acessível por um link antigo. CREATE OR REPLACE
-- mantém GRANTs/REVOKEs já aplicados em 20260711154233.
CREATE OR REPLACE FUNCTION public.get_os_tracking(p_token text)
RETURNS TABLE (
  numero_os text,
  status text,
  defeito_relatado text,
  total numeric,
  os_created_at timestamptz,
  data_saida timestamptz,
  dispositivo_marca text,
  dispositivo_modelo text,
  cliente_nome text,
  cliente_telefone text,
  nome_loja text,
  logo_url text,
  cor_primaria text,
  loja_telefone text,
  loja_endereco text,
  cores_personalizadas jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_id uuid;
  v_user_id uuid;
BEGIN
  UPDATE os_tracking_links
     SET visualizacoes = coalesce(visualizacoes, 0) + 1
   WHERE token = p_token
     AND ativo = true
  RETURNING os_id, user_id INTO v_os_id, v_user_id;

  IF v_os_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    os.numero_os, os.status, os.defeito_relatado, os.total,
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo,
    cli.nome, cli.telefone,
    loja.nome_loja, loja.logo_url,
    loja.cores_personalizadas ->> 'cor_primaria' AS cor_primaria,
    loja.telefone, loja.endereco,
    loja.cores_personalizadas
  FROM ordens_servico os
  LEFT JOIN clientes cli ON cli.id = os.cliente_id
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  WHERE os.id = v_os_id
    AND os.deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_os_tracking_status(p_token text)
RETURNS TABLE (
  numero_os text,
  status text,
  defeito_relatado text,
  total numeric,
  os_created_at timestamptz,
  data_saida timestamptz,
  dispositivo_marca text,
  dispositivo_modelo text,
  cliente_nome text,
  cliente_telefone text,
  nome_loja text,
  logo_url text,
  cor_primaria text,
  loja_telefone text,
  loja_endereco text,
  cores_personalizadas jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_id uuid;
  v_user_id uuid;
BEGIN
  SELECT os_id, user_id INTO v_os_id, v_user_id
  FROM os_tracking_links
  WHERE token = p_token
    AND ativo = true;

  IF v_os_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    os.numero_os, os.status, os.defeito_relatado, os.total,
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo,
    cli.nome, cli.telefone,
    loja.nome_loja, loja.logo_url,
    loja.cores_personalizadas ->> 'cor_primaria' AS cor_primaria,
    loja.telefone, loja.endereco,
    loja.cores_personalizadas
  FROM ordens_servico os
  LEFT JOIN clientes cli ON cli.id = os.cliente_id
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  WHERE os.id = v_os_id
    AND os.deleted_at IS NULL;
END;
$$;

-- PARTE 1 — link de acompanhamento por CLIENTE (todas as OS do cliente de uma vez)
--
-- Mesmo padrão de os_tracking_links (token = 128 bits via pgcrypto, ativo boolean,
-- sem expiração), tabela própria porque a chave de negócio é cliente_id, não os_id.
-- RLS: só policies de dono. Nenhuma policy pública — leitura pública passa
-- exclusivamente pelas duas functions SECURITY DEFINER abaixo, que resolvem
-- cliente_id/user_id a partir do token (nunca aceitos como parâmetro externo).
CREATE TABLE IF NOT EXISTS public.cliente_tracking_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  visualizacoes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cliente_tracking_links_cliente_id_idx ON public.cliente_tracking_links(cliente_id);
CREATE INDEX IF NOT EXISTS cliente_tracking_links_user_id_idx ON public.cliente_tracking_links(user_id);
CREATE INDEX IF NOT EXISTS cliente_tracking_links_token_idx ON public.cliente_tracking_links(token);

ALTER TABLE public.cliente_tracking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono gerencia seus links de cliente"
  ON public.cliente_tracking_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.cliente_tracking_links FROM anon;

CREATE OR REPLACE FUNCTION public.get_cliente_tracking(p_token text)
RETURNS TABLE (
  cliente_nome text,
  nome_loja text,
  logo_url text,
  cor_primaria text,
  loja_telefone text,
  loja_endereco text,
  cores_personalizadas jsonb,
  os_id uuid,
  numero_os text,
  status text,
  defeito_relatado text,
  total numeric,
  os_created_at timestamptz,
  data_saida timestamptz,
  dispositivo_marca text,
  dispositivo_modelo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_user_id uuid;
BEGIN
  UPDATE cliente_tracking_links
     SET visualizacoes = coalesce(visualizacoes, 0) + 1
   WHERE token = p_token
     AND ativo = true
  RETURNING cliente_id, user_id INTO v_cliente_id, v_user_id;

  IF v_cliente_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cli.nome,
    loja.nome_loja, loja.logo_url,
    loja.cores_personalizadas ->> 'cor_primaria' AS cor_primaria,
    loja.telefone, loja.endereco,
    loja.cores_personalizadas,
    os.id, os.numero_os, os.status, os.defeito_relatado, os.total,
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo
  FROM clientes cli
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  LEFT JOIN ordens_servico os
    ON os.cliente_id = cli.id
   AND os.user_id = v_user_id
   AND os.deleted_at IS NULL
  WHERE cli.id = v_cliente_id
    AND cli.deleted_at IS NULL
  ORDER BY os.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cliente_tracking_status(p_token text)
RETURNS TABLE (
  cliente_nome text,
  nome_loja text,
  logo_url text,
  cor_primaria text,
  loja_telefone text,
  loja_endereco text,
  cores_personalizadas jsonb,
  os_id uuid,
  numero_os text,
  status text,
  defeito_relatado text,
  total numeric,
  os_created_at timestamptz,
  data_saida timestamptz,
  dispositivo_marca text,
  dispositivo_modelo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_user_id uuid;
BEGIN
  SELECT cliente_id, user_id INTO v_cliente_id, v_user_id
  FROM cliente_tracking_links
  WHERE token = p_token
    AND ativo = true;

  IF v_cliente_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cli.nome,
    loja.nome_loja, loja.logo_url,
    loja.cores_personalizadas ->> 'cor_primaria' AS cor_primaria,
    loja.telefone, loja.endereco,
    loja.cores_personalizadas,
    os.id, os.numero_os, os.status, os.defeito_relatado, os.total,
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo
  FROM clientes cli
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  LEFT JOIN ordens_servico os
    ON os.cliente_id = cli.id
   AND os.user_id = v_user_id
   AND os.deleted_at IS NULL
  WHERE cli.id = v_cliente_id
    AND cli.deleted_at IS NULL
  ORDER BY os.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cliente_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cliente_tracking(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_cliente_tracking_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cliente_tracking_status(text) TO anon, authenticated;
