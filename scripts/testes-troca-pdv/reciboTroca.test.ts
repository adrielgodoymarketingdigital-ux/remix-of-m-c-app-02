// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-troca-pdv/
// Bloco "TROCA DE APARELHO" dos recibos (src/lib/vendas/reciboTroca.ts).
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  htmlBlocoTrocaRecibo,
  montarBlocoTrocaRecibo,
  textoBlocoTrocaRecibo,
} from "../../src/lib/vendas/reciboTroca.ts";

const iphone12 = { marca: "Apple", modelo: "iPhone 12 Pro Max", capacidadeGb: 256, cor: "Azul-Pacífico", imei: "356789104567891" };
const nbsp = (s: string) => s.replace(/ /g, " ");
const texto = (p: Parameters<typeof montarBlocoTrocaRecibo>[0]) => {
  const b = montarBlocoTrocaRecibo(p);
  return b ? textoBlocoTrocaRecibo(b).map(nbsp) : null;
};

Deno.test("troca parcial: aparelho completo com IMEI e a conta da troca", () => {
  assertEquals(texto({ troca: { aparelho: iphone12, valorEntrada: 3000, cancelada: false }, totalVenda: 4000, formaPagamentoLabel: "Dinheiro" }), [
    "TROCA DE APARELHO",
    "Aparelho recebido na troca: Apple iPhone 12 Pro Max 256 GB Azul-Pacífico",
    "IMEI: 356789104567891",
    "Valor do aparelho recebido: − R$ 3.000,00",
    "Total da venda: R$ 4.000,00",
    "Valor da troca: − R$ 3.000,00",
    "Valor pago pelo cliente (Dinheiro): R$ 1.000,00",
  ]);
});

Deno.test("troca = total: pago integralmente com o aparelho, sem forma de pagamento", () => {
  assertEquals(texto({ troca: { aparelho: iphone12, valorEntrada: 4000, cancelada: false }, totalVenda: 4000, formaPagamentoLabel: "Troca" }), [
    "TROCA DE APARELHO",
    "Aparelho recebido na troca: Apple iPhone 12 Pro Max 256 GB Azul-Pacífico",
    "IMEI: 356789104567891",
    "Valor do aparelho recebido: − R$ 4.000,00",
    "Total da venda: R$ 4.000,00",
    "Valor da troca: − R$ 4.000,00",
    "Valor pago pelo cliente: R$ 0,00",
    "Pago integralmente com o aparelho recebido.",
  ]);
});

Deno.test("sem troca: nenhum bloco (recibo igual ao de antes)", () => {
  assertEquals(montarBlocoTrocaRecibo({ troca: null, totalVenda: 4000, formaPagamentoLabel: "Dinheiro" }), null);
  assertEquals(montarBlocoTrocaRecibo({ troca: undefined, totalVenda: 4000, formaPagamentoLabel: "Dinheiro" }), null);
  assertEquals(montarBlocoTrocaRecibo({ troca: { aparelho: iphone12, valorEntrada: 0, cancelada: false }, totalVenda: 4000, formaPagamentoLabel: "Dinheiro" }), null);
});

Deno.test("sem IMEI e sem capacidade/cor: só o que existe, sem linha de IMEI", () => {
  assertEquals(texto({ troca: { aparelho: { marca: "Samsung", modelo: "Galaxy A55", imei: "  " }, valorEntrada: 1200.5, cancelada: false }, totalVenda: 2000, formaPagamentoLabel: "PIX" }), [
    "TROCA DE APARELHO",
    "Aparelho recebido na troca: Samsung Galaxy A55",
    "Valor do aparelho recebido: − R$ 1.200,50",
    "Total da venda: R$ 2.000,00",
    "Valor da troca: − R$ 1.200,50",
    "Valor pago pelo cliente (PIX): R$ 799,50",
  ]);
});

Deno.test("venda cancelada: troca marcada como cancelada", () => {
  const t = texto({ troca: { aparelho: iphone12, valorEntrada: 3000, cancelada: true }, totalVenda: 4000, formaPagamentoLabel: "Dinheiro" })!;
  assertEquals(t[0], "TROCA DE APARELHO (CANCELADA)");
  assertEquals(t.at(-1), "Troca cancelada junto com a venda.");
});

Deno.test("aparelho ilegível (excluído / sem permissão): bloco só com os valores", () => {
  const t = texto({ troca: { aparelho: null, valorEntrada: 500, cancelada: false }, totalVenda: 800, formaPagamentoLabel: "Dinheiro + PIX" })!;
  assertEquals(t.slice(0, 2), ["TROCA DE APARELHO", "Aparelho recebido na troca: Aparelho"]);
  assertEquals(t.at(-1), "Valor pago pelo cliente (Dinheiro + PIX): R$ 300,00");
});

Deno.test("HTML do bloco: texto escapado, valores sem quebra e rótulos que quebram linha", () => {
  const b = montarBlocoTrocaRecibo({ troca: { aparelho: { marca: "<b>X</b>", modelo: "Y & Z" }, valorEntrada: 10, cancelada: false }, totalVenda: 20, formaPagamentoLabel: "Dinheiro" })!;
  const html = htmlBlocoTrocaRecibo(b);
  assertStringIncludes(html, "&lt;b&gt;X&lt;/b&gt; Y &amp; Z");
  assertEquals(html.includes("<b>X</b>"), false);
  assertStringIncludes(html, "white-space:nowrap");
  assertStringIncludes(html, "overflow-wrap:anywhere");
  assertStringIncludes(html, "break-inside:avoid");
});
