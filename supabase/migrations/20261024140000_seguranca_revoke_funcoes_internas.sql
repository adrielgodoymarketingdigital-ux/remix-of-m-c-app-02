-- Fecha a execução direta (via /rest/v1/rpc) de funções SECURITY DEFINER que
-- hoje qualquer visitante com a chave pública consegue chamar.
--
-- O Supabase dá EXECUTE a PUBLIC, anon, authenticated e service_role em toda
-- função nova do schema public; por isso o REVOKE nomeia os quatro alvos.
--
-- GRUPO 1 — uso interno (só gatilhos/outras funções chamam). Ninguém além do
-- service_role executa direto. Os chamadores internos são SECURITY DEFINER do
-- dono postgres (confirmado em produção), então continuam funcionando:
--   aplicar_automacao_crm        <- trigger_aplicar_automacao_crm (assinaturas)
--   registrar_pontos_fidelidade  <- trigger_pontos_venda / trigger_pontos_os
--   generate_os_number_safe      <- assign_os_number_on_insert (ordens_servico)
--   generate_venda_number_safe   <- assign_venda_number_on_insert (vendas)
--   set_os_sequence_start(int) e get_next_os_number(): versões antigas da
--   sequence global, sem chamador desde 20260202125817.
--
-- GRUPO 2 — o app logado pode usar; só o anon perde:
--   generate_os_number()         -> repassa auth.uid() à versão com uuid
--   incrementar_uso_cupom(uuid)  -> já exige o dono do cupom por dentro
--   aplicar_automacao_crm_todos()-> já exige has_role admin por dentro
--
-- Fora desta etapa (de propósito): funções de CRM usadas pelo n8n,
-- generate_os_number(uuid), set_os_sequence_start(uuid, integer),
-- get_next_os_number(uuid) e as RPCs públicas de acompanhamento/remessa.
--
-- Só REVOKE/GRANT: rodar de novo não muda nada.
--
-- ROLLBACK (volta ao estado anterior: todos executavam):
--   GRANT EXECUTE ON FUNCTION public.aplicar_automacao_crm(uuid) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.registrar_pontos_fidelidade(uuid, uuid, uuid, text, numeric) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.generate_os_number_safe(uuid) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.generate_venda_number_safe(uuid) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.set_os_sequence_start(integer) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.get_next_os_number() TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.generate_os_number() TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.incrementar_uso_cupom(uuid) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.aplicar_automacao_crm_todos() TO PUBLIC, anon, authenticated, service_role;

-- GRUPO 1
REVOKE EXECUTE ON FUNCTION public.aplicar_automacao_crm(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_pontos_fidelidade(uuid, uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_os_number_safe(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_venda_number_safe(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_os_sequence_start(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_os_number() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.aplicar_automacao_crm(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_pontos_fidelidade(uuid, uuid, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_os_number_safe(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_venda_number_safe(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_os_sequence_start(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_os_number() TO service_role;

-- GRUPO 2
REVOKE EXECUTE ON FUNCTION public.generate_os_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.incrementar_uso_cupom(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aplicar_automacao_crm_todos() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_os_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incrementar_uso_cupom(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_automacao_crm_todos() TO authenticated, service_role;
