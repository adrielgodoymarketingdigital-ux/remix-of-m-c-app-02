-- Corrige exposição multi-tenant e risco de escrita indevida em views do schema public.
-- As 5 primeiras views (SELECT * FROM tabela WHERE ...) não têm RLS própria (views não herdam
-- automaticamente) e tinham SELECT/INSERT/UPDATE/DELETE liberados para anon/authenticated,
-- vazando dados de todos os tenants (CPF, senha_desbloqueio, custos, vendas, assinaturas).
-- Nenhum código do app usa essas views hoje.
REVOKE ALL ON public.clientes_ativos FROM anon, authenticated;
REVOKE ALL ON public.ordens_servico_ativas FROM anon, authenticated;
REVOKE ALL ON public.produtos_ativos FROM anon, authenticated;
REVOKE ALL ON public.vendas_ativas FROM anon, authenticated;
REVOKE ALL ON public.assinantes_ativos FROM anon, authenticated;

-- Estas views alimentam páginas públicas legítimas (catálogo, landing page, avisos, novidades),
-- então a leitura pública precisa continuar. Mas eram graváveis por anon/authenticated
-- (confirmado exploitable via UPDATE em configuracoes_loja_publico e DELETE em
-- landing_page_publico, testado em transação com ROLLBACK). Restringe a SELECT-only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.configuracoes_loja_publico FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.landing_page_publico FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.avisos_sistema_publico FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.novidades_publico FROM anon, authenticated;

-- Defesa em profundidade: estas views já não são graváveis via Postgres (têm JOIN/DISTINCT),
-- mas os grants de escrita não deveriam existir mesmo assim.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dispositivos_catalogo FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.produtos_catalogo FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pecas_catalogo FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.onboarding_config_public FROM anon, authenticated;
