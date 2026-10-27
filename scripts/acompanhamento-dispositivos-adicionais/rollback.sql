-- REVERSÃO de supabase/migrations/20261031120000_acompanhamento_dispositivos_adicionais.sql
--
-- Recria get_os_tracking e get_cliente_tracking EXATAMENTE como estavam em produção
-- antes da migration (texto de pg_get_functiondef lido em 2026-10-26: com a coluna
-- fotos e sem dispositivos_adicionais), com os mesmos acessos. As funções *_status
-- não foram tocadas pela migration e não são tocadas aqui. Nenhum dado é alterado.
--
-- Ordem segura de reversão: primeiro voltar o CÓDIGO do front (o front novo
-- funciona sem a coluna — campo ausente = nenhum extra), depois rodar este arquivo
-- inteiro no SQL Editor. Uma transação só; a autoverificação aborta se o retorno
-- ou os acessos não ficarem idênticos aos de antes. Idempotente.

BEGIN;

DROP FUNCTION IF EXISTS public.get_cliente_tracking(text);
DROP FUNCTION IF EXISTS public.get_os_tracking(text);

-- ---------- Link por CLIENTE (definição de produção antes da migration) ----------

CREATE FUNCTION public.get_cliente_tracking(p_token text)
 RETURNS TABLE(cliente_nome text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, os_id uuid, numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, dispositivo_imei text, status_nome text, fotos jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id uuid;
  v_user_id uuid;
  v_mostrar_fotos boolean;
BEGIN
  UPDATE cliente_tracking_links
     SET visualizacoes = coalesce(visualizacoes, 0) + 1
   WHERE token = p_token
     AND ativo = true
  RETURNING cliente_id, user_id INTO v_cliente_id, v_user_id;

  IF v_cliente_id IS NULL THEN
    RETURN;
  END IF;

  -- Opção da loja "Mostrar fotos no acompanhamento": só a linha da matriz.
  SELECT (cl.cores_personalizadas -> 'tracking_config' -> 'mostrar_fotos') = 'true'::jsonb
    INTO v_mostrar_fotos
    FROM configuracoes_loja cl
   WHERE cl.user_id = v_user_id
     AND cl.empresa_id IS NULL
   ORDER BY cl.created_at DESC
   LIMIT 1;
  v_mostrar_fotos := coalesce(v_mostrar_fotos, false);

  RETURN QUERY
  SELECT
    cli.nome,
    loja.nome_loja, loja.logo_url,
    loja.cores_personalizadas ->> 'cor_primaria' AS cor_primaria,
    loja.telefone, loja.endereco,
    loja.cores_personalizadas,
    os.id, os.numero_os, os.status, os.defeito_relatado, os.total,
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo,
    os.dispositivo_imei,
    (SELECT sc.nome FROM os_status_config sc
      WHERE sc.user_id = v_user_id AND sc.slug = os.status
      ORDER BY sc.ordem LIMIT 1) AS status_nome,
    CASE
      WHEN v_mostrar_fotos
       AND (os.avarias -> 'fotos_acompanhamento') = 'true'::jsonb
       AND jsonb_typeof(os.avarias -> 'fotos_dispositivo') = 'array'
      THEN coalesce((
        SELECT jsonb_agg(f.url ORDER BY f.ord)
          FROM (
            SELECT e.url, e.ord
              FROM jsonb_array_elements(os.avarias -> 'fotos_dispositivo') WITH ORDINALITY AS e(url, ord)
             WHERE jsonb_typeof(e.url) = 'string'
               AND (e.url #>> '{}') ~* '^\s*https?://'
             ORDER BY e.ord
             LIMIT 6
          ) f
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END AS fotos
  FROM clientes cli
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  LEFT JOIN ordens_servico os
    ON os.cliente_id = cli.id
   AND os.user_id = v_user_id
   AND os.deleted_at IS NULL
  WHERE cli.id = v_cliente_id
    AND cli.deleted_at IS NULL
  ORDER BY os.created_at DESC;
END;
$function$;

-- ---------- Link por OS (definição de produção antes da migration) ----------

CREATE FUNCTION public.get_os_tracking(p_token text)
 RETURNS TABLE(numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, cliente_nome text, cliente_telefone text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, status_nome text, fotos jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os_id uuid;
  v_user_id uuid;
  v_mostrar_fotos boolean;
BEGIN
  UPDATE os_tracking_links
     SET visualizacoes = coalesce(visualizacoes, 0) + 1
   WHERE token = p_token
     AND ativo = true
  RETURNING os_id, user_id INTO v_os_id, v_user_id;

  IF v_os_id IS NULL THEN
    RETURN;
  END IF;

  -- Opção da loja "Mostrar fotos no acompanhamento": só a linha da matriz.
  SELECT (cl.cores_personalizadas -> 'tracking_config' -> 'mostrar_fotos') = 'true'::jsonb
    INTO v_mostrar_fotos
    FROM configuracoes_loja cl
   WHERE cl.user_id = v_user_id
     AND cl.empresa_id IS NULL
   ORDER BY cl.created_at DESC
   LIMIT 1;
  v_mostrar_fotos := coalesce(v_mostrar_fotos, false);

  RETURN QUERY
  SELECT
    os.numero_os, os.status, os.defeito_relatado, os.total,
    os.created_at, os.data_saida, os.dispositivo_marca, os.dispositivo_modelo,
    cli.nome, cli.telefone,
    loja.nome_loja, loja.logo_url,
    loja.cores_personalizadas ->> 'cor_primaria' AS cor_primaria,
    loja.telefone, loja.endereco,
    loja.cores_personalizadas,
    (SELECT sc.nome FROM os_status_config sc
      WHERE sc.user_id = v_user_id AND sc.slug = os.status
      ORDER BY sc.ordem LIMIT 1) AS status_nome,
    CASE
      WHEN v_mostrar_fotos
       AND (os.avarias -> 'fotos_acompanhamento') = 'true'::jsonb
       AND jsonb_typeof(os.avarias -> 'fotos_dispositivo') = 'array'
      THEN coalesce((
        SELECT jsonb_agg(f.url ORDER BY f.ord)
          FROM (
            SELECT e.url, e.ord
              FROM jsonb_array_elements(os.avarias -> 'fotos_dispositivo') WITH ORDINALITY AS e(url, ord)
             WHERE jsonb_typeof(e.url) = 'string'
               AND (e.url #>> '{}') ~* '^\s*https?://'
             ORDER BY e.ord
             LIMIT 6
          ) f
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END AS fotos
  FROM ordens_servico os
  LEFT JOIN clientes cli ON cli.id = os.cliente_id
  LEFT JOIN configuracoes_loja loja ON loja.user_id = v_user_id
  WHERE os.id = v_os_id
    AND os.deleted_at IS NULL;
END;
$function$;

-- ---------- Acessos (o DROP remove; mesmos de antes) ----------

REVOKE ALL ON FUNCTION public.get_cliente_tracking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cliente_tracking(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_os_tracking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_os_tracking(text) TO anon, authenticated, service_role;

-- ---------- Autoverificação: qualquer divergência aborta a transação ----------

DO $verifica$
DECLARE
  v_acl_esperada text[] := ARRAY[
    'anon:EXECUTE:postgres:false',
    'authenticated:EXECUTE:postgres:false',
    'postgres:EXECUTE:postgres:false',
    'service_role:EXECUTE:postgres:false'];
  r record;
  v_oid oid;
  v_acl text[];
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.get_os_tracking(text)',             'TABLE(numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, cliente_nome text, cliente_telefone text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, status_nome text, fotos jsonb)'),
      ('public.get_cliente_tracking(text)',        'TABLE(cliente_nome text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, os_id uuid, numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, dispositivo_imei text, status_nome text, fotos jsonb)'),
      ('public.get_os_tracking_status(text)',      'TABLE(numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, cliente_nome text, cliente_telefone text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, status_nome text)'),
      ('public.get_cliente_tracking_status(text)', 'TABLE(cliente_nome text, nome_loja text, logo_url text, cor_primaria text, loja_telefone text, loja_endereco text, cores_personalizadas jsonb, os_id uuid, numero_os text, status text, defeito_relatado text, total numeric, os_created_at timestamp with time zone, data_saida timestamp with time zone, dispositivo_marca text, dispositivo_modelo text, dispositivo_imei text, status_nome text)')
    ) AS t(assinatura, resultado)
  LOOP
    v_oid := to_regprocedure(r.assinatura);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'autoverificacao: % nao existe', r.assinatura;
    END IF;
    IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = split_part(substr(r.assinatura, 8), '(', 1)) <> 1 THEN
      RAISE EXCEPTION 'autoverificacao: % tem sobrecarga (mais de uma assinatura)', r.assinatura;
    END IF;
    IF pg_get_function_result(v_oid) IS DISTINCT FROM r.resultado THEN
      RAISE EXCEPTION 'autoverificacao: retorno de % diverge: %', r.assinatura, pg_get_function_result(v_oid);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
       WHERE p.oid = v_oid
         AND p.prosecdef
         AND p.prokind = 'f'
         AND p.proretset
         AND l.lanname = 'plpgsql'
         AND p.proconfig = ARRAY['search_path=public']
         AND pg_get_userbyid(p.proowner) = 'postgres'
    ) THEN
      RAISE EXCEPTION 'autoverificacao: % perdeu SECURITY DEFINER / search_path=public / dono postgres / plpgsql', r.assinatura;
    END IF;
    SELECT array_agg(x.item ORDER BY x.item)
      INTO v_acl
      FROM (
        SELECT format('%s:%s:%s:%s',
                 CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
                 a.privilege_type, pg_get_userbyid(a.grantor), a.is_grantable::text) AS item
          FROM pg_proc p, aclexplode(p.proacl) a
         WHERE p.oid = v_oid
      ) x;
    IF v_acl IS DISTINCT FROM v_acl_esperada THEN
      RAISE EXCEPTION 'autoverificacao: acessos de % divergem: %', r.assinatura, v_acl;
    END IF;
  END LOOP;

  -- A tabela de extras continua fechada para anon (acesso só pelo corpo das funções).
  IF has_table_privilege('anon', 'public.os_dispositivos_adicionais',
                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
    RAISE EXCEPTION 'autoverificacao: anon tem privilegio em os_dispositivos_adicionais';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.os_dispositivos_adicionais'::regclass) THEN
    RAISE EXCEPTION 'autoverificacao: RLS desligado em os_dispositivos_adicionais';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'os_dispositivos_adicionais'
                AND roles <> ARRAY['authenticated']::name[]) THEN
    RAISE EXCEPTION 'autoverificacao: policy de os_dispositivos_adicionais para papel diferente de authenticated';
  END IF;

  RAISE NOTICE 'autoverificacao OK (sem dispositivos_adicionais)';
END
$verifica$;

COMMIT;
