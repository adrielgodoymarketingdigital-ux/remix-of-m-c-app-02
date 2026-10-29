// deno test --no-check scripts/testes-recibo-os-layout/
// Escolha do modelo do recibo A4 da OS (layout_os_config.modelo_recibo_a4).
import { assertEquals } from "jsr:@std/assert@1";
import { CAMINHOS_SO_PADRAO, modeloReciboA4, usaReciboPersonalizado } from "../../src/lib/ordemServico/modeloReciboOS.ts";

const a4 = { formato: "a4" as const, duasOsPorFolha: false, pdfIphoneInstalado: false };

Deno.test("modelo: ausente, nulo, padrao ou desconhecido = padrao", () => {
  assertEquals(modeloReciboA4(undefined), "padrao");
  assertEquals(modeloReciboA4(null), "padrao");
  assertEquals(modeloReciboA4({}), "padrao");
  assertEquals(modeloReciboA4({ modelo_recibo_a4: null }), "padrao");
  assertEquals(modeloReciboA4({ modelo_recibo_a4: "padrao" }), "padrao");
  assertEquals(modeloReciboA4({ modelo_recibo_a4: "tech" }), "padrao");
  assertEquals(modeloReciboA4({ modelo_recibo_a4: "PERSONALIZADO" }), "padrao");
  assertEquals(modeloReciboA4({ modelo_recibo_a4: true }), "padrao");
  assertEquals(modeloReciboA4({ modelo_recibo_a4: "personalizado" }), "personalizado");
});

Deno.test("quem não escolheu nunca recebe o personalizado", () => {
  for (const layout of [undefined, null, {}, { modelo_recibo_a4: null }, { modelo_recibo_a4: "padrao" }, { versao_layout_a4: "tech" }]) {
    assertEquals(usaReciboPersonalizado(layout, a4), false);
  }
});

Deno.test("personalizado só no A4 de uma OS por folha, fora do PDF do iPhone instalado", () => {
  const p = { modelo_recibo_a4: "personalizado" };
  assertEquals(usaReciboPersonalizado(p, a4), true);
  assertEquals(usaReciboPersonalizado(p, { ...a4, formato: "80mm" }), false);
  assertEquals(usaReciboPersonalizado(p, { ...a4, duasOsPorFolha: true }), false);
  assertEquals(usaReciboPersonalizado(p, { ...a4, pdfIphoneInstalado: true }), false);
});

Deno.test("lista do que fica no padrão (mostrada na tela)", () => {
  assertEquals([...CAMINHOS_SO_PADRAO], ["cupom80mm", "duasOsPorFolha", "pdfIphoneInstalado", "pdfWhatsapp"]);
});
