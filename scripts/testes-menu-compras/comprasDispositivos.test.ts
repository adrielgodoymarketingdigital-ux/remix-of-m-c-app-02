// TZ=UTC deno test --no-check scripts/testes-menu-compras/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-menu-compras/
// TZ=Asia/Tokyo deno test --no-check scripts/testes-menu-compras/
// Roda as funções reais de src/lib/origem/comprasDispositivos.ts (lista e insert
// de Origem de Dispositivos), src/lib/dataBrasilia.ts e src/lib/formatters.ts.
// Caso real (out/2026): compras gravadas sem empresa_id sumiam da lista de lojas
// com matriz (filtro .eq("empresa_id", matriz)); datas "AAAA-MM-DD" lidas como
// meia-noite UTC apareciam um dia antes no Brasil.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  compraNoPeriodo,
  compraPassaNoFiltroEmpresa,
  contarHojeEMes,
  filtroEmpresaCompras,
  montarDadosInsercaoCompra,
} from "../../src/lib/origem/comprasDispositivos.ts";
import { dataBrasiliaISO } from "../../src/lib/dataBrasilia.ts";
import { formatDate, parseDate } from "../../src/lib/formatters.ts";

const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone;
Deno.test(`fuso da máquina: ${FUSO}`, () => {});

const MATRIZ = "11111111-1111-1111-1111-111111111111";
const FILIAL = "22222222-2222-2222-2222-222222222222";
const OUTRA = "33333333-3333-3333-3333-333333333333";

// ── Filtro de empresa da lista ─────────────────────────────────────────────

Deno.test("filtro: sem empresa não filtra por empresa (todas as compras do user_id)", () => {
  const f = filtroEmpresaCompras(null, false);
  assertEquals(f, { tipo: "nenhum" });
  for (const e of [null, undefined, MATRIZ, FILIAL]) assert(compraPassaNoFiltroEmpresa(e, f));
});

Deno.test("filtro: matriz inclui empresa_id nulo e a própria matriz, não outras empresas", () => {
  const f = filtroEmpresaCompras(MATRIZ, false);
  assertEquals(f, { tipo: "eq_ou_nulo", empresaId: MATRIZ, expressaoOr: `empresa_id.eq.${MATRIZ},empresa_id.is.null` });
  assert(compraPassaNoFiltroEmpresa(null, f), "compra sem empresa (a que sumia)");
  assert(compraPassaNoFiltroEmpresa(undefined, f));
  assert(compraPassaNoFiltroEmpresa(MATRIZ, f));
  assert(!compraPassaNoFiltroEmpresa(FILIAL, f));
  assert(!compraPassaNoFiltroEmpresa(OUTRA, f));
});

Deno.test("filtro: filial mostra só a filial (mesma regra de applyEmpresaFilter)", () => {
  const f = filtroEmpresaCompras(FILIAL, true);
  assertEquals(f, { tipo: "eq", empresaId: FILIAL });
  assert(compraPassaNoFiltroEmpresa(FILIAL, f));
  assert(!compraPassaNoFiltroEmpresa(null, f));
  assert(!compraPassaNoFiltroEmpresa(MATRIZ, f));
});

Deno.test("insert + lista: compra nova aparece na lista da mesma empresa ativa", () => {
  for (const [empresaId, isFilial] of [[MATRIZ, false], [FILIAL, true], [null, false]] as const) {
    const linha = montarDadosInsercaoCompra({ dispositivo_id: "d1" }, { userId: "u1", empresaId, agora: new Date() });
    assert(compraPassaNoFiltroEmpresa(linha.empresa_id, filtroEmpresaCompras(empresaId, isFilial)), `${empresaId}`);
  }
});

// ── Insert ─────────────────────────────────────────────────────────────────

Deno.test("insert: grava user_id e empresa_id da empresa ativa; sem empresa fica null", () => {
  const agora = new Date("2026-10-05T00:30:00Z");
  const dados = { dispositivo_id: "d1", data_compra: "2026-10-04", valor_pago: 900, forma_pagamento: "pix" as const };
  assertEquals(montarDadosInsercaoCompra(dados, { userId: "u1", empresaId: MATRIZ, agora }), {
    ...dados, user_id: "u1", empresa_id: MATRIZ, assinatura_vendedor_data: undefined, assinatura_cliente_data: undefined,
  });
  assertEquals(montarDadosInsercaoCompra(dados, { userId: "u1", empresaId: null, agora }).empresa_id, null);
  assertEquals(montarDadosInsercaoCompra(dados, { userId: "u1", empresaId: undefined, agora }).empresa_id, null);
});

Deno.test("insert: datas de assinatura só quando há assinatura", () => {
  const agora = new Date("2026-10-05T00:30:00Z");
  const r = montarDadosInsercaoCompra({ assinatura_vendedor: "data:img", dispositivo_id: "d1" }, { userId: "u1", empresaId: FILIAL, agora });
  assertEquals(r.assinatura_vendedor_data, "2026-10-05T00:30:00.000Z");
  assertEquals(r.assinatura_cliente_data, undefined);
});

// ── Datas ──────────────────────────────────────────────────────────────────

Deno.test("data da compra nova: 00:30 UTC de 05/10 é 04/10 em Brasília (qualquer fuso da máquina)", () => {
  assertEquals(dataBrasiliaISO(new Date("2026-10-05T00:30:00Z")), "2026-10-04");
  assertEquals(dataBrasiliaISO(new Date("2026-10-05T03:00:00Z")), "2026-10-05");
});

Deno.test(`"2026-10-05" é lido como 05/10 (${FUSO})`, () => {
  const d = parseDate("2026-10-05");
  assertEquals([d.getFullYear(), d.getMonth() + 1, d.getDate()], [2026, 10, 5]);
  assertEquals(formatDate("2026-10-05"), "05/10/2026");
  // O jeito antigo da tela (new Date("AAAA-MM-DD") = meia-noite UTC) erra o dia em fuso negativo.
  const antigo = new Date("2026-10-05");
  if (FUSO === "America/Sao_Paulo") assertEquals(antigo.getDate(), 4);
});

Deno.test("período: bordas inclusivas, por data de calendário (sem fuso)", () => {
  assert(compraNoPeriodo("2026-10-05", "2026-10-05", "2026-10-05"));
  assert(compraNoPeriodo("2026-10-05", "2026-10-01", ""));
  assert(compraNoPeriodo("2026-10-05", "", "2026-10-05"));
  assert(!compraNoPeriodo("2026-10-04", "2026-10-05", ""));
  assert(!compraNoPeriodo("2026-10-06", "", "2026-10-05"));
  assert(compraNoPeriodo("2026-10-05", "", ""));
  assert(compraNoPeriodo("2026-10-05T12:00:00", "2026-10-05", "2026-10-05"));
});

Deno.test("hoje e este mês pela data de Brasília", () => {
  const datas = ["2026-10-04", "2026-10-04", "2026-10-01", "2026-09-30", "2026-11-01"];
  assertEquals(contarHojeEMes(datas, "2026-10-04"), { hoje: 2, esteMes: 3 });
  assertEquals(contarHojeEMes(datas, dataBrasiliaISO(new Date("2026-10-05T00:30:00Z"))), { hoje: 2, esteMes: 3 });
  assertEquals(contarHojeEMes([], "2026-10-04"), { hoje: 0, esteMes: 0 });
});
