// deno test --no-check scripts/testes-etiquetas/
// Grade de etiquetas em folha/rolo (src/lib/etiquetas/layoutFolha.ts) e o modo
// com que a tela abre (src/lib/etiquetas/modoPadrao.ts). Caso real (out/2026):
// rolo de 107mm com 3 etiquetas de 33×21mm por fileira; a tela abria em
// "Térmica avulsa" e saía uma etiqueta por linha.
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { ErroLayoutFolha, calcularGradeFolha, montarCssGradeFolha, type MedidasFolha } from "../../src/lib/etiquetas/layoutFolha.ts";
import {
  AVISO_TERMICA_COM_PADRAO_FOLHA,
  avisoModoEtiqueta,
  escolherModoInicial,
  houveEscolhaManualNaSessao,
  marcarEscolhaManualNaSessao,
} from "../../src/lib/etiquetas/modoPadrao.ts";

// Rolo 107mm, 3 colunas de 33×21mm: sobram 8mm → 2mm nas laterais e entre colunas
// (mesma conta de calcularLayoutFolha), 1 fileira, página de 21mm.
const ROLO_107: MedidasFolha = {
  larguraFolhaMm: 107, alturaFolhaMm: 21, larguraMm: 33, alturaMm: 21, colunas: 3, linhas: 1,
  margemEsquerdaMm: 2, margemSuperiorMm: 0, gapColunasMm: 2, gapLinhasMm: 0,
};
const css = (m: MedidasFolha) => montarCssGradeFolha(calcularGradeFolha(m));
const sem = (s: string) => s.replace(/\s+/g, " ");

Deno.test("107×21mm, 3 colunas: posições, @page e colunas fixas em mm", () => {
  const g = calcularGradeFolha(ROLO_107);
  assertEquals(g.posicoes.map((p) => [p.coluna, p.linha, p.xMm, p.yMm, p.larguraMm, p.alturaMm]), [
    [0, 0, 2, 0, 33, 21],
    [1, 0, 37, 0, 33, 21],
    [2, 0, 72, 0, 33, 21],
  ]);
  // Última etiqueta termina em 105mm: sobra 2mm à direita, nada passa da página.
  assertEquals(g.posicoes[2].xMm + g.posicoes[2].larguraMm, 105);
  assertEquals(g.cssPage, "@page { size: 107.00mm 21.00mm; margin: 0; }");
  const c = sem(css(ROLO_107));
  for (const trecho of [
    "@page { size: 107.00mm 21.00mm; margin: 0; }",
    "width: 107.00mm; height: 21.00mm;",
    "padding: 0.00mm 0 0 2.00mm;",
    "grid-template-columns: repeat(3, 33.00mm); grid-auto-rows: 21.00mm;",
    "column-gap: 2.00mm; row-gap: 0.00mm;",
    ".etq-celula { width: 33.00mm; height: 21.00mm; overflow: hidden;",
  ]) assertEquals(c.includes(trecho), true, trecho);
});

Deno.test("margens zero e espaço zero: etiquetas encostadas, ocupando a folha toda", () => {
  const m = { ...ROLO_107, larguraFolhaMm: 99, margemEsquerdaMm: 0, gapColunasMm: 0 };
  const g = calcularGradeFolha(m);
  assertEquals(g.posicoes.map((p) => p.xMm), [0, 33, 66]);
  assertEquals(g.posicoes[2].xMm + 33, 99);
  const c = sem(css(m));
  assertEquals([c.includes("padding: 0.00mm 0 0 0.00mm;"), c.includes("column-gap: 0.00mm; row-gap: 0.00mm;")], [true, true]);
});

Deno.test("várias linhas com espaço entre linhas: y de cada fileira", () => {
  const g = calcularGradeFolha({ ...ROLO_107, alturaFolhaMm: 100, linhas: 3, margemSuperiorMm: 5, gapLinhasMm: 3 });
  assertEquals(g.posicoes.filter((p) => p.coluna === 0).map((p) => p.yMm), [5, 29, 53]);
  assertEquals(g.posicoes.map((p) => p.indice), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

Deno.test("escala 100%: tudo em mm, do tamanho pedido, sem zoom/scale/porcentagem", () => {
  const c = css(ROLO_107);
  assertEquals(/scale|zoom|%|\bfr\b|px/.test(c.replace(/\/\*.*?\*\//g, "")), false);
  assertEquals(c.includes("margin: 0;"), true);
});

Deno.test("1 coluna", () => {
  const m = { ...ROLO_107, larguraFolhaMm: 50, larguraMm: 40, alturaMm: 25, alturaFolhaMm: 28, colunas: 1, margemEsquerdaMm: 5, gapColunasMm: 5 };
  const g = calcularGradeFolha(m);
  assertEquals(g.posicoes.map((p) => [p.xMm, p.yMm, p.larguraMm, p.alturaMm]), [[5, 0, 40, 25]]);
  assertEquals(sem(css(m)).includes("grid-template-columns: repeat(1, 40.00mm);"), true);
});

Deno.test("configuração inválida: erro claro (colunas 0, largura 0, não cabe)", () => {
  assertThrows(() => calcularGradeFolha({ ...ROLO_107, colunas: 0 }), ErroLayoutFolha, "Colunas deve ser um número inteiro a partir de 1 (recebido: 0).");
  assertThrows(() => calcularGradeFolha({ ...ROLO_107, larguraMm: 0 }), ErroLayoutFolha, "Largura da etiqueta deve ser maior que zero (recebido: 0).");
  assertThrows(() => calcularGradeFolha({ ...ROLO_107, larguraFolhaMm: 0 }), ErroLayoutFolha, "Largura da folha deve ser maior que zero (recebido: 0).");
  assertThrows(() => calcularGradeFolha({ ...ROLO_107, gapColunasMm: -1 }), ErroLayoutFolha, "Espaço entre colunas não pode ser negativo(a)");
  assertThrows(() => calcularGradeFolha({ ...ROLO_107, colunas: 4 }), ErroLayoutFolha, "4 colunas ocupam 140mm e a folha tem 107mm de largura.");
  assertThrows(() => calcularGradeFolha({ ...ROLO_107, alturaMm: 22 }), ErroLayoutFolha, "1 linhas ocupam 22mm e a folha tem 21mm de altura.");
  assertThrows(() => calcularGradeFolha({ ...ROLO_107, colunas: 1.5 }), ErroLayoutFolha, "Colunas deve ser um número inteiro");
});

// ── Modo com que a tela abre ────────────────────────────────────────────────

Deno.test("modo: loja com padrão de folha abre em Folha/Grade (mesmo com térmica lembrada)", () => {
  assertEquals(escolherModoInicial({ formatoLembrado: "termica", padraoLembradoId: "personalizado", padroesLoja: ["loja-107"], escolhaManualNaSessao: false }),
    { formato: "a4", padraoId: "loja-107" });
  // Padrão lembrado que é da loja continua o escolhido.
  assertEquals(escolherModoInicial({ formatoLembrado: "termica", padraoLembradoId: "b", padroesLoja: ["a", "b"], escolhaManualNaSessao: false }),
    { formato: "a4", padraoId: "b" });
});

Deno.test("modo: sem padrão salvo mantém o comportamento atual", () => {
  for (const formato of ["termica", "a4"] as const) {
    assertEquals(escolherModoInicial({ formatoLembrado: formato, padraoLembradoId: "pimaco-A4356", padroesLoja: [], escolhaManualNaSessao: false }),
      { formato, padraoId: null });
  }
});

Deno.test("modo: escolha manual na sessão vale e não é sobrescrita", () => {
  assertEquals(escolherModoInicial({ formatoLembrado: "termica", padraoLembradoId: "x", padroesLoja: ["loja-107"], escolhaManualNaSessao: true }),
    { formato: "termica", padraoId: null });
  const sessao = new Map<string, string>();
  const armazenamento = { getItem: (k: string) => sessao.get(k) ?? null, setItem: (k: string, v: string) => void sessao.set(k, v) };
  assertEquals(houveEscolhaManualNaSessao(armazenamento), false);
  marcarEscolhaManualNaSessao(armazenamento);
  assertEquals(houveEscolhaManualNaSessao(armazenamento), true);
  // Storage indisponível (aba anônima/bloqueado): não quebra.
  const quebrado = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  marcarEscolhaManualNaSessao(quebrado);
  assertEquals(houveEscolhaManualNaSessao(quebrado), false);
  assertEquals(houveEscolhaManualNaSessao(null), false);
});

Deno.test("aviso: Térmica avulsa numa loja com padrão de folha", () => {
  assertEquals(avisoModoEtiqueta("termica", 1), AVISO_TERMICA_COM_PADRAO_FOLHA);
  assertEquals(AVISO_TERMICA_COM_PADRAO_FOLHA, "Sua loja usa etiqueta em folha (várias por linha). A Térmica avulsa imprime uma etiqueta por vez.");
  assertEquals(avisoModoEtiqueta("a4", 1), null);
  assertEquals(avisoModoEtiqueta("termica", 0), null);
});
