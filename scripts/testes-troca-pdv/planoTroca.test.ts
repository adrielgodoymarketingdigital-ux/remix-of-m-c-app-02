// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-troca-pdv/
// planejarTroca (src/lib/vendas/trocaPDV.ts): a soma que o caixa e o Extrato
// subtraem tem que ser EXATAMENTE a troca. Casos que falhavam antes da correção
// (checagem de 07/10/2026): e2/e3 (pagamento duplo com 2 itens: a 2ª forma
// inteira em cada linha zerava a linha barata e "comia" a troca dela) e h (peça:
// o Extrato ignora linhas com peca_id, então a troca rateada para a peça sumia).
import { assertEquals } from "jsr:@std/assert@1";
import {
  MENSAGEM_TROCA_MAIOR_QUE_ITENS_SEM_PECA,
  planejarTroca,
  valorSegundaFormaItem,
} from "../../src/lib/vendas/trocaPDV.ts";
import { agruparVendasPorFormaPagamento } from "../../src/lib/formaPagamento.ts";
import {
  deveContarSecundarioNoLucro,
  getVendaCustoTotal,
  getVendaReceitaLiquida,
} from "../../src/lib/vendasFinanceiras.ts";
import { calcularCustoUnitarioParcelaSecundaria } from "../../src/lib/vendas/rateioSegundaForma.ts";

const r2 = (v: number) => Math.round(v * 100) / 100;
const soma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));

interface Linha {
  total: number; valor_desconto_manual: number; forma_pagamento: string; peca: boolean;
  segunda_forma_pagamento: string | null; valor_segunda_forma: number | null; valor_troca: number | null;
  observacoes: string | null; custo_unitario: number; quantidade: number; recebido: boolean;
}

// Réplica das linhas que o PDV grava (PDV.tsx finalizarVenda) para venda à vista,
// 1 parcela, com ou sem pagamento duplo.
function venda(p: { itens: { bruto: number; custo: number; peca?: boolean }[]; troca: number; desconto?: number; segunda?: { forma: string; valor: number } }) {
  const desc = (p.desconto ?? 0) / p.itens.length;
  const plano = planejarTroca({
    itens: p.itens.map((i) => ({ bruto: i.bruto, desconto: desc, peca: !!i.peca })),
    parcelasPorItem: p.itens.map(() => 1),
    valorTroca: p.troca,
    valorSegunda: p.segunda?.valor ?? 0,
  });
  const principais: Linha[] = p.itens.map((i, idx) => ({
    total: i.bruto, valor_desconto_manual: desc, forma_pagamento: "dinheiro", peca: !!i.peca,
    segunda_forma_pagamento: p.segunda?.forma ?? null,
    valor_segunda_forma: p.segunda ? plano.segundaPorItem![idx] : null,
    valor_troca: plano.trocaPorLinha[idx][0], observacoes: "item", custo_unitario: i.custo, quantidade: 1, recebido: true,
  }));
  const auxiliares: Linha[] = p.segunda
    ? p.itens.map((i, idx) => ({
        total: plano.segundaPorItem![idx], valor_desconto_manual: 0, forma_pagamento: p.segunda!.forma, peca: !!i.peca,
        segunda_forma_pagamento: null, valor_segunda_forma: null, valor_troca: null,
        observacoes: "pagamento_duplo_secundario", custo_unitario: 0, quantidade: 1, recebido: p.segunda!.forma !== "a_receber",
      }))
    : [];
  return { plano, linhas: [...principais, ...auxiliares] };
}

// Seção 1 de fn_extrato_eventos_raw (migration 20261006120000), linha a linha.
const extrato = (linhas: Linha[]) => soma(linhas
  .filter((l) => !l.peca && l.observacoes !== "pagamento_duplo_secundario" && (!["a_receber", "a_prazo"].includes(l.forma_pagamento) || l.recebido))
  .map((l) => Math.max(0, l.total - l.valor_desconto_manual - (l.valor_troca ?? 0)
    - (l.segunda_forma_pagamento === "a_receber" && (l.valor_segunda_forma ?? 0) > 0 ? l.valor_segunda_forma! : 0))));
const caixa = (linhas: Linha[]) => Object.fromEntries(agruparVendasPorFormaPagamento(linhas).map((b) => [b.chave, r2(b.total)]));
const semTroca = (linhas: Linha[]) => linhas.map((l) => ({ ...l, valor_troca: null }));
const subtraido = (linhas: Linha[]) => ({
  extrato: r2(extrato(semTroca(linhas)) - extrato(linhas)),
  caixa: r2(soma(Object.values(caixa(semTroca(linhas)))) - soma(Object.values(caixa(linhas)))),
});

Deno.test("e2: 2 itens, duplo dinheiro + Pix 500, troca 3000 → caixa e Extrato tiram exatamente 3000", () => {
  const { plano, linhas } = venda({ itens: [{ bruto: 4000, custo: 2500 }, { bruto: 100, custo: 20 }], troca: 3000, segunda: { forma: "pix", valor: 500 } });
  assertEquals(plano.segundaPorItem, [487.8, 12.2]);
  assertEquals(soma(plano.segundaPorItem!), 500);
  assertEquals(soma(plano.trocaPorLinha.flat()), 3000);
  assertEquals(caixa(linhas), { dinheiro: 600, pix: 500 });
  assertEquals(subtraido(linhas), { extrato: 3000, caixa: 3000 });
});

Deno.test("e3: 2 itens, duplo dinheiro + a receber 500, troca 3000 → Extrato 600 e subtrai exatamente 3000", () => {
  const { linhas } = venda({ itens: [{ bruto: 4000, custo: 2500 }, { bruto: 100, custo: 20 }], troca: 3000, segunda: { forma: "a_receber", valor: 500 } });
  assertEquals(extrato(linhas), 600);
  assertEquals(caixa(linhas), { dinheiro: 600, a_receber: 500 });
  assertEquals(subtraido(linhas), { extrato: 3000, caixa: 3000 });
});

Deno.test("e: nenhuma linha principal fica negativa depois de desconto, fatia e troca", () => {
  const { linhas } = venda({ itens: [{ bruto: 600, custo: 1 }, { bruto: 600, custo: 1 }, { bruto: 37.33, custo: 1 }], troca: 700, desconto: 30, segunda: { forma: "pix", valor: 500 } });
  for (const l of linhas.filter((x) => x.observacoes !== "pagamento_duplo_secundario")) {
    assertEquals(r2(l.total - l.valor_desconto_manual - (l.valor_segunda_forma ?? 0) - (l.valor_troca ?? 0)) >= 0, true);
  }
  assertEquals(subtraido(linhas), { extrato: 700, caixa: 700 });
});

Deno.test("h: peça nunca recebe troca; Extrato e caixa tiram exatamente a troca", () => {
  const { plano, linhas } = venda({ itens: [{ bruto: 4000, custo: 2500 }, { bruto: 200, custo: 50, peca: true }], troca: 3000 });
  assertEquals(plano.trocaPorLinha, [[3000], [0]]);
  assertEquals(plano.bloqueio, null);
  assertEquals(subtraido(linhas), { extrato: 3000, caixa: 3000 });
});

Deno.test("C: troca maior que os itens sem peça bloqueia (mesmo cabendo no total com a peça)", () => {
  const plano = planejarTroca({ itens: [{ bruto: 4000, desconto: 0, peca: false }, { bruto: 200, desconto: 0, peca: true }], parcelasPorItem: [1, 1], valorTroca: 4100, valorSegunda: 0 });
  assertEquals([plano.bloqueio, plano.capacidade], [MENSAGEM_TROCA_MAIOR_QUE_ITENS_SEM_PECA, 4000]);
  assertEquals(plano.trocaPorLinha, [[0], [0]]); // nada vai para a peça
  const cabe = planejarTroca({ itens: [{ bruto: 4000, desconto: 0, peca: false }, { bruto: 200, desconto: 0, peca: true }], parcelasPorItem: [1, 1], valorTroca: 4000, valorSegunda: 0 });
  assertEquals([cabe.bloqueio, cabe.trocaPorLinha], [null, [[4000], [0]]]);
});

Deno.test("C: a fatia da 2ª forma do item sem peça reduz a capacidade", () => {
  // 4000 + peça 200, 2ª forma 420: fatias 400 / 20 → capacidade 3600.
  const plano = planejarTroca({ itens: [{ bruto: 4000, desconto: 0, peca: false }, { bruto: 200, desconto: 0, peca: true }], parcelasPorItem: [1, 1], valorTroca: 3600.01, valorSegunda: 420 });
  assertEquals([plano.capacidade, plano.bloqueio], [3600, MENSAGEM_TROCA_MAIOR_QUE_ITENS_SEM_PECA]);
});

Deno.test("A (regressão sem troca): 2ª forma das linhas auxiliares pela fórmula de sempre", () => {
  // Sem troca o PDV não chama planejarTroca: valor_segunda_forma = valor inteiro e
  // linhas auxiliares = bruto × 2ª ÷ total a pagar (valores da main 604e732).
  // Mesma expressão (e ordem de operações) da main: item × (2ª ÷ total), bit a bit.
  const proporcaoMain = 1050 / 4050;
  assertEquals(valorSegundaFormaItem({ itemBruto: 100, subtotal: 4100, totalAPagar: 4050, valorSegunda: 1050, temTroca: false }), 100 * proporcaoMain);
  assertEquals(valorSegundaFormaItem({ itemBruto: 4000, subtotal: 4100, totalAPagar: 4050, valorSegunda: 1050, temTroca: false }), 4000 * proporcaoMain);
  // E sem 2ª forma o plano nem calcula fatia.
  assertEquals(planejarTroca({ itens: [{ bruto: 1, desconto: 0, peca: false }], parcelasPorItem: [1], valorTroca: 0.5, valorSegunda: 0 }).segundaPorItem, null);
});

Deno.test("parcelas a receber: troca do item dividida em centavos exatos e só nas parcelas do item sem peça", () => {
  const plano = planejarTroca({ itens: [{ bruto: 4000, desconto: 0, peca: false }, { bruto: 50, desconto: 0, peca: true }], parcelasPorItem: [3, 3], valorTroca: 1000.01, valorSegunda: 0 });
  assertEquals(plano.trocaPorLinha, [[333.34, 333.34, 333.33], [0, 0, 0]]);
});

// ── D) lucro e reconhecimento da 2ª forma ────────────────────────────────────

// Receita e custo reconhecidos na vida toda da venda: linhas principais na data
// da venda + parcelas da 2ª forma "a receber" quando recebidas (com a fatia de
// custo de reconhecerSegundaForma: principal do MESMO item, soma das parcelas do item).
function lucroVidaToda(linhas: Linha[], nItens: number) {
  const principais = linhas.slice(0, nItens);
  const auxiliares = linhas.slice(nItens).map((a, idx) => ({
    ...a, recebido: true,
    custo_unitario: a.forma_pagamento === "a_receber"
      ? calcularCustoUnitarioParcelaSecundaria(principais[idx], a.total, a.total, 1)
      : 0,
  }));
  const receita = soma([...principais.map(getVendaReceitaLiquida), ...auxiliares.filter(deveContarSecundarioNoLucro).map(getVendaReceitaLiquida)]);
  const custo = soma([...principais.map(getVendaCustoTotal), ...auxiliares.filter(deveContarSecundarioNoLucro).map(getVendaCustoTotal)]);
  return { receita, custo, lucro: r2(receita - custo), reconhecido2a: soma(auxiliares.filter(deveContarSecundarioNoLucro).map((a) => a.total)) };
}

Deno.test("D lucro: troca + duplo a receber + 2 itens → lucro = venda − custo, igual com ou sem valor_troca", () => {
  const { linhas } = venda({ itens: [{ bruto: 4000, custo: 2500 }, { bruto: 100, custo: 20 }], troca: 3000, segunda: { forma: "a_receber", valor: 500 } });
  const com = lucroVidaToda(linhas, 2);
  const sem = lucroVidaToda(semTroca(linhas), 2);
  assertEquals(com, sem); // a troca não entra no lucro
  assertEquals(com, { receita: 4100, custo: 2520, lucro: 1580, reconhecido2a: 500 });
});

Deno.test("D lucro: 1 item com troca + duplo — a fatia é a 2ª forma inteira, lucro igual ao da venda sem troca", () => {
  const { plano, linhas } = venda({ itens: [{ bruto: 4000, custo: 2500 }], troca: 3000, segunda: { forma: "a_receber", valor: 500 } });
  assertEquals(plano.segundaPorItem, [500]);
  assertEquals(lucroVidaToda(linhas, 1), { receita: 4000, custo: 2500, lucro: 1500, reconhecido2a: 500 });
});

Deno.test("D reconhecimento: com a fatia, 2ª forma reconhecida = 500 e o custo diferido fecha (antes, valor inteiro repetido perdia 500 de receita)", () => {
  const { linhas } = venda({ itens: [{ bruto: 4000, custo: 2500 }, { bruto: 100, custo: 20 }], troca: 3000, segunda: { forma: "a_receber", valor: 500 } });
  // Antes da correção: as duas linhas principais com valor_segunda_forma = 500 inteiro.
  const antes = linhas.map((l, i) => (i < 2 ? { ...l, valor_segunda_forma: 500 } : l));
  assertEquals(lucroVidaToda(antes, 2).receita, 3600);
  assertEquals(lucroVidaToda(linhas, 2).receita, 4100);
});
