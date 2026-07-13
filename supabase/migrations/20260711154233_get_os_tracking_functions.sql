-- Corrige vazamento multi-tenant no fluxo publico de acompanhamento de OS.
-- Hoje AcompanharOS.tsx consulta direto os_tracking_links, ordens_servico e
-- configuracoes_loja com o cliente Supabase anonimo, filtrando por token/id/user_id
-- so no app. Como o token vem de querystring (nao de JWT), RLS nao consegue validar
-- "so a linha do token certo" sem manter uma policy aberta o suficiente para
-- listar a tabela inteira via API direta (o mesmo padrao de bug ja corrigido em
-- clientes e followup_control).
--
-- A correcao move a validacao do token para dentro de duas functions
-- SECURITY DEFINER, que bypassam RLS internamente mas so expoem exatamente os
-- campos necessarios para a pagina publica. As policies "leitura publica via
-- tracking token" em os_tracking_links/ordens_servico/configuracoes_loja serao
-- removidas em seguida, depois de validar o fluxo end-to-end.
--
-- get_os_tracking: chamada na carga inicial da pagina. Valida o token e
-- incrementa visualizacoes atomicamente via UPDATE ... RETURNING.
-- get_os_tracking_status: chamada pelo polling (a cada ~15s). So leitura,
-- nao incrementa visualizacoes, para nao inflar o contador a cada poll.

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
  WHERE os.id = v_os_id;
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
  WHERE os.id = v_os_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_os_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_os_tracking(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_os_tracking_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_os_tracking_status(text) TO anon, authenticated;
