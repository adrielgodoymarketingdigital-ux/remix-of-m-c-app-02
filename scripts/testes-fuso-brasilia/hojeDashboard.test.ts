// TZ=UTC deno test --no-check scripts/testes-fuso-brasilia/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-fuso-brasilia/
// Card "Hoje" do Dashboard (loadHojeData): consulta de 00:00 a 23:59:59.999 de
// Brasília (limitesDiaBrasilia) + cada venda conferida pelo dia de Brasília
// (isVendaNoDiaBrasilia). Caso real: VD-000171 do Livio, 14/10 21:00:30 BRT =
// 2026-10-15T00:00:30Z, sumia do "Hoje" de 14/10. O resultado não pode depender
// do fuso da máquina/navegador.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { dataBrasiliaISO, limitesDiaBrasilia } from "../../src/lib/dataBrasilia.ts";
import { diaBrasiliaDaData, isVendaNoDiaBrasilia } from "../../src/lib/vendasFinanceiras.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

type Venda = { data: string; data_recebimento?: string | null; forma_pagamento: string; recebido?: boolean };

/** Mesmo caminho do card: "hoje" de Brasília no instante `agora`, filtro do banco e filtro em memória. */
function vendasDoHoje(vendas: Venda[], agora: Date): Venda[] {
  const hoje = dataBrasiliaISO(agora);
  const { inicioISO, fimISO } = limitesDiaBrasilia(hoje);
  const noBanco = (iso?: string | null) => !!iso && new Date(iso) >= new Date(inicioISO) && new Date(iso) <= new Date(fimISO);
  return vendas
    .filter((v) => noBanco(v.data) || noBanco(v.data_recebimento))
    .filter((v) => isVendaNoDiaBrasilia(v, hoje));
}

const VD171: Venda = { data: "2026-10-15T00:00:30+00:00", forma_pagamento: "dinheiro" };

Deno.test("VD-000171 (00:00:30Z de 15/10) aparece no Hoje de 14/10 e não no de 15/10", () => {
  // 14/10 às 21:30 de Brasília (00:30Z do dia 15)
  assertEquals(vendasDoHoje([VD171], new Date("2026-10-15T00:30:00Z")).length, 1);
  // 14/10 às 23:59 de Brasília
  assertEquals(vendasDoHoje([VD171], new Date("2026-10-15T02:59:00Z")).length, 1);
  // 15/10 às 09:00 de Brasília
  assertEquals(vendasDoHoje([VD171], new Date("2026-10-15T12:00:00Z")).length, 0);
  // 15/10 às 00:05 de Brasília (já é outro dia)
  assertEquals(vendasDoHoje([VD171], new Date("2026-10-15T03:05:00Z")).length, 0);
});

Deno.test("20:58, 21:00:30, 23:59 e 00:01 de Brasília caem no dia certo", () => {
  const casos: [string, string][] = [
    ["2026-10-14T23:58:00Z", "2026-10-14"], // 20:58
    ["2026-10-15T00:00:30Z", "2026-10-14"], // 21:00:30
    ["2026-10-15T02:59:00Z", "2026-10-14"], // 23:59
    ["2026-10-15T03:01:00Z", "2026-10-15"], // 00:01 do dia 15
    ["2026-10-14T03:00:00Z", "2026-10-14"], // 00:00 em ponto
    ["2026-10-14T02:59:59Z", "2026-10-13"], // 23:59:59 do dia 13
  ];
  for (const [iso, dia] of casos) {
    assertEquals(diaBrasiliaDaData(iso), dia, iso);
    assertEquals(diaBrasiliaDaData(iso.replace("Z", "+00:00")), dia, `${iso} (+00:00)`);
    assert(isVendaNoDiaBrasilia({ data: iso, forma_pagamento: "pix" }, dia), iso);
  }
  // Mesmo dia: 20:58 e 21:00:30 juntas no Hoje de 14/10.
  const doDia = vendasDoHoje(
    [{ data: "2026-10-14T23:58:00Z", forma_pagamento: "pix" }, VD171, { data: "2026-10-15T03:01:00Z", forma_pagamento: "pix" }],
    new Date("2026-10-15T01:00:00Z"),
  );
  assertEquals(doDia.length, 2);
});

Deno.test("venda a prazo recebida às 21:00:30 conta no dia do recebimento em Brasília", () => {
  const prazo: Venda = {
    data: "2026-10-01T15:00:00Z",
    data_recebimento: "2026-10-15T00:00:30Z",
    forma_pagamento: "a_receber",
    recebido: true,
  };
  assertEquals(vendasDoHoje([prazo], new Date("2026-10-15T00:30:00Z")).length, 1); // Hoje de 14/10
  assertEquals(vendasDoHoje([prazo], new Date("2026-10-15T12:00:00Z")).length, 0); // Hoje de 15/10
  // Não recebida: não conta no recebimento (regra de sempre).
  assert(!isVendaNoDiaBrasilia({ ...prazo, recebido: false }, "2026-10-14"));
  // Recebimento gravado como meio-dia de Brasília (normalizarDataRecebimento) continua no dia.
  assert(isVendaNoDiaBrasilia({ ...prazo, data_recebimento: "2026-10-14T12:00:00-03:00" }, "2026-10-14"));
  // Data pura "AAAA-MM-DD" é o próprio dia.
  assertEquals(diaBrasiliaDaData("2026-10-14"), "2026-10-14");
  assertEquals(diaBrasiliaDaData(null), null);
  assertEquals(diaBrasiliaDaData("lixo"), null);
});

Deno.test("limites do mês em Brasília: último dia às 22:00 entra no mês certo (produtos mais vendidos)", () => {
  const inicio = limitesDiaBrasilia("2026-10-01").inicioISO;
  const fim = limitesDiaBrasilia("2026-10-31").fimISO;
  assertEquals(inicio, "2026-10-01T03:00:00.000Z");
  assertEquals(fim, "2026-11-01T02:59:59.999Z");
  const dentro = (iso: string) => new Date(iso) >= new Date(inicio) && new Date(iso) <= new Date(fim);
  assert(dentro("2026-11-01T01:00:00Z"));   // 31/10 22:00 BRT → outubro
  assert(!dentro("2026-10-01T01:00:00Z"));  // 30/09 22:00 BRT → setembro
  assert(dentro("2026-10-01T03:00:00Z"));   // 01/10 00:00 BRT → outubro
});
