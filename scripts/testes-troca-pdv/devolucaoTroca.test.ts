// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-troca-pdv/
// Fase 2A: o aparelho recebido vale mais que a venda e a diferença volta ao
// cliente (Dinheiro/Pix). Exemplo base: venda de R$ 3.700, aparelho de R$ 4.500
// → cliente paga R$ 0 e recebe R$ 800.
import { assertEquals } from "jsr:@std/assert@1";
import {
  calcularDevolucao,
  calcularTotaisComTroca,
  camposDevolucao,
  devolucaoPassaDaGaveta,
  planejarTroca,
} from "../../src/lib/vendas/trocaPDV.ts";
import { montarBlocoTrocaRecibo, textoBlocoTrocaRecibo } from "../../src/lib/vendas/reciboTroca.ts";
import { getVendaCustoTotal, getVendaReceitaLiquida } from "../../src/lib/vendasFinanceiras.ts";

const r2 = (v: number) => Math.round(v * 100) / 100;
const soma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));
const nbsp = (s: string) => s.replace(/ /g, " ");

// Plano que o PDV usa quando a troca cobre tudo (igual ou maior que o total).
function cobreTudo(itens: { bruto: number; peca?: boolean }[], desconto: number) {
  return planejarTroca({
    itens: itens.map((i) => ({ bruto: i.bruto, desconto: desconto / itens.length, peca: !!i.peca })),
    parcelasPorItem: itens.map(() => 1),
    valorTroca: 0,
    valorSegunda: 0,
    cobreTudo: { descontoTotal: desconto },
  });
}

// ── Totais ──────────────────────────────────────────────────────────────────

Deno.test("3.700 com aparelho de 4.500: cliente paga 0, devolução 800, pede Dinheiro/Pix", () => {
  const t = calcularTotaisComTroca({ subtotal: 3700, desconto: 0, valorEntrada: 4500 });
  assertEquals(
    [t.situacao, t.podeFinalizar, t.cobreTudo, t.aPagar, t.trocaAplicada, t.diferencaADevolver, t.exigeFormaPagamento, t.exigeFormaDevolucao],
    ["maior", true, true, 0, 3700, 800, false, true],
  );
  assertEquals(calcularDevolucao(4500, 3700), 800);
});

Deno.test("troca igual ao total: cobre tudo, sem devolução nem forma de devolução", () => {
  const t = calcularTotaisComTroca({ subtotal: 3700, desconto: 0, valorEntrada: 3700 });
  assertEquals([t.situacao, t.cobreTudo, t.diferencaADevolver, t.exigeFormaDevolucao], ["igual", true, 0, false]);
});

Deno.test("troca menor que a venda: igual à Fase 1 (não cobre tudo)", () => {
  const t = calcularTotaisComTroca({ subtotal: 3700, desconto: 0, valorEntrada: 1000 });
  assertEquals([t.situacao, t.cobreTudo, t.aPagar, t.exigeFormaPagamento, t.exigeFormaDevolucao], ["menor", false, 2700, true, false]);
});

// ── Rateio quando a troca cobre tudo ────────────────────────────────────────

Deno.test("vários itens: cada linha fica líquida em zero e a troca aplicada = total da venda", () => {
  const plano = cobreTudo([{ bruto: 3500 }, { bruto: 150 }, { bruto: 50 }], 0);
  assertEquals(plano.trocaPorLinha, [[3500], [150], [50]]);
  assertEquals([plano.trocaAplicada, plano.bloqueio, plano.descontoPorItem], [3700, null, [0, 0, 0]]);
  assertEquals(calcularDevolucao(4500, plano.trocaAplicada), 800);
});

Deno.test("peça no carrinho: também fica líquida em zero (resolve o bloqueio da Fase 1)", () => {
  const plano = cobreTudo([{ bruto: 3500 }, { bruto: 200, peca: true }], 0);
  assertEquals([plano.trocaPorLinha, plano.bloqueio, plano.trocaAplicada], [[[3500], [200]], null, 3700]);
  // Na troca parcial a peça continua fora (regra da Fase 1).
  const parcial = planejarTroca({ itens: [{ bruto: 3500, desconto: 0, peca: false }, { bruto: 200, desconto: 0, peca: true }], parcelasPorItem: [1, 1], valorTroca: 1000, valorSegunda: 0 });
  assertEquals(parcial.trocaPorLinha, [[1000], [0]]);
});

Deno.test("desconto quebrado: rateado proporcional ao item, centavos exatos, nenhuma linha negativa", () => {
  const itens = [{ bruto: 4000 }, { bruto: 100 }, { bruto: 50 }];
  const plano = cobreTudo(itens, 200);
  assertEquals(soma(plano.descontoPorItem!), 200);
  assertEquals(plano.descontoPorItem, [192.77, 4.82, 2.41]);
  itens.forEach((it, i) => assertEquals(r2(it.bruto - plano.descontoPorItem![i] - plano.trocaPorLinha[i][0]), 0));
  assertEquals(plano.trocaAplicada, 3950);
  // Com o desconto dividido igualmente (66,67 por item) a película ficaria negativa.
  assertEquals(r2(50 - 200 / 3) < 0, true);
});

Deno.test("desconto percentual com dízima: soma do desconto e da troca fecha em centavos", () => {
  const itens = [{ bruto: 199.9 }, { bruto: 0.1 }, { bruto: 33.33 }];
  const desconto = (233.33 * 7) / 100; // 16,3331
  const plano = cobreTudo(itens, desconto);
  assertEquals(soma(plano.descontoPorItem!), 16.33);
  const t = calcularTotaisComTroca({ subtotal: 233.33, desconto, valorEntrada: 500 });
  assertEquals([plano.trocaAplicada, t.totalVenda], [217, 217]);
  assertEquals(calcularDevolucao(500, plano.trocaAplicada), 283);
});

// ── Coerência valor/forma (CHECK do banco) ──────────────────────────────────

Deno.test("colunas da devolução sempre coerentes com o CHECK", () => {
  assertEquals(camposDevolucao({ valor: 800, forma: "pix" }), { valor_devolvido: 800, forma_devolucao: "pix" });
  assertEquals(camposDevolucao({ valor: 0, forma: "dinheiro" }), { valor_devolvido: 0, forma_devolucao: null });
  assertEquals(camposDevolucao({ valor: 800, forma: null }), { valor_devolvido: 0, forma_devolucao: null });
  assertEquals(camposDevolucao(null), { valor_devolvido: 0, forma_devolucao: null });
  assertEquals(camposDevolucao({ valor: 0.004, forma: "pix" }), { valor_devolvido: 0, forma_devolucao: null });
});

// ── Aviso de gaveta ─────────────────────────────────────────────────────────

Deno.test("aviso só para devolução em DINHEIRO maior que a gaveta", () => {
  assertEquals(devolucaoPassaDaGaveta({ valorDevolucao: 800, forma: "dinheiro", dinheiroNaGaveta: 799.99 }), true);
  assertEquals(devolucaoPassaDaGaveta({ valorDevolucao: 800, forma: "dinheiro", dinheiroNaGaveta: 800 }), false);
  assertEquals(devolucaoPassaDaGaveta({ valorDevolucao: 800, forma: "pix", dinheiroNaGaveta: 0 }), false);
});

// ── Recibo ──────────────────────────────────────────────────────────────────

const aparelho = { marca: "Apple", modelo: "iPhone 13 Pro", capacidadeGb: 256, cor: "Grafite", imei: "359876543210987" };

Deno.test("recibo com devolução em Dinheiro", () => {
  const b = montarBlocoTrocaRecibo({ troca: { aparelho, valorEntrada: 4500, cancelada: false, valorDevolvido: 800, formaDevolucao: "dinheiro" }, totalVenda: 3700, formaPagamentoLabel: "Troca" })!;
  assertEquals(textoBlocoTrocaRecibo(b).map(nbsp), [
    "TROCA DE APARELHO",
    "Aparelho recebido na troca: Apple iPhone 13 Pro 256 GB Grafite",
    "IMEI: 359876543210987",
    "Valor do aparelho recebido: − R$ 4.500,00",
    "Total da venda: R$ 3.700,00",
    "Valor da troca: − R$ 3.700,00",
    "Valor pago pelo cliente: R$ 0,00",
    "Diferença devolvida ao cliente (Dinheiro): R$ 800,00",
    "Pago integralmente com o aparelho recebido.",
  ]);
});

Deno.test("recibo com devolução em Pix", () => {
  const b = montarBlocoTrocaRecibo({ troca: { aparelho, valorEntrada: 4500, cancelada: false, valorDevolvido: 800, formaDevolucao: "pix" }, totalVenda: 3700, formaPagamentoLabel: "Troca" })!;
  assertEquals(textoBlocoTrocaRecibo(b).map(nbsp).at(-2), "Diferença devolvida ao cliente (Pix): R$ 800,00");
});

// ── Lucro (não muda com a devolução) ────────────────────────────────────────

function lucro(itens: { bruto: number; custo: number }[], desconto: number) {
  const plano = cobreTudo(itens, desconto);
  const linhas = itens.map((it, i) => ({
    total: it.bruto, valor_desconto_manual: plano.descontoPorItem![i], valor_troca: plano.trocaPorLinha[i][0],
    custo_unitario: it.custo, quantidade: 1, forma_pagamento: "outro",
  }));
  const receita = soma(linhas.map(getVendaReceitaLiquida));
  const custo = soma(linhas.map(getVendaCustoTotal));
  return { receita, custo, lucro: r2(receita - custo) };
}

Deno.test("lucro 3.700 / 4.500: venda − custo do vendido = 1.200 (devolução e troca fora)", () => {
  assertEquals(lucro([{ bruto: 3700, custo: 2500 }], 0), { receita: 3700, custo: 2500, lucro: 1200 });
});

Deno.test("lucro com desconto: receita = venda − desconto, independente do rateio", () => {
  assertEquals(lucro([{ bruto: 4000, custo: 2500 }, { bruto: 100, custo: 20 }, { bruto: 50, custo: 5 }], 200), { receita: 3950, custo: 2525, lucro: 1425 });
});
