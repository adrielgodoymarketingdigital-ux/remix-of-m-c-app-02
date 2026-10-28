-- =====================================================================
-- Estoque baixo, fase 2: consultas de LEITURA para rodar em produção ANTES
-- da migration 20261102120000. Colar UMA POR VEZ no SQL Editor.
-- Nenhuma grava nada e nenhuma traz dado de cliente (só estrutura).
-- =====================================================================


-- 1) Já existe algo com o nome configuracao_estoque? Esperado: nenhuma linha.
SELECT n.nspname AS esquema, c.relname AS nome, c.relkind::text AS tipo
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relname ILIKE '%configuracao_estoque%'
UNION ALL
SELECT n.nspname, p.proname, 'função'
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE p.proname ILIKE '%configuracao_estoque%' OR p.prosrc ILIKE '%configuracao_estoque%';


-- 2) _zerar_catalogo() em produção é a mesma da main (etapa 3a)?
--    Esperado: linhas = 111 e assinatura = 9c5f023e430f459aa317b4f423b6262f.
--    Se der diferente, NÃO rodar a migration: me mande o resultado da consulta 3.
SELECT count(*) AS linhas,
       md5(string_agg(concat_ws('|', ordem, lista, categoria, tabela, filtro), E'\n' ORDER BY ordem)) AS assinatura
  FROM public._zerar_catalogo();


-- 3) Definição completa de _zerar_catalogo() (para comparar com a etapa 3a, linha a linha).
SELECT pg_get_functiondef('public._zerar_catalogo()'::regprocedure);


-- 4) Funções que a migration usa. Esperado:
--    is_funcionario_of: SECURITY DEFINER, procura em loja_funcionarios com
--      funcionario_user_id = auth.uid(), loja_user_id = parâmetro e ativo = true;
--    update_updated_at_column: só "NEW.updated_at = now(); RETURN NEW;".
SELECT p.oid::regprocedure AS funcao, p.prosecdef AS security_definer, p.proconfig AS config,
       pg_get_functiondef(p.oid) AS definicao
  FROM pg_proc p
 WHERE p.oid IN ('public.is_funcionario_of(uuid)'::regprocedure,
                 'public.update_updated_at_column()'::regprocedure);


-- 5) Policies de leitura que servem de modelo (assinaturas, configuracoes_loja) e as de
--    empresa_usuarios (o gerente precisa ler a própria linha para o EXISTS funcionar).
--    Esperado: em assinaturas, "gerente de filial ve assinatura do proprietario" com
--    EXISTS em empresa_usuarios (gerente_id = auth.uid() e proprietario_id = user_id);
--    em empresa_usuarios, "gerente pode ler sua propria linha" (gerente_id = auth.uid()).
SELECT tablename, policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('assinaturas', 'configuracoes_loja', 'empresa_usuarios')
 ORDER BY tablename, policyname;


-- 6) Colunas e RLS de empresa_usuarios (a policy do gerente usa gerente_id e proprietario_id).
SELECT c.column_name, c.data_type,
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.empresa_usuarios'::regclass) AS rls_ligada
  FROM information_schema.columns c
 WHERE c.table_schema = 'public' AND c.table_name = 'empresa_usuarios'
 ORDER BY c.ordinal_position;


-- 7) Privilégios padrão de tabela nova no esquema public (é por isso que a migration
--    faz REVOKE de anon/authenticated) e quem vai ser o dono da tabela.
SELECT current_user AS quem_roda,
       pg_get_userbyid(d.defaclrole) AS dono_do_padrao,
       d.defaclobjtype AS tipo_objeto,
       d.defaclacl::text AS privilegios
  FROM pg_default_acl d
 WHERE d.defaclnamespace = 'public'::regnamespace;


-- 8) Outras funções do banco que listam tabelas do usuário (usam o nome de tabelas de
--    configuração da loja). Esperado: só _zerar_catalogo e as do "Começar do zero";
--    se aparecer outra (cópia de filial, exclusão de conta), me mande o nome.
SELECT p.oid::regprocedure AS funcao
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND (p.prosrc ILIKE '%user_notification_preferences%' OR p.prosrc ILIKE '%categorias_produtos%')
 ORDER BY 1;
