// deno test --no-check scripts/testes-recibo-cabecalho/
// Compactação do A4 da reimpressão de Vendas (src/lib/recibo/compactacaoReciboA4.ts):
// venda de aparelho em UMA página só com espaçamento; térmico intocado.
import { assertEquals } from "jsr:@std/assert@1";
import {
  ESPACO_ASSINATURA_A4_PX,
  FONTE_MINIMA_TERMOS_PX,
  FONTE_TERMOS_A4_PX,
  cssCompactacaoReciboA4,
} from "../../src/lib/recibo/compactacaoReciboA4.ts";

const sem = (s: string) => s.replace(/\s+/g, " ").trim();

Deno.test("térmico (58/80mm): a compactação não gera nada, nos dois recibos", () => {
  assertEquals(cssCompactacaoReciboA4(true), "");
  assertEquals(cssCompactacaoReciboA4(true, "vendas"), "");
  assertEquals(cssCompactacaoReciboA4(true, "pdv"), "");
});

Deno.test("A4: só espaçamento (margens, entrelinha, assinaturas)", () => {
  const css = sem(cssCompactacaoReciboA4(false));
  for (const r of [
    "body { padding: 0; }",
    ".recibo-section { margin-bottom: 8px; }",
    ".recibo-section h3 { padding-bottom: 1mm !important; margin-bottom: 1mm !important; }",
    ".recibo-info { margin: 0.4mm 0 !important; page-break-inside: avoid; break-inside: avoid; }",
    ".termos-garantia { font-size: 10px; line-height: 1.3; }",
    'div[style*="margin-top: 40px"] { margin-top: 16px !important; page-break-inside: avoid; break-inside: avoid; }',
  ]) assertEquals(css.includes(r), true, r);
  assertEquals(ESPACO_ASSINATURA_A4_PX, 16);
});

Deno.test("A4: letra dos termos nunca abaixo de 8px (e hoje continua 10px)", () => {
  assertEquals(FONTE_MINIMA_TERMOS_PX, 8);
  assertEquals(FONTE_TERMOS_A4_PX >= FONTE_MINIMA_TERMOS_PX, true);
  const tamanhos = [...sem(cssCompactacaoReciboA4(false)).matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1]));
  assertEquals(tamanhos.every((t) => t >= FONTE_MINIMA_TERMOS_PX), true);
});

Deno.test("A4: não toca no cabeçalho, no bloco da troca nem no VALOR TOTAL", () => {
  const css = cssCompactacaoReciboA4(false);
  for (const classe of [".recibo-header", ".recibo-cab", ".recibo-titulo-bloco", ".recibo-troca", ".recibo-total"]) {
    assertEquals(css.includes(classe), false, classe);
  }
});

// ── Recibo do PDV ───────────────────────────────────────────────────────────

Deno.test("PDV A4: as mesmas regras comuns (sem duplicar) + itens e termo do PDV", () => {
  const pdv = sem(cssCompactacaoReciboA4(false, "pdv"));
  const vendas = sem(cssCompactacaoReciboA4(false, "vendas"));
  const comum = vendas.slice(0, vendas.indexOf(".recibo-checklist"));
  assertEquals(pdv.startsWith(comum), true);
  for (const r of [
    ".item-venda { padding: 3px 0; page-break-inside: avoid; break-inside: avoid; }",
    ".termo-garantia-pdv-section { margin-bottom: 4px; }",
    ".termo-garantia-pdv-texto { line-height: 1.3; }",
  ]) assertEquals(pdv.includes(r), true, r);
  // Regras só do recibo de Vendas não entram no PDV.
  assertEquals([pdv.includes(".termos-garantia {"), pdv.includes(".recibo-checklist")], [false, false]);
});

Deno.test("PDV A4: título e linha com !important (o PDV tem margem no style embutido)", () => {
  const pdv = sem(cssCompactacaoReciboA4(false, "pdv"));
  assertEquals(pdv.includes("padding-bottom: 1mm !important; margin-bottom: 1mm !important;"), true);
  assertEquals(pdv.includes(".recibo-info { margin: 0.4mm 0 !important;"), true);
});

Deno.test("PDV A4: não muda letra dos termos (já é a mínima, 8px) nem totais, cabeçalho e troca", () => {
  const pdv = cssCompactacaoReciboA4(false, "pdv");
  assertEquals(/font-size/.test(pdv), false);
  for (const classe of [".recibo-header", ".recibo-cab", ".recibo-titulo-bloco", ".recibo-troca", ".resumo-section", ".resumo-linha", ".recibo-total"]) {
    assertEquals(pdv.includes(classe), false, classe);
  }
});
