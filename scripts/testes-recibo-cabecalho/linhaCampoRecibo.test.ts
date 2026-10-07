// deno test --no-check scripts/testes-recibo-cabecalho/
// Linhas "Rótulo: valor" dos recibos (src/lib/recibo/linhaCampoRecibo.ts). Caso real
// (out/2026): no A4 da reimpressão de Vendas o valor ia para a ponta direita da folha.
import { assertEquals } from "jsr:@std/assert@1";
import { ESPACO_ROTULO_VALOR_A4_PX, cssLinhaCampoRecibo } from "../../src/lib/recibo/linhaCampoRecibo.ts";

const sem = (s: string) => s.replace(/\s+/g, " ").trim();

Deno.test("A4: valor logo depois do rótulo, sem jogar para a direita", () => {
  const css = sem(cssLinhaCampoRecibo(false));
  assertEquals(css.includes("justify-content: flex-start;"), true);
  assertEquals(css.includes("space-between"), false);
  assertEquals(css.includes(`gap: ${ESPACO_ROTULO_VALOR_A4_PX}px;`), true);
  assertEquals(ESPACO_ROTULO_VALOR_A4_PX, 4);
});

Deno.test("A4: rótulo com largura automática (sem colunas fixas) e não quebra", () => {
  const css = sem(cssLinhaCampoRecibo(false));
  assertEquals(css.includes(".recibo-info > span:first-child { flex: 0 0 auto; white-space: nowrap; }"), true);
  assertEquals(/grid-template-columns|(^|[^-])width:\s*\d/.test(css), false);
});

Deno.test("A4: valor longo quebra dentro do espaço dele, alinhado à esquerda", () => {
  const css = sem(cssLinhaCampoRecibo(false));
  assertEquals(css.includes(".recibo-info > span:last-child { flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; text-align: left; }"), true);
  assertEquals(css.includes("align-items: baseline;"), true);
});

Deno.test("A4: mesmo tamanho de letra e margem de antes (12px, 1mm)", () => {
  const css = sem(cssLinhaCampoRecibo(false));
  assertEquals([css.includes("font-size: 12px;"), css.includes("margin: 1mm 0;")], [true, true]);
});

Deno.test("térmico (58/80mm): exatamente as regras de antes", () => {
  assertEquals(sem(cssLinhaCampoRecibo(true)), ".recibo-info { display: flex; justify-content: space-between; font-size: 9pt; margin: 1mm 0; }");
});
