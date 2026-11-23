// "Começar do zero" — categoria nova "Produtos e peças" (produtos_pecas).
// Prova num Postgres 17 LOCAL (PGlite, WebAssembly). Não toca produção.
// Dados 100% fictícios (uuids 0000000N-…, URLs x.supabase.co).
//
//   mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
//   PGLITE_DIR=/tmp/pg node scripts/zerar-produtos-pecas/teste-pglite.mjs              # suíte
//   PGLITE_DIR=/tmp/pg node scripts/zerar-produtos-pecas/teste-pglite.mjs --mutantes   # + mutantes
//   (SO_MUTANTE=rollback … --mutantes roda só os mutantes cujo nome contém o texto)
//   PGLITE_DIR=/tmp/pg node scripts/zerar-produtos-pecas/teste-pglite.mjs --hashes     # md5 p/ os scripts 0 e 1
//
// Réplica: as tabelas que as funções tocam, com as FKs (e ON DELETE) das
// migrations do repositório; depois as migrations REAIS do recurso, inteiras:
// etapa 1 (20261027120000), etapa 2 (20261028120000), etapa 3a (20261029120000)
// e o _zerar_catalogo() da 20261102120000 (o último do repositório). Por cima:
//   ANTIGO = só isso (as funções em vigor)
//   NOVO   = + 20261124120000_zerar_produtos_pecas.sql
// Lojistas: U1 (o que apaga) e U2 (o outro: nunca pode ser lido nem tocado),
// com o mesmo conjunto de dados; U3 admin; U4 funcionário de U1.
//
// O que é provado:
//  A. Regressão: as 127 escolhas possíveis com as categorias de antes dão a
//     MESMA prévia (JSON inteiro, inclusive a impressão) no antigo e no novo;
//     e 11 execuções dão o MESMO resultado e o MESMO estado final.
//  B. Tela = banco: as 255 escolhas (8 opções) dão, na prévia do banco, as
//     mesmas efetivas / incluídas / absorvidas que expandirEscolha() da tela
//     (src/lib/comecarDoZero/regras.ts, importado de verdade).
//  C. Produtos e peças: prévia (contagens, resumo, desvínculos, avisos) e
//     execução (apaga produtos, peças, entradas e mapeamento XML; vendas
//     entram; aparelhos/IMEIs/compras/fornecedores/listas/notas XML ficam
//     iguais; itens XML e serviços ficam sem a ligação; fantasmas só de
//     produto e peça; fila só do bucket produtos-fotos; contadores).
//  D. Estoque + Produtos e peças = Estoque; Tudo + Produtos e peças = Tudo.
//  E. Combinações com OS, Financeiro e Clientes.
//  F. ZD000–ZD007 e a conferência final (inclusive "linha a linha").
//  G. Isolamento: U2 idêntico depois de TODA execução.
//  H. Segurança: SECURITY DEFINER, search_path, REVOKE/GRANT.
//  I. Rollback: volta o texto exato (md5) das duas funções sem tocar em dado.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");
const require = createRequire(join(resolve(process.env.PGLITE_DIR ?? "."), "noop.js"));
const { PGlite } = require("@electric-sql/pglite");
const regras = await import(pathToFileURL(join(raiz, "src/lib/comecarDoZero/regras.ts")).href);

const ARQ = {
  etapa1: "supabase/migrations/20261027120000_zerar_meus_dados_etapa1.sql",
  etapa2: "supabase/migrations/20261028120000_zerar_dados_storage_etapa2.sql",
  etapa3a: "supabase/migrations/20261029120000_zerar_cota_registros_apagados_etapa3a.sql",
  catalogo: "supabase/migrations/20261102120000_configuracao_estoque_baixo.sql",
  mig: "supabase/migrations/20261124120000_zerar_produtos_pecas.sql",
  rollback: "scripts/zerar-produtos-pecas/rollback.sql",
  conferir: "scripts/zerar-produtos-pecas/0-conferir-producao.sql",
  verificar: "scripts/zerar-produtos-pecas/1-verificar.sql",
};
const ORIG = { mig: ler(ARQ.mig), rollback: ler(ARQ.rollback), conferir: ler(ARQ.conferir), verificar: ler(ARQ.verificar) };
// Roda um script de produção (SELECT … AS t(item, valor_atual, esperado, ok)) e devolve as linhas com ok = false.
const naoOk = async (db, sql) => (await db.query(sql)).rows.filter((r) => r.ok !== true).map((r) => `${r.item} → ${r.valor_atual}`);

function catalogoDaProducao() {
  const f = ler(ARQ.catalogo);
  const ini = f.indexOf("CREATE OR REPLACE FUNCTION public._zerar_catalogo()");
  const fim = f.indexOf("$$;", ini) + 3;
  return f.slice(ini, fim) + "\nREVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;\n";
}

// ---------------------------------------------------------------------------
// Réplica mínima
// ---------------------------------------------------------------------------
const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth, storage TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text NOT NULL, name text NOT NULL);
CREATE TABLE storage.buckets (id text PRIMARY KEY);
INSERT INTO storage.buckets VALUES ('produtos-fotos'), ('dispositivos-fotos'), ('compras-fotos'), ('notas-compra-xml');
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role text NOT NULL);
CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, nome text);
CREATE TABLE public.loja_funcionarios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), funcionario_user_id uuid, loja_user_id uuid, ativo boolean DEFAULT true);
CREATE TABLE public.empresas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proprietario_id uuid, tipo text NOT NULL);
CREATE TABLE public.empresa_usuarios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid, gerente_id uuid, proprietario_id uuid);
CREATE TABLE public.user_onboarding (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  primeiro_cliente_id uuid, onboarding_dismissed boolean DEFAULT true, onboarding_dismissed_at timestamptz DEFAULT now());
CREATE TABLE public.user_os_counters (user_id uuid PRIMARY KEY, ultimo_numero int NOT NULL DEFAULT 0, updated_at timestamptz);
CREATE TABLE public.user_venda_counters (user_id uuid PRIMARY KEY, ultimo_numero int NOT NULL DEFAULT 0, updated_at timestamptz);

CREATE TABLE public.clientes (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text);
CREATE TABLE public.clientes_audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, cliente_id uuid);
CREATE TABLE public.fornecedores (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text);
CREATE TABLE public.origem_pessoas (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text);
CREATE TABLE public.dispositivos (id uuid PRIMARY KEY, user_id uuid NOT NULL, modelo text, fotos jsonb,
  created_at timestamptz, updated_at timestamptz);
CREATE TABLE public.compras_dispositivos (id uuid PRIMARY KEY, user_id uuid NOT NULL,
  pessoa_id uuid REFERENCES public.origem_pessoas(id) ON DELETE RESTRICT,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  dispositivo_id uuid NOT NULL REFERENCES public.dispositivos(id) ON DELETE CASCADE, fotos jsonb);
CREATE TABLE public.produtos (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text, fotos jsonb, created_at timestamptz,
  produto_pai_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL);
CREATE TABLE public.pecas (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text, fotos jsonb, created_at timestamptz,
  peca_pai_id uuid REFERENCES public.pecas(id),
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL);
CREATE TABLE public.servicos (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text, peca_id uuid REFERENCES public.pecas(id));
CREATE TABLE public.ordens_servico (id uuid PRIMARY KEY, user_id uuid NOT NULL, numero_os text,
  cliente_id uuid REFERENCES public.clientes(id), servico_fornecedor_id uuid REFERENCES public.fornecedores(id),
  deleted_at timestamptz, nao_conta_limite boolean NOT NULL DEFAULT false, created_at timestamptz);
CREATE TABLE public.os_audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, os_id uuid);
CREATE TABLE public.contas (id uuid PRIMARY KEY, user_id uuid NOT NULL, descricao text, os_numero text,
  cliente_id uuid REFERENCES public.clientes(id), fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL);
CREATE TABLE public.caixas (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.caixa_movimentacoes (id uuid PRIMARY KEY, user_id uuid, caixa_id uuid REFERENCES public.caixas(id));
CREATE TABLE public.vendas (id uuid PRIMARY KEY, user_id uuid NOT NULL, tipo text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id),
  produto_id uuid REFERENCES public.produtos(id),
  peca_id uuid REFERENCES public.pecas(id) ON UPDATE CASCADE ON DELETE SET NULL,
  dispositivo_id uuid REFERENCES public.dispositivos(id),
  parcela_numero int, observacoes text, total numeric(10,2) NOT NULL DEFAULT 0);
CREATE TABLE public.dispositivo_imeis (id uuid PRIMARY KEY, imei text,
  dispositivo_id uuid NOT NULL REFERENCES public.dispositivos(id) ON DELETE CASCADE,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL);
CREATE TABLE public.trocas_garantia (id uuid PRIMARY KEY, user_id uuid NOT NULL,
  venda_id uuid REFERENCES public.vendas(id),
  produto_novo_id uuid NOT NULL REFERENCES public.produtos(id),
  produto_devolvido_id uuid REFERENCES public.produtos(id));
CREATE TABLE public.vendas_trocas (id uuid PRIMARY KEY, user_id uuid NOT NULL,
  dispositivo_entrada_id uuid REFERENCES public.dispositivos(id) ON DELETE SET NULL,
  compra_id uuid REFERENCES public.compras_dispositivos(id) ON DELETE SET NULL);
CREATE TABLE public.servicos_avulsos (id uuid PRIMARY KEY, user_id uuid NOT NULL, created_at timestamptz);
CREATE TABLE public.fidelidade_pontos (id uuid PRIMARY KEY, user_id uuid, cliente_id uuid REFERENCES public.clientes(id), tipo text);
CREATE TABLE public.fidelidade_resgates (id uuid PRIMARY KEY, user_id uuid, cliente_id uuid REFERENCES public.clientes(id));
CREATE TABLE public.remessas_corporativas (id uuid PRIMARY KEY, user_id uuid, cliente_id uuid REFERENCES public.clientes(id));
CREATE TABLE public.remessa_itens (id uuid PRIMARY KEY, user_id uuid, remessa_id uuid REFERENCES public.remessas_corporativas(id));
CREATE TABLE public.entradas_estoque (id uuid PRIMARY KEY, user_id uuid NOT NULL, item_tipo text NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  peca_id uuid REFERENCES public.pecas(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL, quantidade int NOT NULL,
  CONSTRAINT entradas_estoque_um_item CHECK (NOT (produto_id IS NOT NULL AND peca_id IS NOT NULL)));
CREATE TABLE public.compras_xml_importadas (id uuid PRIMARY KEY, user_id uuid NOT NULL, numero text, xml_path text);
CREATE TABLE public.compras_xml_itens (id uuid PRIMARY KEY,
  importacao_id uuid NOT NULL REFERENCES public.compras_xml_importadas(id) ON DELETE CASCADE,
  descricao text NOT NULL, tipo_destino text NOT NULL CHECK (tipo_destino IN ('produto', 'peca')),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  peca_id uuid REFERENCES public.pecas(id) ON DELETE SET NULL,
  entrada_estoque_id uuid REFERENCES public.entradas_estoque(id) ON DELETE SET NULL,
  CONSTRAINT compras_xml_itens_destino CHECK ((tipo_destino = 'produto' AND peca_id IS NULL) OR (tipo_destino = 'peca' AND produto_id IS NULL)));
CREATE TABLE public.compras_xml_mapeamento (id uuid PRIMARY KEY, user_id uuid NOT NULL, c_prod text NOT NULL,
  tipo_destino text NOT NULL CHECK (tipo_destino IN ('produto', 'peca')),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  peca_id uuid REFERENCES public.pecas(id) ON DELETE CASCADE,
  CONSTRAINT compras_xml_mapeamento_destino CHECK (
    (tipo_destino = 'produto' AND produto_id IS NOT NULL AND peca_id IS NULL) OR
    (tipo_destino = 'peca' AND peca_id IS NOT NULL AND produto_id IS NULL)));
CREATE TABLE public.listas_compras (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text);
CREATE TABLE public.lista_compras (id uuid PRIMARY KEY, user_id uuid NOT NULL, nome text,
  lista_id uuid REFERENCES public.listas_compras(id) ON DELETE CASCADE);
CREATE TABLE public.orcamentos (id uuid PRIMARY KEY, user_id uuid NOT NULL, itens jsonb);
CREATE TABLE public.notifications (id uuid PRIMARY KEY, user_id uuid NOT NULL);
`;

const uid = (u) => `0000000${u}-0000-0000-0000-000000000000`;
const id = (u, k) => `0000000${u}-0000-0000-0000-${String(k).padStart(12, "0")}`;
const url = (bucket, nome) => `https://x.supabase.co/storage/v1/object/public/${bucket}/${nome}`;

function seed(u) {
  const U = uid(u), i = (k) => `'${id(u, k)}'`;
  const foto = (b, n) => JSON.stringify(url(b, `${U}/${n}`));
  return `
INSERT INTO auth.users VALUES ('${U}', 'lojista${u}@teste.local');
INSERT INTO public.profiles (id, user_id, nome) VALUES (${i(90)}, '${U}', 'Loja ${u}');
INSERT INTO public.user_onboarding (id, user_id, onboarding_dismissed_at) VALUES (${i(91)}, '${U}', '2026-01-01');
INSERT INTO public.user_os_counters VALUES ('${U}', 5, '2026-01-01');
INSERT INTO public.user_venda_counters VALUES ('${U}', 7, '2026-01-01');
INSERT INTO public.clientes VALUES (${i(1)}, '${U}', 'Cliente');
INSERT INTO public.clientes_audit_log (id, user_id, cliente_id) VALUES (${i(92)}, '${U}', ${i(1)});
INSERT INTO public.fornecedores VALUES (${i(2)}, '${U}', 'Fornecedor');
INSERT INTO public.origem_pessoas VALUES (${i(3)}, '${U}', 'Pessoa');
INSERT INTO public.dispositivos VALUES (${i(4)}, '${U}', 'iPhone', '[${foto("dispositivos-fotos", "d1.jpg")}]', '2026-01-04', '2026-01-04');
INSERT INTO public.compras_dispositivos VALUES (${i(5)}, '${U}', ${i(3)}, ${i(2)}, ${i(4)}, '[${foto("compras-fotos", "c1.jpg")}]');
INSERT INTO public.produtos VALUES (${i(10)}, '${U}', 'Capinha', '[${foto("produtos-fotos", "p1.jpg")}, ${foto("produtos-fotos", "v2-abc.jpg")}]', '2026-01-10', NULL, ${i(2)});
INSERT INTO public.produtos VALUES (${i(11)}, '${U}', 'Capinha azul', NULL, '2026-01-11', ${i(10)}, NULL);
INSERT INTO public.pecas VALUES (${i(12)}, '${U}', 'Tela', '[${foto("produtos-fotos", "pc1.jpg")}]', '2026-01-12', NULL, ${i(2)});
INSERT INTO public.pecas VALUES (${i(13)}, '${U}', 'Tela OLED', NULL, '2026-01-13', ${i(12)}, NULL);
INSERT INTO public.servicos VALUES (${i(14)}, '${U}', 'Troca de tela', ${i(12)}), (${i(15)}, '${U}', 'Limpeza', NULL);
INSERT INTO public.ordens_servico VALUES (${i(20)}, '${U}', '1', ${i(1)}, ${i(2)}, NULL, false, '2026-02-01'),
                                         (${i(21)}, '${U}', '2', ${i(1)}, NULL, '2026-02-03', false, '2026-02-02');
INSERT INTO public.os_audit_log (id, user_id, os_id) VALUES (${i(93)}, '${U}', ${i(20)});
INSERT INTO public.contas VALUES (${i(25)}, '${U}', 'venda_id:${id(u, 32)}', NULL, ${i(1)}, ${i(2)}),
                                 (${i(26)}, '${U}', 'OS 1', '1', NULL, NULL);
INSERT INTO public.caixas VALUES (${i(27)}, '${U}');
INSERT INTO public.caixa_movimentacoes VALUES (${i(28)}, '${U}', ${i(27)});
INSERT INTO public.vendas VALUES
  (${i(30)}, '${U}', 'dispositivo', ${i(1)}, NULL, NULL, ${i(4)}, 1, 'foto ${url("dispositivos-fotos", `${U}/d1.jpg`)}', 1000),
  (${i(31)}, '${U}', 'dispositivo', ${i(1)}, NULL, NULL, ${i(4)}, 2, NULL, 1000),
  (${i(32)}, '${U}', 'produto', ${i(1)}, ${i(10)}, NULL, NULL, NULL, NULL, 50),
  (${i(33)}, '${U}', 'produto', NULL, NULL, ${i(12)}, NULL, NULL, NULL, 300),
  (${i(34)}, '${U}', 'produto', NULL, ${i(11)}, NULL, NULL, NULL, NULL, 55);
INSERT INTO public.dispositivo_imeis VALUES (${i(6)}, '35000000000000${u}', ${i(4)}, ${i(30)});
INSERT INTO public.trocas_garantia VALUES (${i(35)}, '${U}', ${i(32)}, ${i(10)}, ${i(11)});
INSERT INTO public.vendas_trocas VALUES (${i(36)}, '${U}', ${i(4)}, ${i(5)});
INSERT INTO public.servicos_avulsos VALUES (${i(37)}, '${U}', '2026-03-01');
INSERT INTO public.fidelidade_pontos VALUES (${i(38)}, '${U}', ${i(1)}, 'venda');
INSERT INTO public.entradas_estoque VALUES (${i(40)}, '${U}', 'produto', ${i(10)}, NULL, ${i(2)}, ${i(25)}, 3),
                                           (${i(41)}, '${U}', 'peca', NULL, ${i(12)}, NULL, NULL, 2);
INSERT INTO public.compras_xml_importadas VALUES (${i(50)}, '${U}', '123', '${U}/nota.xml');
INSERT INTO public.compras_xml_itens VALUES (${i(51)}, ${i(50)}, 'CAPINHA', 'produto', ${i(10)}, NULL, ${i(40)}),
                                            (${i(52)}, ${i(50)}, 'TELA', 'peca', NULL, ${i(12)}, ${i(41)}),
                                            (${i(53)}, ${i(50)}, 'BRINDE', 'produto', NULL, NULL, NULL);
INSERT INTO public.compras_xml_mapeamento VALUES (${i(55)}, '${U}', 'CAP-1', 'produto', ${i(10)}, NULL),
                                                 (${i(56)}, '${U}', 'TEL-1', 'peca', NULL, ${i(12)});
INSERT INTO public.listas_compras VALUES (${i(60)}, '${U}', 'Semana');
INSERT INTO public.lista_compras VALUES (${i(61)}, '${U}', 'Tela de iPhone', ${i(60)});
INSERT INTO public.orcamentos VALUES (${i(65)}, '${U}', '[{"produto_id": "${id(u, 10)}"}]');
INSERT INTO public.notifications VALUES (${i(70)}, '${U}');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('produtos-fotos', '${U}/p1.jpg'), ('produtos-fotos', '${U}/v2-abc.jpg'), ('produtos-fotos', '${U}/v2-abc_thumb.jpg'),
  ('produtos-fotos', '${U}/pc1.jpg'), ('produtos-fotos', '${U}/solta.jpg'),
  ('dispositivos-fotos', '${U}/d1.jpg'), ('compras-fotos', '${U}/c1.jpg'), ('notas-compra-xml', '${U}/nota.xml');
`;
}
const OUTROS = `
INSERT INTO auth.users VALUES ('${uid(3)}', 'admin@teste.local'), ('${uid(4)}', 'func@teste.local');
INSERT INTO public.user_roles (id, user_id, role) VALUES ('${id(3, 1)}', '${uid(3)}', 'admin');
INSERT INTO public.loja_funcionarios (id, funcionario_user_id, loja_user_id) VALUES ('${id(4, 1)}', '${uid(4)}', '${uid(1)}');
`;

// Foto de estado: md5 de cada tabela do catálogo pelo filtro do dono (+ storage, fantasmas, log).
// updated_at fica de fora: a execução grava now() nos contadores (o valor do contador entra).
const AJUDANTES = `
CREATE FUNCTION public._t_foto(p_uid uuid, p_sem text[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE r record; v jsonb := '{}'; v_md5 text; v_n bigint;
  v_os uuid[] := ARRAY(SELECT id FROM public.ordens_servico WHERE user_id = p_uid);
  v_cli uuid[] := ARRAY(SELECT id FROM public.clientes WHERE user_id = p_uid);
BEGIN
  FOR r IN SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
           WHERE c.lista IN ('APAGAR', 'MANTER') AND to_regclass(c.tabela) IS NOT NULL LOOP
    EXECUTE format('SELECT count(*), md5(COALESCE(string_agg(t, chr(10) ORDER BY t), '''')) FROM (SELECT (to_jsonb(x) - $4)::text t FROM %s x WHERE %s) s', r.tabela, r.filtro)
      INTO v_n, v_md5 USING p_uid, v_os, v_cli, p_sem || ARRAY['updated_at'];
    v := v || jsonb_build_object(r.tabela, v_n::text || ':' || v_md5);
  END LOOP;
  v := v || jsonb_build_object('storage', (SELECT string_agg(bucket_id || '/' || name, ',' ORDER BY bucket_id, name) FROM storage.objects WHERE name LIKE p_uid::text || '/%'));
  v := v || jsonb_build_object('cota', (SELECT string_agg(tipo || '@' || COALESCE(criado_em::text, '-'), ',' ORDER BY tipo, criado_em) FROM public.cota_registros_apagados WHERE user_id = p_uid));
  v := v || jsonb_build_object('execucoes', (SELECT count(*) FROM public.zerar_dados_execucoes WHERE user_id = p_uid));
  RETURN v;
END $f$;
`;

async function novoBanco(extra = []) {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(ler(ARQ.etapa1));
  await db.exec(ler(ARQ.etapa2));
  await db.exec(ler(ARQ.etapa3a));
  await db.exec(catalogoDaProducao());
  await db.exec(seed(1) + seed(2) + OUTROS + AJUDANTES);
  for (const sql of extra) await db.exec(sql);
  return db;
}
const clonar = async (blob) => new PGlite({ loadDataDir: blob });

// ---------------------------------------------------------------------------
// Chamadas como o lojista (papel authenticated + claims do JWT)
// ---------------------------------------------------------------------------
async function como(db, u, fn, { senhaHaMin = 1, semLogin = false } = {}) {
  const claims = semLogin ? "" : JSON.stringify({
    sub: uid(u), role: "authenticated",
    amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - senhaHaMin * 60 }],
  });
  await db.query("SELECT set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec("SET ROLE authenticated");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); await db.query("SELECT set_config('request.jwt.claims', '', false)"); }
}
const previa = (db, u, cats, o) => como(db, u, async () =>
  (await db.query("SELECT public.zerar_meus_dados_previa($1::text[]) AS j", [cats])).rows[0].j, o);
const executar = (db, u, cats, conf, impr, o) => como(db, u, async () =>
  (await db.query("SELECT public.zerar_meus_dados_executar($1::text[], $2, $3) AS j", [cats, conf, impr])).rows[0].j, o);
async function apagar(db, u, cats) {
  const p = await previa(db, u, cats);
  if (!p.pode_usar) throw new Error(`prévia recusou: ${p.codigo}`);
  return { p, r: await executar(db, u, cats, "APAGAR", p.impressao) };
}
async function erro(fn) {
  try { await fn(); return "sem erro"; } catch (e) { return e.code ?? String(e.message); }
}
const foto = async (db, u, sem = []) => (await db.query("SELECT public._t_foto($1::uuid, $2::text[]) AS j", [uid(u), sem])).rows[0].j;
const um = async (db, sql, p = []) => (await db.query(sql, p)).rows[0];
const fila = async (db, exec) => (await db.query(
  "SELECT bucket || '/' || caminho AS a, motivo FROM public.zerar_dados_arquivos WHERE execucao_id = $1 ORDER BY 1", [exec])).rows;
const semId = (r) => { const { execucao_id, ...resto } = r; return resto; };
const ordenar = (v) => Array.isArray(v) ? v.map(ordenar)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar(v[k])])) : v;
const igual = (a, b) => JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));

function subconjuntos(lista) {
  const out = [];
  for (let m = 1; m < 1 << lista.length; m++) out.push(lista.filter((_, i) => m & (1 << i)));
  return out;
}
const ANTIGAS = ["vendas", "os", "clientes", "financeiro", "estoque", "orcamentos", "tudo"];
const TODAS = ["vendas", "os", "clientes", "financeiro", "estoque", "produtos_pecas", "orcamentos", "tudo"];

// ---------------------------------------------------------------------------
// Antigo (sem a migration nova): calculado uma vez, nunca é mutado
// ---------------------------------------------------------------------------
console.log("montando o banco ANTIGO…");
const dbAntigo = await novoBanco();
const blobAntigo = await dbAntigo.dumpDataDir("none");
const previasAntigas = new Map();
for (const s of subconjuntos(ANTIGAS)) previasAntigas.set(s.join(","), await previa(dbAntigo, 1, s));
const conferirNoAntigo = await naoOk(dbAntigo, ORIG.conferir);
const fonteAntiga = Object.fromEntries((await dbAntigo.query(
  "SELECT proname, md5(prosrc) h, prosecdef, proconfig, proacl::text acl FROM pg_proc WHERE proname IN ('zerar_meus_dados_previa', 'zerar_meus_dados_executar')")).rows
  .map((r) => [r.proname, r]));
await dbAntigo.close();
const EXEC_REGRESSAO = [["vendas"], ["os"], ["clientes"], ["financeiro"], ["estoque"], ["orcamentos"], ["tudo"],
  ["clientes", "estoque"], ["os", "financeiro"], ["vendas", "financeiro"], ["os", "financeiro", "estoque"]];
const execAntigas = new Map();
for (const cats of EXEC_REGRESSAO) {
  const db = await clonar(blobAntigo);
  const { r } = await apagar(db, 1, cats);
  execAntigas.set(cats.join(","), { r: semId(r), u1: await foto(db, 1), u2: await foto(db, 2), fila: await fila(db, r.execucao_id) });
  await db.close();
}
// O que a tela calcula (regras.ts de verdade)
const daTela = (cats) => {
  const t = regras.expandirEscolha(cats);
  return { efetivas: t.efetivas, tudo: t.tudo, incluidas: t.incluidas, absorvidas: t.absorvidas };
};
const doBanco = (p) => ({ efetivas: p.categorias_efetivas, tudo: p.tudo, incluidas: p.incluidas_automaticamente, absorvidas: p.absorvidas ?? [] });

// ---------------------------------------------------------------------------
// Suíte (recebe os textos, para os mutantes)
// ---------------------------------------------------------------------------
async function suite(txt, { silencioso = false, comVerificacao = true } = {}) {
  const falhas = [];
  let n = 0;
  const ok = (cond, nome, detalhe) => {
    n++;
    if (!cond) falhas.push(`${nome}${detalhe !== undefined ? ` — ${typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe)}` : ""}`);
    if (!silencioso) console.log(`${cond ? "OK   " : "FALHA"} ${nome}${!cond && detalhe !== undefined ? `\n        ${typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe).slice(0, 600)}` : ""}`);
  };
  const tentar = async (nome, fn) => { try { await fn(); } catch (e) { ok(false, nome, `erro ${e.code ?? ""} ${e.message}`); } };

  let blob;
  try {
    const db = await novoBanco();
    await db.exec(txt.mig);
    blob = await db.dumpDataDir("none");
    await db.close();
  } catch (e) {
    ok(false, "migration aplica", `${e.code ?? ""} ${e.message}`);
    return falhas;
  }

  // ---------- scripts de produção ----------
  ok(conferirNoAntigo.length === 0, "0-conferir-producao.sql: tudo ok no banco ANTES da migration", conferirNoAntigo);
  // Os scripts 0 e 1 comparam md5: matariam QUALQUER mutante do SQL sem provar nada.
  // Por isso os mutantes da migration rodam sem eles (só os mutantes dos próprios scripts os usam).
  if (comVerificacao) await tentar("scripts", async () => {
    const db = await clonar(blob);
    const v = await naoOk(db, txt.verificar);
    ok(v.length === 0, "1-verificar.sql: tudo ok DEPOIS da migration", v);
    const c = await naoOk(db, txt.conferir);
    ok(c.length === 2 && c[0].startsWith("1.") && c[1].startsWith("2."), "0-conferir-producao.sql depois da migration: só as linhas 1 e 2 (md5) acusam", c);
    await db.exec(txt.rollback);
    const c2 = await naoOk(db, txt.conferir), v2 = await naoOk(db, txt.verificar);
    ok(c2.length === 0, "0-conferir-producao.sql: tudo ok de novo depois do rollback", c2);
    ok(v2.length === 2, "1-verificar.sql depois do rollback: as linhas 1 e 2 acusam", v2);
    await db.close();
  });
  await tentar("scripts: conferência acusa", async () => {
    const db = await clonar(blobAntigo);
    await db.exec("CREATE TABLE public.kits_itens (id uuid PRIMARY KEY, produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE)");
    const c = await naoOk(db, txt.conferir);
    ok(c.length === 1 && c[0].startsWith("7."), "0-conferir-producao.sql acusa FK nova apontando para produtos (linha 7)", c);
    await db.exec(`DROP TABLE public.kits_itens; CREATE FUNCTION public._t_x() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$;
      CREATE TRIGGER _t_x AFTER DELETE ON public.pecas FOR EACH ROW EXECUTE FUNCTION public._t_x();`);
    const c2 = await naoOk(db, txt.conferir);
    ok(c2.length === 1 && c2[0].startsWith("9."), "0-conferir-producao.sql acusa gatilho de DELETE em peças (linha 9)", c2);
    await db.close();
  });

  // ---------- H. segurança e idempotência ----------
  await tentar("H", async () => {
    const db = await clonar(blob);
    const f = Object.fromEntries((await db.query(`SELECT proname, md5(prosrc) h, prosecdef, proconfig, proacl::text acl,
        pg_get_function_identity_arguments(oid) args,
        has_function_privilege('anon', oid, 'EXECUTE') anon, has_function_privilege('authenticated', oid, 'EXECUTE') auth,
        has_function_privilege('service_role', oid, 'EXECUTE') srv,
        EXISTS (SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee = 0) publico
      FROM pg_proc WHERE proname IN ('zerar_meus_dados_previa', 'zerar_meus_dados_executar')`)).rows.map((r) => [r.proname, r]));
    for (const nome of ["zerar_meus_dados_previa", "zerar_meus_dados_executar"]) {
      const x = f[nome];
      ok(x && x.prosecdef === true, `H ${nome}: SECURITY DEFINER`);
      ok(x && JSON.stringify(x.proconfig) === JSON.stringify(["search_path=public, pg_temp"]), `H ${nome}: search_path fixo`, x?.proconfig);
      ok(x && !x.anon && x.auth && x.srv && !x.publico, `H ${nome}: anon/PUBLIC sem EXECUTE; authenticated e service_role com`, x && { anon: x.anon, auth: x.auth, srv: x.srv, publico: x.publico });
      ok(x && x.acl === fonteAntiga[nome].acl, `H ${nome}: mesmas permissões de antes`, x && [x.acl, fonteAntiga[nome].acl]);
      ok(x && x.h !== fonteAntiga[nome].h, `H ${nome}: corpo novo aplicado`);
    }
    ok(f.zerar_meus_dados_executar?.args === "p_categorias text[], p_confirmacao text, p_impressao text"
      && f.zerar_meus_dados_previa?.args === "p_categorias text[]", "H mesmas assinaturas");
    const antes = await foto(db, 1);
    await db.exec(txt.mig);
    const f2 = (await db.query("SELECT md5(prosrc) h FROM pg_proc WHERE proname = 'zerar_meus_dados_executar'")).rows[0].h;
    ok(f2 === f.zerar_meus_dados_executar.h && igual(antes, await foto(db, 1)), "H migration idempotente (rodar de novo não muda nada)");
    const cat = (await db.query("SELECT count(*)::int n FROM public._zerar_catalogo()")).rows[0].n;
    ok(cat === 112, "H _zerar_catalogo() não mudou (112 linhas da 20261102120000)", cat);
    await db.close();
  });

  // ---------- A. regressão: prévia ----------
  await tentar("A prévia", async () => {
    const db = await clonar(blob);
    let difs = [];
    for (const s of subconjuntos(ANTIGAS)) {
      const novo = await previa(db, 1, s);
      if (!igual(novo, previasAntigas.get(s.join(",")))) difs.push(s.join("+"));
    }
    ok(difs.length === 0, `A prévia idêntica à antiga nas ${previasAntigas.size} escolhas sem "Produtos e peças"`, difs.slice(0, 5).join(" | "));
    // ---------- B. tela = banco ----------
    difs = [];
    let total = 0;
    for (const s of subconjuntos(TODAS)) {
      total++;
      const p = await previa(db, 1, s);
      if (!igual(doBanco(p), daTela(s))) difs.push(`${s.join("+")}: banco ${JSON.stringify(doBanco(p))} tela ${JSON.stringify(daTela(s))}`);
    }
    ok(difs.length === 0 && total === 255, `B tela = banco (efetivas, incluídas, absorvidas) nas ${total} escolhas`, difs.slice(0, 2).join(" | "));
    await db.close();
  });

  // ---------- A. regressão: execução ----------
  for (const cats of EXEC_REGRESSAO) {
    await tentar(`A execução ${cats.join("+")}`, async () => {
      const db = await clonar(blob);
      const { r } = await apagar(db, 1, cats);
      const a = execAntigas.get(cats.join(","));
      const agora = { r: semId(r), u1: await foto(db, 1), u2: await foto(db, 2), fila: await fila(db, r.execucao_id) };
      ok(igual(agora, a), `A execução ${cats.join("+")}: resultado, fila de fotos e estado final iguais aos de antes`,
        Object.keys(agora).filter((k) => !igual(agora[k], a[k])).map((k) => k + ":" + (typeof agora[k] === "object" ? Object.keys(agora[k]).filter((t) => !igual(agora[k][t], a[k][t])).map((t) => t + "=" + JSON.stringify(agora[k][t]) + "/" + JSON.stringify(a[k][t])).join(";") : "")).join(" "));
      await db.close();
    });
  }

  // ---------- C. Produtos e peças ----------
  await tentar("C", async () => {
    const db = await clonar(blob);
    const U2antes = await foto(db, 2);
    const p = await previa(db, 1, ["produtos_pecas"]);
    ok(p.pode_usar === true, "C prévia: pode usar");
    ok(igual(p.categorias_efetivas, ["vendas", "produtos_pecas"]), "C prévia: efetivas = vendas + produtos_pecas", p.categorias_efetivas);
    ok(igual(p.incluidas_automaticamente, [{ categoria: "vendas", por_causa_de: "produtos_pecas", motivo: "As vendas ficariam sem o produto ou a peça vendida." }]),
      "C prévia: vendas incluídas por causa de produtos_pecas, com o motivo", p.incluidas_automaticamente);
    ok(p.absorvidas === undefined, "C prévia: sem absorvidas");
    ok(igual(p.tabelas, { trocas_garantia: 1, vendas_trocas: 1, entradas_estoque: 2, compras_xml_mapeamento: 2, vendas: 5, servicos_avulsos: 1, produtos: 2, pecas: 2 }),
      "C prévia: contagens só das vendas, produtos, peças, entradas e ligações XML (nada de aparelho, fornecedor, lista, nota)", p.tabelas);
    ok(igual(p.resumo, {
      vendas: { vendas: 4, vendas_avulsas: 1, pedidos: 0, trocas_garantia: 1 },
      produtos_pecas: { produtos: 2, pecas: 2, entradas_estoque: 2, ligacoes_xml: 2 },
    }), "C prévia: resumo (vendas + produtos_pecas)", p.resumo);
    ok(igual(p.desvinculos, { servicos_sem_peca: 1, itens_xml_sem_produto: 2 }), "C prévia: desvínculos (serviço sem peça, itens XML sem produto)", p.desvinculos);
    const cod = p.avisos.map((a) => a.codigo);
    const aviso = (c) => p.avisos.find((a) => a.codigo === c);
    ok(aviso("vendas_de_aparelhos")?.quantidade === 1 && aviso("vendas_de_aparelhos").texto.includes("TODAS as vendas, inclusive as de aparelhos"),
      "C prévia: aviso claro de que TODAS as vendas vão, inclusive as de aparelhos (1)", aviso("vendas_de_aparelhos"));
    ok(aviso("ligacoes_xml_apagadas")?.quantidade === 2, "C prévia: aviso das ligações XML apagadas (2)", aviso("ligacoes_xml_apagadas"));
    ok(aviso("itens_xml_sem_produto")?.quantidade === 2 && aviso("servicos_sem_peca")?.quantidade === 1, "C prévia: avisos dos itens XML e do serviço sem peça");
    ok(aviso("estoque_nao_volta")?.texto === "Os aparelhos vendidos não voltam para o estoque.", "C prévia: aviso 'aparelhos vendidos não voltam'", aviso("estoque_nao_volta"));
    ok(aviso("imeis_sem_venda")?.quantidade === 1, "C prévia: aviso do IMEI que perde a venda");
    ok(!cod.includes("os_sem_fornecedor") && !cod.includes("contas_sem_fornecedor") && !cod.includes("pecas_os_nao_voltam") && !cod.includes("entradas_sem_conta"),
      "C prévia: sem avisos de fornecedor/OS/entradas (nada disso muda)", cod);
    ok(p.contadores.venda.volta_para_1 === true && p.contadores.os.volta_para_1 === false && p.contadores.os.proximo === 6, "C prévia: contadores (venda volta a 1; OS não)", p.contadores);

    const r = await executar(db, 1, ["produtos_pecas"], "APAGAR", p.impressao);
    ok(igual(r.apagados, p.tabelas), "C execução: apagados = contagens da prévia", r.apagados);
    ok(igual(r.desvinculos, p.desvinculos), "C execução: desvínculos = os da prévia");
    ok(igual(r.fantasmas_cota, { produto: 2, peca: 2, servico_avulso: 1 }), "C execução: fantasmas da cota só de produto e peça (+ serviço avulso das vendas), nunca de aparelho", r.fantasmas_cota);
    const cota = (await db.query("SELECT tipo, count(*)::int n FROM public.cota_registros_apagados WHERE user_id = $1 GROUP BY 1 ORDER BY 1", [uid(1)])).rows;
    ok(igual(cota, [{ tipo: "peca", n: 2 }, { tipo: "produto", n: 2 }, { tipo: "servico_avulso", n: 1 }]), "C execução: fantasmas gravados (sem 'dispositivo')", cota);
    const fl = await fila(db, r.execucao_id);
    ok(igual(fl.map((x) => x.a), [`produtos-fotos/${uid(1)}/p1.jpg`, `produtos-fotos/${uid(1)}/pc1.jpg`, `produtos-fotos/${uid(1)}/v2-abc.jpg`, `produtos-fotos/${uid(1)}/v2-abc_thumb.jpg`])
      && r.arquivos_na_fila === 4,
      "C execução: fila de fotos só do bucket produtos-fotos (a foto do aparelho citada na venda fica)", fl);
    const c = await um(db, `SELECT
      (SELECT count(*) FROM produtos WHERE user_id = $1)::int produtos, (SELECT count(*) FROM pecas WHERE user_id = $1)::int pecas,
      (SELECT count(*) FROM entradas_estoque WHERE user_id = $1)::int entradas, (SELECT count(*) FROM compras_xml_mapeamento WHERE user_id = $1)::int mapeamento,
      (SELECT count(*) FROM vendas WHERE user_id = $1)::int vendas, (SELECT count(*) FROM trocas_garantia WHERE user_id = $1)::int trocas,
      (SELECT count(*) FROM dispositivos WHERE user_id = $1)::int aparelhos, (SELECT count(*) FROM dispositivo_imeis WHERE dispositivo_id = $2)::int imeis,
      (SELECT count(*) FROM dispositivo_imeis WHERE dispositivo_id = $2 AND venda_id IS NULL)::int imeis_sem_venda,
      (SELECT count(*) FROM compras_dispositivos WHERE user_id = $1)::int compras, (SELECT count(*) FROM origem_pessoas WHERE user_id = $1)::int pessoas,
      (SELECT count(*) FROM fornecedores WHERE user_id = $1)::int fornecedores, (SELECT count(*) FROM listas_compras WHERE user_id = $1)::int listas,
      (SELECT count(*) FROM lista_compras WHERE user_id = $1)::int itens_lista, (SELECT count(*) FROM compras_xml_importadas WHERE user_id = $1)::int notas,
      (SELECT count(*) FROM compras_xml_itens WHERE importacao_id = $3)::int itens_xml,
      (SELECT count(*) FROM compras_xml_itens WHERE importacao_id = $3 AND produto_id IS NULL AND peca_id IS NULL AND entrada_estoque_id IS NULL)::int itens_xml_soltos,
      (SELECT string_agg(descricao, ',' ORDER BY descricao) FROM compras_xml_itens WHERE importacao_id = $3) itens_xml_nomes,
      (SELECT count(*) FROM servicos WHERE user_id = $1)::int servicos, (SELECT count(*) FROM servicos WHERE user_id = $1 AND peca_id IS NULL)::int servicos_sem_peca,
      (SELECT count(*) FROM ordens_servico WHERE user_id = $1)::int os, (SELECT count(*) FROM contas WHERE user_id = $1)::int contas,
      (SELECT count(*) FROM orcamentos WHERE user_id = $1)::int orcamentos, (SELECT count(*) FROM clientes WHERE user_id = $1)::int clientes,
      (SELECT ultimo_numero FROM user_venda_counters WHERE user_id = $1) cont_venda, (SELECT ultimo_numero FROM user_os_counters WHERE user_id = $1) cont_os`,
      [uid(1), id(1, 4), id(1, 50)]);
    ok(c.produtos === 0 && c.pecas === 0 && c.entradas === 0 && c.mapeamento === 0, "C execução: não sobrou produto, peça, entrada de estoque nem ligação XML", c);
    ok(c.vendas === 0 && c.trocas === 0, "C execução: vendas (inclusive a de aparelho) e trocas apagadas", c);
    ok(c.aparelhos === 1 && c.imeis === 1 && c.compras === 1 && c.pessoas === 1 && c.fornecedores === 1 && c.listas === 1 && c.itens_lista === 1 && c.notas === 1,
      "C execução: aparelhos, IMEIs, compras, pessoas, fornecedores, listas e notas XML continuam", c);
    ok(c.itens_xml === 3 && c.itens_xml_soltos === 3 && c.itens_xml_nomes === "BRINDE,CAPINHA,TELA", "C execução: itens das notas XML continuam, sem produto/peça/entrada", c);
    ok(c.servicos === 2 && c.servicos_sem_peca === 2, "C execução: serviços continuam, sem a peça", c);
    ok(c.imeis_sem_venda === 1, "C execução: IMEI fica sem a venda apagada");
    ok(c.os === 2 && c.contas === 2 && c.orcamentos === 1 && c.clientes === 1, "C execução: OS, contas, orçamentos e clientes intocados", c);
    ok(c.cont_venda === 0 && c.cont_os === 5, "C execução: contador de vendas zerou; o de OS não", c);
    const log = await um(db, "SELECT categorias_pedidas, categorias_efetivas, arquivos_na_fila FROM zerar_dados_execucoes WHERE id = $1", [r.execucao_id]);
    ok(igual(log.categorias_pedidas, ["produtos_pecas"]) && igual(log.categorias_efetivas, ["vendas", "produtos_pecas"]) && log.arquivos_na_fila === 4, "C execução: log com o pedido e o efetivo", log);
    ok(igual(await foto(db, 2), U2antes), "G isolamento: U2 idêntico depois de Produtos e peças");
    // prova linha a linha do que fica (fora as ligações que viram NULL)
    await db.close();
  });

  // ---------- C. o que fica, linha a linha (twin: antes × depois) ----------
  await tentar("C linha a linha", async () => {
    const db = await clonar(blob);
    const SEM = ["venda_id", "produto_id", "peca_id", "entrada_estoque_id"];
    const tabs = ["public.dispositivos", "public.dispositivo_imeis", "public.compras_dispositivos", "public.origem_pessoas", "public.fornecedores",
      "public.listas_compras", "public.lista_compras", "public.compras_xml_importadas", "public.compras_xml_itens"];
    const antes = await foto(db, 1, SEM);
    await apagar(db, 1, ["produtos_pecas"]);
    const depois = await foto(db, 1, SEM);
    const mudou = tabs.filter((t) => antes[t] !== depois[t]);
    ok(mudou.length === 0, "C aparelhos, IMEIs, compras, pessoas, fornecedores, listas e notas XML iguais linha a linha", mudou);
    await db.close();
  });

  // ---------- D. Estoque + Produtos e peças = Estoque; Tudo + Produtos e peças = Tudo ----------
  for (const [com, sem] of [[["estoque", "produtos_pecas"], ["estoque"]], [["tudo", "produtos_pecas"], ["tudo"]],
                            [["estoque", "produtos_pecas", "os"], ["estoque", "os"]]]) {
    await tentar(`D ${com.join("+")}`, async () => {
      const a = await clonar(blob), b = await clonar(blob);
      const pa = await previa(a, 1, com), pb = await previa(b, 1, sem);
      const { categorias_pedidas: x1, absorvidas, ...ra } = pa;
      const { categorias_pedidas: x2, ...rb } = pb;
      ok(igual(ra, rb), `D prévia ${com.join("+")} = ${sem.join("+")} (efetivas, contagens, avisos, impressão)`);
      ok(com.includes("tudo") ? absorvidas === undefined
        : igual(absorvidas, [{ categoria: "produtos_pecas", por_causa_de: "estoque", motivo: "O Estoque já apaga os produtos e as peças." }]),
        `D prévia ${com.join("+")}: absorvidas`, absorvidas);
      const ea = await executar(a, 1, com, "APAGAR", pa.impressao), eb = await executar(b, 1, sem, "APAGAR", pb.impressao);
      ok(igual(semId(ea), semId(eb)) && igual(await foto(a, 1), await foto(b, 1)) && igual(await fila(a, ea.execucao_id), await fila(b, eb.execucao_id)),
        `D execução ${com.join("+")} = ${sem.join("+")} (nada contado duas vezes)`, [ea.fantasmas_cota, eb.fantasmas_cota]);
      ok(igual(await foto(a, 2), await foto(b, 2)), `G isolamento: U2 idêntico em ${com.join("+")}`);
      await a.close(); await b.close();
    });
  }

  // ---------- E. combinações ----------
  await tentar("E", async () => {
    const db = await clonar(blob);
    const pOs = await previa(db, 1, ["os", "produtos_pecas"]);
    ok(!pOs.avisos.some((a) => a.codigo === "pecas_os_nao_voltam"), "E OS + Produtos e peças: sem o aviso 'peças das OS não voltam' (as peças são apagadas)");
    const pFin = await previa(db, 1, ["financeiro", "produtos_pecas"]);
    ok(!pFin.avisos.some((a) => a.codigo === "entradas_sem_conta"), "E Financeiro + Produtos e peças: sem o aviso 'entradas sem conta' (as entradas são apagadas)");
    const pCli = await previa(db, 1, ["clientes", "produtos_pecas"]);
    ok(igual(pCli.incluidas_automaticamente.map((i) => `${i.categoria}<${i.por_causa_de}`), ["os<clientes", "vendas<clientes", "orcamentos<clientes"]),
      "E Clientes + Produtos e peças: vendas entram uma vez só (por causa de clientes)", pCli.incluidas_automaticamente);
    const pVen = await previa(db, 1, ["vendas", "produtos_pecas"]);
    ok(igual(pVen.incluidas_automaticamente, []) && igual(pVen.categorias_efetivas, ["vendas", "produtos_pecas"]), "E Vendas + Produtos e peças: vendas marcada não aparece como incluída");
    await db.close();
    for (const cats of [["os", "produtos_pecas"], ["financeiro", "produtos_pecas"], ["clientes", "produtos_pecas"], ["clientes", "financeiro", "os", "produtos_pecas", "orcamentos"]]) {
      const d = await clonar(blob);
      const U2 = await foto(d, 2);
      try {
        const { r } = await apagar(d, 1, cats);
        const sobrou = await um(d, "SELECT (SELECT count(*) FROM produtos WHERE user_id = $1)::int + (SELECT count(*) FROM pecas WHERE user_id = $1)::int n, (SELECT count(*) FROM dispositivos WHERE user_id = $1)::int ap, (SELECT count(*) FROM fornecedores WHERE user_id = $1)::int f", [uid(1)]);
        ok(sobrou.n === 0 && sobrou.ap === 1 && sobrou.f === 1 && !("dispositivo" in r.fantasmas_cota), `E execução ${cats.join("+")}: apaga produtos e peças, mantém aparelho e fornecedor`, { sobrou, f: r.fantasmas_cota });
      } catch (e) {
        ok(false, `E execução ${cats.join("+")}`, `${e.code} ${e.message} ${e.detail ?? ""}`);
      }
      ok(igual(await foto(d, 2), U2), `G isolamento: U2 idêntico em ${cats.join("+")}`);
      await d.close();
    }
  });

  // ---------- F. erros ZD ----------
  await tentar("F", async () => {
    const db = await clonar(blob);
    const antes1 = await foto(db, 1), antes2 = await foto(db, 2);
    const p = await previa(db, 1, ["produtos_pecas"]);
    ok(await erro(() => previa(db, 1, ["produtos_pecas"], { semLogin: true })) === "ZD000", "F ZD000 prévia sem login");
    ok(await erro(() => executar(db, 1, ["produtos_pecas"], "APAGAR", p.impressao, { semLogin: true })) === "ZD000", "F ZD000 execução sem login");
    ok(await erro(() => previa(db, 1, [])) === "ZD007", "F ZD007 nada escolhido");
    ok(await erro(() => previa(db, 1, ["produtos"])) === "ZD007", "F ZD007 categoria desconhecida ('produtos')");
    ok(await erro(() => previa(db, 1, ["produtos_pecas", "xyz"])) === "ZD007", "F ZD007 produtos_pecas + desconhecida");
    ok(await erro(() => executar(db, 1, ["produtos_pecas"], "apagar", p.impressao)) === "ZD002", "F ZD002 confirmação errada");
    ok(await erro(() => executar(db, 1, ["produtos_pecas"], "APAGAR", p.impressao, { senhaHaMin: 20 })) === "ZD003", "F ZD003 senha de 20 min atrás");
    ok(await erro(() => executar(db, 1, ["produtos_pecas"], "APAGAR", "x")) === "ZD005", "F ZD005 impressão diferente");
    const impEstoque = (await previa(db, 1, ["estoque"])).impressao;
    ok(await erro(() => executar(db, 1, ["produtos_pecas"], "APAGAR", impEstoque)) === "ZD005",
      "F ZD005 impressão do Estoque não serve para Produtos e peças");
    const pa = await previa(db, 3, ["produtos_pecas"]);
    ok(pa.pode_usar === false && pa.codigo === "admin", "F admin: prévia recusa", pa.codigo);
    ok(await erro(() => executar(db, 3, ["produtos_pecas"], "APAGAR", "x")) === "ZD001", "F ZD001 admin");
    const pf = await previa(db, 4, ["produtos_pecas"]);
    ok(pf.pode_usar === false && pf.codigo === "funcionario" && await erro(() => executar(db, 4, ["produtos_pecas"], "APAGAR", "x")) === "ZD001", "F ZD001 funcionário");
    ok(igual(await foto(db, 1), antes1) && igual(await foto(db, 2), antes2), "F nenhum erro apagou nada");
    await executar(db, 1, ["produtos_pecas"], "APAGAR", p.impressao);
    const p2 = await previa(db, 1, ["produtos_pecas"]);
    ok(p2.proxima_execucao_em !== null && await erro(() => executar(db, 1, ["produtos_pecas"], "APAGAR", p2.impressao)) === "ZD004", "F ZD004 de novo antes de 10 min");
    await db.close();
  });

  // ---------- F. conferência final ----------
  const GATILHOS = [
    ["apaga uma lista de compras junto", "ZD006", `CREATE FUNCTION public._t_g() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN DELETE FROM public.lista_compras WHERE user_id = OLD.user_id; RETURN OLD; END $$;
      CREATE TRIGGER _t_g AFTER DELETE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public._t_g();`],
    ["muda o nome do fornecedor (mesma contagem)", "ZD006", `CREATE FUNCTION public._t_g() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.fornecedores SET nome = nome || '!' WHERE user_id = OLD.user_id; RETURN OLD; END $$;
      CREATE TRIGGER _t_g AFTER DELETE ON public.pecas FOR EACH ROW EXECUTE FUNCTION public._t_g();`],
    ["muda o modelo do aparelho (mesma contagem)", "ZD006", `CREATE FUNCTION public._t_g() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.dispositivos SET modelo = 'outro' WHERE user_id = OLD.user_id; RETURN OLD; END $$;
      CREATE TRIGGER _t_g AFTER DELETE ON public.pecas FOR EACH ROW EXECUTE FUNCTION public._t_g();`],
    ["só toca o updated_at do aparelho", "sem erro", `CREATE FUNCTION public._t_g() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.dispositivos SET updated_at = now() WHERE user_id = OLD.user_id; RETURN OLD; END $$;
      CREATE TRIGGER _t_g AFTER DELETE ON public.pecas FOR EACH ROW EXECUTE FUNCTION public._t_g();`],
  ];
  for (const [nome, esperado, sql] of GATILHOS) {
    await tentar(`F conferência: ${nome}`, async () => {
      const db = await clonar(blob);
      await db.exec(sql);
      const antes = await foto(db, 1);
      const p = await previa(db, 1, ["produtos_pecas"]);
      const e = await erro(() => executar(db, 1, ["produtos_pecas"], "APAGAR", p.impressao));
      ok(e === esperado, `F conferência final: ${nome} → ${esperado}`, e);
      if (esperado === "ZD006") ok(igual(await foto(db, 1), antes), `F conferência final: ${nome} → nada apagado`);
      await db.close();
    });
  }

  // ---------- I. rollback ----------
  await tentar("I", async () => {
    const db = await clonar(blob);
    const antes1 = await foto(db, 1), antes2 = await foto(db, 2);
    await db.exec(txt.rollback);
    const f = Object.fromEntries((await db.query(
      "SELECT proname, md5(prosrc) h, prosecdef, proconfig, proacl::text acl FROM pg_proc WHERE proname IN ('zerar_meus_dados_previa', 'zerar_meus_dados_executar')")).rows
      .map((r) => [r.proname, r]));
    for (const nome of ["zerar_meus_dados_previa", "zerar_meus_dados_executar"]) {
      ok(igual(f[nome], fonteAntiga[nome]), `I rollback: ${nome} volta ao texto exato (md5), SECURITY DEFINER, search_path e permissões`, [f[nome], fonteAntiga[nome]]);
    }
    ok(igual(await foto(db, 1), antes1) && igual(await foto(db, 2), antes2), "I rollback não toca em dado nenhum");
    ok(await erro(() => previa(db, 1, ["produtos_pecas"])) === "ZD007", "I depois do rollback, 'produtos_pecas' volta a ser desconhecida (ZD007)");
    ok(igual(await previa(db, 1, ["estoque"]), previasAntigas.get("estoque")), "I depois do rollback, Estoque igual ao antigo");
    await db.exec(txt.rollback);
    ok((await db.query("SELECT md5(prosrc) h FROM pg_proc WHERE proname = 'zerar_meus_dados_previa'")).rows[0].h === fonteAntiga.zerar_meus_dados_previa.h, "I rollback idempotente");
    await db.close();
  });

  if (!silencioso) console.log(`(${n} verificações)`);
  return falhas;
}

// ---------------------------------------------------------------------------
// Mutantes: cada um TEM que derrubar a suíte
// ---------------------------------------------------------------------------
const PP = "'public.entradas_estoque', 'public.compras_xml_mapeamento',\n                                       'public.produtos', 'public.pecas'];";
const MUTANTES = [
  { nome: "apaga os aparelhos junto", todos: true, de: PP, para: PP.replace("'public.pecas']", "'public.pecas', 'public.dispositivo_imeis', 'public.dispositivos']") },
  { nome: "apaga os fornecedores junto", todos: true, de: PP, para: PP.replace("'public.pecas']", "'public.pecas', 'public.fornecedores']") },
  { nome: "apaga as listas de compras junto", todos: true, de: PP, para: PP.replace("'public.pecas']", "'public.pecas', 'public.lista_compras', 'public.listas_compras']") },
  { nome: "apaga as notas XML junto", todos: true, de: PP, para: PP.replace("'public.pecas']", "'public.pecas', 'public.compras_xml_itens', 'public.compras_xml_importadas']") },
  { nome: "entradas de estoque ficam", todos: true, de: PP, para: PP.replace("'public.entradas_estoque', ", "") },
  { nome: "mapeamento XML fica (some pelo CASCADE)", todos: true, de: PP, para: PP.replace("'public.compras_xml_mapeamento',", "") },
  { nome: "não inclui as vendas", de: "  IF 'produtos_pecas' = ANY (v_ef) AND NOT 'vendas' = ANY (v_ef) THEN\n    v_ef := v_ef || 'vendas'::text;", para: "  IF false THEN\n    v_ef := v_ef || 'vendas'::text;" },
  { nome: "motivo da inclusão diferente do da tela", de: "'As vendas ficariam sem o produto ou a peça vendida.'", para: "'As vendas ficariam sem o produto.'" },
  { nome: "sem absorção pelo Estoque", de: "  IF 'estoque' = ANY (v_ef) AND 'produtos_pecas' = ANY (v_ef) THEN\n    v_ef := array_remove(v_ef, 'produtos_pecas');", para: "  IF false THEN\n    v_ef := array_remove(v_ef, 'produtos_pecas');" },
  { nome: "Tudo passa a incluir Produtos e peças", de: "THEN array_remove(c_ordem, 'produtos_pecas') ELSE", para: "THEN c_ordem ELSE" },
  { nome: "aceita categoria desconhecida", de: "'produtos_pecas', 'orcamentos', 'tudo'];", para: "'produtos_pecas', 'orcamentos', 'tudo', 'produtos'];" },
  { nome: "fantasma de aparelho em Produtos e peças", de: "    -- Só produtos e peças: os aparelhos continuam (e contam na cota por si).\n",
    para: "    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)\n    SELECT v_uid, 'dispositivo', created_at, v_exec FROM public.dispositivos WHERE user_id = v_uid;\n" },
  { nome: "fantasmas com produtos de outro usuário", de: "    -- Só produtos e peças: os aparelhos continuam (e contam na cota por si).\n    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)\n    SELECT v_uid, 'produto', created_at, v_exec FROM public.produtos WHERE user_id = v_uid;",
    para: "    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)\n    SELECT v_uid, 'produto', created_at, v_exec FROM public.produtos;" },
  { nome: "sem fantasmas em Produtos e peças", de: "    -- Só produtos e peças: os aparelhos continuam (e contam na cota por si).\n    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)\n    SELECT v_uid, 'produto', created_at, v_exec FROM public.produtos WHERE user_id = v_uid;",
    para: "    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)\n    SELECT v_uid, 'produto', created_at, v_exec FROM public.produtos WHERE false;" },
  { nome: "fotos de aparelhos/compras na fila", de: "THEN c_buckets_pp ELSE c_buckets END;", para: "THEN c_buckets ELSE c_buckets END;" },
  { nome: "itens XML de outro usuário ficam sem produto", de: "     WHERE importacao_id IN (SELECT id FROM public.compras_xml_importadas WHERE user_id = v_uid)\n       AND (produto_id IN (SELECT id FROM public.produtos WHERE user_id = v_uid)\n            OR",
    para: "     WHERE (produto_id IN (SELECT id FROM public.produtos)\n            OR" ,
    extra: [["      produto_id = CASE WHEN produto_id IN (SELECT id FROM public.produtos WHERE user_id = v_uid) THEN NULL", "      produto_id = CASE WHEN produto_id IN (SELECT id FROM public.produtos) THEN NULL"]] },
  { nome: "serviço sem desvínculo na execução", de: "  IF v_pp THEN\n    UPDATE public.servicos SET peca_id = NULL", para: "  IF v_pp THEN\n    UPDATE public.servicos SET peca_id = peca_id" },
  { nome: "serviço sem desvínculo na prévia", de: "    v_desv := v_desv || jsonb_build_object('servicos_sem_peca',\n      (SELECT count(*) FROM public.servicos WHERE user_id = v_uid\n         AND peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid)));\n    v_desv := v_desv || jsonb_build_object('itens_xml_sem_produto',",
    para: "    v_desv := v_desv || jsonb_build_object('itens_xml_sem_produto'," },
  { nome: "itens XML sem desvínculo explícito (fica só o SET NULL da FK)",
    de: "     WHERE importacao_id IN (SELECT id FROM public.compras_xml_importadas WHERE user_id = v_uid)\n       AND (produto_id IN (SELECT id FROM public.produtos WHERE user_id = v_uid)\n            OR",
    para: "     WHERE false AND importacao_id IN (SELECT id FROM public.compras_xml_importadas WHERE user_id = v_uid)\n       AND (produto_id IN (SELECT id FROM public.produtos WHERE user_id = v_uid)\n            OR" },
  { nome: "sem conferência linha a linha", de: "    WHERE v_mantidos ? c.tabela\n", para: "    WHERE false\n" },
  { nome: "conferência ignora todas as colunas", de: "      v_ign := ARRAY['updated_at'] || ARRAY(", para: "      v_ign := ARRAY(SELECT attname::text FROM pg_attribute WHERE attrelid = to_regclass(r.tabela) AND attnum > 0) || ARRAY(" },
  { nome: "conferência não confere a tabela de Produtos e peças", de: "    IF r.lista = 'APAGAR' AND (r.categoria = ANY (v_casar) OR (v_pp AND r.tabela = ANY (c_tab_pp))) THEN", para: "    IF r.lista = 'APAGAR' AND r.categoria = ANY (v_casar) THEN" },
  { nome: "prévia não conta Produtos e peças", de: "    WHERE c.lista = 'APAGAR' AND (c.categoria = ANY (v_casar) OR (v_pp AND c.tabela = ANY (c_tab_pp))) AND to_regclass(c.tabela) IS NOT NULL\n    ORDER BY c.ordem\n  LOOP\n    EXECUTE format('SELECT count(*)",
    para: "    WHERE c.lista = 'APAGAR' AND c.categoria = ANY (v_casar) AND to_regclass(c.tabela) IS NOT NULL\n    ORDER BY c.ordem\n  LOOP\n    EXECUTE format('SELECT count(*)" },
  { nome: "aviso de vendas de aparelhos some", de: "    v_avisos := v_avisos || jsonb_build_object('codigo', 'vendas_de_aparelhos', 'quantidade', v_cnt,", para: "    v_avisos := v_avisos || jsonb_build_object('codigo', 'vendas', 'quantidade', v_cnt," },
  { nome: "aviso de vendas de aparelhos conta parcelas", de: "    SELECT count(*) INTO v_cnt FROM public.vendas WHERE user_id = v_uid AND dispositivo_id IS NOT NULL\n      AND (parcela_numero IS NULL OR parcela_numero = 1)\n", para: "    SELECT count(*) INTO v_cnt FROM public.vendas WHERE user_id = v_uid AND dispositivo_id IS NOT NULL\n" },
  { nome: "aviso das peças das OS com Produtos e peças", de: "AND NOT 'estoque' = ANY (v_ef) AND NOT v_pp THEN\n    v_avisos := v_avisos || jsonb_build_object('codigo', 'pecas_os_nao_voltam'", para: "AND NOT 'estoque' = ANY (v_ef) THEN\n    v_avisos := v_avisos || jsonb_build_object('codigo', 'pecas_os_nao_voltam'" },
  { nome: "aviso das entradas sem conta com Produtos e peças", de: "  IF 'financeiro' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) AND NOT v_pp THEN", para: "  IF 'financeiro' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) THEN" },
  { nome: "texto antigo de 'não volta' com Produtos e peças", de: "CASE WHEN v_pp THEN 'Os aparelhos vendidos não voltam para o estoque.'", para: "CASE WHEN false THEN 'Os aparelhos vendidos não voltam para o estoque.'" },
  { nome: "resumo sem as entradas", de: "      'entradas_estoque', COALESCE((v_tab->>'entradas_estoque')::bigint, 0),\n", para: "" },
  { nome: "absorvidas sempre presente", de: "  RETURN CASE WHEN jsonb_array_length(v_absorvidas) > 0\n", para: "  RETURN CASE WHEN true\n" },
  { nome: "sem trava de admin", de: "  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role::text = 'admin') THEN", para: "  IF false THEN" },
  { nome: "anon pode executar a prévia", de: "REVOKE ALL ON FUNCTION public.zerar_meus_dados_previa(text[]) FROM PUBLIC, anon;", para: "REVOKE ALL ON FUNCTION public.zerar_meus_dados_previa(text[]) FROM PUBLIC;\nGRANT EXECUTE ON FUNCTION public.zerar_meus_dados_previa(text[]) TO anon;" },
  { nome: "execução sem SECURITY DEFINER", de: "RETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public, pg_temp\nAS $fn$\nDECLARE\n  c_buckets", para: "RETURNS jsonb\nLANGUAGE plpgsql\nSECURITY INVOKER\nSET search_path = public, pg_temp\nAS $fn$\nDECLARE\n  c_buckets" },
  { nome: "prévia sem search_path fixo", de: "RETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public, pg_temp\nAS $fn$\nDECLARE\n  c_ordem", para: "RETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $fn$\nDECLARE\n  c_ordem" },
  { nome: "conferência espera md5 da execução nova", alvo: "conferir", de: "= 'f42a00788eb4dab5c5abb6c75ef713cd'),", para: "= '2879d571ef93b589a4bd5f20e82950d7')," },
  { nome: "conferência aceita FK nova para produtos", alvo: "conferir", de: "(SELECT lista FROM fk) = 'compras_xml_itens.peca_id:n,", para: "(SELECT lista FROM fk) LIKE '%' OR (SELECT lista FROM fk) = 'compras_xml_itens.peca_id:n," },
  { nome: "conferência aceita gatilho de DELETE", alvo: "conferir", de: "(SELECT lista FROM trg) = '(nenhum)'),", para: "true)," },
  { nome: "verificação espera md5 da prévia antiga", alvo: "verificar", de: "= 'dde29d23c95e58bd38acc4763f457389'),", para: "= '04a361c6316841c9c6a7425b272a0636')," },
  { nome: "rollback sem a execução antiga", alvo: "rollback", de: "CREATE OR REPLACE FUNCTION public.zerar_meus_dados_executar(", para: "CREATE OR REPLACE FUNCTION public.zerar_meus_dados_executar_x(" },
  { nome: "rollback deixa Produtos e peças na prévia", alvo: "rollback", de: "c_validas   constant text[] := ARRAY['vendas', 'os', 'clientes', 'financeiro', 'estoque', 'orcamentos', 'tudo'];", para: "c_validas   constant text[] := ARRAY['vendas', 'os', 'clientes', 'financeiro', 'estoque', 'orcamentos', 'tudo', 'produtos_pecas'];" },
  // (tirar o GRANT do rollback é mutante EQUIVALENTE: CREATE OR REPLACE mantém as permissões que a função já tem)
  { nome: "rollback abre a execução para anon", alvo: "rollback", de: "GRANT EXECUTE ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) TO authenticated, service_role;", para: "GRANT EXECUTE ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) TO authenticated, service_role, anon;" },
];

function aplicarMutante(m) {
  const s = { ...ORIG };
  const alvo = m.alvo ?? "mig";
  const antes = s[alvo];
  s[alvo] = m.todos ? antes.split(m.de).join(m.para) : antes.replace(m.de, () => m.para);
  for (const [de, para] of m.extra ?? []) s[alvo] = s[alvo].replace(de, () => para);
  if (s[alvo] === antes) throw new Error(`mutante "${m.nome}" não achou o trecho`);
  return s;
}

const md5 = (t) => createHash("md5").update(t).digest("hex");
if (process.argv.includes("--hashes")) {
  for (const p of [ARQ.mig, ARQ.rollback, "scripts/zerar-produtos-pecas/0-conferir-producao.sql", "scripts/zerar-produtos-pecas/1-verificar.sql"]) {
    try { console.log(`md5 arquivo ${p}: ${md5(ler(p))}`); } catch { console.log(`(sem ${p})`); }
  }
  const db = await novoBanco();
  const H = `SELECT proname, md5(prosrc) exato,
      md5(regexp_replace(prosrc, '^[ \\t]*--[^\\n]*\\n', '', 'gn')) sem_linhas_comentario,
      md5(btrim(regexp_replace(regexp_replace(prosrc, '--[^\\n]*', '', 'g'), '\\s+', ' ', 'g'))) normalizado
    FROM pg_proc WHERE proname IN ('zerar_meus_dados_previa', 'zerar_meus_dados_executar') ORDER BY proname`;
  console.log("ANTES (em vigor):", JSON.stringify((await db.query(H)).rows, null, 1));
  await db.exec(ORIG.mig);
  console.log("DEPOIS (20261124120000):", JSON.stringify((await db.query(H)).rows, null, 1));
  await db.close();
  process.exit(0);
}

console.log("\n--- suíte ---");
const t0 = Date.now();
const falhas = await suite(ORIG);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
let falhasMut = 0;
if (process.argv.includes("--mutantes")) {
  console.log("\n--- mutantes (cada um precisa ser MORTO) ---");
  const base = await suite(ORIG, { silencioso: true, comVerificacao: false });
  console.log(base.length === 0 ? "OK    suíte sem a verificação por md5 passa sem mutação" : `FALHA suíte sem a verificação: ${base.join(" | ")}`);
  if (base.length) falhasMut++;
  const filtro = process.env.SO_MUTANTE;
  for (const m of MUTANTES.filter((x) => !filtro || x.nome.includes(filtro))) {
    const f = await suite(aplicarMutante(m), { silencioso: true, comVerificacao: m.alvo === "conferir" || m.alvo === "verificar" });
    const morto = f.length > 0;
    if (!morto) falhasMut++;
    console.log(`${morto ? "MORTO" : "VIVO!"} ${m.nome}${morto ? ` — ${f.length} verificação(ões):` : ""}`);
    for (const x of f.slice(0, 2)) console.log(`        · ${x.split("\n")[0].slice(0, 150)}`);
  }
  console.log(`(${MUTANTES.length} mutantes)`);
}
const total = falhas.length + falhasMut;
console.log(total === 0 ? "\nTUDO OK" : `\n${total} FALHA(S)`);
process.exit(total ? 1 : 0);
