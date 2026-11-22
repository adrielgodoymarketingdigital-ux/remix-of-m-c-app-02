-- =====================================================================
-- CRM — PESQUISA DE FEEDBACK COM PAGANTES — CONFERÊNCIA ANTES DE APLICAR.
-- SOMENTE LEITURA. Rodar em produção ANTES de
-- 20261122130000_crm_feedback_pagantes.sql.
-- A migration NÃO altera função nenhuma; os itens 1 a 3 conferem que as
-- funções de que ela DEPENDE são as do repositório (o teste foi feito
-- sobre elas). Os itens [INFORMATIVO] são só CONTAGENS (nenhum id, nome,
-- e-mail ou telefone sai daqui): anotar e me mandar.
-- Esperado: todas as linhas com ok = true. Se 1 a 6 derem false: PARE.
-- =====================================================================
WITH f AS (
  SELECT p.proname, md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) AS h
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('_crm_pagantes', '_crm_profile_elegivel', 'crm_normalizar_telefone')
),
precos(plano_tipo) AS (
  VALUES ('basico_mensal'), ('intermediario_mensal'), ('profissional_mensal'), ('profissional_ultra_mensal'),
         ('basico_anual'), ('intermediario_anual'), ('profissional_anual'), ('profissional_ultra_anual')
),
ativos AS (
  SELECT DISTINCT a.user_id AS uid
    FROM public.assinaturas a JOIN precos pr ON pr.plano_tipo = a.plano_tipo::text
   WHERE a.status::text = 'active' AND (a.data_fim IS NULL OR a.data_fim > now())
     AND coalesce(a.bloqueado_admin, false) = false
),
pagantes AS (SELECT p.user_id AS uid FROM public._crm_pagantes(ARRAY(SELECT uid FROM ativos)) p),
elegiveis AS (SELECT pg.uid FROM pagantes pg WHERE public._crm_profile_elegivel(pg.uid)),
cel AS (
  SELECT e.uid, public.crm_normalizar_telefone(pf.celular) AS tel
    FROM elegiveis e JOIN public.profiles pf ON pf.user_id = e.uid
),
cel_br AS (SELECT * FROM cel WHERE tel ~ '^\+55[1-9]{2}9[0-9]{8}$'),
sem_opt AS (
  SELECT c.* FROM cel_br c
   WHERE NOT EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.opt_out AND l.telefone_e164 = c.tel)
     AND NOT EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.opt_out AND l.cadastro_user_id = c.uid)
)
SELECT * FROM (VALUES
  ('1. _crm_pagantes = versão do repositório (fase 1)',
     (SELECT h FROM f WHERE proname = '_crm_pagantes'), '83436d28276fb79cf60bef2da5fd0890',
     coalesce((SELECT h FROM f WHERE proname = '_crm_pagantes') = '83436d28276fb79cf60bef2da5fd0890', false)),
  ('2. _crm_profile_elegivel = versão do repositório (fase 1)',
     (SELECT h FROM f WHERE proname = '_crm_profile_elegivel'), '62d97936d613da5e272e0e70cacc4047',
     coalesce((SELECT h FROM f WHERE proname = '_crm_profile_elegivel') = '62d97936d613da5e272e0e70cacc4047', false)),
  ('3. crm_normalizar_telefone = versão do repositório (fase 1)',
     (SELECT h FROM f WHERE proname = 'crm_normalizar_telefone'), '743b00cfd292a0196daded7f16ef5e4c',
     coalesce((SELECT h FROM f WHERE proname = 'crm_normalizar_telefone') = '743b00cfd292a0196daded7f16ef5e4c', false)),
  ('4. tabela crm_contato_campanha ainda não existe',
     coalesce(to_regclass('public.crm_contato_campanha')::text, '(não existe)'), '(não existe)',
     to_regclass('public.crm_contato_campanha') IS NULL),
  ('5. funções novas ainda não existem',
     concat_ws(', ', to_regprocedure('public.crm_pagantes_contato(text, integer, integer, uuid[])'),
                     to_regprocedure('public.crm_contato_registrar(text, jsonb)')), '',
     to_regprocedure('public.crm_pagantes_contato(text, integer, integer, uuid[])') IS NULL
       AND to_regprocedure('public.crm_contato_registrar(text, jsonb)') IS NULL),
  ('6. colunas usadas existem (profiles.nome/celular, assinaturas.data_fim/bloqueado_admin, crm_leads.opt_out/cadastro_user_id)',
     (SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name, column_name)
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (('profiles', 'nome'), ('profiles', 'celular'), ('assinaturas', 'data_fim'),
                                           ('assinaturas', 'bloqueado_admin'), ('crm_leads', 'opt_out'), ('crm_leads', 'cadastro_user_id'))),
     'assinaturas.bloqueado_admin, assinaturas.data_fim, crm_leads.cadastro_user_id, crm_leads.opt_out, profiles.celular, profiles.nome',
     (SELECT count(*) = 6 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (('profiles', 'nome'), ('profiles', 'celular'), ('assinaturas', 'data_fim'),
                                           ('assinaturas', 'bloqueado_admin'), ('crm_leads', 'opt_out'), ('crm_leads', 'cadastro_user_id')))),
  ('7. [INFORMATIVO] funil da lista: ativos em plano pago → com pagamento real → sem admin/teste/funcionário → celular BR → sem opt-out → telefones distintos',
     (SELECT count(*) FROM ativos) || ' → ' || (SELECT count(*) FROM pagantes) || ' → ' || (SELECT count(*) FROM elegiveis)
       || ' → ' || (SELECT count(*) FROM cel_br) || ' → ' || (SELECT count(*) FROM sem_opt) || ' → ' || (SELECT count(DISTINCT tel) FROM sem_opt),
     '(anotar)', true),
  ('8. [INFORMATIVO] ativos em plano pago SEM pagamento real (cortesia/liberação manual: ficam fora)',
     ((SELECT count(*) FROM ativos) - (SELECT count(*) FROM pagantes))::text, '(anotar)', true),
  ('9. [INFORMATIVO] elegíveis sem celular BR válido (vazio, fixo, estrangeiro ou inválido)',
     ((SELECT count(*) FROM cel) - (SELECT count(*) FROM cel_br))::text, '(anotar)', true)
) AS t(item, encontrado, esperado, ok);
