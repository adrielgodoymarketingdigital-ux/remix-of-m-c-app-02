-- Corrige vazamento multi-tenant no fluxo publico de Entrada Corporativa
-- (/entrada/:itemId). Mesmo padrao ja corrigido em clientes/followup_control/
-- os_tracking_links: remessa_itens e remessas_corporativas tinham policies de
-- SELECT com USING(true), listaveis por completo via API direta (IMEI, numero
-- de serie, nome/cliente da remessa de qualquer loja). Alem disso, a policy de
-- SELECT/INSERT publico em ordens_servico usava
-- "rc.cliente_id = ordens_servico.cliente_id OR ordens_servico.cliente_id IS NULL",
-- que era ampla demais: qualquer OS de qualquer loja com cliente_id nulo ficava
-- publica, mesmo sem nenhuma relacao com a remessa corporativa (nao so a OS
-- originada daquela remessa especifica).
--
-- get_remessa_item: substitui a leitura publica de remessa_itens/remessas_corporativas
-- por uma function que so retorna o item pedido pelo id (equivalente ao token
-- do QR code), nunca a tabela inteira.
-- criar_os_remessa_corporativa: substitui o INSERT publico em ordens_servico +
-- UPDATE de os_ids em remessa_itens (hoje 2 chamadas separadas em
-- EntradaCorporativa.tsx) por uma unica function atomica. Preserva o caso
-- legitimo de remessa sem cliente_id (OS criada tambem fica sem cliente_id),
-- mas amarrado ao item de remessa valido — nao abre mais para OS soltas sem
-- relacao nenhuma com remessa corporativa.

CREATE OR REPLACE FUNCTION public.get_remessa_item(p_item_id uuid)
RETURNS TABLE (
  id uuid,
  remessa_id uuid,
  marca text,
  modelo text,
  cor text,
  imei text,
  numero_serie text,
  defeito_padrao text,
  os_ids uuid[],
  remessa_nome text,
  remessa_user_id uuid,
  remessa_cliente_id uuid,
  remessa_cliente_nome text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    ri.id, ri.remessa_id, ri.marca, ri.modelo, ri.cor, ri.imei, ri.numero_serie,
    ri.defeito_padrao, ri.os_ids,
    rc.nome, rc.user_id, rc.cliente_id, cli.nome
  FROM remessa_itens ri
  JOIN remessas_corporativas rc ON rc.id = ri.remessa_id
  LEFT JOIN clientes cli ON cli.id = rc.cliente_id
  WHERE ri.id = p_item_id;
$$;

CREATE OR REPLACE FUNCTION public.criar_os_remessa_corporativa(
  p_item_id uuid,
  p_defeito text
)
RETURNS TABLE (id uuid, numero_os text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remessa_id uuid;
  v_user_id uuid;
  v_cliente_id uuid;
  v_marca text;
  v_modelo text;
  v_cor text;
  v_imei text;
  v_numero_serie text;
  v_os_id uuid;
  v_numero_os text;
  v_os_ids_atuais uuid[];
BEGIN
  SELECT ri.remessa_id, rc.user_id, rc.cliente_id, ri.marca, ri.modelo, ri.cor, ri.imei, ri.numero_serie, ri.os_ids
    INTO v_remessa_id, v_user_id, v_cliente_id, v_marca, v_modelo, v_cor, v_imei, v_numero_serie, v_os_ids_atuais
  FROM remessa_itens ri
  JOIN remessas_corporativas rc ON rc.id = ri.remessa_id
  WHERE ri.id = p_item_id;

  IF v_remessa_id IS NULL THEN
    RAISE EXCEPTION 'Item de remessa não encontrado';
  END IF;

  IF coalesce(trim(p_defeito), '') = '' THEN
    RAISE EXCEPTION 'Defeito relatado é obrigatório';
  END IF;

  INSERT INTO ordens_servico (
    user_id, cliente_id, dispositivo_tipo, dispositivo_marca, dispositivo_modelo,
    dispositivo_cor, dispositivo_imei, dispositivo_numero_serie, defeito_relatado,
    status, origem_remessa_corporativa
  ) VALUES (
    v_user_id, v_cliente_id, 'celular', coalesce(v_marca, ''), v_modelo,
    v_cor, v_imei, v_numero_serie, trim(p_defeito),
    'pendente', true
  )
  RETURNING ordens_servico.id, ordens_servico.numero_os INTO v_os_id, v_numero_os;

  UPDATE remessa_itens
     SET os_ids = coalesce(v_os_ids_atuais, '{}') || v_os_id
   WHERE remessa_itens.id = p_item_id;

  RETURN QUERY SELECT v_os_id, v_numero_os;
END;
$$;

REVOKE ALL ON FUNCTION public.get_remessa_item(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_remessa_item(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.criar_os_remessa_corporativa(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.criar_os_remessa_corporativa(uuid, text) TO anon, authenticated;
