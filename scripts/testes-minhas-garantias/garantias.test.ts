// deno test --no-check scripts/testes-minhas-garantias/
// "Minhas garantias" (fase A): regras puras de src/lib/garantias/garantias.ts.
// Dados 100% fictícios.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  type GarantiaLoja,
  garantiasPadraoVirtuais,
  garantiasParaExibir,
  planoGravacao,
  prazosDivergentes,
  validarGarantia,
} from "../../src/lib/garantias/garantias.ts";
import { TEXTO_PADRAO_COM_GARANTIA, TEXTO_PADRAO_SEM_GARANTIA } from "../../src/lib/garantias/textoPadrao.ts";

const DONO = { user_id: "u-dono", empresa_id: "emp-matriz" };
const linha = (p: Partial<GarantiaLoja> & { id: string }): GarantiaLoja => ({
  user_id: "u-dono",
  empresa_id: "emp-matriz",
  nome: "G",
  meses: 3,
  texto: "t",
  ativo: true,
  ordem: 10,
  revisar: false,
  origem: "manual",
  origem_ref: null,
  deleted_at: null,
  ...p,
});

// ── Padrões virtuais ────────────────────────────────────────────────────────

Deno.test("padrões virtuais: Sem garantia, 3, 6 e 12 meses com o texto padrão certo", () => {
  const v = garantiasPadraoVirtuais();
  assertEquals(v.map((g) => [g.chave, g.nome, g.meses]), [
    ["padrao:0", "Sem garantia", 0],
    ["padrao:3", "Garantia 3 meses", 3],
    ["padrao:6", "Garantia 6 meses", 6],
    ["padrao:12", "Garantia 12 meses", 12],
  ]);
  assertEquals(v[0].texto, TEXTO_PADRAO_SEM_GARANTIA);
  for (const g of v.slice(1)) assertEquals(g.texto, TEXTO_PADRAO_COM_GARANTIA);
  assert(v.every((g) => g.virtual && g.id === null && g.ativo && !g.revisar && g.origem === "padrao"));
});

Deno.test("texto padrão: prazo só pela variável (nada de '6 meses' fixo nem 'meses meses')", () => {
  assert(!/\{\{garantia_meses\}\}\s+meses/i.test(TEXTO_PADRAO_COM_GARANTIA));
  assert(TEXTO_PADRAO_COM_GARANTIA.includes("{{garantia_meses}}"));
  for (const m of [0, 1, 3, 6, 12, 18, 24, 120]) {
    assertEquals(prazosDivergentes(TEXTO_PADRAO_COM_GARANTIA, m), [], `com garantia, ${m} meses`);
    assertEquals(prazosDivergentes(TEXTO_PADRAO_SEM_GARANTIA, m), [], `sem garantia, ${m} meses`);
  }
  assert(!TEXTO_PADRAO_COM_GARANTIA.includes("GARANTIA LEGAL"), "sem o bloco que o formatador apaga");
});

Deno.test("lista: loja que nunca teve linha vê os padrões virtuais", () => {
  const r = garantiasParaExibir([]);
  assert(r.virtual);
  assertEquals(r.lista.length, 4);
});

Deno.test("lista: com linhas, só as não apagadas, ordenadas por ordem e nome; padrões não voltam", () => {
  const r = garantiasParaExibir([
    linha({ id: "c", nome: "Zeta", ordem: 20 }),
    linha({ id: "a", nome: "Beta", ordem: 10 }),
    linha({ id: "b", nome: "Alfa", ordem: 10 }),
    linha({ id: "x", nome: "Apagada", ordem: 0, deleted_at: "2026-11-20T10:00:00Z" }),
  ]);
  assert(!r.virtual);
  assertEquals(r.lista.map((g) => g.chave), ["b", "a", "c"]);
  const todasApagadas = garantiasParaExibir([linha({ id: "x", deleted_at: "2026-11-20T10:00:00Z" })]);
  assertEquals(todasApagadas, { lista: [], virtual: false });
});

// ── Validação (mesmos limites dos CHECKs) ───────────────────────────────────

Deno.test("validação: nome, prazo e texto", () => {
  assert(validarGarantia({ nome: " Garantia ", meses: 3, texto: "t" }).ok);
  const ok = validarGarantia({ nome: " Garantia ", meses: 0, texto: "t" });
  assert(ok.ok && ok.valor.nome === "Garantia" && ok.valor.ativo === true);
  const ruins: [string, Parameters<typeof validarGarantia>[0], string][] = [
    ["nome vazio", { nome: "   ", meses: 3, texto: "t" }, "nome"],
    ["nome longo", { nome: "x".repeat(81), meses: 3, texto: "t" }, "nome"],
    ["prazo negativo", { nome: "a", meses: -1, texto: "t" }, "meses"],
    ["prazo > 120", { nome: "a", meses: 121, texto: "t" }, "meses"],
    ["prazo quebrado", { nome: "a", meses: 2.5, texto: "t" }, "meses"],
    ["prazo vazio", { nome: "a", meses: NaN, texto: "t" }, "meses"],
    ["texto vazio", { nome: "a", meses: 3, texto: "  \n" }, "texto"],
    ["texto > 20000 bytes", { nome: "a", meses: 3, texto: "é".repeat(10001) }, "texto"],
  ];
  for (const [rotulo, d, campo] of ruins) {
    const v = validarGarantia(d);
    assert(!v.ok && campo in v.erros, rotulo);
  }
  assert(validarGarantia({ nome: "x".repeat(80), meses: 120, texto: "a".repeat(20000) }).ok, "nos limites");
});

// ── Prazo escrito à mão ─────────────────────────────────────────────────────

Deno.test("prazo à mão diferente do prazo da garantia", () => {
  assertEquals(prazosDivergentes("Garantia de 6 meses.", 3), [{ trecho: "6 meses", meses: 6 }]);
  assertEquals(prazosDivergentes("Garantia de 6 (seis) meses.", 6), []);
  assertEquals(prazosDivergentes("GARANTIA CONTRATUAL (12 meses)", 3).map((p) => p.meses), [12]);
  assertEquals(prazosDivergentes("Garantia de 1 ano", 12), []);
  assertEquals(prazosDivergentes("Garantia de um ano", 6).map((p) => p.meses), [12]);
  assertEquals(prazosDivergentes("dois anos de garantia", 24), []);
  assertEquals(prazosDivergentes("1 mês", 1), []);
  assertEquals(prazosDivergentes("Garantia legal de 90 dias (CDC)", 3), [], "dias não contam");
  assertEquals(prazosDivergentes("{{garantia_meses}} meses", 3), [], "a variável não é prazo fixo");
  assertEquals(prazosDivergentes("6 meses", 0).length, 1, "sem garantia com prazo no texto");
});

// ── Plano de gravação: lista virtual ────────────────────────────────────────

Deno.test("virtual + editar: grava as 4 padrão de uma vez, com a editada já alterada", () => {
  const p = planoGravacao([], { tipo: "editar", chave: "padrao:3", dados: { nome: "Três meses", meses: 3, texto: "T3" } }, DONO);
  assertEquals(p.atualizar, []);
  assertEquals(p.inserir.length, 4);
  assert(p.inserir.every((n) => n.user_id === "u-dono" && n.empresa_id === "emp-matriz" && n.origem === "padrao" && n.deleted_at === null));
  assertEquals(p.inserir.map((n) => n.origem_ref), ["padrao:0", "padrao:3", "padrao:6", "padrao:12"]);
  assertEquals([p.inserir[1].nome, p.inserir[1].texto], ["Três meses", "T3"]);
  assertEquals(p.inserir[2].texto, TEXTO_PADRAO_COM_GARANTIA, "as outras ficam iguais");
});

Deno.test("virtual + criar: 4 padrão + a nova (manual, no fim)", () => {
  const p = planoGravacao([], { tipo: "criar", dados: { nome: "Vitrine", meses: 2, texto: "V" } }, DONO);
  assertEquals(p.inserir.length, 5);
  const nova = p.inserir[4];
  assertEquals([nova.nome, nova.meses, nova.origem, nova.origem_ref, nova.ordem], ["Vitrine", 2, "manual", null, 40]);
});

Deno.test("virtual + excluir: grava as 4, a excluída já apagada (a lista não volta a ser virtual)", () => {
  const agora = "2026-11-20T12:00:00.000Z";
  const p = planoGravacao([], { tipo: "excluir", chave: "padrao:0", agora }, DONO);
  assertEquals(p.inserir.length, 4);
  assertEquals(p.inserir[0].deleted_at, agora);
  assert(p.inserir.slice(1).every((n) => n.deleted_at === null));
});

Deno.test("virtual + duplicar e ativar", () => {
  const d = planoGravacao([], { tipo: "duplicar", chave: "padrao:6" }, DONO);
  assertEquals(d.inserir.length, 5);
  assertEquals([d.inserir[4].nome, d.inserir[4].meses, d.inserir[4].origem, d.inserir[4].origem_ref], ["Garantia 6 meses (cópia)", 6, "manual", null]);
  const a = planoGravacao([], { tipo: "ativar", chave: "padrao:12", ativo: false }, DONO);
  assertEquals(a.inserir.map((n) => n.ativo), [true, true, true, false]);
});

// ── Plano de gravação: linhas reais ─────────────────────────────────────────

const REAIS = [
  linha({ id: "g1", nome: "Garantia 3 meses", meses: 3, ordem: 10, revisar: true, origem: "modelo", origem_ref: "m:com" }),
  linha({ id: "g2", nome: "Garantia 3 meses (cópia)", ordem: 20 }),
  linha({ id: "g9", nome: "Velha", ordem: 90, deleted_at: "2026-11-01T00:00:00Z" }),
];

Deno.test("real + editar: UPDATE só da linha, e salvar tira o 'revisar'", () => {
  const p = planoGravacao(REAIS, { tipo: "editar", chave: "g1", dados: { nome: "G", meses: 4, texto: "x", ativo: false } }, DONO);
  assertEquals(p, { inserir: [], atualizar: [{ id: "g1", campos: { nome: "G", meses: 4, texto: "x", ativo: false, revisar: false } }] });
});

Deno.test("real + criar / duplicar (nome sem repetir) / ativar / excluir", () => {
  const c = planoGravacao(REAIS, { tipo: "criar", dados: { nome: "N", meses: 1, texto: "n" } }, DONO);
  assertEquals([c.inserir.length, c.inserir[0].ordem, c.inserir[0].origem], [1, 30, "manual"]);
  const d = planoGravacao(REAIS, { tipo: "duplicar", chave: "g1" }, DONO);
  assertEquals(d.inserir[0].nome, "Garantia 3 meses (cópia 2)");
  assertEquals([d.inserir[0].revisar, d.inserir[0].texto], [false, "t"]);
  assertEquals(planoGravacao(REAIS, { tipo: "ativar", chave: "g2", ativo: false }, DONO).atualizar, [{ id: "g2", campos: { ativo: false } }]);
  assertEquals(planoGravacao(REAIS, { tipo: "excluir", chave: "g2", agora: "T" }, DONO).atualizar, [{ id: "g2", campos: { deleted_at: "T" } }]);
});

Deno.test("cópia de nome longo continua cabendo em 80 caracteres", () => {
  const longo = [linha({ id: "l", nome: "N".repeat(80) })];
  const d = planoGravacao(longo, { tipo: "duplicar", chave: "l" }, DONO);
  assert([...d.inserir[0].nome].length <= 80);
  assert(d.inserir[0].nome.endsWith(" (cópia)"));
});

Deno.test("erros: chave inexistente, linha apagada e dados inválidos", () => {
  assertThrows(() => planoGravacao(REAIS, { tipo: "excluir", chave: "nao-existe", agora: "T" }, DONO));
  assertThrows(() => planoGravacao(REAIS, { tipo: "ativar", chave: "g9", ativo: true }, DONO), Error, "não encontrada");
  assertThrows(() => planoGravacao([], { tipo: "editar", chave: "padrao:99", dados: { nome: "a", meses: 1, texto: "t" } }, DONO));
  assertThrows(() => planoGravacao([], { tipo: "criar", dados: { nome: "", meses: 1, texto: "t" } }, DONO), Error, "inválida");
  assertThrows(() => planoGravacao(REAIS, { tipo: "editar", chave: "g1", dados: { nome: "a", meses: 500, texto: "t" } }, DONO), Error, "inválida");
});
