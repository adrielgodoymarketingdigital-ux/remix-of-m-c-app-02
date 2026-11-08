// TZ=UTC deno test --no-check scripts/testes-fuso-brasilia/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-fuso-brasilia/
// Cards "Hoje" do Dashboard (filtrarVendasDoHoje): mesma regra financeira do mês
// (a receber/a prazo só depois de recebida), com o dia de Brasília. Caso real:
// venda de R$ 50 a receber, não recebida, feita hoje, aparecia como Faturamento
// Hoje R$ 50 / Lucro Hoje R$ 40 enquanto o mês mostrava R$ 0.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { limitesDiaBrasilia } from "../../src/lib/dataBrasilia.ts";
import {
  filtrarVendasDoHoje,
  getVendaCustoTotal,
  getVendaReceitaLiquida,
  isVendaInFinancialPeriod,
  isVendaNoDiaBrasilia,
  MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO,
  type VendaFinanceiraLike,
} from "../../src/lib/vendasFinanceiras.ts";

type Venda = VendaFinanceiraLike & { peca_id?: string | null };

const HOJE = "2026-11-08";
const ONTEM = "2026-11-07";
const HOJE_MEIO_DIA = "2026-11-08T15:00:00Z"; // 12:00 de Brasília
const HOJE_21H30 = "2026-11-09T00:30:00Z"; // 08/11 21:30 de Brasília (já é 09/11 em UTC)
const ONTEM_MEIO_DIA = "2026-11-07T15:00:00Z";
const RECEBIDO_HOJE = "2026-11-08T12:00:00-03:00"; // formato de normalizarDataRecebimento

/** Mesmo caminho do card: filtro do banco (data OU data_recebimento no dia) + filtro em memória. */
function vendasDoDia(vendas: Venda[], dia: string): Venda[] {
  const { inicioISO, fimISO } = limitesDiaBrasilia(dia);
  const noBanco = (iso?: string | null) =>
    !!iso && new Date(iso) >= new Date(inicioISO) && new Date(iso) <= new Date(fimISO);
  return filtrarVendasDoHoje(vendas.filter((v) => noBanco(v.data) || noBanco(v.data_recebimento)), dia);
}

/** Faturamento e lucro como o Dashboard soma (getVendaReceitaLiquida − getVendaCustoTotal). */
function totais(vendas: Venda[]) {
  const receita = vendas.reduce((acc, v) => acc + getVendaReceitaLiquida(v), 0);
  const custo = vendas.reduce((acc, v) => acc + getVendaCustoTotal(v), 0);
  return { faturamento: Math.round(receita * 100) / 100, lucro: Math.round((receita - custo) * 100) / 100 };
}

/** Regra do mês (novembro), já usada pelos cards do mês — o "Hoje" tem que bater com ela. */
const contaNoMes = (v: Venda) =>
  isVendaInFinancialPeriod(v, new Date(2026, 10, 1), new Date(2026, 10, 30));

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

Deno.test("venda à vista hoje conta", () => {
  const v: Venda = { data: HOJE_MEIO_DIA, forma_pagamento: "pix", recebido: true, total: 80, custo_unitario: 30, quantidade: 1 };
  assertEquals(vendasDoDia([v], HOJE), [v]);
  assertEquals(totais(vendasDoDia([v], HOJE)), { faturamento: 80, lucro: 50 });
  // Às 21:30 de Brasília (dia seguinte em UTC) continua no dia certo.
  const noite: Venda = { ...v, data: HOJE_21H30 };
  assertEquals(vendasDoDia([noite], HOJE).length, 1);
  assertEquals(vendasDoDia([noite], "2026-11-09").length, 0);
});

Deno.test("caso real: R$ 50 a receber não recebida hoje — Faturamento/Lucro Hoje passam de 50/40 para 0/0", () => {
  const v: Venda = { data: HOJE_MEIO_DIA, forma_pagamento: "a_receber", recebido: false, total: 50, custo_unitario: 10, quantidade: 1 };
  // Antes: o filtro só pelo dia deixava a venda entrar.
  assert(isVendaNoDiaBrasilia(v, HOJE));
  assertEquals(totais([v]), { faturamento: 50, lucro: 40 });
  // Agora: fora, como no mês.
  assertEquals(vendasDoDia([v], HOJE), []);
  assertEquals(totais(vendasDoDia([v], HOJE)), { faturamento: 0, lucro: 0 });
  assert(!contaNoMes(v));
  // A prazo segue a mesma regra.
  assertEquals(vendasDoDia([{ ...v, forma_pagamento: "a_prazo" }], HOJE), []);
});

Deno.test("venda a receber recebida hoje conta", () => {
  const v: Venda = { data: HOJE_MEIO_DIA, data_recebimento: RECEBIDO_HOJE, forma_pagamento: "a_receber", recebido: true, total: 50, custo_unitario: 10, quantidade: 1 };
  assertEquals(totais(vendasDoDia([v], HOJE)), { faturamento: 50, lucro: 40 });
  // Recebimento gravado como new Date().toISOString() às 21:30 de Brasília.
  assertEquals(vendasDoDia([{ ...v, data_recebimento: HOJE_21H30 }], HOJE).length, 1);
});

Deno.test("vendida ontem e recebida hoje conta hoje, não ontem", () => {
  const v: Venda = { data: ONTEM_MEIO_DIA, data_recebimento: RECEBIDO_HOJE, forma_pagamento: "a_receber", recebido: true, total: 50, custo_unitario: 10, quantidade: 1 };
  assertEquals(totais(vendasDoDia([v], HOJE)), { faturamento: 50, lucro: 40 });
  assertEquals(vendasDoDia([v], ONTEM), []);
  // Ainda não recebida: não conta em nenhum dos dois.
  const pendente: Venda = { ...v, recebido: false, data_recebimento: null };
  assertEquals(vendasDoDia([pendente], ONTEM), []);
  assertEquals(vendasDoDia([pendente], HOJE), []);
});

Deno.test("venda cancelada não conta (mesmo sem o filtro do banco)", () => {
  const avista: Venda = { data: HOJE_MEIO_DIA, forma_pagamento: "dinheiro", recebido: true, cancelada: true, total: 80, custo_unitario: 30, quantidade: 1 };
  const recebida: Venda = { data: HOJE_MEIO_DIA, data_recebimento: RECEBIDO_HOJE, forma_pagamento: "a_receber", recebido: true, cancelada: true, total: 50 };
  assertEquals(filtrarVendasDoHoje([avista, recebida], HOJE), []);
});

Deno.test("pagamento duplo pix + a receber: principal conta a parte paga; secundária só quando recebida", () => {
  const principal: Venda = {
    data: HOJE_MEIO_DIA, forma_pagamento: "pix", recebido: true, total: 100, custo_unitario: 60, quantidade: 1,
    segunda_forma_pagamento: "a_receber", valor_segunda_forma: 40,
  };
  const secundariaPendente: Venda = {
    data: HOJE_MEIO_DIA, forma_pagamento: "a_receber", recebido: false, total: 40, custo_unitario: 0, quantidade: 1,
    observacoes: MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO,
  };
  // Receita 100 − 40 = 60; custo reconhecido 60 × 60% = 36.
  assertEquals(vendasDoDia([principal, secundariaPendente], HOJE), [principal]);
  assertEquals(totais(vendasDoDia([principal, secundariaPendente], HOJE)), { faturamento: 60, lucro: 24 });

  // Secundária recebida hoje, com a fatia de custo (24) gravada pelo reconhecimento.
  const secundariaRecebida: Venda = { ...secundariaPendente, recebido: true, data_recebimento: RECEBIDO_HOJE, custo_unitario: 24 };
  assertEquals(totais(vendasDoDia([principal, secundariaRecebida], HOJE)), { faturamento: 100, lucro: 40 });
  // Recebida sem custo gravado: "custo não confirmado", fica fora.
  assertEquals(vendasDoDia([{ ...secundariaRecebida, custo_unitario: 0 }], HOJE), []);
});

Deno.test("pagamento duplo a receber + pix: fora até a baixa da principal (igual ao mês)", () => {
  const principal: Venda = {
    data: HOJE_MEIO_DIA, forma_pagamento: "a_receber", recebido: false, total: 100, custo_unitario: 60, quantidade: 1,
    segunda_forma_pagamento: "pix", valor_segunda_forma: 40,
  };
  const secundariaPix: Venda = {
    data: HOJE_MEIO_DIA, forma_pagamento: "pix", recebido: true, total: 40, custo_unitario: 0, quantidade: 1,
    observacoes: MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO,
  };
  assertEquals(vendasDoDia([principal, secundariaPix], HOJE), []);
  // No mês a principal também fica fora (a linha pix secundária sai antes, no excluirItemOS).
  assert(!contaNoMes(principal));

  // Principal recebida hoje: entra inteira (R$ 100), como no mês; a linha pix segue fora.
  const principalRecebida: Venda = { ...principal, recebido: true, data_recebimento: RECEBIDO_HOJE };
  assertEquals(vendasDoDia([principalRecebida, secundariaPix], HOJE), [principalRecebida]);
  assertEquals(totais(vendasDoDia([principalRecebida, secundariaPix], HOJE)), { faturamento: 100, lucro: 40 });
  assert(contaNoMes(principalRecebida));
});

Deno.test("parcelado a receber em 3x com 1 parcela recebida hoje: só ela conta", () => {
  // PDV: total e custo já divididos por parcela (R$ 90 / custo R$ 60 em 3x).
  const parcela = (n: number, recebida: boolean): Venda => ({
    data: HOJE_MEIO_DIA, forma_pagamento: "a_receber", recebido: recebida, data_recebimento: recebida ? RECEBIDO_HOJE : null,
    total: 30, custo_unitario: 20, quantidade: 1, parcela_numero: n, total_parcelas: 3, grupo_venda: "g1",
  });
  const parcelas = [parcela(1, true), parcela(2, false), parcela(3, false)];
  assertEquals(vendasDoDia(parcelas, HOJE), [parcelas[0]]);
  assertEquals(totais(vendasDoDia(parcelas, HOJE)), { faturamento: 30, lucro: 10 });
});

Deno.test("itens de OS e venda de peça continuam fora", () => {
  const itemOS: Venda = { data: HOJE_MEIO_DIA, forma_pagamento: "pix", recebido: true, total: 20, observacoes: "Peça/Produto utilizado na OS 123" };
  const peca: Venda = { data: HOJE_MEIO_DIA, forma_pagamento: "pix", recebido: true, total: 20, peca_id: "p1" };
  assertEquals(filtrarVendasDoHoje([itemOS, peca], HOJE), []);
});

Deno.test("o Hoje bate com a regra do mês em todos os casos acima", () => {
  const casos: Venda[] = [
    { data: HOJE_MEIO_DIA, forma_pagamento: "pix", recebido: true, total: 80 },
    { data: HOJE_MEIO_DIA, forma_pagamento: "a_receber", recebido: false, total: 50 },
    { data: HOJE_MEIO_DIA, data_recebimento: RECEBIDO_HOJE, forma_pagamento: "a_receber", recebido: true, total: 50 },
    { data: HOJE_MEIO_DIA, forma_pagamento: "credito", recebido: true, total: 50, parcela_numero: 2, total_parcelas: 3 },
    { data: HOJE_MEIO_DIA, forma_pagamento: "dinheiro", recebido: true, cancelada: true, total: 50 },
  ];
  for (const v of casos) {
    assertEquals(filtrarVendasDoHoje([v], HOJE).length === 1, contaNoMes(v), JSON.stringify(v));
  }
});
