-- =====================================================================
-- Estoque mínimo por item (fase 3): consultas de LEITURA para rodar em
-- produção ANTES da migration 20261103120000. Colar UMA POR VEZ no SQL Editor.
-- Nenhuma grava nada e nenhuma traz dado de cliente (só estrutura e contagens).
-- =====================================================================


-- 1) A coluna já existe? Alguma função ou view já cita "estoque_minimo"?
--    Esperado: nenhuma linha.
SELECT 'coluna' AS tipo, table_name::text AS nome, data_type AS detalhe
  FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name = 'estoque_minimo'
UNION ALL
SELECT 'função', p.oid::regprocedure::text, NULL
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc ILIKE '%estoque_minimo%'
UNION ALL
SELECT 'restrição', conname::text, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname IN ('produtos_estoque_minimo_check', 'pecas_estoque_minimo_check');


-- 2) Colunas e tipos atuais de produtos e pecas (para comparar com o repositório).
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name IN ('produtos', 'pecas')
 ORDER BY table_name, ordinal_position;


-- 3) Restrições, índices, gatilhos, policies, RLS e grants de cada tabela.
--    Atenção especial aos gatilhos: me mande a função de cada um (coluna "detalhe").
SELECT t.tabela, 'restrição' AS tipo, k.conname::text AS nome, pg_get_constraintdef(k.oid) AS detalhe
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN pg_constraint k ON k.conrelid = ('public.' || t.tabela)::regclass
UNION ALL
SELECT t.tabela, 'índice', i.indexname::text, i.indexdef
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN pg_indexes i ON i.schemaname = 'public' AND i.tablename = t.tabela
UNION ALL
SELECT t.tabela, 'gatilho', g.tgname::text,
       pg_get_triggerdef(g.oid) || '  >>  função: ' || g.tgfoid::regproc::text || '  >>  ' || g.tgenabled::text
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN pg_trigger g ON g.tgrelid = ('public.' || t.tabela)::regclass AND NOT g.tgisinternal
UNION ALL
SELECT t.tabela, 'policy', p.policyname::text,
       p.cmd || ' | ' || p.roles::text || ' | ' || COALESCE(p.qual, '') || ' | ' || COALESCE(p.with_check, '')
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.tabela
UNION ALL
SELECT t.tabela, 'rls', NULL, c.relrowsecurity::text || ' | force ' || c.relforcerowsecurity::text
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN pg_class c ON c.oid = ('public.' || t.tabela)::regclass
UNION ALL
SELECT t.tabela, 'grant', g.grantee::text, string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type)
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN information_schema.role_table_grants g ON g.table_schema = 'public' AND g.table_name = t.tabela
 GROUP BY t.tabela, g.grantee
 ORDER BY 1, 2, 3;


-- 4) O que depende das tabelas e poderia quebrar com uma coluna a mais.
--    Esperado: só as views produtos_catalogo / pecas_catalogo (colunas listadas)
--    e funções que listam colunas. Me mande qualquer linha de "função suspeita",
--    "tabela parecida", "publicação" ou "event trigger".
SELECT 'view' AS tipo, v.oid::regclass::text AS objeto, t.tabela AS de
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN pg_depend d ON d.refobjid = ('public.' || t.tabela)::regclass AND d.classid = 'pg_rewrite'::regclass
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class v ON v.oid = r.ev_class AND v.oid <> ('public.' || t.tabela)::regclass
 GROUP BY v.oid, t.tabela
UNION ALL
-- função que cita produtos/pecas E usa SELECT *, ROWTYPE, INSERT sem lista de
-- colunas ou CREATE TABLE ... AS/LIKE (texto da função, aproximado)
SELECT 'função suspeita', p.oid::regprocedure::text,
       concat_ws(', ',
         CASE WHEN p.prosrc ~* 'select\s+\*' THEN 'SELECT *' END,
         CASE WHEN p.prosrc ~* '(produtos|pecas)%rowtype' THEN '%ROWTYPE' END,
         CASE WHEN p.prosrc ~* 'insert\s+into\s+(public\.)?(produtos|pecas)\s+(values|select)' THEN 'INSERT sem colunas' END,
         CASE WHEN p.prosrc ~* 'insert\s+into\s+[a-z_.]+\s+select\s+\*\s+from\s+(public\.)?(produtos|pecas)\M' THEN 'INSERT ... SELECT * FROM produtos/pecas' END,
         CASE WHEN p.prosrc ~* 'create\s+(temp\s+|temporary\s+)?table\s+[a-z_.]+\s+(\(\s*like|as)' THEN 'CREATE TABLE AS/LIKE' END)
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.prosrc ~* '\m(produtos|pecas)\M'
   AND (p.prosrc ~* 'select\s+\*' OR p.prosrc ~* '%rowtype'
        OR p.prosrc ~* 'insert\s+into\s+(public\.)?(produtos|pecas)\s+(values|select)'
        OR p.prosrc ~* 'create\s+(temp\s+|temporary\s+)?table\s+[a-z_.]+\s+(\(\s*like|as)')
UNION ALL
-- tabela com as mesmas colunas (cópia/backup feita com LIKE ou AS): recebe
-- INSERT ... SELECT * e quebraria
SELECT 'tabela parecida', c.table_name::text, t.tabela
  FROM (VALUES ('produtos'), ('pecas')) t(tabela)
  JOIN information_schema.columns c ON c.table_schema IN ('public', 'backup', 'archive')
       AND c.table_name NOT IN ('produtos', 'pecas')
       AND EXISTS (SELECT 1 FROM information_schema.tables x
                    WHERE x.table_schema = c.table_schema AND x.table_name = c.table_name
                      AND x.table_type = 'BASE TABLE')
       AND c.column_name IN (SELECT column_name FROM information_schema.columns
                              WHERE table_schema = 'public' AND table_name = t.tabela)
 GROUP BY c.table_name, t.tabela
HAVING count(*) >= (SELECT count(*) - 2 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = t.tabela)
UNION ALL
SELECT 'publicação', pubname::text, tablename::text
  FROM pg_publication_tables
 WHERE schemaname = 'public' AND tablename IN ('produtos', 'pecas')
UNION ALL
SELECT 'event trigger', evtname::text, evtevent || ' -> ' || evtfoid::regproc::text
  FROM pg_event_trigger
 ORDER BY 1, 2;


-- 5) Tamanho e quantidade de linhas (estimativa do catálogo, sem varrer, e a exata).
SELECT c.relname AS tabela,
       c.reltuples::bigint AS linhas_estimadas,
       pg_size_pretty(pg_relation_size(c.oid)) AS tamanho_tabela,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS tamanho_com_indices
  FROM pg_class c
 WHERE c.oid IN ('public.produtos'::regclass, 'public.pecas'::regclass);
-- contagem exata (lê a tabela inteira; é rápida, mas rode separado se preferir)
SELECT (SELECT count(*) FROM public.produtos) AS produtos, (SELECT count(*) FROM public.pecas) AS pecas;


-- 6) O que a migration usa: só comandos do Postgres (ALTER TABLE, COMMENT,
--    catálogo), nenhuma função do app. Antes de rodar, conferir que ninguém está
--    segurando as tabelas há muito tempo (o lock_timeout de 3 s desistiria).
--    Esperado: nenhuma linha (ou só transações de segundos).
SELECT a.pid, a.state, now() - a.xact_start AS transacao_aberta_ha, l.mode, l.relation::regclass AS tabela
  FROM pg_locks l
  JOIN pg_stat_activity a ON a.pid = l.pid
 WHERE l.relation IN ('public.produtos'::regclass, 'public.pecas'::regclass)
   AND a.pid <> pg_backend_pid()
 ORDER BY transacao_aberta_ha DESC NULLS LAST;
