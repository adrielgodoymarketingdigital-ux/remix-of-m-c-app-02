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

Deno.test("térmico (58/80mm): a compactação não gera nada", () => {
  assertEquals(cssCompactacaoReciboA4(true), "");
});

Deno.test("A4: só espaçamento (margens, entrelinha, assinaturas)", () => {
  const css = sem(cssCompactacaoReciboA4(false));
  for (const r of [
    "body { padding: 0; }",
    ".recibo-section { margin-bottom: 8px; }",
    ".recibo-section h3 { padding-bottom: 1mm; margin-bottom: 1mm; }",
    ".recibo-info { margin: 0.4mm 0; page-break-inside: avoid; break-inside: avoid; }",
    ".termos-garantia { font-size: 10px; line-height: 1.3; }",
    'div[style*="margin-top: 40px"] { margin-top: 16px !important; }',
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
