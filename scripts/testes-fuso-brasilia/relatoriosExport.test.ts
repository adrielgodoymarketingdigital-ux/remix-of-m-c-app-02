// TZ=UTC deno test --no-check scripts/testes-fuso-brasilia/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-fuso-brasilia/
// Exports de Relatórios (Vendas Completo, OS, Clientes), OS do useRelatorios e vendas
// avulsas: período "AAAA-MM-DD" a "AAAA-MM-DD" vira 00:00 e 23:59:59.999 de Brasília
// em UTC (limitesDiaBrasilia). Antes iam crus e o banco (sessão UTC) lia 3h adiantado.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { limitesDiaBrasilia } from "../../src/lib/dataBrasilia.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

/** O que o banco devolve com .gte(col, inicioISO).lte(col, fimISO) para o período. */
function noPeriodo(instanteISO: string, dataInicio: string, dataFim: string): boolean {
  const { inicioISO } = limitesDiaBrasilia(dataInicio);
  const { fimISO } = limitesDiaBrasilia(dataFim);
  const t = new Date(instanteISO).getTime();
  return t >= new Date(inicioISO).getTime() && t <= new Date(fimISO).getTime();
}

/** Como era: "AAAA-MM-DD" e "AAAA-MM-DDT23:59:59" lidos em UTC pelo Postgres. */
function noPeriodoAntigo(instanteISO: string, dataInicio: string, dataFim: string): boolean {
  const t = new Date(instanteISO).getTime();
  return t >= Date.parse(`${dataInicio}T00:00:00Z`) && t <= Date.parse(`${dataFim}T23:59:59Z`);
}

const VD171 = "2026-10-15T00:00:30Z"; // 14/10 21:00:30 BRT

Deno.test("Export de 14/10 a 14/10 inclui a VD-000171 (antes ficava de fora)", () => {
  assert(!noPeriodoAntigo(VD171, "2026-10-14", "2026-10-14"));
  assert(noPeriodo(VD171, "2026-10-14", "2026-10-14"));
  assert(!noPeriodo(VD171, "2026-10-15", "2026-10-15"));
});

Deno.test("20:58, 21:00:30, 23:59 e 00:01 caem no dia certo do export", () => {
  assert(noPeriodo("2026-10-14T23:58:00Z", "2026-10-14", "2026-10-14"));  // 20:58
  assert(noPeriodo("2026-10-15T00:00:30Z", "2026-10-14", "2026-10-14"));  // 21:00:30
  assert(noPeriodo("2026-10-15T02:59:00Z", "2026-10-14", "2026-10-14"));  // 23:59
  assert(!noPeriodo("2026-10-15T03:01:00Z", "2026-10-14", "2026-10-14")); // 00:01 do dia 15
  assert(noPeriodo("2026-10-15T03:01:00Z", "2026-10-15", "2026-10-15"));
  // Venda de 13/10 às 21:30 não entra mais no export de 14/10 (antes entrava).
  assert(noPeriodoAntigo("2026-10-14T00:30:00Z", "2026-10-14", "2026-10-14"));
  assert(!noPeriodo("2026-10-14T00:30:00Z", "2026-10-14", "2026-10-14"));
});

Deno.test("mês: último dia às 22:00 entra no mês certo; 1º dia às 22:00 do mês anterior não", () => {
  assert(noPeriodo("2026-11-01T01:00:00Z", "2026-10-01", "2026-10-31"));   // 31/10 22:00 BRT
  assert(!noPeriodoAntigo("2026-11-01T01:00:00Z", "2026-10-01", "2026-10-31"));
  assert(!noPeriodo("2026-10-01T01:00:00Z", "2026-10-01", "2026-10-31"));  // 30/09 22:00 BRT
  assert(noPeriodo("2026-10-01T01:00:00Z", "2026-09-01", "2026-09-30"));
  // OS entregue no último dia às 23:30 (data_saida) entra no período.
  assert(noPeriodo("2026-11-01T02:30:00Z", "2026-10-01", "2026-10-31"));
});

Deno.test("limites exatos (iguais em qualquer fuso da máquina)", () => {
  assertEquals(limitesDiaBrasilia("2026-10-14"), {
    inicioISO: "2026-10-14T03:00:00.000Z",
    fimISO: "2026-10-15T02:59:59.999Z",
  });
});
