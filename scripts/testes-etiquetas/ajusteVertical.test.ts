// deno test --no-check scripts/testes-etiquetas/
// Roda as funções reais de src/lib/etiquetas/ajusteVertical.ts e
// padraoEtiqueta.ts (ajuste vertical da impressão de etiquetas). Caso real:
// rolo de 3 colunas 33×21mm com o topo do nome cortado (out/2026) — a
// impressora imprime ~1,5–2mm acima do recorte da etiqueta.
import { assertEquals } from "jsr:@std/assert@1";
import {
  aplicarAjusteNoPadrao,
  clampAjusteVertical,
  formatarAjusteVertical,
  lerAjusteVertical,
  paddingVerticalComAjuste,
} from "../../src/lib/etiquetas/ajusteVertical.ts";
import { normalizarPadrao, normalizarPadroes } from "../../src/lib/etiquetas/padraoEtiqueta.ts";

// Padrão salvo antes do campo existir (como está hoje em configuracoes_loja.etiquetas_padroes).
const PADRAO_ANTIGO = {
  id: "padrao-rolo-3-colunas",
  nome: "Rolo 3 colunas",
  larguraFolhaMm: 107,
  alturaFolhaMm: 297,
  alturaMm: 21,
  larguraMm: 33,
  colunas: 3,
  linhas: 1,
  espacoFileiraMm: 0,
};

Deno.test("valor ausente vira 0", () => {
  assertEquals(clampAjusteVertical(undefined), 0);
  assertEquals(clampAjusteVertical(null), 0);
  assertEquals(lerAjusteVertical({}), 0);
  assertEquals(lerAjusteVertical(null), 0);
  assertEquals(lerAjusteVertical(undefined), 0);
});

Deno.test("NaN, Infinity e texto viram 0", () => {
  assertEquals(clampAjusteVertical(NaN), 0);
  assertEquals(clampAjusteVertical(Infinity), 0);
  assertEquals(clampAjusteVertical(-Infinity), 0);
  assertEquals(clampAjusteVertical("2"), 0);
  assertEquals(clampAjusteVertical("abc"), 0);
  assertEquals(clampAjusteVertical(true), 0);
  assertEquals(lerAjusteVertical({ ajusteVerticalMm: "1,5" }), 0);
});

Deno.test("fora do intervalo é limitado a -5..+5", () => {
  assertEquals(clampAjusteVertical(-9), -5);
  assertEquals(clampAjusteVertical(9), 5);
  assertEquals(clampAjusteVertical(-5), -5);
  assertEquals(clampAjusteVertical(5), 5);
});

Deno.test("valores válidos são preservados (2 casas, sem -0)", () => {
  assertEquals(clampAjusteVertical(1.25), 1.25);
  assertEquals(clampAjusteVertical(-2), -2);
  assertEquals(clampAjusteVertical(0.1 + 0.2), 0.3);
  assertEquals(Object.is(clampAjusteVertical(-0.001), 0), true);
});

Deno.test("padrão antigo sem o campo continua válido, com ajuste 0", () => {
  const p = normalizarPadrao(PADRAO_ANTIGO);
  assertEquals(p, { ...PADRAO_ANTIGO, ajusteVerticalMm: 0 });
  assertEquals(normalizarPadroes([PADRAO_ANTIGO]).length, 1);
});

Deno.test("padrão com ajuste: preserva, limita ou zera sem invalidar", () => {
  assertEquals(normalizarPadrao({ ...PADRAO_ANTIGO, ajusteVerticalMm: 1.25 })?.ajusteVerticalMm, 1.25);
  assertEquals(normalizarPadrao({ ...PADRAO_ANTIGO, ajusteVerticalMm: 9 })?.ajusteVerticalMm, 5);
  assertEquals(normalizarPadrao({ ...PADRAO_ANTIGO, ajusteVerticalMm: -9 })?.ajusteVerticalMm, -5);
  assertEquals(normalizarPadrao({ ...PADRAO_ANTIGO, ajusteVerticalMm: "x" })?.ajusteVerticalMm, 0);
  // Medida inválida continua invalidando o padrão (regra antiga intacta).
  assertEquals(normalizarPadrao({ ...PADRAO_ANTIGO, larguraMm: 0, ajusteVerticalMm: 1 }), null);
});

Deno.test("aplicarAjusteNoPadrao grava o valor limitado e não mexe no resto", () => {
  const p = normalizarPadrao(PADRAO_ANTIGO)!;
  assertEquals(aplicarAjusteNoPadrao(p, 2), { ...p, ajusteVerticalMm: 2 });
  assertEquals(aplicarAjusteNoPadrao(p, 12).ajusteVerticalMm, 5);
  assertEquals(aplicarAjusteNoPadrao(p, NaN).ajusteVerticalMm, 0);
  // Ida e volta pelo JSON do banco.
  assertEquals(normalizarPadrao(JSON.parse(JSON.stringify(aplicarAjusteNoPadrao(p, 1.5)))), { ...p, ajusteVerticalMm: 1.5 });
});

Deno.test("padding com ajuste: 0 mantém 1/1; até o padding é só deslocamento; além disso não fica negativo", () => {
  assertEquals(paddingVerticalComAjuste(1, 0), { topoMm: 1, baseMm: 1 });
  assertEquals(paddingVerticalComAjuste(1, undefined), { topoMm: 1, baseMm: 1 });
  assertEquals(paddingVerticalComAjuste(1, 0.5), { topoMm: 1.5, baseMm: 0.5 });
  assertEquals(paddingVerticalComAjuste(1, 0.3), { topoMm: 1.3, baseMm: 0.7 });
  assertEquals(paddingVerticalComAjuste(1, 2), { topoMm: 3, baseMm: 0 });
  assertEquals(paddingVerticalComAjuste(1, -2), { topoMm: 0, baseMm: 3 });
  assertEquals(paddingVerticalComAjuste(1, 9), { topoMm: 6, baseMm: 0 });
});

Deno.test("formatarAjusteVertical", () => {
  assertEquals(formatarAjusteVertical(0), "0 mm");
  assertEquals(formatarAjusteVertical(1.5), "+1,5 mm");
  assertEquals(formatarAjusteVertical(-2), "-2 mm");
  assertEquals(formatarAjusteVertical(9), "+5 mm");
});
