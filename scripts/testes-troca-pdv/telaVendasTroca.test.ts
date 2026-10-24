// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// parcelasComTrocaNaTela (src/lib/vendas/trocaPDV.ts): a tela de Vendas mostra
// por parcela o que o cliente paga (igual à conta a receber), e não total da
// parcela − desconto. Antes (24/10/2026): 5.000 com troca de 2.000 em 4x
// aparecia como 4 × 1.250.
import { assertEquals } from "jsr:@std/assert@1";
import {
  LinhaVendaTela,
  aReceberComTrocaNaTela,
  parcelasComTrocaNaTela,
  valorAReceberSemConta,
} from "../../src/lib/vendas/trocaPDV.ts";

/** Linhas como o PDV grava em "A Receber" parcelado: total e desconto ÷ N, valor_troca rateado. */
function linhasParceladas(p: {
  grupo: string; item: string; bruto: number; desconto: number; trocas: number[]; segunda?: string;
}): LinhaVendaTela[] {
  const n = p.trocas.length;
  return p.trocas.map((t, i) => ({
    id: `${p.grupo}-${p.item}-${i + 1}`,
    grupo_venda: p.grupo,
    dispositivo_id: p.item,
    parcela_numero: i + 1,
    total_parcelas: n,
    total: p.bruto / n,
    valor_desconto_manual: p.desconto / n,
    valor_desconto_cupom: 0,
    valor_troca: t,
    segunda_forma_pagamento: p.segunda ?? null,
  }));
}

Deno.test("5.000 com troca de 2.000 em 4x → 750 por parcela e troca 2.000", () => {
  const mapa = parcelasComTrocaNaTela(linhasParceladas({ grupo: "g", item: "a", bruto: 5000, desconto: 0, trocas: [500, 500, 500, 500] }));
  assertEquals([...mapa.values()], Array(4).fill({ valor: 750, trocaVenda: 2000 }));
});

Deno.test("com desconto 100 → 725 por parcela", () => {
  const mapa = parcelasComTrocaNaTela(linhasParceladas({ grupo: "g", item: "a", bruto: 5000, desconto: 100, trocas: [500, 500, 500, 500] }));
  assertEquals([...mapa.values()].map((p) => p.valor), [725, 725, 725, 725]);
});

Deno.test("1.000 − 333,33 em 3x → mesmas parcelas das contas (222,23 + 222,22 + 222,22)", () => {
  const mapa = parcelasComTrocaNaTela(linhasParceladas({ grupo: "g", item: "a", bruto: 1000, desconto: 0, trocas: [111.11, 111.11, 111.11] }));
  assertEquals(["g-a-1", "g-a-2", "g-a-3"].map((id) => mapa.get(id)?.valor), [222.23, 222.22, 222.22]);
});

Deno.test("dois itens parcelados: cada um com o seu restante; troca da venda é a soma", () => {
  const linhas = [
    ...linhasParceladas({ grupo: "g", item: "a", bruto: 5000, desconto: 50, trocas: [1000, 1000] }),
    ...linhasParceladas({ grupo: "g", item: "b", bruto: 100, desconto: 50, trocas: [0, 0] }),
  ];
  const mapa = parcelasComTrocaNaTela(linhas);
  assertEquals(mapa.get("g-a-1"), { valor: 1475, trocaVenda: 2000 });
  assertEquals(mapa.get("g-b-2"), { valor: 25, trocaVenda: 2000 });
});

Deno.test("parcela faltando na lista: linha calculada sozinha", () => {
  const linhas = linhasParceladas({ grupo: "g", item: "a", bruto: 5000, desconto: 0, trocas: [500, 500, 500, 500] }).slice(1);
  const mapa = parcelasComTrocaNaTela(linhas);
  assertEquals([...mapa.values()].map((p) => p.valor), [750, 750, 750]);
});

Deno.test("fica fora do mapa (tela mostra o de sempre): sem troca, à vista, pagamento duplo, sem grupo", () => {
  const semTroca = linhasParceladas({ grupo: "g1", item: "a", bruto: 5000, desconto: 0, trocas: [0, 0] }).map((l) => ({ ...l, valor_troca: null }));
  const aVista: LinhaVendaTela = { id: "v", grupo_venda: "g2", total: 5000, valor_troca: 2000, parcela_numero: null, total_parcelas: null };
  const duplo = linhasParceladas({ grupo: "g3", item: "a", bruto: 5000, desconto: 0, trocas: [500, 500], segunda: "pix" });
  const semGrupo = linhasParceladas({ grupo: "g4", item: "a", bruto: 5000, desconto: 0, trocas: [500, 500] }).map((l) => ({ ...l, grupo_venda: null }));
  assertEquals(parcelasComTrocaNaTela([...semTroca, aVista, ...duplo, ...semGrupo]).size, 0);
});

// ── Vendas a Receber (card) e conta a receber carregada ─────────────────────
// Antes (25/10/2026) o card "Vendas Pendentes de Recebimento" mostrava
// total − desconto (1.225 / 1.250) em vez da conta a receber (725 / 750).
const aReceber = (p: Parameters<typeof linhasParceladas>[0]) =>
  linhasParceladas(p).map((l) => ({ ...l, forma_pagamento: "a_receber" }));

Deno.test("card a receber: 5.000 / troca 2.000 / 4x → 750 por parcela", () => {
  const mapa = aReceberComTrocaNaTela(aReceber({ grupo: "g", item: "a", bruto: 5000, desconto: 0, trocas: [500, 500, 500, 500] }));
  assertEquals([...mapa.values()], Array(4).fill({ valor: 750, trocaVenda: 2000 }));
});

Deno.test("card a receber: com desconto 100 → 725 por parcela", () => {
  const mapa = aReceberComTrocaNaTela(aReceber({ grupo: "g", item: "a", bruto: 5000, desconto: 100, trocas: [500, 500, 500, 500] }));
  assertEquals([...mapa.values()].map((p) => p.valor), [725, 725, 725, 725]);
});

Deno.test("desconto embutido no preço (produção: total 1.225, desconto 0, troca 500) → 725", () => {
  const mapa = aReceberComTrocaNaTela(aReceber({ grupo: "g", item: "a", bruto: 4900, desconto: 0, trocas: [500, 500, 500, 500] }));
  assertEquals([...mapa.values()].map((p) => p.valor), [725, 725, 725, 725]);
});

Deno.test("valor da conta a receber, quando carregado, manda (lista e card)", () => {
  const linhas = aReceber({ grupo: "g", item: "a", bruto: 5000, desconto: 0, trocas: [500, 500, 500, 500] })
    .map((l, i) => ({ ...l, valor_conta_receber: i === 0 ? 700 : 750 }));
  assertEquals(aReceberComTrocaNaTela(linhas).get("g-a-1")?.valor, 700);
  assertEquals(parcelasComTrocaNaTela(linhas).get("g-a-1")?.valor, 700);
  assertEquals(aReceberComTrocaNaTela(linhas).get("g-a-2")?.valor, 750);
});

Deno.test("a receber à vista com troca: linha única, total − desconto − troca", () => {
  const linha: LinhaVendaTela & { forma_pagamento: string } = {
    id: "v", grupo_venda: "g", total: 5000, valor_desconto_manual: 100, valor_troca: 2000,
    parcela_numero: null, total_parcelas: null, forma_pagamento: "a_receber",
  };
  assertEquals(aReceberComTrocaNaTela([linha]).get("v"), { valor: 2900, trocaVenda: 2000 });
  assertEquals(valorAReceberSemConta(linha), 2900);
});

Deno.test("card a receber: sem troca ou forma que não é a receber fica fora do mapa", () => {
  const semTroca = aReceber({ grupo: "g1", item: "a", bruto: 5000, desconto: 0, trocas: [0, 0] }).map((l) => ({ ...l, valor_troca: null }));
  const pix = aReceber({ grupo: "g2", item: "a", bruto: 5000, desconto: 0, trocas: [2000] }).map((l) => ({ ...l, forma_pagamento: "pix", parcela_numero: null, total_parcelas: null }));
  assertEquals(aReceberComTrocaNaTela([...semTroca, ...pix]).size, 0);
});
