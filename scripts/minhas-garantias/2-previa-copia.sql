-- =====================================================================
-- "Minhas garantias" — PRÉVIA da cópia de dados. SOMENTE LEITURA (só SELECT).
-- ARQUIVO GERADO por scripts/minhas-garantias/gerar-sql-copia.ts — não edite à mão.
-- Mesmo núcleo da migration 20261120120100: conta o que ela VAI inserir agora
-- (o que já existe em garantias_loja não entra na conta). Antes da migration
-- de estrutura, garantias_loja não existe: rode esta prévia DEPOIS da
-- estrutura e ANTES da cópia.
-- Não traz nome, texto nem dado de cliente: só contagens.
-- =====================================================================
WITH
padrao AS (
  SELECT $padrao_com$TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}
Endereço: {{loja_endereco}}
Telefone: {{loja_telefone}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}
Telefone: {{telefone}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Nº Série: {{numero_serie}}
Cor: {{cor}}  |  Capacidade: {{capacidade}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor do produto: {{valor}}

1. GARANTIA CONTRATUAL ({{garantia_meses}})
   • Garantia de {{garantia_meses}} a partir da data desta venda, já incluindo o prazo mínimo de garantia legal previsto no CDC (Art. 26, II).
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

2. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

3. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.$padrao_com$::text AS com,
         $padrao_sem$DECLARAÇÃO DE VENDA SEM GARANTIA CONTRATUAL

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor do produto: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.$padrao_sem$::text AS sem
),
-- Modelos padrão do código salvos SEM alteração (id, md5 com, md5 sem): não viram garantia.
modelos_padrao_codigo (id, md5_com, md5_sem) AS (VALUES
    ('padrao_90dias', 'e55c90d4084e80fe8c46fd98ef50de44', '45072abdb208ac06db6b80a915bbbc20'),
    ('padrao_6meses', 'a98f2281883f8576e47ebeba642a6f7d', '45072abdb208ac06db6b80a915bbbc20'),
    ('padrao_1ano', 'b20c14aee97edde68716a3f4b8f997c0', '45072abdb208ac06db6b80a915bbbc20')
),
-- Matriz ativa do dono (EmpresaContext): registros "sem loja" são da matriz.
matriz AS (
  SELECT DISTINCT ON (e.proprietario_id) e.proprietario_id AS user_id, e.id
  FROM public.empresas e
  WHERE e.tipo = 'matriz' AND e.ativa = true AND e.proprietario_id IS NOT NULL
  ORDER BY e.proprietario_id, e.created_at, e.id
),
tipos AS (
  SELECT t.id, t.user_id, t.nome, t.meses, t.ativo, t.created_at,
         COALESCE(t.empresa_id, m.id) AS emp
  FROM public.tipos_garantia t
  LEFT JOIN matriz m ON m.user_id = t.user_id
),
-- Lojas: quem tem tipos_garantia ou termo salvo (sem loja → matriz, como a tela lê).
chaves AS (
  SELECT user_id, emp FROM tipos
  UNION
  SELECT c.user_id, COALESCE(c.empresa_id, m.id)
  FROM public.configuracoes_loja c
  LEFT JOIN matriz m ON m.user_id = c.user_id
  WHERE c.termo_garantia_dispositivo_config IS NOT NULL
),
-- Termo efetivo como useConfiguracaoLoja(empresaId): linha da loja; sem linha → matriz (empresa_id nulo).
-- Modelos: os da linha da matriz (o PDV lista os modelos com useConfiguracaoLoja() sem loja).
lojas AS (
  SELECT k.user_id, k.emp,
         CASE WHEN fil.achou THEN fil.cfg ELSE mat.cfg END AS cfg,
         mat.cfg -> 'modelos' AS modelos,
         EXISTS (SELECT 1 FROM tipos t WHERE t.user_id = k.user_id AND t.emp IS NOT DISTINCT FROM k.emp) AS tem_tipos
  FROM chaves k
  LEFT JOIN LATERAL (
    SELECT true AS achou, c.termo_garantia_dispositivo_config AS cfg
    FROM public.configuracoes_loja c
    WHERE k.emp IS NOT NULL AND c.user_id = k.user_id AND c.empresa_id = k.emp
    ORDER BY c.created_at DESC
    LIMIT 1
  ) fil ON true
  LEFT JOIN LATERAL (
    SELECT c.termo_garantia_dispositivo_config AS cfg
    FROM public.configuracoes_loja c
    WHERE c.user_id = k.user_id AND c.empresa_id IS NULL
    ORDER BY c.created_at DESC
    LIMIT 1
  ) mat ON true
),
textos AS (
  SELECT l.*,
      CASE
        WHEN l.cfg IS NULL OR jsonb_typeof(l.cfg) <> 'object' THEN p.com
        WHEN l.cfg->>'modo' = 'livre' THEN COALESCE(NULLIF(l.cfg->>'termo_com_garantia', ''), p.com)
        WHEN jsonb_typeof(l.cfg->'secoes_com_garantia') = 'array' AND jsonb_array_length(l.cfg->'secoes_com_garantia') > 0
          THEN (SELECT COALESCE(string_agg(btrim(COALESCE(s.e->>'conteudo', ''), E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), E'\n\n' ORDER BY s.o), '')
        FROM jsonb_array_elements(l.cfg->'secoes_com_garantia') WITH ORDINALITY AS s(e, o)
        WHERE (CASE jsonb_typeof(s.e->'visivel')
        WHEN 'boolean' THEN (s.e->'visivel')::boolean
        WHEN 'string'  THEN (s.e->>'visivel') <> ''
        WHEN 'number'  THEN (s.e->>'visivel')::numeric <> 0
        WHEN 'object'  THEN true
        WHEN 'array'   THEN true
        ELSE false END))
        ELSE COALESCE(NULLIF(l.cfg->>'termo_com_garantia', ''), p.com)
      END AS texto_com,
      CASE
        WHEN l.cfg IS NULL OR jsonb_typeof(l.cfg) <> 'object' THEN p.sem
        WHEN l.cfg->>'modo' = 'livre' THEN COALESCE(NULLIF(l.cfg->>'termo_sem_garantia', ''), p.sem)
        WHEN jsonb_typeof(l.cfg->'secoes_sem_garantia') = 'array' AND jsonb_array_length(l.cfg->'secoes_sem_garantia') > 0
          THEN (SELECT COALESCE(string_agg(btrim(COALESCE(s.e->>'conteudo', ''), E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), E'\n\n' ORDER BY s.o), '')
        FROM jsonb_array_elements(l.cfg->'secoes_sem_garantia') WITH ORDINALITY AS s(e, o)
        WHERE (CASE jsonb_typeof(s.e->'visivel')
        WHEN 'boolean' THEN (s.e->'visivel')::boolean
        WHEN 'string'  THEN (s.e->>'visivel') <> ''
        WHEN 'number'  THEN (s.e->>'visivel')::numeric <> 0
        WHEN 'object'  THEN true
        WHEN 'array'   THEN true
        ELSE false END))
        ELSE COALESCE(NULLIF(l.cfg->>'termo_sem_garantia', ''), p.sem)
      END AS texto_sem
  FROM lojas l CROSS JOIN padrao p
),
modelos AS (
  SELECT t.user_id, t.emp, t.texto_sem AS texto_sem_loja, m.o,
         COALESCE(m.e->>'id', 'sem_id_' || m.o) AS modelo_id,
         left(COALESCE(NULLIF(btrim(m.e->>'nome', E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), ''), 'Modelo importado'), 80) AS nome,
         CASE WHEN jsonb_typeof(m.e->'secoes_com_garantia') = 'array'
              THEN (SELECT COALESCE(string_agg(btrim(COALESCE(s.e->>'conteudo', ''), E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), E'\n\n' ORDER BY s.o), '')
        FROM jsonb_array_elements(m.e->'secoes_com_garantia') WITH ORDINALITY AS s(e, o)
        WHERE (CASE jsonb_typeof(s.e->'visivel')
        WHEN 'boolean' THEN (s.e->'visivel')::boolean
        WHEN 'string'  THEN (s.e->>'visivel') <> ''
        WHEN 'number'  THEN (s.e->>'visivel')::numeric <> 0
        WHEN 'object'  THEN true
        WHEN 'array'   THEN true
        ELSE false END)) ELSE '' END AS texto_com,
         CASE WHEN jsonb_typeof(m.e->'secoes_sem_garantia') = 'array'
              THEN (SELECT COALESCE(string_agg(btrim(COALESCE(s.e->>'conteudo', ''), E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), E'\n\n' ORDER BY s.o), '')
        FROM jsonb_array_elements(m.e->'secoes_sem_garantia') WITH ORDINALITY AS s(e, o)
        WHERE (CASE jsonb_typeof(s.e->'visivel')
        WHEN 'boolean' THEN (s.e->'visivel')::boolean
        WHEN 'string'  THEN (s.e->>'visivel') <> ''
        WHEN 'number'  THEN (s.e->>'visivel')::numeric <> 0
        WHEN 'object'  THEN true
        WHEN 'array'   THEN true
        ELSE false END)) END AS texto_sem
  FROM textos t
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.modelos) = 'array' THEN t.modelos ELSE '[]'::jsonb END)
       WITH ORDINALITY AS m(e, o)
  WHERE jsonb_typeof(m.e) = 'object'
),
modelos_classificados AS (
  SELECT mo.*,
         EXISTS (SELECT 1 FROM modelos_padrao_codigo pc
                  WHERE pc.id = mo.modelo_id AND pc.md5_com = md5(mo.texto_com)
                    AND pc.md5_sem IS NOT DISTINCT FROM md5(mo.texto_sem)) AS padrao_sem_alteracao,
         CASE
           WHEN regexp_match(lower(mo.nome), '(\d{1,3})\s*m[eêÊ]s') IS NOT NULL
             THEN GREATEST(1, LEAST((regexp_match(lower(mo.nome), '(\d{1,3})\s*m[eêÊ]s'))[1]::int, 120))
           WHEN regexp_match(lower(mo.nome), '(\d{1,2})\s*anos?') IS NOT NULL
             THEN GREATEST(1, LEAST((regexp_match(lower(mo.nome), '(\d{1,2})\s*anos?'))[1]::int * 12, 120))
           WHEN lower(mo.nome) ~ '(^|[^a-z0-9])(um|1)\s*ano([^a-z]|$)' THEN 12
           WHEN regexp_match(lower(mo.nome), '(\d{2,3})\s*dias') IS NOT NULL
                AND (regexp_match(lower(mo.nome), '(\d{2,3})\s*dias'))[1]::int >= 30
                AND (regexp_match(lower(mo.nome), '(\d{2,3})\s*dias'))[1]::int % 30 IN (0, 5)
             THEN LEAST(round((regexp_match(lower(mo.nome), '(\d{2,3})\s*dias'))[1]::int / 30.0)::int, 120)
           WHEN regexp_match(mo.texto_com, 'GARANTIA CONTRATUAL \((\d{1,3}) meses\)') IS NOT NULL
             THEN GREATEST(1, LEAST((regexp_match(mo.texto_com, 'GARANTIA CONTRATUAL \((\d{1,3}) meses\)'))[1]::int, 120))
         END AS meses_inferidos
  FROM modelos mo
),
novas AS (
  -- a) Sem garantia, com o texto "sem garantia" da loja
  SELECT 'a_sem_garantia'::text AS passo, t.user_id, t.emp AS empresa_id, 'Sem garantia'::text AS nome, 0 AS meses,
         t.texto_sem AS texto, true AS ativo, 0 AS ordem, false AS revisar, 'termo_global'::text AS origem, 'sem'::text AS origem_ref
  FROM textos t
  UNION ALL
  -- b) cada tipos_garantia, com o texto "com garantia" da loja
  SELECT 'b_tipos', tp.user_id, tp.emp,
         btrim(left(COALESCE(NULLIF(btrim(tp.nome, E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), ''), 'Garantia ' || tp.meses || ' meses'), 80), E'\u0009\u000A\u000B\u000C\u000D                  　﻿'),
         LEAST(tp.meses, 120), t.texto_com, tp.ativo,
         (10 * row_number() OVER (PARTITION BY tp.user_id, tp.emp ORDER BY tp.meses, tp.created_at, tp.id))::int,
         false, 'tipos_garantia', tp.id::text
  FROM tipos tp
  JOIN textos t ON t.user_id = tp.user_id AND t.emp IS NOT DISTINCT FROM tp.emp
  UNION ALL
  -- c) termo salvo e nenhum tipos_garantia → 3, 6 e 12 meses
  SELECT 'c_prazos_termo', t.user_id, t.emp, pz.nome, pz.meses, t.texto_com, true, pz.ordem, false,
         'termo_global', 'com:' || pz.meses
  FROM textos t
  CROSS JOIN (VALUES ('Garantia 3 meses', 3, 10), ('Garantia 6 meses', 6, 20), ('Garantia 12 meses', 12, 30)) AS pz(nome, meses, ordem)
  WHERE NOT t.tem_tipos AND t.cfg IS NOT NULL
  UNION ALL
  -- d) cada modelo salvo (menos os padrão do código sem alteração)
  SELECT 'd_modelos', mc.user_id, mc.emp, btrim(mc.nome, E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), COALESCE(mc.meses_inferidos, 3), mc.texto_com, true,
         (100 + mc.o)::int, mc.meses_inferidos IS NULL, 'modelo', mc.modelo_id || ':com'
  FROM modelos_classificados mc
  WHERE NOT mc.padrao_sem_alteracao
  UNION ALL
  -- d) "sem garantia" do modelo, só se diferente do da loja e dos modelos anteriores
  SELECT 'd_modelos_sem', mc.user_id, mc.emp, btrim(left('Sem garantia — ' || mc.nome, 80), E'\u0009\u000A\u000B\u000C\u000D                  　﻿'), 0, mc.texto_sem, true,
         (200 + mc.o)::int, false, 'modelo', mc.modelo_id || ':sem'
  FROM modelos_classificados mc
  WHERE NOT mc.padrao_sem_alteracao
    AND mc.texto_sem IS NOT NULL
    AND mc.texto_sem <> mc.texto_sem_loja
    AND NOT EXISTS (SELECT 1 FROM modelos_classificados m2
                     WHERE m2.user_id = mc.user_id AND m2.emp IS NOT DISTINCT FROM mc.emp
                       AND NOT m2.padrao_sem_alteracao AND m2.o < mc.o AND m2.texto_sem = mc.texto_sem)
),
-- 1 linha por (loja, origem, origem_ref) e só o que ainda não existe (rodar 2 vezes não duplica)
a_inserir AS (
  SELECT DISTINCT ON (n.user_id, n.empresa_id, n.origem, n.origem_ref) n.*
  FROM novas n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.garantias_loja g
     WHERE g.user_id = n.user_id AND g.empresa_id IS NOT DISTINCT FROM n.empresa_id
       AND g.origem = n.origem AND g.origem_ref = n.origem_ref)
  ORDER BY n.user_id, n.empresa_id, n.origem, n.origem_ref, n.ordem
)
SELECT passo,
       count(DISTINCT (user_id, empresa_id)) AS lojas,
       count(*) AS linhas,
       count(*) FILTER (WHERE revisar) AS revisar,
       count(*) FILTER (WHERE NOT ativo) AS inativas,
       count(*) FILTER (WHERE texto = '') AS texto_vazio,
       count(*) FILTER (WHERE octet_length(texto) > 20000) AS acima_do_limite,
       max(octet_length(texto)) AS maior_texto_bytes
FROM a_inserir
GROUP BY ROLLUP (passo)
ORDER BY passo NULLS LAST;
