// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-troca-pdv/
// valoresContaReceberComTroca (src/lib/vendas/trocaPDV.ts): a conta "A Receber"
// de uma venda COM troca é o que o cliente ainda deve (bruto − desconto − troca),
// dividido em centavos exatos. Antes (checagem de 24/10/2026) o PDV fazia
// total da parcela − troca da parcela e ignorava o desconto: 5.000 − 100 de
// desconto − 2.000 de troca em 4x gerava 4 × 750 em vez de 4 × 725.
import { assertEquals } from "jsr:@std/assert@1";
import {
  calcularTotaisComTroca,
  planejarTroca,
  ratearPorPeso,
  valoresContaReceberComTroca,
} from "../../src/lib/vendas/trocaPDV.ts";

const r2 = (v: number) => Math.round(v * 100) / 100;
const soma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));

interface ItemCarrinho { preco: number; quantidade: number; peca?: boolean }

/** Mesma sequência do PDV (calcularPlanoTroca + finalizarVenda) para "A Receber" em N parcelas. */
function contasDoPDV(itens: ItemCarrinho[], desconto: number, troca: number, parcelas: number): number[][] {
  const subtotal = itens.reduce((a, i) => a + i.preco * i.quantidade, 0);
  const totais = calcularTotaisComTroca({ subtotal, desconto, valorEntrada: troca });
  const descontoPorItem = desconto / Math.max(1, itens.length);
  const plano = planejarTroca({
    itens: itens.map((i) => ({ bruto: i.preco * i.quantidade, desconto: descontoPorItem, peca: !!i.peca })),
    parcelasPorItem: itens.map(() => parcelas),
    valorTroca: totais.valorEntrada,
    valorSegunda: 0,
  });
  // Contas: desconto da venda dividido entre os itens em centavos exatos.
  const descontoContas = ratearPorPeso(desconto, itens.map(() => 1));
  return itens.map((i, idx) =>
    valoresContaReceberComTroca({
      bruto: i.preco * i.quantidade,
      desconto: descontoContas[idx],
      trocaPorParcela: plano.trocaPorLinha[idx],
      duplo: false,
    }) ?? [],
  );
}

Deno.test("5.000 com troca de 2.000 em 4x → 4 contas de 750", () => {
  const contas = contasDoPDV([{ preco: 5000, quantidade: 1 }], 0, 2000, 4);
  assertEquals(contas, [[750, 750, 750, 750]]);
});

Deno.test("5.000, desconto 100, troca 2.000 em 4x → 4 contas de 725", () => {
  const contas = contasDoPDV([{ preco: 5000, quantidade: 1 }], 100, 2000, 4);
  assertEquals(contas, [[725, 725, 725, 725]]);
});

Deno.test("centavos que não dividem exato: 1.000 − 333,33 em 3x soma exatamente 666,67", () => {
  const [contas] = contasDoPDV([{ preco: 1000, quantidade: 1 }], 0, 333.33, 3);
  assertEquals(contas, [222.23, 222.22, 222.22]);
  assertEquals(soma(contas), 666.67);
});

Deno.test("desconto que não divide entre itens: soma das contas = restante da venda", () => {
  // 3 itens, desconto 100 → 33,34 + 33,33 + 33,33 nas contas; troca só cabe no aparelho.
  const itens = [{ preco: 5000, quantidade: 1 }, { preco: 99.9, quantidade: 1 }, { preco: 35, quantidade: 2 }];
  const contas = contasDoPDV(itens, 100, 2000, 3);
  assertEquals(soma(contas.flat()), r2(5000 + 99.9 + 70 - 100 - 2000));
  for (const doItem of contas) {
    assertEquals(doItem.length, 3);
    // Parcelas iguais, diferença de no máximo 1 centavo
    const c = doItem.map((v) => Math.round(v * 100));
    assertEquals(Math.max(...c) - Math.min(...c) <= 1, true);
  }
});

Deno.test("à vista (1 parcela) com troca e desconto: uma conta com o restante", () => {
  assertEquals(contasDoPDV([{ preco: 5000, quantidade: 1 }], 100, 2000, 1), [[2900]]);
});

Deno.test("peça numa venda com troca: não recebe troca, conta = bruto − desconto", () => {
  const contas = contasDoPDV([{ preco: 5000, quantidade: 1 }, { preco: 200, quantidade: 1, peca: true }], 0, 2000, 2);
  assertEquals(contas, [[1500, 1500], [100, 100]]);
});

Deno.test("sem troca devolve null: o PDV mantém exatamente a fórmula da main", () => {
  assertEquals(valoresContaReceberComTroca({ bruto: 5000, desconto: 100, trocaPorParcela: null, duplo: false }), null);
  assertEquals(valoresContaReceberComTroca({ bruto: 5000, desconto: 100, trocaPorParcela: [], duplo: false }), null);
});

Deno.test("pagamento duplo devolve null: a conta do duplo não muda", () => {
  assertEquals(valoresContaReceberComTroca({ bruto: 5000, desconto: 0, trocaPorParcela: [500, 500], duplo: true }), null);
});

Deno.test("troca ≥ total não gera parcelas nem conta a receber", () => {
  for (const troca of [5000, 6000]) {
    const totais = calcularTotaisComTroca({ subtotal: 5000, desconto: 0, valorEntrada: troca });
    // Sem forma de pagamento: o PDV grava a forma "Troca" (outro), nunca "a_receber".
    assertEquals(totais.exigeFormaPagamento, false);
    assertEquals(totais.cobreTudo, true);
    assertEquals(totais.aPagar, 0);
    // Uma linha por item (forma "outro" → parcelasPorItem 1).
    const plano = planejarTroca({
      itens: [{ bruto: 5000, desconto: 0, peca: false }],
      parcelasPorItem: [1],
      valorTroca: troca,
      valorSegunda: 0,
      cobreTudo: { descontoTotal: 0 },
    });
    assertEquals(plano.trocaPorLinha, [[5000]]);
  }
  // E se chegasse a calcular, o restante seria zero.
  assertEquals(valoresContaReceberComTroca({ bruto: 5000, desconto: 0, trocaPorParcela: [5000], duplo: false }), [0]);
});
