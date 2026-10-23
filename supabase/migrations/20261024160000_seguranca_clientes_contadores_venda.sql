-- Dois blocos independentes de endurecimento de RLS/GRANT. Só DROP POLICY IF
-- EXISTS e REVOKE: rodar de novo não muda nada.

-- =====================================================================
-- BLOCO 1 — clientes: remove a leitura pública que sobrou do tracking
-- =====================================================================
-- "Leitura pública via tracking token" (20260502120000) liberava SELECT em
-- clientes para qualquer papel sem comparar com o token do link. As irmãs em
-- os_tracking_links/ordens_servico/configuracoes_loja já foram removidas em
-- 20260711155638; esta ficou para trás. Hoje o anon vê 0 linhas só porque as
-- policies de ordens_servico e os_tracking_links o barram dentro do EXISTS:
-- isto é defesa em profundidade.
--
-- As páginas públicas (/acompanhar, /acompanhar-cliente, /entrada) leem por
-- get_os_tracking, get_os_tracking_status, get_cliente_tracking,
-- get_cliente_tracking_status e get_remessa_item — SECURITY DEFINER do dono
-- postgres, que não dependem desta policy nem do GRANT do anon. Nenhuma
-- policy de outra tabela consulta clientes, então o REVOKE não gera
-- "permission denied" em outro lugar.
--
-- ROLLBACK do bloco 1:
--   CREATE POLICY "Leitura pública via tracking token"
--     ON public.clientes FOR SELECT
--     USING (
--       EXISTS (
--         SELECT 1 FROM public.ordens_servico os
--         JOIN public.os_tracking_links tl ON tl.os_id = os.id
--         WHERE os.cliente_id = clientes.id
--           AND tl.ativo = true
--       )
--     );
--   GRANT ALL ON public.clientes TO anon;

DROP POLICY IF EXISTS "Leitura pública via tracking token" ON public.clientes;
REVOKE ALL ON public.clientes FROM PUBLIC, anon;

-- =====================================================================
-- BLOCO 2 — user_venda_counters: só a numeração automática escreve
-- =====================================================================
-- "Users can insert own venda counter" tinha WITH CHECK (true): qualquer um
-- criava o contador de outra loja (ex.: ultimo_numero perto do limite do
-- integer, travando a primeira venda dela). O único escritor é
-- generate_venda_number_safe (SECURITY DEFINER, dono postgres com bypass de
-- RLS), chamada pelo gatilho assign_venda_number_on_insert; nenhum código do
-- app ou das Edge Functions toca na tabela. Nenhuma policy de INSERT no lugar.
-- SELECT segue como está (cada um lê o próprio contador).
--
-- ROLLBACK do bloco 2:
--   CREATE POLICY "Users can insert own venda counter"
--     ON public.user_venda_counters FOR INSERT
--     WITH CHECK (true);
--   GRANT INSERT, UPDATE, DELETE ON public.user_venda_counters TO anon, authenticated;

DROP POLICY IF EXISTS "Users can insert own venda counter" ON public.user_venda_counters;
REVOKE INSERT, UPDATE, DELETE ON public.user_venda_counters FROM PUBLIC, anon, authenticated;
