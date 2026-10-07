// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-troca-pdv/
// Fase 2B: devolução da troca no fechamento de caixa, Extrato, cancelamento
// (venda inteira + aviso) e alterar data da venda. Exemplo base: venda de
// R$ 3.700 com aparelho de R$ 4.500 → R$ 800 devolvidos ao cliente.
import { assertEquals } from "jsr:@std/assert@1";
import { calcularDinheiroEsperado } from "../../src/lib/formaPagamento.ts";
import { somarDevolucoesTroca } from "../../src/lib/caixa/devolucoesTroca.ts";
import { LABEL_ORIGEM_EXTRATO, ORIGENS_COM_DETALHE } from "../../src/lib/financeiro/origensExtrato.ts";
import {
  MENSAGEM_VENDA_COM_TROCA_INTEIRA,
  avisoDevolucaoNoCancelamento,
  decidirCancelamentoTroca,
  linhasParaCancelarVendaInteira,
  podeConfirmarCancelamento,
} from "../../src/lib/vendas/trocaPDV.ts";
import { PARTE_ZERO, calcularParteDaVenda, novosTotaisCaixa, parteMexeNoCaixa } from "../../src/lib/vendas/alterarDataVenda.core.ts";

const nbsp = (s: string | null) => (s ?? "").replace(/ /g, " ");
const dev = (valor: number, forma: string | null, cancelada = false) => ({ valor_devolvido: valor, forma_devolucao: forma, cancelada });

// Caixa: abriu com 200, vendeu 150 em dinheiro, suprimento 50, sangria 30.
const caixaBase = { saldoInicial: 200, totalDinheiro: 150, suprimentos: 50, sangrias: 30 };
const esperado = (devolucoes: ReturnType<typeof dev>[]) =>
  calcularDinheiroEsperado({ ...caixaBase, devolucoesDinheiro: somarDevolucoesTroca(devolucoes).dinheiro });

// ── 1. Fechamento de caixa ──────────────────────────────────────────────────

Deno.test("dinheiro esperado: devolução em DINHEIRO abate da gaveta", () => {
  assertEquals(esperado([dev(800, "dinheiro")]), 370 - 800);
  assertEquals(esperado([dev(100, "dinheiro"), dev(50.55, "dinheiro")]), 370 - 150.55);
});

Deno.test("dinheiro esperado: devolução em PIX não mexe na gaveta (só informação)", () => {
  const t = somarDevolucoesTroca([dev(800, "pix")]);
  assertEquals([esperado([dev(800, "pix")]), t.pix, t.quantidadePix, t.dinheiro], [370, 800, 1, 0]);
});

Deno.test("dinheiro esperado: sem devolução é idêntico à conta de antes (mesmos bits)", () => {
  const antes = (p: typeof caixaBase) => (Number(p.saldoInicial) || 0) + p.totalDinheiro + p.suprimentos - p.sangrias;
  for (const p of [caixaBase, { saldoInicial: 0.1, totalDinheiro: 0.2, suprimentos: 0.3, sangrias: 0.7 }, { saldoInicial: 1e-9, totalDinheiro: 33.33, suprimentos: 0, sangrias: 66.67 }]) {
    assertEquals(Object.is(calcularDinheiroEsperado(p), antes(p)), true);
    assertEquals(Object.is(calcularDinheiroEsperado({ ...p, devolucoesDinheiro: 0 }), antes(p)), true);
    assertEquals(Object.is(calcularDinheiroEsperado({ ...p, devolucoesDinheiro: somarDevolucoesTroca([]).dinheiro }), antes(p)), true);
  }
});

Deno.test("dinheiro esperado: devolução de troca CANCELADA não entra", () => {
  assertEquals(esperado([dev(800, "dinheiro", true)]), 370);
  assertEquals(somarDevolucoesTroca([dev(800, "dinheiro", true), dev(300, "pix", true)]), { dinheiro: 0, pix: 0, quantidadeDinheiro: 0, quantidadePix: 0 });
});

Deno.test("total_devolucoes_troca do fechamento = soma em centavos das devoluções em dinheiro ativas", () => {
  const t = somarDevolucoesTroca([dev(0.1, "dinheiro"), dev(0.2, "dinheiro"), dev("99.99" as unknown as number, "dinheiro"), dev(500, "pix"), dev(700, "dinheiro", true), dev(0, null)]);
  assertEquals([t.dinheiro, t.quantidadeDinheiro, t.pix, t.quantidadePix], [100.29, 3, 500, 1]);
});

// ── 3. Extrato ──────────────────────────────────────────────────────────────

Deno.test("Extrato: rótulo 'Devolução de troca' e a linha abre o detalhe", () => {
  assertEquals(LABEL_ORIGEM_EXTRATO.devolucao_troca, "Devolução de troca");
  assertEquals(LABEL_ORIGEM_EXTRATO.venda_pdv, "Venda");
  assertEquals(ORIGENS_COM_DETALHE, ["venda_pdv", "ordem_servico", "devolucao_troca"]);
});

// ── 5. Cancelamento: aviso e "Estou ciente" ─────────────────────────────────

Deno.test("cancelamento: aviso da devolução em Dinheiro e em Pix", () => {
  assertEquals(nbsp(avisoDevolucaoNoCancelamento({ valorDevolvido: 800, formaDevolucao: "dinheiro" })),
    "O cliente recebeu R$ 800,00 (Dinheiro) de devolução nesta troca. Cancelar a venda não traz esse dinheiro de volta; combine a recuperação com o cliente.");
  assertEquals(nbsp(avisoDevolucaoNoCancelamento({ valorDevolvido: 1234.5, formaDevolucao: "pix" })),
    "O cliente recebeu R$ 1.234,50 (Pix) de devolução nesta troca. Cancelar a venda não traz esse dinheiro de volta; combine a recuperação com o cliente.");
});

Deno.test("cancelamento: sem devolução não há aviso nem 'Estou ciente'", () => {
  assertEquals(avisoDevolucaoNoCancelamento({ valorDevolvido: 0, formaDevolucao: null }), null);
  assertEquals(avisoDevolucaoNoCancelamento(null), null);
  assertEquals(avisoDevolucaoNoCancelamento({ valorDevolvido: 0.004, formaDevolucao: "pix" }), null);
});

Deno.test("cancelamento: botão só libera com 'Estou ciente' quando houve devolução", () => {
  const base = { carregando: false, erroLeitura: false, bloqueio: null, exigeCiente: true, ciente: false };
  assertEquals(podeConfirmarCancelamento(base), false);
  assertEquals(podeConfirmarCancelamento({ ...base, ciente: true }), true);
  assertEquals(podeConfirmarCancelamento({ ...base, exigeCiente: false }), true);
  assertEquals(podeConfirmarCancelamento({ ...base, ciente: true, carregando: true }), false);
  assertEquals(podeConfirmarCancelamento({ ...base, ciente: true, erroLeitura: true }), false);
  assertEquals(podeConfirmarCancelamento({ ...base, ciente: true, bloqueio: "x" }), false);
});

// ── 6. Venda com troca: só cancela inteira ──────────────────────────────────

Deno.test("item 6: venda com troca é cancelada inteira; sem troca, só a linha", () => {
  const comTroca = decidirCancelamentoTroca({ trocaAtiva: true, aparelho: { vendido: false, excluido: false } }, "manter");
  assertEquals([comTroca.cancelarVendaInteira, comTroca.marcarTrocaCancelada], [true, true]);
  assertEquals(decidirCancelamentoTroca({ trocaAtiva: false, aparelho: null }, null).cancelarVendaInteira, false);
  assertEquals(MENSAGEM_VENDA_COM_TROCA_INTEIRA, "Vendas com troca são canceladas por inteiro");
});

Deno.test("item 6: linhas canceladas juntas; estoque estornado 1× por item (parcelado) e auxiliar fora", () => {
  const l = (id: string, parcela: number | null, extra: { cancelada?: boolean; observacoes?: string } = {}) =>
    ({ id, parcela_numero: parcela, cancelada: extra.cancelada ?? false, observacoes: extra.observacoes ?? null });
  const r = linhasParaCancelarVendaInteira([
    l("celular", null),
    l("capa-p1", 1), l("capa-p2", 2), l("capa-p3", 3),
    l("aux", null, { observacoes: "pagamento_duplo_secundario" }),
    l("pelicula-ja-cancelada", null, { cancelada: true }),
  ]);
  assertEquals(r.map((x) => [x.linha.id, x.estornar]), [["celular", true], ["capa-p1", true], ["capa-p2", false], ["capa-p3", false]]);
});

// ── 7. Alterar data da venda ────────────────────────────────────────────────

const caixaFechado = { total_dinheiro: 1000, total_pix: 500, total_cartao: 0, total_a_receber: 0, total_vendas: 1500, saldo_final: 900, total_devolucoes_troca: 800 };

Deno.test("alterar data: troca que cobre tudo + devolução em dinheiro move só a devolução", () => {
  // 3.700 no "outro/Troca" com valor_troca 3.700: nada entra nas formas; 800 em dinheiro saíram da gaveta.
  const linhas = [{ forma_pagamento: "outro", observacoes: "[forma:Troca]", total: 3700, valor_troca: 3700 }];
  const parte = calcularParteDaVenda(linhas, [dev(800, "dinheiro")]);
  assertEquals(parte, { ...PARTE_ZERO, devolucoes_dinheiro: 800 });
  assertEquals(parteMexeNoCaixa(parte), true);
  // Sai do caixa antigo: o saldo volta a subir 800, a foto da devolução zera.
  assertEquals(novosTotaisCaixa(caixaFechado, parte, -1), { ...caixaFechado, saldo_final: 1700, total_devolucoes_troca: 0 });
  // Entra no novo: o saldo cai 800, a foto soma 800.
  const novo = { ...caixaFechado, total_devolucoes_troca: 0 };
  assertEquals(novosTotaisCaixa(novo, parte, 1), { ...novo, saldo_final: 100, total_devolucoes_troca: 800 });
});

Deno.test("alterar data: troca parcial paga em dinheiro, sem devolução: igual à Fase 1", () => {
  // 1.000 em dinheiro, troca de 400 na mesma linha: 600 em dinheiro entram; sem devolução.
  const parte = calcularParteDaVenda([{ forma_pagamento: "dinheiro", total: 1000, valor_troca: 400 }], [dev(0, null)]);
  assertEquals(parte, { ...PARTE_ZERO, total_dinheiro: 600 });
  const r = novosTotaisCaixa(caixaFechado, parte, 1);
  assertEquals([r.total_dinheiro, r.total_vendas, r.saldo_final, "total_devolucoes_troca" in r], [1600, 2100, 1500, false]);
});

Deno.test("alterar data: devolução em Pix ou cancelada não mexe no saldo nem na foto", () => {
  for (const d of [dev(800, "pix"), dev(800, "dinheiro", true)]) {
    const parte = calcularParteDaVenda([{ forma_pagamento: "outro", total: 3700, valor_troca: 3700 }], [d]);
    assertEquals(parteMexeNoCaixa(parte), false);
  }
});

Deno.test("alterar data: venda sem troca gera o mesmo update de antes (mesmos bits, sem coluna nova)", () => {
  const linhas = [
    { forma_pagamento: "credito", total: 199.9, segunda_forma_pagamento: "dinheiro", valor_segunda_forma: 33.33 },
    { forma_pagamento: "dinheiro", total: 0.1 },
    { forma_pagamento: "pix", total: 0.2 },
  ];
  const parte = calcularParteDaVenda(linhas, []);
  const n = (v: number | null) => Number(v || 0);
  const total = parte.total_dinheiro + parte.total_pix + parte.total_cartao + parte.total_a_receber;
  for (const sinal of [1, -1] as const) {
    const antes = {
      total_dinheiro: n(caixaFechado.total_dinheiro) + sinal * parte.total_dinheiro,
      total_pix: n(caixaFechado.total_pix) + sinal * parte.total_pix,
      total_cartao: n(caixaFechado.total_cartao) + sinal * parte.total_cartao,
      total_a_receber: n(caixaFechado.total_a_receber) + sinal * parte.total_a_receber,
      total_vendas: n(caixaFechado.total_vendas) + sinal * total,
      saldo_final: n(caixaFechado.saldo_final) + sinal * parte.total_dinheiro,
    };
    const depois = novosTotaisCaixa(caixaFechado, parte, sinal);
    assertEquals(Object.keys(depois), Object.keys(antes));
    for (const k of Object.keys(antes) as (keyof typeof antes)[]) assertEquals(Object.is(depois[k], antes[k]), true, k);
  }
});

Deno.test("alterar data: a foto nunca fica negativa (caixa fechado antes da 2B, foto 0)", () => {
  const parte = { ...PARTE_ZERO, devolucoes_dinheiro: 800 };
  const r = novosTotaisCaixa({ ...caixaFechado, total_devolucoes_troca: 0 }, parte, -1);
  assertEquals([r.total_devolucoes_troca, r.saldo_final], [0, 1700]);
});
