// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-troca-pdv/
// Roda as funções reais de src/lib/vendas/trocaPDV.ts, src/lib/formaPagamento.ts
// e src/lib/vendasFinanceiras.ts. Caso real: venda de 4.000 com entrada de um
// aparelho de 3.000 e 1.000 em dinheiro era contada como 4.000 em dinheiro no
// caixa e no Extrato.
import { assertEquals } from "jsr:@std/assert@1";
import {
  MENSAGEM_APARELHO_TROCA_VENDIDO,
  calcularTotaisComTroca,
  decidirCancelamentoTroca,
  planejarTrocaPorLinha,
  ratearPorPeso,
  valorSegundaFormaItem,
} from "../../src/lib/vendas/trocaPDV.ts";
import { agruparVendasPorFormaPagamento, calcularDinheiroEsperado } from "../../src/lib/formaPagamento.ts";
import { getVendaCustoTotal, getVendaReceitaLiquida } from "../../src/lib/vendasFinanceiras.ts";

const soma = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
const porChave = (vendas: Parameters<typeof agruparVendasPorFormaPagamento>[0]) =>
  Object.fromEntries(agruparVendasPorFormaPagamento(vendas).map((b) => [b.chave, Math.round(b.total * 100) / 100]));

// ── Totais ──────────────────────────────────────────────────────────────────

Deno.test("troca menor que a venda: cliente paga a diferença", () => {
  const t = calcularTotaisComTroca({ subtotal: 4000, desconto: 0, valorEntrada: 3000 });
  assertEquals([t.totalVenda, t.aPagar, t.diferencaADevolver, t.situacao, t.podeFinalizar, t.exigeFormaPagamento], [4000, 1000, 0, "menor", true, true]);
});

Deno.test("troca igual à venda (com desconto): nada a pagar e sem forma de pagamento", () => {
  const t = calcularTotaisComTroca({ subtotal: 3200, desconto: 200, valorEntrada: 3000 });
  assertEquals([t.totalVenda, t.aPagar, t.situacao, t.podeFinalizar, t.exigeFormaPagamento], [3000, 0, "igual", true, false]);
});

Deno.test("troca maior que a venda (Fase 2): nada a pagar, diferença vira devolução e pede Dinheiro/Pix", () => {
  const t = calcularTotaisComTroca({ subtotal: 4000, desconto: 0, valorEntrada: 4500.5 });
  assertEquals(
    [t.aPagar, t.diferencaADevolver, t.situacao, t.podeFinalizar, t.cobreTudo, t.trocaAplicada, t.exigeFormaPagamento, t.exigeFormaDevolucao],
    [0, 500.5, "maior", true, true, 4000, false, true],
  );
});

Deno.test("sem troca: igual ao cálculo de antes (subtotal − desconto)", () => {
  const t = calcularTotaisComTroca({ subtotal: 199.9, desconto: 0.1, valorEntrada: 0 });
  assertEquals([t.aPagar, t.situacao, t.exigeFormaPagamento], [199.8, "sem_troca", true]);
});

Deno.test("centavos: 0,1 + 0,2 de entrada contra 0,3 de venda é igual, não maior", () => {
  assertEquals(calcularTotaisComTroca({ subtotal: 0.3, desconto: 0, valorEntrada: 0.1 + 0.2 }).situacao, "igual");
});

// ── Rateio ──────────────────────────────────────────────────────────────────

Deno.test("rateio fecha exatamente e respeita o peso de cada linha", () => {
  const partes = ratearPorPeso(100, [1, 1, 1]);
  assertEquals(soma(partes), 100);
  assertEquals(partes, [33.34, 33.33, 33.33]);
  const cheio = ratearPorPeso(3000, [2500, 400, 100]);
  assertEquals(cheio, [2500, 400, 100]);
});

Deno.test("troca por linha: vários itens com desconto rateado, soma exata e nenhuma linha passa do seu valor", () => {
  const itens = [{ bruto: 2999.99, desconto: 33.33 }, { bruto: 1000, desconto: 33.33 }, { bruto: 0.03, desconto: 0 }];
  const plano = planejarTrocaPorLinha(itens, [1, 1, 1], 2500.01);
  assertEquals(soma(plano.flat()), 2500.01);
  plano.forEach((linhas, i) => assertEquals(soma(linhas) <= itens[i].bruto - itens[i].desconto + 0.01, true));
});

Deno.test("troca por linha: valor igual ao total zera cada linha exatamente", () => {
  const itens = [{ bruto: 1500, desconto: 50 }, { bruto: 600, desconto: 50 }];
  const plano = planejarTrocaPorLinha(itens, [1, 1], 2000);
  assertEquals(plano, [[1450], [550]]);
});

Deno.test("troca por linha: parcelas a receber dividem a parte do item e fecham", () => {
  const plano = planejarTrocaPorLinha([{ bruto: 1000, desconto: 0 }], [3], 100);
  assertEquals(plano, [[33.34, 33.33, 33.33]]);
});

// ── Pagamento duplo ─────────────────────────────────────────────────────────

Deno.test("pagamento duplo sem troca: fórmula de antes; total a pagar zero não divide por zero", () => {
  assertEquals(valorSegundaFormaItem({ itemBruto: 1000, subtotal: 1000, totalAPagar: 1000, valorSegunda: 300, temTroca: false }), 300);
  assertEquals(valorSegundaFormaItem({ itemBruto: 1000, subtotal: 1000, totalAPagar: 0, valorSegunda: 300, temTroca: false }), 0);
});

Deno.test("pagamento duplo com troca: linhas da 2ª forma somam exatamente a 2ª forma", () => {
  const itens = [3000, 1000];
  const valores = itens.map((b) => valorSegundaFormaItem({ itemBruto: b, subtotal: 4000, totalAPagar: 1000, valorSegunda: 500, temTroca: true }));
  assertEquals(soma(valores), 500);
  // A fórmula antiga (bruto × 2ª ÷ total a pagar) daria 2.000 — a conta a receber da 2ª forma sairia 4x maior.
  assertEquals(soma(itens.map((b) => (b * 500) / 1000)), 2000);
});

// ── Caixa ───────────────────────────────────────────────────────────────────

Deno.test("caixa: venda 4.000 com troca 3.000 conta 1.000 em dinheiro (antes contava 4.000)", () => {
  const linha = { forma_pagamento: "dinheiro", total: 4000, observacoes: "iPhone 11", segunda_forma_pagamento: null, valor_segunda_forma: null };
  assertEquals(porChave([linha]), { dinheiro: 4000 });
  assertEquals(porChave([{ ...linha, valor_troca: 3000 }]), { dinheiro: 1000 });
  assertEquals(porChave([{ ...linha, valor_troca: null }]), { dinheiro: 4000 });
});

Deno.test("caixa: troca + pagamento duplo abate só a 1ª forma", () => {
  const linha = { forma_pagamento: "dinheiro", total: 4000, observacoes: null, segunda_forma_pagamento: "pix", valor_segunda_forma: 500, valor_troca: 3000 };
  assertEquals(porChave([linha]), { dinheiro: 500, pix: 500 });
});

Deno.test("caixa: troca igual ao total entra como forma 'Troca' com R$ 0", () => {
  const b = agruparVendasPorFormaPagamento([{ forma_pagamento: "outro", total: 1200, observacoes: "Moto G [forma:Troca]", valor_troca: 1200 }]);
  assertEquals(b.map((x) => [x.chave, x.nome, x.total, x.quantidade]), [["custom:Troca", "Troca", 0, 1]]);
});

Deno.test("dinheiro esperado no fechamento: saldo inicial + dinheiro + suprimentos − sangrias", () => {
  const totalDinheiro = porChave([{ forma_pagamento: "dinheiro", total: 4000, valor_troca: 3000 }]).dinheiro;
  assertEquals(calcularDinheiroEsperado({ saldoInicial: 200, totalDinheiro, suprimentos: 50, sangrias: 100 }), 1150);
});

// ── Lucro (não muda) ────────────────────────────────────────────────────────

Deno.test("lucro e faturamento ignoram a troca", () => {
  const venda = { total: 4000, valor_desconto_manual: 100, custo_unitario: 2500, quantidade: 1, forma_pagamento: "dinheiro" };
  const comTroca = { ...venda, valor_troca: 3000 };
  assertEquals(getVendaReceitaLiquida(comTroca), getVendaReceitaLiquida(venda));
  assertEquals(getVendaCustoTotal(comTroca), getVendaCustoTotal(venda));
  assertEquals(getVendaReceitaLiquida(comTroca) - getVendaCustoTotal(comTroca), 1400);
});

// ── Cancelamento ────────────────────────────────────────────────────────────

const aparelhoNoEstoque = { vendido: false, excluido: false };

Deno.test("cancelamento: venda sem troca não pergunta nada", () => {
  const d = decidirCancelamentoTroca({ trocaAtiva: false, aparelho: null }, null);
  assertEquals([d.cancelarVendaInteira, d.perguntar, d.marcarTrocaCancelada, d.removerAparelho, d.bloqueio], [false, false, false, false, null]);
});

// Fase 2B: venda com troca é cancelada inteira, então a troca é sempre desfeita
// (antes: só na última linha ativa; cancelar um item mantinha a troca).
Deno.test("cancelamento: venda com troca cancela inteira e desfaz a troca; manter ou tirar do estoque", () => {
  const manter = decidirCancelamentoTroca({ trocaAtiva: true, aparelho: aparelhoNoEstoque }, "manter");
  assertEquals([manter.cancelarVendaInteira, manter.perguntar, manter.marcarTrocaCancelada, manter.removerAparelho, manter.podeRemover], [true, true, true, false, true]);
  const remover = decidirCancelamentoTroca({ trocaAtiva: true, aparelho: aparelhoNoEstoque }, "remover");
  assertEquals([remover.marcarTrocaCancelada, remover.removerAparelho, remover.bloqueio], [true, true, null]);
});

Deno.test("cancelamento: aparelho já vendido bloqueia 'tirar do estoque'", () => {
  const vendido = { vendido: true, excluido: false };
  const d = decidirCancelamentoTroca({ trocaAtiva: true, aparelho: vendido }, "remover");
  assertEquals([d.bloqueio, d.removerAparelho, d.podeRemover], [MENSAGEM_APARELHO_TROCA_VENDIDO, false, false]);
  const manter = decidirCancelamentoTroca({ trocaAtiva: true, aparelho: vendido }, "manter");
  assertEquals([manter.bloqueio, manter.marcarTrocaCancelada], [null, true]);
});

Deno.test("cancelamento: aparelho já excluído só cancela a troca, sem pergunta", () => {
  const d = decidirCancelamentoTroca({ trocaAtiva: true, aparelho: { vendido: false, excluido: true } }, "remover");
  assertEquals([d.perguntar, d.marcarTrocaCancelada, d.removerAparelho, d.bloqueio], [false, true, false, null]);
});
