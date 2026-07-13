-- Remove as policies publicas em remessa_itens, remessas_corporativas e
-- ordens_servico que expunham dados de qualquer loja via API direta, sem
-- token nenhum (mesma classe de vazamento ja corrigida em clientes,
-- followup_control e os_tracking_links).
--
-- remessa_itens/remessas_corporativas tinham USING(true) — listagem completa
-- (IMEI, numero de serie, nome/cliente da remessa de qualquer loja).
--
-- ordens_servico tinha "rc.cliente_id = ordens_servico.cliente_id OR
-- ordens_servico.cliente_id IS NULL" nas policies de INSERT/SELECT publico —
-- o OR abria qualquer OS de qualquer loja com cliente_id nulo, mesmo sem
-- nenhuma relacao com a remessa corporativa que motivou a policy.
--
-- Substituidas por get_remessa_item e criar_os_remessa_corporativa
-- (SECURITY DEFINER, ver 20260711160306_get_remessa_item_e_criar_os_remessa.sql),
-- que validam o item de remessa pedido (id vindo do QR code) e preservam o
-- caso legitimo de remessa sem cliente_id sem abrir para OS soltas.
-- EntradaCorporativa.tsx ja foi migrado para usar essas RPCs. Validado via
-- REST publico antes desta remocao: brecha confirmada aberta (IMEI/remessas/
-- OS solta listaveis sem token).

DROP POLICY IF EXISTS "leitura publica de itens por id" ON public.remessa_itens;
DROP POLICY IF EXISTS "atualizacao publica de itens por remessa valida" ON public.remessa_itens;
DROP POLICY IF EXISTS "leitura publica de remessas por id" ON public.remessas_corporativas;
DROP POLICY IF EXISTS "insercao publica de OS via remessa corporativa" ON public.ordens_servico;
DROP POLICY IF EXISTS "leitura publica de OS criada via remessa corporativa" ON public.ordens_servico;
