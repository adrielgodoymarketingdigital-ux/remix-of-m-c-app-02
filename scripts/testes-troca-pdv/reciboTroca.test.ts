// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-troca-pdv/
// Bloco "TROCA DE APARELHO" dos recibos (src/lib/vendas/reciboTroca.ts).
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  htmlBlocoTrocaRecibo,
  montarBlocoTrocaRecibo,
  textoBlocoTrocaRecibo,
} from "../../src/lib/vendas/reciboTroca.ts";
import * as antes from "./referencia/reciboTrocaAntesF2b.ts";
import { aparelhoRecebidoDaLinha, COLUNAS_APARELHO_RECEBIDO } from "../../src/lib/vendas/reciboTroca.ts";

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

// ── F2b: IMEI 2 do aparelho recebido ─────────────────────────────────────────
// Sem IMEI 2, a saída tem de ser IDÊNTICA à de antes: compara com a cópia
// congelada de reciboTroca.ts (main 8e89404) em referencia/reciboTrocaAntesF2b.ts.

const casosSemImei2: Parameters<typeof montarBlocoTrocaRecibo>[0][] = [];
const aparelhosSemImei2 = [
  iphone12,
  { ...iphone12, imei2: null },
  { ...iphone12, imei2: "" },
  { ...iphone12, imei2: "   " },
  { ...iphone12, imei2: undefined },
  { marca: "Samsung", modelo: "Galaxy A55", imei: "  " },
  { marca: "Samsung", modelo: "Galaxy A55", imei: null, imei2: "" },
  null,
];
for (const aparelho of aparelhosSemImei2) {
  for (const [valorEntrada, totalVenda, cancelada, valorDevolvido, formaDevolucao] of [
    [3000, 4000, false, 0, null],
    [4000, 4000, false, 0, null],
    [5000, 4000, false, 1000, "pix"],
    [3000, 4000, true, 0, null],
    [0, 4000, false, 0, null],
  ] as const) {
    casosSemImei2.push({
      troca: { aparelho, valorEntrada, cancelada, valorDevolvido, formaDevolucao },
      totalVenda,
      formaPagamentoLabel: "Dinheiro",
    });
  }
}

Deno.test(`sem IMEI 2: bloco, texto e HTML idênticos aos de antes (${aparelhosSemImei2.length * 5} casos)`, () => {
  for (const p of casosSemImei2) {
    const novo = montarBlocoTrocaRecibo(p);
    const velho = antes.montarBlocoTrocaRecibo(p);
    assertEquals(novo, velho);
    if (novo && velho) {
      assertEquals("imei2" in novo, false);
      assertEquals(textoBlocoTrocaRecibo(novo), antes.textoBlocoTrocaRecibo(velho));
      assertEquals(htmlBlocoTrocaRecibo(novo), antes.htmlBlocoTrocaRecibo(velho));
    }
  }
});

Deno.test("com IMEI 2: linha logo abaixo do IMEI, no mesmo formato", () => {
  const aparelho = { ...iphone12, imei2: " 356789104567892 " };
  assertEquals(texto({ troca: { aparelho, valorEntrada: 3000, cancelada: false }, totalVenda: 4000, formaPagamentoLabel: "Dinheiro" }), [
    "TROCA DE APARELHO",
    "Aparelho recebido na troca: Apple iPhone 12 Pro Max 256 GB Azul-Pacífico",
    "IMEI: 356789104567891",
    "IMEI 2: 356789104567892",
    "Valor do aparelho recebido: − R$ 3.000,00",
    "Total da venda: R$ 4.000,00",
    "Valor da troca: − R$ 3.000,00",
    "Valor pago pelo cliente (Dinheiro): R$ 1.000,00",
  ]);
});

Deno.test("com IMEI 2: o resto do bloco é o mesmo de sem IMEI 2", () => {
  const p = { troca: { aparelho: { ...iphone12, imei2: "356789104567892" }, valorEntrada: 3000, cancelada: false }, totalVenda: 4000, formaPagamentoLabel: "Dinheiro" };
  const { imei2, ...resto } = montarBlocoTrocaRecibo(p)!;
  assertEquals(imei2, "356789104567892");
  assertEquals(resto, antes.montarBlocoTrocaRecibo({ ...p, troca: { ...p.troca, aparelho: iphone12 } }));
});

Deno.test("IMEI 2 sem IMEI 1: mostra só o IMEI 2", () => {
  const t = texto({ troca: { aparelho: { marca: "Samsung", modelo: "A55", imei: "", imei2: "356789104567892" }, valorEntrada: 100, cancelada: false }, totalVenda: 200, formaPagamentoLabel: "PIX" })!;
  assertEquals(t.slice(0, 3), ["TROCA DE APARELHO", "Aparelho recebido na troca: Samsung A55", "IMEI 2: 356789104567892"]);
  assertEquals(t.some((l) => l.startsWith("IMEI:")), false);
});

Deno.test("HTML com IMEI 2: mesma div do IMEI, logo depois dele, com texto escapado", () => {
  const b = montarBlocoTrocaRecibo({ troca: { aparelho: { ...iphone12, imei2: "35<6>" }, valorEntrada: 10, cancelada: false }, totalVenda: 20, formaPagamentoLabel: "Dinheiro" })!;
  const html = htmlBlocoTrocaRecibo(b);
  const div = (txt: string) => `<div style="margin:2px 0;overflow-wrap:anywhere;">${txt}</div>`;
  assertStringIncludes(html, div("IMEI: 356789104567891") + div("IMEI 2: 35&lt;6&gt;"));
});

Deno.test("aparelhoRecebidoDaLinha: linha de dispositivos → aparelho (imei2 ausente = null)", () => {
  assertEquals(
    aparelhoRecebidoDaLinha({ marca: "Apple", modelo: "iPhone 12", capacidade_gb: 128, cor: "Azul", imei: "1", imei2: "2" }),
    { marca: "Apple", modelo: "iPhone 12", capacidadeGb: 128, cor: "Azul", imei: "1", imei2: "2" },
  );
  assertEquals(aparelhoRecebidoDaLinha({ marca: "A", modelo: "B", capacidade_gb: null, cor: null, imei: null }).imei2, null);
  // Linha sem imei2 → bloco igual ao de antes.
  const p = { troca: { aparelho: aparelhoRecebidoDaLinha({ marca: "A", modelo: "B", imei: "1" }), valorEntrada: 10, cancelada: false }, totalVenda: 20, formaPagamentoLabel: "Dinheiro" };
  assertEquals(montarBlocoTrocaRecibo(p), antes.montarBlocoTrocaRecibo(p));
});

Deno.test("select dos carregadores traz imei e imei2", () => {
  const colunas = COLUNAS_APARELHO_RECEBIDO.split(",").map((c) => c.trim());
  assertEquals(colunas.includes("imei"), true);
  assertEquals(colunas.includes("imei2"), true);
});
