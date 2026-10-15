// TZ=UTC deno test --no-check scripts/testes-fuso-brasilia/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-fuso-brasilia/
// Contas a receber "virtuais" de venda a prazo (useContas): a data da conta é o dia de
// Brasília da venda/recebimento (diaBrasiliaDaData), não o dia UTC cortado do ISO.
import { assertEquals } from "jsr:@std/assert@1";
import { diaBrasiliaDaData } from "../../src/lib/vendasFinanceiras.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

/** Mesma escolha de useContas (sem o fallback "hoje"). */
const dataContaVirtual = (v: { recebido?: boolean; data_recebimento?: string | null; data_prevista_recebimento?: string | null; data?: string | null }) =>
  v.recebido && v.data_recebimento
    ? diaBrasiliaDaData(v.data_recebimento)
    : v.data_prevista_recebimento || diaBrasiliaDaData(v.data);

Deno.test("venda a prazo das 21:00:30 fica no dia 14 (antes ia para 15)", () => {
  assertEquals("2026-10-15T00:00:30+00:00".split("T")[0], "2026-10-15"); // como era
  assertEquals(dataContaVirtual({ data: "2026-10-15T00:00:30+00:00" }), "2026-10-14");
});

Deno.test("recebida às 21:00:30: conta no dia do recebimento em Brasília", () => {
  assertEquals(dataContaVirtual({ recebido: true, data_recebimento: "2026-10-15T00:00:30Z", data: "2026-10-01T15:00:00Z" }), "2026-10-14");
});

Deno.test("data prevista (coluna date) continua como está", () => {
  assertEquals(dataContaVirtual({ data_prevista_recebimento: "2026-11-10", data: "2026-10-15T00:00:30Z" }), "2026-11-10");
});
