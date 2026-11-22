-- =====================================================================
-- CRM — PESQUISA DE FEEDBACK — QUEM RECEBEU E QUANDO VOLTA. SOMENTE LEITURA.
-- Só contagens e datas: nenhum user_id, nome, e-mail ou telefone.
--
-- Uma linha por campanha e uma linha "(todas)" com pessoas distintas.
--   recebidos        pessoas com 'enviado' na campanha
--   so_falhou        pessoas com 'falhou' (nunca receberam nesta campanha)
--   primeiro_envio / ultimo_envio   (horário de Brasília)
--   ja_liberadas     já passaram da pausa (podem entrar em outra lista)
--   liberam_por_mes  quantas saem da pausa em cada um dos próximos 6 meses
--                    (mês atual + 5, Brasília); "depois" = além disso
-- A volta conta a partir do ÚLTIMO envio da pessoa em QUALQUER campanha
-- (é o que a pausa usa). Pausa: 120 dias (troque em params se usar outra).
-- Conta pessoas por conta (user_id); a lista ainda junta contas com o mesmo
-- telefone, então o número real de pessoas pode ser um pouco menor.
-- =====================================================================
WITH params AS (SELECT 120 AS pausa_dias),
meses AS (
  SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')) + make_interval(months => n) AS mes, n
    FROM generate_series(0, 5) n
),
volta AS (
  -- quando cada pessoa sai da pausa (último envio em qualquer campanha + pausa)
  SELECT c.destinatario_user_id AS uid,
         (max(c.enviado_em) + make_interval(days => (SELECT pausa_dias FROM params))) AS libera_em
    FROM public.crm_contato_campanha c
   WHERE c.resultado = 'enviado'
   GROUP BY c.destinatario_user_id
),
por_campanha AS (
  SELECT c.campanha, c.destinatario_user_id AS uid, c.resultado, c.enviado_em FROM public.crm_contato_campanha c
  UNION ALL
  SELECT '(todas)', c.destinatario_user_id, c.resultado, c.enviado_em FROM public.crm_contato_campanha c
),
pessoas AS (
  SELECT p.campanha, p.uid,
         bool_or(p.resultado = 'enviado') AS recebeu,
         min(p.enviado_em) AS primeiro, max(p.enviado_em) AS ultimo
    FROM por_campanha p
   GROUP BY p.campanha, p.uid
),
linhas AS (
  SELECT pe.*, (v.libera_em AT TIME ZONE 'America/Sao_Paulo') AS libera_local, v.libera_em
    FROM pessoas pe LEFT JOIN volta v ON v.uid = pe.uid
),
por_mes AS (
  SELECT l.campanha, m.n, m.mes,
         count(*) FILTER (WHERE l.recebeu AND l.libera_em > now()
                            AND l.libera_local >= m.mes AND l.libera_local < m.mes + interval '1 month') AS qtd
    FROM linhas l CROSS JOIN meses m
   GROUP BY l.campanha, m.n, m.mes
),
texto AS (
  SELECT campanha, string_agg(to_char(mes, 'MM/YYYY') || ': ' || qtd, ' · ' ORDER BY n) AS t
    FROM por_mes GROUP BY campanha
)
SELECT l.campanha,
       count(*) FILTER (WHERE l.recebeu) AS recebidos,
       count(*) FILTER (WHERE NOT l.recebeu) AS so_falhou,
       to_char(min(l.primeiro) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS primeiro_envio,
       to_char(max(l.ultimo) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS ultimo_envio,
       count(*) FILTER (WHERE l.recebeu AND l.libera_em <= now()) AS ja_liberadas,
       min(tx.t) || ' · depois: '
         || count(*) FILTER (WHERE l.recebeu AND l.libera_local >= (SELECT max(mes) FROM meses) + interval '1 month') AS liberam_por_mes
  FROM linhas l
  JOIN texto tx ON tx.campanha = l.campanha
 GROUP BY l.campanha
 ORDER BY l.campanha = '(todas)', min(l.primeiro) NULLS LAST, l.campanha;
