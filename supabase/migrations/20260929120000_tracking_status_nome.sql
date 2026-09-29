-- Páginas públicas de acompanhamento (/acompanhar-cliente/:token e
-- /acompanhar/:token) mostravam o nome PADRÃO do status (mapa fixo no front,
-- STATUS_CONFIG em CardStatusOS.tsx), ignorando o nome que a loja configurou
-- em os_status_config — ex.: loja renomeou "aguardando_aprovacao" para
-- "Em Processo", menu de OS mostra certo, acompanhamento mostra
-- "Aguard. Aprovação".
--
-- A página é anônima e não pode ler os_status_config (RLS de dono). Então o
-- nome passa a vir das próprias RPCs SECURITY DEFINER, numa coluna nova
-- status_nome, resolvida com a MESMA regra do menu de OS (useOSStatusConfig):
-- os_status_config.user_id = dono da loja (user_id do link, já resolvido pelo
-- token) AND slug = ordens_servico.status. Subquery com LIMIT 1 (em vez de
-- JOIN) pra nunca multiplicar linhas se houver slug duplicado. Sem config
-- (status_nome nulo), o front cai no nome padrão, como hoje.
--
-- Segurança inalterada: user_id/cliente_id/os_id continuam resolvidos pelo
-- token, e os_status_config é lida só na conta do dono do link. Expõe apenas
-- o nome do status da OS que a página já exibe.
--
-- status_nome vai no FIM do RETURNS TABLE (colunas existentes na mesma
-- ordem). Mudar RETURNS TABLE exige DROP + CREATE (não dá CREATE OR REPLACE);
-- DDL transacional, então não há janela sem a função. O DROP apaga os
-- GRANTs — reaplicados no fim com o mesmo padrão das migrations originais
-- (20260711154233 e 20260925120000).

DROP FUNCTION IF EXISTS public.get_cliente_tracking(text);
DROP FUNCTION IF EXISTS public.get_cliente_tracking_status(text);
DROP FUNCTION IF EXISTS public.get_os_tracking(text);
DROP FUNCTION IF EXISTS public.get_os_tracking_status(text);

-- ---------- Link por CLIENTE ----------

CREATE FUNCTION public.get_cliente_tracking(p_token text)
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
  dispositivo_modelo text,
  dispositivo_imei text,
  status_nome text
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
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo,
    os.dispositivo_imei,
    (SELECT sc.nome FROM os_status_config sc
      WHERE sc.user_id = v_user_id AND sc.slug = os.status
      ORDER BY sc.ordem LIMIT 1) AS status_nome
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

CREATE FUNCTION public.get_cliente_tracking_status(p_token text)
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
  dispositivo_modelo text,
  dispositivo_imei text,
  status_nome text
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
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo,
    os.dispositivo_imei,
    (SELECT sc.nome FROM os_status_config sc
      WHERE sc.user_id = v_user_id AND sc.slug = os.status
      ORDER BY sc.ordem LIMIT 1) AS status_nome
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

-- ---------- Link por OS ----------

CREATE FUNCTION public.get_os_tracking(p_token text)
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
  cores_personalizadas jsonb,
  status_nome text
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
    loja.cores_personalizadas,
    (SELECT sc.nome FROM os_status_config sc
      WHERE sc.user_id = v_user_id AND sc.slug = os.status
      ORDER BY sc.ordem LIMIT 1) AS status_nome
  FROM ordens_servico os
  LEFT JOIN clientes cli ON cli.id = os.cliente_id
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  WHERE os.id = v_os_id
    AND os.deleted_at IS NULL;
END;
$$;

CREATE FUNCTION public.get_os_tracking_status(p_token text)
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
  cores_personalizadas jsonb,
  status_nome text
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
    loja.cores_personalizadas,
    (SELECT sc.nome FROM os_status_config sc
      WHERE sc.user_id = v_user_id AND sc.slug = os.status
      ORDER BY sc.ordem LIMIT 1) AS status_nome
  FROM ordens_servico os
  LEFT JOIN clientes cli ON cli.id = os.cliente_id
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  WHERE os.id = v_os_id
    AND os.deleted_at IS NULL;
END;
$$;

-- ---------- GRANTs (o DROP remove) ----------

REVOKE ALL ON FUNCTION public.get_cliente_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cliente_tracking(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_cliente_tracking_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cliente_tracking_status(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_os_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_os_tracking(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_os_tracking_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_os_tracking_status(text) TO anon, authenticated;
