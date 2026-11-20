// "Minhas garantias" — prova das 2 migrations num Postgres 17 local (PGlite).
// NÃO toca em produção: monta uma réplica mínima (papéis do Supabase, auth.uid,
// privilégios padrão, empresas/empresa_usuarios/loja_funcionarios, tipos_garantia
// pela migration real, configuracoes_loja, vendas, dispositivos e a
// _zerar_catalogo() de 20261102120000) e testa.
//
// Rodar (o PGlite não é dependência do projeto; Node 23+ por causa dos .ts):
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/minhas-garantias/teste-pglite.mjs              # testes
//   PGLITE_DIR=/tmp/pg node scripts/minhas-garantias/teste-pglite.mjs --mutantes   # + mutantes
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolverTextoTermoDispositivo } from "../../src/lib/termo-garantia-utils.ts";
import { TEXTO_PADRAO_COM_GARANTIA, TEXTO_PADRAO_SEM_GARANTIA } from "../../src/lib/garantias/textoPadrao.ts";
import { juntarSecoes, modelosPadraoDoCodigo } from "./gerar-sql-copia.ts";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");

const ESTRUTURA = ler("supabase/migrations/20261120120000_minhas_garantias_estrutura.sql");
const COPIA = ler("supabase/migrations/20261120120100_minhas_garantias_copia_dados.sql");
const PREVIA = ler("scripts/minhas-garantias/2-previa-copia.sql");
const TIPOS_GARANTIA = ler("supabase/migrations/20260617000001_create_tipos_garantia.sql");
const CONFERIR = ler("scripts/minhas-garantias/0-conferir-producao.sql");
const VERIF_ESTRUTURA = ler("scripts/minhas-garantias/1-verificar-estrutura.sql");
const VERIF_COPIA = ler("scripts/minhas-garantias/3-verificar-copia.sql");
const ROLLBACK_1 = ler("scripts/minhas-garantias/rollback-1-estrutura.sql");
const ROLLBACK_2 = ler("scripts/minhas-garantias/rollback-2-copia.sql");

// _zerar_catalogo() como está em 20261102120000 (a última que a redefiniu no repositório).
function zerarCatalogoBase() {
  const f = ler("supabase/migrations/20261102120000_configuracao_estoque_baixo.sql");
  const ini = f.indexOf("CREATE OR REPLACE FUNCTION public._zerar_catalogo()");
  const fim = f.indexOf("$$;", ini) + 3;
  return f.slice(ini, fim) + "\nREVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;\n";
}

const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Como o Supabase: tudo novo em public nasce com ALL para anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL DEFAULT 'x',
  proprietario_id uuid, tipo text NOT NULL, ativa boolean DEFAULT true, created_at timestamptz DEFAULT now());
CREATE TABLE public.empresa_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid, gerente_id uuid, proprietario_id uuid);
CREATE TABLE public.loja_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), funcionario_user_id uuid, loja_user_id uuid, ativo boolean DEFAULT true);
CREATE OR REPLACE FUNCTION public.is_funcionario_of(owner_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.loja_funcionarios
    WHERE funcionario_user_id = auth.uid() AND loja_user_id = owner_user_id AND ativo = true) $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TABLE public.configuracoes_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, empresa_id uuid,
  termo_garantia_dispositivo_config jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, empresa_id uuid, tempo_garantia integer);
CREATE TABLE public.dispositivos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL);
`;

// ── Pessoas e lojas (ids fictícios) ─────────────────────────────────────────
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const U1 = id(1), U2 = id(2), U3 = id(3), U4 = id(4), U5 = id(5);
const FUNC = id(51), GER = id(52), ESTRANHO = id(53);
const M = id(501), F1 = id(511), F2 = id(512), F3 = id(513);

const cfgU2 = { modo: "livre", termo_com_garantia: "COM U2 {{garantia_meses}} meses", termo_sem_garantia: "SEM U2" };
const cfgU3 = {
  modo: "secoes",
  secoes_com_garantia: [
    { id: "a", visivel: true, conteudo: "  A1  " },
    { id: "b", visivel: false, conteudo: "oculta" },
    { id: "c", visivel: "sim", conteudo: "\nA2\n" },
    { id: "d", visivel: 0, conteudo: "zero" },
  ],
  secoes_sem_garantia: [{ id: "s", visivel: true, conteudo: "S3" }],
};
// Nenhuma seção visível: o app imprime texto vazio (não cai no padrão).
const cfgU3b = { secoes_com_garantia: [{ id: "a", visivel: false, conteudo: "x" }], secoes_sem_garantia: [] };
const padroesCodigo = modelosPadraoDoCodigo();
const p90 = padroesCodigo.find((m) => m.id === "padrao_90dias");
const p6 = padroesCodigo.find((m) => m.id === "padrao_6meses");
const p6alterado = {
  ...p6,
  secoes_com_garantia: p6.secoes_com_garantia.map((s, i) => (i === 0 ? { ...s, conteudo: s.conteudo + "\nWhatsApp da loja" } : s)),
};
const SEC = (t) => [{ id: "x", titulo: "x", visivel: true, conteudo: t }];
const cfgU4 = {
  modo: "secoes",
  secoes_com_garantia: SEC("COM U4"),
  secoes_sem_garantia: SEC("SEM U4"),
  modelos: [
    p90, // padrão do código salvo sem alteração → não vira garantia
    p6alterado,
    { id: "m_x", nome: "Seminovo vitrine", secoes_com_garantia: SEC("vitrine"), secoes_sem_garantia: SEC("SEM U4") },
    { id: "m_y", nome: "Garantia 2 anos", secoes_com_garantia: SEC("texto 2a"), secoes_sem_garantia: SEC("SEM DIFERENTE") },
    { id: "m_z", nome: "Promo 90 dias", secoes_com_garantia: [{ id: "q", visivel: false, conteudo: "q" }], secoes_sem_garantia: SEC("SEM DIFERENTE") },
    { id: "m_w", nome: "Especial", secoes_com_garantia: SEC("2. GARANTIA CONTRATUAL (18 meses)"), secoes_sem_garantia: SEC("SEM U4") },
  ],
};
const cfgM = { modo: "livre", termo_com_garantia: "COM MATRIZ", termo_sem_garantia: "SEM MATRIZ" };
const cfgF1 = { modo: "livre", termo_com_garantia: "COM F1", termo_sem_garantia: "SEM F1" };

const SEED = `
INSERT INTO public.configuracoes_loja (user_id, empresa_id, termo_garantia_dispositivo_config) VALUES
  ('${U1}', NULL, NULL),
  ('${U2}', NULL, '${JSON.stringify(cfgU2)}'),
  ('${U3}', NULL, '${JSON.stringify(cfgU3)}'),
  ('${U4}', NULL, '${JSON.stringify(cfgU4).replace(/'/g, "''")}'),
  ('${U5}', NULL, '${JSON.stringify(cfgM)}'),
  ('${U5}', '${F1}', '${JSON.stringify(cfgF1)}'),
  ('${U5}', '${F3}', NULL);
INSERT INTO public.empresas (id, proprietario_id, tipo) VALUES
  ('${M}', '${U5}', 'matriz'), ('${F1}', '${U5}', 'filial'), ('${F2}', '${U5}', 'filial'), ('${F3}', '${U5}', 'filial');
INSERT INTO public.empresa_usuarios (empresa_id, gerente_id, proprietario_id) VALUES ('${F1}', '${GER}', '${U5}');
INSERT INTO public.loja_funcionarios (funcionario_user_id, loja_user_id) VALUES ('${FUNC}', '${U5}');
INSERT INTO public.tipos_garantia (id, user_id, empresa_id, nome, meses, ativo, created_at) VALUES
  ('${id(31)}', '${U3}', NULL, 'Garantia 3m', 3, true, now() - interval '3 day'),
  ('${id(32)}', '${U3}', NULL, '   ', 6, false, now() - interval '2 day'),
  ('${id(33)}', '${U3}', NULL, 'Um ano', 12, true, now() - interval '1 day'),
  ('${id(51 + 1000)}', '${U5}', NULL, 'TM', 3, true, now()),
  ('${id(52 + 1000)}', '${U5}', '${F1}', 'TF1', 6, true, now()),
  ('${id(53 + 1000)}', '${U5}', '${F2}', 'TF2', 12, true, now()),
  ('${id(54 + 1000)}', '${U5}', '${F3}', 'TF3', 3, true, now());
`;
// U3b: outra loja só para "nenhuma seção visível" (tipos + termo sem nada visível)
const U3B = id(6);
const SEED_U3B = `
INSERT INTO public.configuracoes_loja (user_id, empresa_id, termo_garantia_dispositivo_config) VALUES ('${U3B}', NULL, '${JSON.stringify(cfgU3b)}');
INSERT INTO public.tipos_garantia (id, user_id, nome, meses) VALUES ('${id(61)}', '${U3B}', 'G6', 6);
`;

// ── Esperado (calculado com as funções REAIS do app) ────────────────────────
const res = (cfg, com) => resolverTextoTermoDispositivo(cfg, com, TEXTO_PADRAO_COM_GARANTIA, TEXTO_PADRAO_SEM_GARANTIA);
const ESPERADO = [
  // [user, empresa, origem, origem_ref, nome, meses, revisar, ativo, texto]
  [U2, null, "termo_global", "sem", "Sem garantia", 0, false, true, res(cfgU2, false)],
  [U2, null, "termo_global", "com:3", "Garantia 3 meses", 3, false, true, res(cfgU2, true)],
  [U2, null, "termo_global", "com:6", "Garantia 6 meses", 6, false, true, res(cfgU2, true)],
  [U2, null, "termo_global", "com:12", "Garantia 12 meses", 12, false, true, res(cfgU2, true)],
  [U3, null, "termo_global", "sem", "Sem garantia", 0, false, true, res(cfgU3, false)],
  [U3, null, "tipos_garantia", id(31), "Garantia 3m", 3, false, true, res(cfgU3, true)],
  [U3, null, "tipos_garantia", id(32), "Garantia 6 meses", 6, false, false, res(cfgU3, true)],
  [U3, null, "tipos_garantia", id(33), "Um ano", 12, false, true, res(cfgU3, true)],
  [U3B, null, "termo_global", "sem", "Sem garantia", 0, false, true, res(cfgU3b, false)],
  [U3B, null, "tipos_garantia", id(61), "G6", 6, false, true, res(cfgU3b, true)],
  [U4, null, "termo_global", "sem", "Sem garantia", 0, false, true, "SEM U4"],
  [U4, null, "termo_global", "com:3", "Garantia 3 meses", 3, false, true, "COM U4"],
  [U4, null, "termo_global", "com:6", "Garantia 6 meses", 6, false, true, "COM U4"],
  [U4, null, "termo_global", "com:12", "Garantia 12 meses", 12, false, true, "COM U4"],
  [U4, null, "modelo", "padrao_6meses:com", "Garantia 6 meses", 6, false, true, juntarSecoes(p6alterado.secoes_com_garantia)],
  [U4, null, "modelo", "padrao_6meses:sem", "Sem garantia — Garantia 6 meses", 0, false, true, juntarSecoes(p6alterado.secoes_sem_garantia)],
  [U4, null, "modelo", "m_x:com", "Seminovo vitrine", 3, true, true, "vitrine"],
  [U4, null, "modelo", "m_y:com", "Garantia 2 anos", 24, false, true, "texto 2a"],
  [U4, null, "modelo", "m_y:sem", "Sem garantia — Garantia 2 anos", 0, false, true, "SEM DIFERENTE"],
  [U4, null, "modelo", "m_z:com", "Promo 90 dias", 3, false, true, ""],
  [U4, null, "modelo", "m_w:com", "Especial", 18, false, true, "2. GARANTIA CONTRATUAL (18 meses)"],
  [U5, M, "termo_global", "sem", "Sem garantia", 0, false, true, "SEM MATRIZ"],
  [U5, M, "tipos_garantia", id(1051), "TM", 3, false, true, "COM MATRIZ"],
  [U5, F1, "termo_global", "sem", "Sem garantia", 0, false, true, "SEM F1"],
  [U5, F1, "tipos_garantia", id(1052), "TF1", 6, false, true, "COM F1"],
  [U5, F2, "termo_global", "sem", "Sem garantia", 0, false, true, "SEM MATRIZ"],
  [U5, F2, "tipos_garantia", id(1053), "TF2", 12, false, true, "COM MATRIZ"],
  [U5, F3, "termo_global", "sem", "Sem garantia", 0, false, true, TEXTO_PADRAO_SEM_GARANTIA],
  [U5, F3, "tipos_garantia", id(1054), "TF3", 3, false, true, TEXTO_PADRAO_COM_GARANTIA],
];

// ── Utilidades ──────────────────────────────────────────────────────────────
async function como(db, papel, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${papel}`);
    await tx.query("SELECT set_config('request.jwt.claims', $1, true)",
      [JSON.stringify(uid ? { sub: uid, role: papel } : { role: papel })]);
    return fn(tx);
  });
}
async function erro(p) {
  try { await p; return null; } catch (e) { return e.message; }
}
async function novoBanco(zerar = zerarCatalogoBase()) {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(TIPOS_GARANTIA);
  await db.exec(zerar);
  return db;
}
async function aplicar(db, sql) {
  try { await db.exec(sql); return null; } catch (e) {
    await db.exec("ROLLBACK").catch(() => {});
    return e.message;
  }
}

// ── Rodada completa (devolve nº de falhas) ──────────────────────────────────
async function rodar({ estrutura, copia, previa, verbose }) {
  let falhas = 0;
  const ok = (cond, msg, extra) => {
    if (cond) { if (verbose) console.log("  ✓", msg); }
    else { falhas++; if (verbose) console.log("  ✗", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 400)); }
  };
  const log = (t) => verbose && console.log(`\n${t}`);

  // 1) _zerar_catalogo: aborta se a função de produção não for a esperada
  log("1. Estrutura aborta sem efeito se a _zerar_catalogo não for a esperada");
  for (const [rotulo, estragar, motivo] of [
    ["111 linhas", (z) => z.replace(/\n\s*\(1540, 'MANTER'[^\n]*/, ""), "esperado 112"],
    ["linha 1550 diferente", (z) => z.replace("'public.configuracao_estoque',", "'public.configuracao_estoque_x',"), "linha 1550"],
  ]) {
    const db = await novoBanco(estragar(zerarCatalogoBase()));
    const e = await aplicar(db, estrutura);
    const existe = (await db.query("SELECT to_regclass('public.garantias_loja') AS t")).rows[0].t;
    const colunas = (await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'vendas' AND column_name LIKE 'garantia%'")).rows[0].n;
    ok(!!e && e.includes(motivo) && existe === null && colunas === 0, `${rotulo}: erro "${motivo}" e nada criado`, e);
    await db.close();
  }

  const db = await novoBanco();
  const um = async (sql, p) => (await db.query(sql, p)).rows[0];

  // 0) consulta de conferência (somente leitura) antes de aplicar
  log("0. Conferência de produção (somente leitura) antes da estrutura");
  const conf = await db.transaction(async (tx) => {
    await tx.exec("SET TRANSACTION READ ONLY");
    return (await tx.query(CONFERIR)).rows;
  }).catch((e) => e.message);
  ok(Array.isArray(conf) && conf.every((r) => r.ok === true), "0-conferir-producao: tudo ok e roda em READ ONLY", conf);

  const defAntes = (await um("SELECT pg_get_functiondef('public._zerar_catalogo()'::regprocedure) AS d")).d;

  // 2) estrutura + idempotência
  log("2. Estrutura (2 vezes)");
  { const e1 = await aplicar(db, estrutura); ok(e1 === null, "1ª execução sem erro", e1); }
  const defDepois = (await um("SELECT pg_get_functiondef('public._zerar_catalogo()'::regprocedure) AS d")).d;
  { const e2 = await aplicar(db, estrutura); ok(e2 === null, "2ª execução sem erro", e2); }
  const defDepois2 = (await um("SELECT pg_get_functiondef('public._zerar_catalogo()'::regprocedure) AS d")).d;
  ok(defDepois === defDepois2, "2ª execução não mexe de novo na _zerar_catalogo");
  const linhasAntes = defAntes.split("\n"), linhasDepois = defDepois.split("\n");
  const novas = linhasDepois.filter((l) => !linhasAntes.includes(l));
  const sumiram = linhasAntes.filter((l) => !linhasDepois.includes(l));
  ok(sumiram.length === 0 && novas.length === 3 && linhasDepois.length === linhasAntes.length + 3,
    "_zerar_catalogo: só +3 linhas (comentário + 2 tabelas), nenhuma removida", { novas, sumiram });
  const pos1550 = linhasDepois.findIndex((l) => l.includes("public.configuracao_estoque"));
  ok(linhasDepois[pos1550 + 2]?.includes("public.garantias_loja") && linhasDepois[pos1550 + 3]?.includes("public.garantias_textos_venda"),
    "as 2 linhas entram logo depois da 1550");
  ok((await um("SELECT count(*)::int AS n FROM public._zerar_catalogo()")).n === 114, "_zerar_catalogo: 114 linhas");
  const priv = await um(`SELECT has_function_privilege('authenticated', 'public._zerar_catalogo()', 'EXECUTE') AS a,
                                has_function_privilege('anon', 'public._zerar_catalogo()', 'EXECUTE') AS b`);
  ok(!priv.a && !priv.b, "_zerar_catalogo continua fechada para anon/authenticated");
  const verifE = await db.transaction(async (tx) => { await tx.exec("SET TRANSACTION READ ONLY"); return (await tx.query(VERIF_ESTRUTURA)).rows; })
    .catch((e) => e.message);
  ok(Array.isArray(verifE) && verifE.every((r) => r.ok === true), "1-verificar-estrutura: tudo ok (READ ONLY)", verifE);

  // 3) prévia (somente leitura) antes da cópia
  log("3. Prévia (somente leitura) antes da cópia");
  await db.exec(SEED);
  await db.exec(SEED_U3B);
  const prev = await db.transaction(async (tx) => { await tx.exec("SET TRANSACTION READ ONLY"); return (await tx.query(previa)).rows; })
    .catch((e) => e.message);
  ok(Array.isArray(prev), "prévia roda em READ ONLY", prev);
  const porPasso = Object.fromEntries((Array.isArray(prev) ? prev : []).map((r) => [r.passo ?? "TOTAL", Number(r.linhas)]));

  // 4) cópia (2 vezes)
  log("4. Cópia dos dados (2 vezes)");
  { const c1 = await aplicar(db, copia); ok(c1 === null, "1ª execução sem erro", c1); }
  const total1 = (await um("SELECT count(*)::int AS n FROM public.garantias_loja")).n;
  { const c2 = await aplicar(db, copia); ok(c2 === null, "2ª execução sem erro", c2); }
  const total2 = (await um("SELECT count(*)::int AS n FROM public.garantias_loja")).n;
  ok(total1 === ESPERADO.length && total2 === total1, `idempotente: ${total1} linhas nas 2 execuções (esperado ${ESPERADO.length})`, { total1, total2 });

  const linhas = (await db.query(`SELECT user_id, empresa_id, origem, origem_ref, nome, meses, revisar, ativo, texto, deleted_at
                                   FROM public.garantias_loja`)).rows;
  const chave = (u, e, o, r) => `${u}|${e}|${o}|${r}`;
  const mapa = new Map(linhas.map((l) => [chave(l.user_id, l.empresa_id, l.origem, l.origem_ref), l]));
  for (const [u, e, o, r, nome, meses, revisar, ativo, texto] of ESPERADO) {
    const l = mapa.get(chave(u, e, o, r));
    const igual = l && l.nome === nome && l.meses === meses && l.revisar === revisar && l.ativo === ativo && l.texto === texto && l.deleted_at === null;
    ok(!!igual, `${u.slice(-3)}/${e ? e.slice(-3) : "-"} ${o}:${r} → "${nome}", ${meses}m`, l ? { nome: l.nome, meses: l.meses, revisar: l.revisar, ativo: l.ativo, texto: l.texto.slice(0, 80) } : "ausente");
  }
  ok(!linhas.some((l) => l.user_id === U1), "loja sem nada (U1): nenhuma linha (padrões ficam virtuais)");
  ok(!linhas.some((l) => l.origem_ref === "padrao_90dias:com"), "modelo padrão salvo sem alteração não vira garantia");
  ok(mapa.get(chave(U3B, null, "tipos_garantia", id(61)))?.texto === "", "nenhuma seção visível → texto vazio, como o app");
  ok(res(cfgU3, true) === "A1\n\nA2", "conferência do esperado: trim do JS (\\u00A0) e visivel 'sim'/0", res(cfgU3, true));

  // prévia = o que entrou
  const contar = (f) => linhas.filter(f).length;
  const real = {
    a_sem_garantia: contar((l) => l.origem === "termo_global" && l.origem_ref === "sem"),
    b_tipos: contar((l) => l.origem === "tipos_garantia"),
    c_prazos_termo: contar((l) => l.origem === "termo_global" && l.origem_ref.startsWith("com:")),
    d_modelos: contar((l) => l.origem === "modelo" && l.origem_ref.endsWith(":com")),
    d_modelos_sem: contar((l) => l.origem === "modelo" && l.origem_ref.endsWith(":sem")),
  };
  ok(Object.entries(real).every(([k, v]) => (porPasso[k] ?? 0) === v) && porPasso.TOTAL === total1,
    "prévia contou exatamente o que a cópia inseriu", { porPasso, real });
  const prev2 = (await db.query(previa)).rows;
  ok(prev2.every((r) => Number(r.linhas) === 0), "prévia depois da cópia: 0 (nada a inserir)", prev2);
  const verifC = await db.transaction(async (tx) => { await tx.exec("SET TRANSACTION READ ONLY"); return (await tx.query(VERIF_COPIA)).rows; })
    .catch((e) => e.message);
  ok(Array.isArray(verifC) && verifC.length > 0, "3-verificar-copia roda em READ ONLY", verifC);
  ok((await um("SELECT count(*)::int AS n FROM public.vendas WHERE garantia_id IS NOT NULL OR garantia_texto_id IS NOT NULL")).n === 0,
    "nenhuma venda tocada");

  // 5) RLS garantias_loja
  log("5. RLS de garantias_loja");
  const ver = (papel, uid) => como(db, papel, uid, async (tx) => (await tx.query("SELECT user_id, empresa_id FROM public.garantias_loja")).rows);
  const doU5 = linhas.filter((l) => l.user_id === U5).length;
  ok((await ver("authenticated", U5)).length === doU5, `dono vê as ${doU5} dele`);
  ok((await ver("authenticated", FUNC)).length === doU5, "funcionário vê as do dono");
  const doGerente = await ver("authenticated", GER);
  ok(doGerente.length === 2 && doGerente.every((r) => r.empresa_id === F1), "gerente vê só as da filial dele (2)", doGerente);
  ok((await ver("authenticated", ESTRANHO)).length === 0, "estranho não vê nada");
  ok(!!(await erro(ver("anon", null))), "anon: sem permissão");

  const ins = (uid, dono, emp = null) => como(db, "authenticated", uid, (tx) =>
    tx.query("INSERT INTO public.garantias_loja (user_id, empresa_id, nome, meses, texto) VALUES ($1, $2, 'Nova', 3, 't') RETURNING id", [dono, emp]));
  ok((await erro(ins(U5, U5))) === null, "dono cria");
  ok((await erro(ins(FUNC, U5))) === null, "funcionário cria para o dono");
  ok(!!(await erro(ins(GER, U5, F1))), "gerente NÃO cria");
  ok(!!(await erro(ins(ESTRANHO, U5))), "estranho NÃO cria para o dono");
  const upd = (uid) => como(db, "authenticated", uid, async (tx) =>
    (await tx.query("UPDATE public.garantias_loja SET nome = 'mudou' WHERE user_id = $1 AND empresa_id = $2 RETURNING id", [U5, F1])).rows.length);
  const del = (uid) => como(db, "authenticated", uid, async (tx) =>
    (await tx.query("DELETE FROM public.garantias_loja WHERE user_id = $1 AND empresa_id = $2 AND origem_ref = 'sem' RETURNING id", [U5, F1])).rows.length);
  ok((await upd(FUNC)) === 0 && (await upd(GER)) === 0 && (await upd(ESTRANHO)) === 0, "funcionário, gerente e estranho NÃO alteram");
  ok((await del(FUNC)) === 0 && (await del(GER)) === 0 && (await del(ESTRANHO)) === 0, "funcionário, gerente e estranho NÃO apagam");
  ok((await upd(U5)) === 2, "dono altera");
  ok(!!(await erro(como(db, "authenticated", U5, (tx) => tx.query("UPDATE public.garantias_loja SET user_id = $1 WHERE user_id = $2", [ESTRANHO, U5])))),
    "dono não passa garantia para outro dono");
  ok(!!(await erro(como(db, "authenticated", U5, (tx) => tx.query("TRUNCATE public.garantias_loja")))), "authenticated não trunca");
  ok(!!(await erro(db.query(`INSERT INTO public.garantias_loja (user_id, nome, meses, texto) VALUES ('${U5}', ' ', 3, 't')`))), "CHECK: nome em branco recusado");
  ok(!!(await erro(db.query(`INSERT INTO public.garantias_loja (user_id, nome, meses, texto) VALUES ('${U5}', 'x', 121, 't')`))), "CHECK: prazo > 120 recusado");
  ok(!!(await erro(db.query(`INSERT INTO public.garantias_loja (user_id, nome, meses, texto) VALUES ('${U5}', 'x', 3, repeat('a', 20001))`))), "CHECK: texto > 20000 bytes recusado");

  // 6) RLS textos congelados
  log("6. RLS de garantias_textos_venda (imutável)");
  const insT = (uid, texto) => como(db, "authenticated", uid, async (tx) =>
    (await tx.query("INSERT INTO public.garantias_textos_venda (user_id, texto) VALUES ($1, $2) RETURNING id", [U5, texto])).rows[0].id);
  const t1 = await insT(U5, "texto dono").catch((e) => e.message);
  ok(typeof t1 === "string" && t1.length === 36, "dono cria texto", t1);
  ok((await erro(insT(FUNC, "texto func"))) === null, "funcionário cria texto do dono");
  ok((await erro(insT(GER, "texto gerente"))) === null, "gerente de filial cria texto do proprietário");
  ok(!!(await erro(insT(ESTRANHO, "texto estranho"))), "estranho NÃO cria");
  ok((await erro(insT(U5, "texto dono")))?.includes("duplicate") ?? false, "mesmo texto 2 vezes: recusado (índice md5)");
  const verT = (uid) => como(db, "authenticated", uid, async (tx) => (await tx.query("SELECT id FROM public.garantias_textos_venda")).rows.length);
  ok((await verT(U5)) === 3 && (await verT(FUNC)) === 3 && (await verT(GER)) === 3, "dono, funcionário e gerente leem");
  ok((await verT(ESTRANHO)) === 0, "estranho não lê");
  for (const quem of [U5, FUNC, GER]) {
    ok(!!(await erro(como(db, "authenticated", quem, (tx) => tx.query("UPDATE public.garantias_textos_venda SET texto = 'x'")))), `ninguém altera (${quem.slice(-2)})`);
    ok(!!(await erro(como(db, "authenticated", quem, (tx) => tx.query("DELETE FROM public.garantias_textos_venda")))), `ninguém apaga (${quem.slice(-2)})`);
  }
  ok(!!(await erro(como(db, "anon", null, (tx) => tx.query("SELECT 1 FROM public.garantias_textos_venda")))), "anon: sem permissão");

  // 7) vendas e dispositivos
  log("7. Vendas e dispositivos");
  const g = (await um(`SELECT id FROM public.garantias_loja WHERE user_id = '${U5}' AND origem = 'manual' LIMIT 1`)).id;
  ok(!!(await erro(db.query(`INSERT INTO public.vendas (user_id, garantia_texto_id) VALUES ('${U5}', '${t1}')`))), "cópia sem prazo recusada (tudo ou nada)");
  await db.query(`INSERT INTO public.vendas (user_id, garantia_id, garantia_nome, garantia_meses, garantia_texto_id) VALUES ('${U5}', '${g}', 'Nova', 3, '${t1}')`);
  await db.query(`INSERT INTO public.dispositivos (user_id, garantia_padrao_id) VALUES ('${U5}', '${g}')`);
  await db.query(`DELETE FROM public.garantias_loja WHERE id = '${g}'`);
  const v = await um("SELECT garantia_id, garantia_nome, garantia_meses, garantia_texto_id FROM public.vendas");
  ok(v.garantia_id === null && v.garantia_nome === "Nova" && v.garantia_meses === 3 && v.garantia_texto_id === t1,
    "garantia apagada: venda fica com a cópia (id vira nulo)", v);
  ok((await um("SELECT garantia_padrao_id FROM public.dispositivos")).garantia_padrao_id === null, "garantia padrão do aparelho vira nula");
  ok(!!(await erro(db.query(`DELETE FROM public.garantias_textos_venda WHERE id = '${t1}'`))), "texto usado numa venda não pode ser apagado (nem pelo banco)");

  await db.close();

  // 8) rollbacks (NÃO RODE em produção; aqui só para provar que funcionam)
  log("8. Rollbacks de emergência");
  const rb = await novoBanco();
  const md5Antes = (await rb.query("SELECT md5(prosrc) AS m FROM pg_proc WHERE oid = 'public._zerar_catalogo()'::regprocedure")).rows[0].m;
  await rb.exec(estrutura); await rb.exec(SEED); await rb.exec(copia);
  ok(!!(await aplicar(rb, ROLLBACK_1)), "rollback da estrutura recusa enquanto houver dados");
  ok((await aplicar(rb, ROLLBACK_2)) === null, "rollback da cópia sem erro");
  ok((await rb.query("SELECT count(*)::int AS n FROM public.garantias_loja")).rows[0].n === 0, "cópia desfeita");
  ok((await aplicar(rb, copia)) === null && (await rb.query("SELECT count(*)::int AS n FROM public.garantias_loja")).rows[0].n > 0,
    "cópia pode ser refeita depois do rollback");
  // edição pela tela algum tempo depois da cópia (o gatilho põe updated_at = now())
  await rb.exec("UPDATE public.garantias_loja SET created_at = created_at - interval '1 hour'");
  await rb.exec("UPDATE public.garantias_loja SET nome = nome || ' editada' WHERE origem_ref = 'sem' AND user_id = '" + U2 + "'");
  ok(!!(await aplicar(rb, ROLLBACK_2)), "rollback da cópia recusa se a tela já editou uma copiada");
  await rb.exec("DELETE FROM public.garantias_loja");
  ok((await aplicar(rb, ROLLBACK_1)) === null, "rollback da estrutura sem erro (tabelas vazias)");
  const fim = (await rb.query(`SELECT md5(prosrc) AS m, (SELECT count(*)::int FROM public._zerar_catalogo()) AS n,
                                      to_regclass('public.garantias_loja') AS t,
                                      (SELECT count(*)::int FROM information_schema.columns WHERE table_name IN ('vendas','dispositivos') AND column_name LIKE 'garantia%') AS c
                               FROM pg_proc WHERE oid = 'public._zerar_catalogo()'::regprocedure`)).rows[0];
  ok(fim.m === md5Antes && fim.n === 112 && fim.t === null && fim.c === 0, "tudo como antes: _zerar_catalogo idêntica (md5), tabelas e colunas removidas", fim);
  await rb.close();
  return falhas;
}

// ── Mutantes: cada um tem que derrubar pelo menos um teste ──────────────────
const MUTANTES = [
  ["gerente vê garantias de todas as lojas", "e", (s) => s.replace("      AND eu.empresa_id = garantias_loja.empresa_id\n", "")],
  ["texto congelado pode ser alterado", "e", (s) => s.replace("GRANT SELECT, INSERT ON TABLE public.garantias_textos_venda TO authenticated;", "GRANT SELECT, INSERT ON TABLE public.garantias_textos_venda TO authenticated;\nGRANT UPDATE ON TABLE public.garantias_textos_venda TO authenticated;")],
  ["remendo sem conferir 112 linhas", "e", (s) => s.replace("IF v_linhas <> 112 THEN", "IF false THEN")],
  ["remendo não confere a âncora", "e", (s) => s.replace("IF v_ancoras <> 1 THEN", "IF false THEN")],
  ["funcionário pode alterar", "e", (s) => s.replace(`CREATE POLICY "Users can update own garantias_loja"
  ON public.garantias_loja FOR UPDATE TO authenticated USING (auth.uid() = user_id)`, `CREATE POLICY "Users can update own garantias_loja"
  ON public.garantias_loja FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_funcionario_of(user_id))`)],
  ["filial com linha sem termo herda o da matriz", "c", (s) => s.replace("CASE WHEN fil.achou THEN fil.cfg ELSE mat.cfg END", "COALESCE(fil.cfg, mat.cfg)")],
  ["nenhuma seção visível vira NULL", "c", (s) => s.replaceAll("SELECT COALESCE(string_agg(", "SELECT (string_agg(").replaceAll("ORDER BY s.o), '')", "ORDER BY s.o))")],
  ["trim do SQL diferente do JS", "c", (s) => s.replace(/btrim\(COALESCE\(s\.e->>'conteudo', ''\), E'[^']*'\)/g, "btrim(COALESCE(s.e->>'conteudo', ''))")],
  ["visivel 'sim' tratado como falso", "c", (s) => s.replaceAll("WHEN 'string'  THEN", "WHEN 'string'  THEN false AND")],
  ["modelo padrão sem alteração também copiado", "c", (s) => s.replace("WHERE NOT mc.padrao_sem_alteracao\n  UNION ALL", "WHERE true\n  UNION ALL")],
  ["sem loja não vira matriz", "c", (s) => s.replace("COALESCE(t.empresa_id, m.id) AS emp", "t.empresa_id AS emp")],
  ["cópia não é idempotente", "c", (s) => s.replace("WHERE NOT EXISTS (\n    SELECT 1 FROM public.garantias_loja g", "WHERE true OR NOT EXISTS (\n    SELECT 1 FROM public.garantias_loja g")],
];

const verbose = true;
console.log("== Minhas garantias: migrations em PGlite ==");
let falhas;
try { falhas = await rodar({ estrutura: ESTRUTURA, copia: COPIA, previa: PREVIA, verbose }); }
catch (e) { console.log("\n  ✗ teste interrompido:", e.message); falhas = 1; }
console.log(`\n${falhas === 0 ? "OK: todos os testes passaram" : `FALHAS: ${falhas}`}`);
let mutantesVivos = 0;
if (process.argv.includes("--mutantes")) {
  console.log("\n== Mutantes ==");
  for (const [nome, alvo, mutar] of MUTANTES) {
    const e = alvo === "e" ? mutar(ESTRUTURA) : ESTRUTURA;
    const c = alvo === "c" ? mutar(COPIA) : COPIA;
    const p = alvo === "c" ? mutar(PREVIA) : PREVIA;
    if (e === ESTRUTURA && c === COPIA) { console.log(`  ? ${nome}: a mutação não mudou nada (ajustar o teste)`); mutantesVivos++; continue; }
    let f;
    try { f = await rodar({ estrutura: e, copia: c, previa: p, verbose: false }); } catch { f = 1; }
    console.log(`  ${f > 0 ? "✓ morto" : "✗ VIVO "} ${nome} (${f} falhas)`);
    if (f === 0) mutantesVivos++;
  }
}
process.exit(falhas === 0 && mutantesVivos === 0 ? 0 : 1);
