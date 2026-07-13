-- Remove as policies de RLS que expunham os_tracking_links, ordens_servico e
-- configuracoes_loja inteiras para acesso publico direto via API (mesmo padrao
-- do vazamento ja corrigido em clientes/followup_control): a validacao do token
-- acontecia so no filtro da query do app, nao na policy, entao qualquer
-- authenticated/anon conseguia listar a tabela toda via REST direto.
--
-- Substituidas por duas functions SECURITY DEFINER (get_os_tracking e
-- get_os_tracking_status, ver 20260711154233_get_os_tracking_functions.sql),
-- que validam o token internamente e retornam so os campos necessarios para a
-- pagina publica /acompanhar/:token. AcompanharOS.tsx ja foi migrado para usar
-- essas RPCs em vez de consultar as 3 tabelas diretamente. Validado
-- end-to-end antes desta remocao (dados corretos, RLS bloqueando listagem
-- direta, visualizacoes incrementando 1x por carregamento).

DROP POLICY IF EXISTS "Leitura pública por token" ON public.os_tracking_links;
DROP POLICY IF EXISTS "acesso publico por token" ON public.os_tracking_links;
DROP POLICY IF EXISTS "Leitura pública via tracking token" ON public.ordens_servico;
DROP POLICY IF EXISTS "Leitura pública via tracking token" ON public.configuracoes_loja;
