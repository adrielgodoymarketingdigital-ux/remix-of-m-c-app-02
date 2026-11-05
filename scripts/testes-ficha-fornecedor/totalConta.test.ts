// deno test --no-check scripts/testes-ficha-fornecedor/
// Roda as funções reais de src/lib/contas/totalConta.ts (total/saldo da conta
// e resumo da ficha do fornecedor).
import { assertEquals } from "jsr:@std/assert@1";
import { calcTotalFalta, resumoFicha } from "../../src/lib/contas/totalConta.ts";

const HOJE = new Date(2026, 10, 5); // 05/11/2026 00:00 (horário do aparelho)

type ContaTeste = Parameters<typeof resumoFicha>[0][number];
const conta = (c: Partial<ContaTeste>): ContaTeste => ({
  valor: 100,
  valor_pago: 0,
  usa_historico_pagamentos: false,
  data: "2026-11-10",
  status: "pendente",
  ...c,
});

Deno.test("calcTotalFalta: conta antiga guarda o saldo em valor e a entrada em valor_pago", () => {
  assertEquals(calcTotalFalta({ valor: 70, valor_pago: 30, usa_historico_pagamentos: false }), { total: 100, falta: 70 });
  assertEquals(calcTotalFalta({ valor: 70, valor_pago: undefined, usa_historico_pagamentos: undefined }), { total: 70, falta: 70 });
});

Deno.test("calcTotalFalta: conta nova guarda o total em valor", () => {
  assertEquals(calcTotalFalta({ valor: 100, valor_pago: 30, usa_historico_pagamentos: true }), { total: 100, falta: 70 });
  // Pago a mais nunca deixa saldo negativo
  assertEquals(calcTotalFalta({ valor: 100, valor_pago: 120, usa_historico_pagamentos: true }), { total: 100, falta: 0 });
});

Deno.test("calcTotalFalta: valores em texto (numeric do PostgREST) viram número", () => {
  const c = { valor: "50.5", valor_pago: "10", usa_historico_pagamentos: true } as unknown as ContaTeste;
  assertEquals(calcTotalFalta(c), { total: 50.5, falta: 40.5 });
});

Deno.test("resumoFicha: período vazio zera tudo", () => {
  assertEquals(resumoFicha([], HOJE), { total: 0, pago: 0, emAberto: 0, vencido: 0, quantidade: 0, quantidadeVencidas: 0 });
});

Deno.test("resumoFicha: conta paga entra inteira em Pago", () => {
  const r = resumoFicha([
    conta({ status: "pago", valor: 100, valor_pago: 100, usa_historico_pagamentos: true }),
    conta({ status: "pago", valor: 40 }), // antiga, sem entrada
  ], HOJE);
  assertEquals([r.total, r.pago, r.emAberto, r.vencido], [140, 140, 0, 0]);
});

Deno.test("resumoFicha: pendente a vencer fica em Em aberto e não em Vencido", () => {
  const r = resumoFicha([conta({ valor: 80, data: "2026-11-05" })], HOJE); // vence hoje: não está vencida
  assertEquals([r.total, r.pago, r.emAberto, r.vencido, r.quantidadeVencidas], [80, 0, 80, 0, 0]);
});

Deno.test("resumoFicha: pendente vencida entra em Em aberto e em Vencido", () => {
  const r = resumoFicha([conta({ valor: 80, data: "2026-11-04" })], HOJE);
  assertEquals([r.total, r.pago, r.emAberto, r.vencido, r.quantidadeVencidas], [80, 0, 80, 80, 1]);
});

Deno.test("resumoFicha: paga com data passada não conta como vencida", () => {
  const r = resumoFicha([conta({ status: "pago", data: "2026-01-01" })], HOJE);
  assertEquals([r.vencido, r.quantidadeVencidas], [0, 0]);
});

Deno.test("resumoFicha: parcial da conta antiga (entrada) e da conta nova", () => {
  const r = resumoFicha([
    conta({ valor: 70, valor_pago: 30, usa_historico_pagamentos: false, data: "2026-10-01" }), // vencida
    conta({ valor: 100, valor_pago: 25, usa_historico_pagamentos: true }),
  ], HOJE);
  assertEquals(r.total, 200);
  assertEquals(r.pago, 55);
  assertEquals(r.emAberto, 145);
  assertEquals(r.vencido, 70);
  assertEquals(r.total, r.pago + r.emAberto);
});

Deno.test("resumoFicha: arredonda centavos", () => {
  const r = resumoFicha([conta({ valor: 0.1 }), conta({ valor: 0.2 })], HOJE);
  assertEquals(r.total, 0.3);
});
