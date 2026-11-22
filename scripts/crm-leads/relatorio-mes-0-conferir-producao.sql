-- =====================================================================
-- CRM de leads — RELATÓRIO: mês contra mês anterior — CONFERÊNCIA ANTES DE
-- APLICAR. SOMENTE LEITURA. Rodar em produção ANTES de
-- 20261123130000_crm_leads_relatorio_mes_calendario.sql.
-- Só lê o catálogo do Postgres (nenhum dado de cliente sai daqui).
-- Esperado: todas as linhas com ok = true.
--
-- Linha 1: crm_relatorio_marketing é a versão da 20261123120000. Se der
-- false porque esta migration já foi aplicada (md5 da versão nova), pode
-- seguir: é idempotente. Qualquer outro valor: PARE e me mande.
-- Linhas 2 e 3: as internas são as da 20261123120000 (esta migration não as
-- toca, mas a função nova chama as duas).
-- =====================================================================
WITH f AS (
  SELECT p.oid, p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('crm_relatorio_marketing', '_crm_rel_cadastros', '_crm_rel_funil')
), esperado(n, proname, h) AS (VALUES
  (1, 'crm_relatorio_marketing', '4e034d5e70a4d309bc362eb2c4d34ab0'),
  (2, '_crm_rel_cadastros',      '7248f2c66df5e862f722354ae26e7f7c'),
  (3, '_crm_rel_funil',          '780e1348dff477d4ad4f9102ab47a363')
)
SELECT * FROM (
  SELECT e.n || '. ' || e.proname || ' = versão da 20261123120000' AS item,
         coalesce((SELECT string_agg(f.h, ', ') FROM f WHERE f.proname = e.proname), '(não existe)') AS encontrado,
         e.h AS esperado,
         coalesce((SELECT count(*) = 1 AND bool_and(f.h = e.h) FROM f WHERE f.proname = e.proname), false) AS ok
    FROM esperado e
  UNION ALL
  SELECT '4. crm_relatorio_marketing: só service_role executa (anon / authenticated não)',
         (SELECT has_function_privilege('service_role', oid, 'EXECUTE') || ' / ' || has_function_privilege('anon', oid, 'EXECUTE')
                 || ' / ' || has_function_privilege('authenticated', oid, 'EXECUTE') FROM f WHERE proname = 'crm_relatorio_marketing'),
         'true / false / false',
         coalesce((SELECT has_function_privilege('service_role', oid, 'EXECUTE') AND NOT has_function_privilege('anon', oid, 'EXECUTE')
                      AND NOT has_function_privilege('authenticated', oid, 'EXECUTE') FROM f WHERE proname = 'crm_relatorio_marketing'), false)
) t
ORDER BY split_part(item, '.', 1)::int;
