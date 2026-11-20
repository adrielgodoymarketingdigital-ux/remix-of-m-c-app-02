// Gera, a partir de UM núcleo só, os dois SQL da cópia de dados de "Minhas garantias":
//   - supabase/migrations/20261120120100_minhas_garantias_copia_dados.sql  (grava)
//   - scripts/minhas-garantias/2-previa-copia.sql                            (SÓ leitura)
// Assim a prévia conta exatamente o que a migration vai inserir.
//
// Entradas que vêm do código (nada digitado à mão no SQL):
//   - texto padrão novo: src/lib/garantias/textoPadrao.ts
//   - modelos padrão de código (padrao_90dias/6meses/1ano): bloco de
//     src/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo.tsx,
//     transpilado com esbuild e avaliado (só constantes), para saber o md5
//     do texto de um modelo padrão salvo SEM alteração.
//
// Rodar (Node 23+, na raiz da worktree, com node_modules):
//   node scripts/minhas-garantias/gerar-sql-copia.ts            # grava os 2 arquivos
//   node scripts/minhas-garantias/gerar-sql-copia.ts --verificar # falha se estiverem desatualizados
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { TEXTO_PADRAO_COM_GARANTIA, TEXTO_PADRAO_SEM_GARANTIA } from "../../src/lib/garantias/textoPadrao.ts";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARQ_MIGRATION = "supabase/migrations/20261120120100_minhas_garantias_copia_dados.sql";
const ARQ_PREVIA = "scripts/minhas-garantias/2-previa-copia.sql";

// ── Modelos padrão de código ────────────────────────────────────────────────
interface Secao { visivel: unknown; conteudo: string }
interface Modelo { id: string; nome: string; secoes_com_garantia: Secao[]; secoes_sem_garantia: Secao[] }

export function modelosPadraoDoCodigo(): Modelo[] {
  const fonte = readFileSync(join(raiz, "src/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo.tsx"), "utf8");
  const ini = fonte.indexOf("const SECOES_PADRAO_COM_GARANTIA");
  const fim = fonte.indexOf("function gerarIdModelo");
  if (ini < 0 || fim < 0 || fim < ini) throw new Error("bloco dos modelos padrão não encontrado no diálogo do termo");
  const ts = fonte.slice(ini, fim).replace(/^export /gm, "");
  const { code } = transformSync(ts, { loader: "ts", format: "esm" });
  const modelos = new Function(`${code}\nreturn MODELOS_PADRAO_GARANTIA;`)() as Modelo[];
  if (!Array.isArray(modelos) || modelos.length === 0) throw new Error("MODELOS_PADRAO_GARANTIA vazio");
  return modelos;
}

/** Como o app junta as seções: filter(visivel).map(trim).join("\n\n"). */
export const juntarSecoes = (secoes: Secao[]) => secoes.filter((s) => s.visivel).map((s) => s.conteudo.trim()).join("\n\n");
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

// ── Núcleo SQL ──────────────────────────────────────────────────────────────
function dolar(texto: string, tag: string): string {
  if (texto.includes(`$${tag}$`)) throw new Error(`texto contém o delimitador $${tag}$`);
  return `$${tag}$${texto}$${tag}$`;
}

// Espaços que String.prototype.trim() remove (para o btrim do SQL fazer igual).
const ESPACOS_JS = String.raw`E'\u0009\u000A\u000B\u000C\u000D                  　﻿'`;
const TRIM = (x: string) => `btrim(${x}, ${ESPACOS_JS})`;
// Truthiness de JS para s.visivel.
const VISIVEL = (e: string) => `(CASE jsonb_typeof(${e}->'visivel')
        WHEN 'boolean' THEN (${e}->'visivel')::boolean
        WHEN 'string'  THEN (${e}->>'visivel') <> ''
        WHEN 'number'  THEN (${e}->>'visivel')::numeric <> 0
        WHEN 'object'  THEN true
        WHEN 'array'   THEN true
        ELSE false END)`;
// Seções visíveis → texto único ('' se nenhuma visível, como o JS).
const JUNTAR = (arr: string) => `(SELECT COALESCE(string_agg(${TRIM("COALESCE(s.e->>'conteudo', '')")}, E'\\n\\n' ORDER BY s.o), '')
        FROM jsonb_array_elements(${arr}) WITH ORDINALITY AS s(e, o)
        WHERE ${VISIVEL("s.e")})`;
// Espelho de resolverTextoTermoDispositivo (src/lib/termo-garantia-utils.ts).
const RESOLVER = (cfg: string, com: boolean) => {
  const livre = com ? "termo_com_garantia" : "termo_sem_garantia";
  const secoes = com ? "secoes_com_garantia" : "secoes_sem_garantia";
  const padrao = com ? "p.com" : "p.sem";
  return `CASE
        WHEN ${cfg} IS NULL OR jsonb_typeof(${cfg}) <> 'object' THEN ${padrao}
        WHEN ${cfg}->>'modo' = 'livre' THEN COALESCE(NULLIF(${cfg}->>'${livre}', ''), ${padrao})
        WHEN jsonb_typeof(${cfg}->'${secoes}') = 'array' AND jsonb_array_length(${cfg}->'${secoes}') > 0
          THEN ${JUNTAR(`${cfg}->'${secoes}'`)}
        ELSE COALESCE(NULLIF(${cfg}->>'${livre}', ''), ${padrao})
      END`;
};
const RE_MESES = String.raw`'(\d{1,3})\s*m[eêÊ]s'`;
const RE_ANOS = String.raw`'(\d{1,2})\s*anos?'`;
const RE_UM_ANO = String.raw`'(^|[^a-z0-9])(um|1)\s*ano([^a-z]|$)'`;
const RE_DIAS = String.raw`'(\d{2,3})\s*dias'`;
const RE_TEXTO = String.raw`'GARANTIA CONTRATUAL \((\d{1,3}) meses\)'`;

export function nucleo(): string {
  const padroes = modelosPadraoDoCodigo()
    .filter((m) => m.id.startsWith("padrao_"))
    .map((m) => `('${m.id}', '${md5(juntarSecoes(m.secoes_com_garantia))}', '${md5(juntarSecoes(m.secoes_sem_garantia))}')`)
    .join(",\n    ");
  return `WITH
padrao AS (
  SELECT ${dolar(TEXTO_PADRAO_COM_GARANTIA, "padrao_com")}::text AS com,
         ${dolar(TEXTO_PADRAO_SEM_GARANTIA, "padrao_sem")}::text AS sem
),
-- Modelos padrão do código salvos SEM alteração (id, md5 com, md5 sem): não viram garantia.
modelos_padrao_codigo (id, md5_com, md5_sem) AS (VALUES
    ${padroes}
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
      ${RESOLVER("l.cfg", true)} AS texto_com,
      ${RESOLVER("l.cfg", false)} AS texto_sem
  FROM lojas l CROSS JOIN padrao p
),
modelos AS (
  SELECT t.user_id, t.emp, t.texto_sem AS texto_sem_loja, m.o,
         COALESCE(m.e->>'id', 'sem_id_' || m.o) AS modelo_id,
         left(COALESCE(NULLIF(${TRIM("m.e->>'nome'")}, ''), 'Modelo importado'), 80) AS nome,
         CASE WHEN jsonb_typeof(m.e->'secoes_com_garantia') = 'array'
              THEN ${JUNTAR("m.e->'secoes_com_garantia'")} ELSE '' END AS texto_com,
         CASE WHEN jsonb_typeof(m.e->'secoes_sem_garantia') = 'array'
              THEN ${JUNTAR("m.e->'secoes_sem_garantia'")} END AS texto_sem
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
           WHEN regexp_match(lower(mo.nome), ${RE_MESES}) IS NOT NULL
             THEN GREATEST(1, LEAST((regexp_match(lower(mo.nome), ${RE_MESES}))[1]::int, 120))
           WHEN regexp_match(lower(mo.nome), ${RE_ANOS}) IS NOT NULL
             THEN GREATEST(1, LEAST((regexp_match(lower(mo.nome), ${RE_ANOS}))[1]::int * 12, 120))
           WHEN lower(mo.nome) ~ ${RE_UM_ANO} THEN 12
           WHEN regexp_match(lower(mo.nome), ${RE_DIAS}) IS NOT NULL
                AND (regexp_match(lower(mo.nome), ${RE_DIAS}))[1]::int >= 30
                AND (regexp_match(lower(mo.nome), ${RE_DIAS}))[1]::int % 30 IN (0, 5)
             THEN LEAST(round((regexp_match(lower(mo.nome), ${RE_DIAS}))[1]::int / 30.0)::int, 120)
           WHEN regexp_match(mo.texto_com, ${RE_TEXTO}) IS NOT NULL
             THEN GREATEST(1, LEAST((regexp_match(mo.texto_com, ${RE_TEXTO}))[1]::int, 120))
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
         ${TRIM(`left(COALESCE(NULLIF(${TRIM("tp.nome")}, ''), 'Garantia ' || tp.meses || ' meses'), 80)`)},
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
  SELECT 'd_modelos', mc.user_id, mc.emp, ${TRIM("mc.nome")}, COALESCE(mc.meses_inferidos, 3), mc.texto_com, true,
         (100 + mc.o)::int, mc.meses_inferidos IS NULL, 'modelo', mc.modelo_id || ':com'
  FROM modelos_classificados mc
  WHERE NOT mc.padrao_sem_alteracao
  UNION ALL
  -- d) "sem garantia" do modelo, só se diferente do da loja e dos modelos anteriores
  SELECT 'd_modelos_sem', mc.user_id, mc.emp, ${TRIM("left('Sem garantia — ' || mc.nome, 80)")}, 0, mc.texto_sem, true,
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
)`;
}

const AVISO_GERADO = "-- ARQUIVO GERADO por scripts/minhas-garantias/gerar-sql-copia.ts — não edite à mão.";

export function sqlMigration(): string {
  return `-- =====================================================================
-- "Minhas garantias" — FASE A, passo 2 de 2: CÓPIA DOS DADOS
${AVISO_GERADO}
--
-- Roda DEPOIS de 20261120120000_minhas_garantias_estrutura.sql.
-- Quem aplica em produção é o Adriel, no SQL Editor. NUNCA \`supabase db push\`.
-- Só INSERT em garantias_loja. Não lê nem altera vendas, não apaga nada, não
-- mexe em tipos_garantia nem em configuracoes_loja (o app de hoje continua
-- usando os dois). Idempotente: cada linha tem (origem, origem_ref) e só
-- entra se ainda não existir.
--
-- Por loja (dono + loja; "sem loja" conta como a matriz ativa do dono), com
-- o termo que o app usa hoje (linha da loja; sem linha → a da matriz):
--   a) "Sem garantia" (0 meses) com o texto SEM garantia da loja;
--   b) cada tipos_garantia → mesmo nome, prazo e ativo, com o texto COM
--      garantia da loja (modo livre ou seções, igual a resolverTextoTermoDispositivo,
--      inclusive: lista de seções com nenhuma visível = texto vazio);
--   c) termo salvo e nenhum tipos_garantia → 3, 6 e 12 meses com o texto da loja;
--   d) cada modelo salvo (da linha da matriz) → seções "com garantia" visíveis
--      viram texto único; prazo pelo nome ("6 meses", "1 ano", "90 dias") ou
--      pelo texto ("(12 meses)"); sem prazo claro → 3 meses e revisar = true.
--      "Sem garantia — <modelo>" só se o texto sem garantia do modelo for
--      diferente do da loja (e dos modelos anteriores).
--      Modelos padrão do código (padrao_90dias/6meses/1ano) salvos SEM
--      nenhuma alteração não viram garantia (o texto é o do código).
-- Loja sem tipos e sem termo: NADA é gravado (o app mostra os padrões virtuais).
--
-- ANTES: scripts/minhas-garantias/2-previa-copia.sql (só leitura) — mesmo núcleo.
-- DEPOIS: scripts/minhas-garantias/3-verificar-copia.sql.
-- ROLLBACK (NÃO RODE, só em emergência): scripts/minhas-garantias/rollback-2-copia.sql.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TEMP TABLE _garantias_a_inserir ON COMMIT DROP AS
${nucleo()}
SELECT * FROM a_inserir;

-- Nenhum texto pode passar do limite da tabela (abortar em vez de cortar conteúdo).
DO $$
DECLARE v_grandes int;
BEGIN
  SELECT count(*) INTO v_grandes FROM _garantias_a_inserir WHERE octet_length(texto) > 20000;
  IF v_grandes > 0 THEN
    RAISE EXCEPTION 'minhas garantias (cópia): % textos acima de 20000 bytes; nada foi gravado', v_grandes;
  END IF;
END
$$;

INSERT INTO public.garantias_loja (user_id, empresa_id, nome, meses, texto, ativo, ordem, revisar, origem, origem_ref)
SELECT user_id, empresa_id, nome, meses, texto, ativo, ordem, revisar, origem, origem_ref
FROM _garantias_a_inserir;

-- Autoverificação: cada tipos_garantia virou exatamente 1 garantia.
DO $$
DECLARE v_faltando int; v_repetidas int;
BEGIN
  SELECT count(*) INTO v_faltando FROM public.tipos_garantia t
   WHERE NOT EXISTS (SELECT 1 FROM public.garantias_loja g
                      WHERE g.origem = 'tipos_garantia' AND g.origem_ref = t.id::text);
  SELECT count(*) INTO v_repetidas FROM (
    SELECT 1 FROM public.garantias_loja WHERE origem = 'tipos_garantia'
    GROUP BY origem_ref HAVING count(*) > 1) x;
  IF v_faltando > 0 OR v_repetidas > 0 THEN
    RAISE EXCEPTION 'minhas garantias (cópia): % tipos sem garantia, % tipos repetidos', v_faltando, v_repetidas;
  END IF;
END
$$;

COMMIT;
`;
}

export function sqlPrevia(): string {
  return `-- =====================================================================
-- "Minhas garantias" — PRÉVIA da cópia de dados. SOMENTE LEITURA (só SELECT).
${AVISO_GERADO}
-- Mesmo núcleo da migration 20261120120100: conta o que ela VAI inserir agora
-- (o que já existe em garantias_loja não entra na conta). Antes da migration
-- de estrutura, garantias_loja não existe: rode esta prévia DEPOIS da
-- estrutura e ANTES da cópia.
-- Não traz nome, texto nem dado de cliente: só contagens.
-- =====================================================================
${nucleo()}
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
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const verificar = process.argv.includes("--verificar");
  const alvos: [string, string][] = [[ARQ_MIGRATION, sqlMigration()], [ARQ_PREVIA, sqlPrevia()]];
  let ok = true;
  for (const [arq, conteudo] of alvos) {
    const caminho = join(raiz, arq);
    if (verificar) {
      let atual = "";
      try { atual = readFileSync(caminho, "utf8"); } catch { /* ausente */ }
      if (atual !== conteudo) { ok = false; console.error(`DESATUALIZADO: ${arq}`); }
    } else {
      writeFileSync(caminho, conteudo);
      console.log(`gravado: ${arq}`);
    }
  }
  if (!ok) process.exit(1);
}
