-- =====================================================================
-- DELETE COMPLETO DE DADOS — usuário: brunosobral0604@gmail.com
-- Apaga SOMENTE os dados deste usuário (e das empresas/filiais que ele
-- é proprietário, e dos funcionários vinculados à(s) sua(s) loja(s)).
-- NÃO afeta nenhum outro usuário.
--
-- Como usar: cole no SQL Editor do Supabase e rode tudo de uma vez.
-- É uma transação única: ao final, confira os números da consulta de
-- verificação — se todos forem 0, o COMMIT já terá sido aplicado.
-- Se quiser conferir ANTES de aplicar, troque a linha "COMMIT;" do
-- final por "ROLLBACK;", rode, veja os números, e só então rode de
-- novo com COMMIT.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'brunosobral0604@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email brunosobral0604@gmail.com não encontrado em auth.users';
  END IF;
  RAISE NOTICE 'user_id resolvido: %', v_user_id;
END $$;

-- ---------------------------------------------------------------
-- 1) Tabelas com FK indireta (filhas de outras tabelas de dados)
-- ---------------------------------------------------------------
DELETE FROM public.mensagens_suporte
WHERE conversa_id IN (
  SELECT id FROM public.conversas_suporte
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
);

DELETE FROM public.os_audit_log
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR os_id IN (
      SELECT id FROM public.ordens_servico
      WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
         OR empresa_id IN (
            SELECT id FROM public.empresas
            WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
         )
   );

DELETE FROM public.comissoes_tipo_servico
WHERE funcionario_id IN (
  SELECT id FROM public.loja_funcionarios
  WHERE loja_user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
);

DELETE FROM public.os_tecnicos
WHERE funcionario_id IN (
  SELECT id FROM public.loja_funcionarios
  WHERE loja_user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
);

-- ---------------------------------------------------------------
-- 2) Tabelas com user_id direto (dados próprios do usuário)
-- ---------------------------------------------------------------
DELETE FROM public.trial_emails_sent WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.user_notification_preferences WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.user_events WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.user_onboarding WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.push_subscriptions WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.reactivation_messages WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.historico_bloqueios WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.os_tracking_uso WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.os_tracking_links WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.pagamentos_pix WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.conversas_suporte WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.feedbacks WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.crm_usuarios WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.crm_configuracoes WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.categorias_despesas WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.categorias_sistema_excluidas WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.categorias_produtos WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.os_status_config WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');
DELETE FROM public.user_os_counters WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');

-- categorias_funcionarios usa loja_user_id (dono da loja)
DELETE FROM public.categorias_funcionarios WHERE loja_user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');

-- ---------------------------------------------------------------
-- 3) Tabelas de dados "de negócio" com empresa_id (e também user_id
--    em parte delas) — filtra por user_id OU empresa pertencente a ele
-- ---------------------------------------------------------------
DELETE FROM public.ordens_servico
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.vendas
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.servicos_avulsos
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.orcamentos
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.contas
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.clientes
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.origem_pessoas
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.compras_dispositivos
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.dispositivos
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.produtos
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.pecas
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.servicos
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.taxas_cartao
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.tipos_servico
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

DELETE FROM public.tipos_garantia
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com')
   OR empresa_id IN (SELECT id FROM public.empresas WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com'));

-- ---------------------------------------------------------------
-- 4) Funcionários da loja e a própria estrutura de empresas/filiais
-- ---------------------------------------------------------------
DELETE FROM public.loja_funcionarios
WHERE loja_user_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');

DELETE FROM public.empresas
WHERE proprietario_id = (SELECT id FROM auth.users WHERE email = 'brunosobral0604@gmail.com');

-- ---------------------------------------------------------------
-- 5) NÃO apagamos user_roles, assinaturas nem profiles — o login do
--    usuário continua funcionando para ele recomeçar do zero no app.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 6) Verificação final — todos os números devem ser 0
-- ---------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.ordens_servico WHERE user_id = (SELECT id FROM auth.users WHERE email='brunosobral0604@gmail.com')) AS os_restantes,
  (SELECT count(*) FROM public.clientes      WHERE user_id = (SELECT id FROM auth.users WHERE email='brunosobral0604@gmail.com')) AS clientes_restantes,
  (SELECT count(*) FROM public.vendas        WHERE user_id = (SELECT id FROM auth.users WHERE email='brunosobral0604@gmail.com')) AS vendas_restantes,
  (SELECT count(*) FROM public.profiles      WHERE user_id = (SELECT id FROM auth.users WHERE email='brunosobral0604@gmail.com')) AS profile_continua_existindo;

COMMIT;
