-- =====================================================================
-- Extrato: funções só para usuário logado (revoga PUBLIC e anon).
--
-- JÁ APLICADO MANUALMENTE NA PRODUÇÃO. Esta migration só registra a regra
-- no repositório, para que um banco recriado a partir das migrations não
-- volte a expor o extrato.
--
-- Motivo: fn_extrato_lista tinha GRANT para anon
-- (20261001170000_extrato_lancamentos_editar_excluir.sql) e nenhuma das
-- três funções tinha REVOKE FROM PUBLIC. fn_extrato_eventos_raw é
-- SECURITY DEFINER e só barra o acesso quando auth.uid() IS NOT NULL —
-- sem login, auth.uid() é NULL e a checagem era pulada, ou seja, quem não
-- estava logado conseguia ler o extrato de qualquer loja passando o
-- p_user_id.
--
-- Idempotente e independente de assinatura: percorre pg_proc pelo nome e
-- usa regprocedure, então cobre qualquer overload que exista no banco.
-- Não altera o corpo de nenhuma função nem nenhum dado.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_extrato_eventos_raw', 'fn_extrato_lista', 'fn_extrato_resumo')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.fn);
  END LOOP;
END $$;

COMMIT;
