// TZ=UTC deno test --no-check scripts/testes-datas/
// TZ=Asia/Tokyo deno test --no-check scripts/testes-datas/
// "Hoje" de negócio sempre no dia de Brasília, independente do fuso da máquina:
// new Date().toISOString().slice(0, 10) dá o dia UTC e, entre 21h e
// meia-noite de Brasília, grava o dia seguinte.
import { assertEquals } from "jsr:@std/assert@1";
import { dataBrasiliaISO } from "../../src/lib/dataBrasilia.ts";
import { dataRecebimentoDaConta } from "../../src/lib/vendas/reconhecerSegundaForma.core.ts";

const instante = (iso: string) => new Date(iso);

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {
  // Só registra no relatório em qual fuso a suíte rodou.
});

Deno.test("21h30 de Brasília continua sendo o mesmo dia (caso do bug)", () => {
  assertEquals(dataBrasiliaISO(instante("2026-10-05T00:30:00Z")), "2026-10-04");
});

Deno.test("borda exata da meia-noite de Brasília (03:00 UTC)", () => {
  assertEquals(dataBrasiliaISO(instante("2026-10-05T02:59:59Z")), "2026-10-04");
  assertEquals(dataBrasiliaISO(instante("2026-10-05T03:00:00Z")), "2026-10-05");
});

Deno.test("virada de mês: noite do dia 31 fica no mês que está fechando", () => {
  assertEquals(dataBrasiliaISO(instante("2026-11-01T01:00:00Z")), "2026-10-31");
});

Deno.test("virada de ano: noite de 31/12 fica no ano que está fechando", () => {
  assertEquals(dataBrasiliaISO(instante("2027-01-01T02:00:00Z")), "2026-12-31");
});

Deno.test("recebimento da venda vinculada: sem data na conta usa hoje em Brasília", () => {
  assertEquals(dataRecebimentoDaConta(null, instante("2026-10-05T00:30:00Z")), "2026-10-04T12:00:00-03:00");
  assertEquals(dataRecebimentoDaConta(undefined, instante("2026-11-01T01:00:00Z")), "2026-10-31T12:00:00-03:00");
});

Deno.test("recebimento da venda vinculada: data da conta tem prioridade sobre hoje", () => {
  assertEquals(dataRecebimentoDaConta("2026-09-15", instante("2026-10-05T00:30:00Z")), "2026-09-15T12:00:00-03:00");
  // Timestamp completo passa intacto (mesma regra de normalizarDataRecebimento).
  assertEquals(dataRecebimentoDaConta("2026-09-15T18:00:00-03:00"), "2026-09-15T18:00:00-03:00");
});
