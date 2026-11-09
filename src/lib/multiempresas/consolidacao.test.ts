// node --test src/lib/multiempresas/consolidacao.test.ts
// Consolidado da tela Multi Empresas: cada loja somada uma única vez. Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidarLojas, lojasUnicas, osParaMeta, participacaoNoTotal, ticketMedioOS, ticketMedioOSConsolidado, type LojaComMetricas } from "./consolidacao.ts";

function loja(id: string, fat: number, os = 0, vendas = 0, fatOS = 0): LojaComMetricas {
  return {
    id,
    metricas: {
      faturamento_mes: fat,
      faturamento_os: fatOS,
      faturamento_vendas: fat - fatOS,
      os_mes: os,
      os_em_aberto: Math.floor(os / 2),
      os_finalizadas: os - Math.floor(os / 2),
      vendas_mes: vendas,
    },
  };
}

// Card da matriz já vem só com a matriz (+ sem loja), como a função devolve agora.
const matriz = loja("emp-matriz", 1000, 4, 10, 400);
const filialA = loja("emp-filial-a", 500, 2, 5, 200);
const filialB = loja("emp-filial-b", 250, 1, 3, 50);

test("total confere com a soma dos cards", () => {
  const t = consolidarLojas([matriz, filialA, filialB]);
  assert.equal(t.faturamento, 1750);
  assert.equal(t.faturamentoOS, 650);
  assert.equal(t.faturamentoVendas, 1100);
  assert.equal(t.os, 7);
  assert.equal(t.osAbertas + t.osFinalizadas, 7);
  assert.equal(t.vendas, 18);
  assert.equal(t.quantidadeLojas, 3);
});

test("filial repetida na lista não soma duas vezes", () => {
  const t = consolidarLojas([matriz, filialA, filialA, filialB]);
  assert.equal(t.faturamento, 1750);
  assert.equal(t.quantidadeLojas, 3);
  assert.deepEqual(lojasUnicas([matriz, filialA, filialA]).map((l) => l.id), ["emp-matriz", "emp-filial-a"]);
});

test("Part. % das lojas soma 100% com o total correto", () => {
  const lojas = [matriz, filialA, filialB];
  const total = consolidarLojas(lojas).faturamento;
  const pcts = lojas.map((l) => participacaoNoTotal(l.metricas.faturamento_mes, total));
  assert.ok(Math.abs(pcts.reduce((s, p) => s + p, 0) - 100) < 1e-9);
  assert.ok(Math.abs(pcts[0] - (1000 / 1750) * 100) < 1e-9);
});

test("Part. % sem faturamento é 0 e nunca passa de 100", () => {
  assert.equal(participacaoNoTotal(100, 0), 0);
  assert.equal(participacaoNoTotal(0, 0), 0);
  assert.equal(participacaoNoTotal(300, 200), 100);
  assert.equal(participacaoNoTotal(-50, 200), 0);
});

test("lista vazia e campos opcionais ausentes viram zero", () => {
  assert.equal(consolidarLojas([]).faturamento, 0);
  const semOpcionais: LojaComMetricas = {
    id: "x",
    metricas: { faturamento_mes: 10, os_mes: 1, os_em_aberto: 1, os_finalizadas: 0, vendas_mes: 0 },
  };
  const t = consolidarLojas([semOpcionais]);
  assert.equal(t.faturamentoOS, 0);
  assert.equal(t.faturamentoVendas, 0);
  assert.equal(t.faturamento, 10);
});

// ── Ticket médio de OS e meta de OS ───────────────────────────────────────

const comFaturadas = (l: LojaComMetricas, osFaturadas: number, avulsos = 0): LojaComMetricas =>
  ({ ...l, metricas: { ...l.metricas, os_faturadas: osFaturadas, faturamento_avulsos: avulsos } });

test("ticket de OS = faturamento de OS ÷ OS faturadas (vendas não entram)", () => {
  const m = comFaturadas(matriz, 2);
  assert.equal(ticketMedioOS(m.metricas), 400 / 2);
  assert.equal(ticketMedioOS(comFaturadas(matriz, 0).metricas), 0);
});

test("ticket de OS consolidado: soma de OS ÷ soma de faturadas, cada loja uma vez", () => {
  const lojas = [comFaturadas(matriz, 2), comFaturadas(filialA, 1), comFaturadas(filialA, 1), comFaturadas(filialB, 1)];
  assert.equal(ticketMedioOSConsolidado(lojas), (400 + 200 + 50) / (2 + 1 + 1));
});

test("função antiga publicada (sem os_faturadas): mantém a conta de antes", () => {
  assert.equal(ticketMedioOS(matriz.metricas), 1000 / 4);
  assert.equal(ticketMedioOSConsolidado([matriz, filialA, filialB]), 1750 / 7);
  assert.equal(osParaMeta(matriz.metricas), 4);
});

test("meta de OS compara com as OS faturadas", () => {
  assert.equal(osParaMeta(comFaturadas(matriz, 3).metricas), 3);
});

test("consolidado soma avulsos e OS faturadas", () => {
  const t = consolidarLojas([comFaturadas(matriz, 2, 30), comFaturadas(filialA, 1, 5)]);
  assert.equal(t.faturamentoAvulsos, 35);
  assert.equal(t.osFaturadas, 3);
});
