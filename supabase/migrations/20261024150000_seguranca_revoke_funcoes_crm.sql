-- Fecha a execução direta (via /rest/v1/rpc) das funções SECURITY DEFINER do
-- CRM, que hoje qualquer visitante com a chave pública consegue chamar:
--   get_users_by_crm_stage(text) -> lista nome e celular de todos os lojistas
--   get_user_by_id(uuid)         -> nome e celular de qualquer lojista
--   update_crm_stage(uuid, text) -> muda estágio/whatsapp_enviado de qualquer um
--   mark_as_client(uuid)         -> marca qualquer um como cliente
--   determinar_condicao_usuario(uuid) -> situação da assinatura de qualquer um
--
-- Nenhum chamador no app nem nas Edge Functions, e nenhuma chamada em produção
-- em ~7,5 dias (pg_stat_statements). Só o service_role mantém EXECUTE.
-- Único chamador no banco: aplicar_automacao_crm -> determinar_condicao_usuario;
-- aplicar_automacao_crm e quem a chama (trigger_aplicar_automacao_crm,
-- aplicar_automacao_crm_todos) são SECURITY DEFINER do dono postgres, então o
-- gatilho de assinaturas continua movendo o CRM.
--
-- Fora desta etapa (de propósito): generate_os_number(uuid),
-- set_os_sequence_start(uuid, integer) e get_next_os_number(uuid).
--
-- Só REVOKE/GRANT: rodar de novo não muda nada.
--
-- ROLLBACK (volta ao estado anterior: todos executavam):
--   GRANT EXECUTE ON FUNCTION public.get_user_by_id(uuid) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.get_users_by_crm_stage(text) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.update_crm_stage(uuid, text) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.mark_as_client(uuid) TO PUBLIC, anon, authenticated, service_role;
--   GRANT EXECUTE ON FUNCTION public.determinar_condicao_usuario(uuid) TO PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_by_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_users_by_crm_stage(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_crm_stage(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_as_client(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.determinar_condicao_usuario(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_by_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_users_by_crm_stage(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_crm_stage(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_as_client(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.determinar_condicao_usuario(uuid) TO service_role;
