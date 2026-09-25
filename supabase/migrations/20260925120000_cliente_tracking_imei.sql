-- Adiciona dispositivo_imei ao RPC de acompanhamento por cliente
-- (get_cliente_tracking / get_cliente_tracking_status), pra exibir modelo+IMEI
-- na tabela/lista de /acompanhar-cliente/:token. Mesma segurança já
-- estabelecida: cliente_id/user_id continuam resolvidos internamente a partir
-- do token (nunca aceitos como parâmetro externo), e o novo campo vem da MESMA
-- linha de ordens_servico já escopada por os.user_id = v_user_id e
-- cli.id = v_cliente_id — nenhuma superfície nova de vazamento entre contas ou
-- entre clientes da mesma conta, é só mais uma coluna da mesma linha já lida.
--
-- Não altera get_os_tracking/get_os_tracking_status (link individual de OS) —
-- fora de escopo desta mudança.
--
-- NOTA: Postgres não permite CREATE OR REPLACE mudar o RETURNS TABLE (nova
-- coluna = tipo de retorno diferente) — precisa DROP + CREATE. Tudo dentro da
-- mesma transação da migration, então não existe janela em que a função não
-- exista para quem chama via RPC (DDL transacional: outras sessões só veem o
-- antes ou o depois, nunca o meio).
DROP FUNCTION IF EXISTS public.get_cliente_tracking(text);
DROP FUNCTION IF EXISTS public.get_cliente_tracking_status(text);

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
  dispositivo_imei text
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
    os.dispositivo_imei
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
  dispositivo_imei text
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
    os.dispositivo_imei
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

-- DROP remove os GRANTs junto com a função — reaplicando o mesmo padrão de
-- segurança da migration original (20260922120000): só anon/authenticated via
-- RPC, nada de acesso direto à função por PUBLIC.
REVOKE ALL ON FUNCTION public.get_cliente_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cliente_tracking(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_cliente_tracking_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cliente_tracking_status(text) TO anon, authenticated;
