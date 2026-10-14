// TZ=UTC deno test --no-check scripts/testes-limite-dispositivos-periodo/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-limite-dispositivos-periodo/
// Roda as funções reais de src/lib/assinatura/limiteDispositivosPeriodo.ts (limite de
// dispositivos que renova a cada período da assinatura, ligado por usuário).
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  cicloQueContem,
  dispositivoContaNoLimite,
  formatarRenovacao,
  periodoLimiteDispositivos,
  textoUsoDispositivos,
  usaLimiteDispositivosPorPeriodo,
} from "../../src/lib/assinatura/limiteDispositivosPeriodo.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

const MARCA = { limite_dispositivos_por_periodo: true };
const iso = (s: string) => new Date(s).toISOString();

/** Conta como o hook: aparelhos do usuário (já criados em `agora`) que entram no limite. */
function contar(ds: { created_at: string; vendido?: boolean; deleted_at?: string | null }[], ass: Parameters<typeof periodoLimiteDispositivos>[0], agora: Date) {
  const periodo = periodoLimiteDispositivos(ass, agora);
  return ds.filter((d) => new Date(d.created_at) <= agora && dispositivoContaNoLimite(d, periodo)).length;
}

// Assinatura mensal paga em 14/09 18:00 (Brasília) → data_fim 14/10 21:00Z; renovada em 14/10 → data_fim 13/11.
const aparelhos = [
  { created_at: "2026-08-20T15:00:00Z" },                                       // período antigo
  { created_at: "2026-09-20T15:00:00Z", vendido: true },                        // período anterior, vendido
  { created_at: "2026-10-01T15:00:00Z", deleted_at: "2026-10-02T10:00:00Z" },   // período anterior, lixeira
  { created_at: "2026-10-14T22:00:00Z" },                                       // período novo
  { created_at: "2026-10-20T12:00:00Z", vendido: true },                        // período novo, vendido
  { created_at: "2026-10-25T12:00:00Z", deleted_at: "2026-10-26T12:00:00Z" },   // período novo, lixeira
];

Deno.test("sem a marca: nada muda (período null, todos contam, texto 'no total')", () => {
  for (const ass of [
    null,
    {},
    { modulos_extras: null, data_fim: iso("2026-11-13T21:00:00Z") },
    { modulos_extras: {}, data_fim: iso("2026-11-13T21:00:00Z") },
    { modulos_extras: { limite_dispositivos_por_periodo: false } },
    { modulos_extras: { limite_dispositivos_por_periodo: "true" } },
    { modulos_extras: { financeiro: true } },
    { modulos_extras: [true] },
  ]) {
    assertEquals(usaLimiteDispositivosPorPeriodo(ass), false);
    assertEquals(periodoLimiteDispositivos(ass, new Date("2026-10-30T12:00:00Z")), null);
    assertEquals(contar(aparelhos, ass, new Date("2026-10-30T12:00:00Z")), aparelhos.length);
  }
  assertEquals(textoUsoDispositivos(null), "utilizados no total");
});

Deno.test("com a marca: só contam os criados no período atual (vendidos e excluídos também)", () => {
  const ass = { modulos_extras: MARCA, data_fim: iso("2026-11-13T21:00:00Z") };
  const agora = new Date("2026-10-30T12:00:00Z");
  const p = periodoLimiteDispositivos(ass, agora)!;
  assertEquals(p.origem, "data_fim");
  assertEquals(p.inicio.toISOString(), "2026-10-14T21:00:00.000Z");
  assertEquals(p.fim.toISOString(), "2026-11-13T21:00:00.000Z");
  assertEquals(contar(aparelhos, ass, agora), 3);
  assertEquals(textoUsoDispositivos(p), "utilizados neste período (renova em 13/11)");
});

Deno.test("renovação passou: o limite zera e aparelhos antigos deixam de contar", () => {
  // Antes da renovação (data_fim ainda 14/10 21:00Z): conta o período de 14/09 a 14/10.
  const antes = { modulos_extras: MARCA, data_fim: iso("2026-10-14T21:00:00Z") };
  assertEquals(contar(aparelhos, antes, new Date("2026-10-14T20:00:00Z")), 2);
  // Webhook renovou: data_fim vai para 13/11. Logo após a renovação nada do período anterior conta.
  const depois = { modulos_extras: MARCA, data_fim: iso("2026-11-13T21:00:00Z") };
  assertEquals(contar(aparelhos, depois, new Date("2026-10-14T21:30:00Z")), 0);
  // E o primeiro aparelho do novo período (14/10 22:00) já conta.
  assertEquals(contar(aparelhos, depois, new Date("2026-10-14T22:30:00Z")), 1);
});

Deno.test("renovação atrasada (data_fim já passou): o ciclo segue de 30 em 30 dias, sem bloquear", () => {
  const ass = { modulos_extras: MARCA, data_fim: iso("2026-10-14T21:00:00Z") };
  const p = periodoLimiteDispositivos(ass, new Date("2026-10-17T12:00:00Z"))!;
  assertEquals(p.inicio.toISOString(), "2026-10-14T21:00:00.000Z");
  assertEquals(p.fim.toISOString(), "2026-11-13T21:00:00.000Z");
});

Deno.test("plano anual: renova a cada 30 dias contados a partir da data_fim", () => {
  const ass = { modulos_extras: MARCA, data_fim: iso("2027-06-30T15:00:00Z") };
  const p = periodoLimiteDispositivos(ass, new Date("2026-10-30T12:00:00Z"))!;
  assert(p.inicio <= new Date("2026-10-30T12:00:00Z") && new Date("2026-10-30T12:00:00Z") < p.fim);
  assertEquals((p.fim.getTime() - p.inicio.getTime()) / 86400000, 30);
  // O fim cai exatamente em data_fim - k*30 dias.
  assertEquals((new Date("2027-06-30T15:00:00Z").getTime() - p.fim.getTime()) % (30 * 86400000), 0);
});

Deno.test("sem data_fim: mês corrido a partir de data_inicio (fallback)", () => {
  const ass = { modulos_extras: MARCA, data_fim: null, data_inicio: iso("2026-09-05T13:00:00Z") };
  const p = periodoLimiteDispositivos(ass, new Date("2026-10-30T12:00:00Z"))!;
  assertEquals(p.origem, "data_inicio");
  assertEquals(p.inicio.toISOString(), "2026-10-05T13:00:00.000Z");
  assertEquals(p.fim.toISOString(), "2026-11-04T13:00:00.000Z");
});

Deno.test("sem datas de período: usa created_at e, sem nada, o mês do calendário em Brasília", () => {
  const p1 = periodoLimiteDispositivos({ modulos_extras: MARCA, created_at: iso("2026-10-01T12:00:00Z") }, new Date("2026-10-30T12:00:00Z"))!;
  assertEquals(p1.origem, "created_at");
  assertEquals(p1.inicio.toISOString(), "2026-10-01T12:00:00.000Z");
  // 31/10 22:00 em Brasília = 01/11 01:00Z: ainda é outubro no calendário de Brasília.
  const p2 = periodoLimiteDispositivos({ modulos_extras: MARCA, data_fim: "data inválida" }, new Date("2026-11-01T01:00:00Z"))!;
  assertEquals(p2.origem, "mes_calendario");
  assertEquals(p2.inicio.toISOString(), "2026-10-01T03:00:00.000Z");
  assertEquals(p2.fim.toISOString(), "2026-11-01T03:00:00.000Z");
  assertEquals(formatarRenovacao(p2), "01/11");
});

Deno.test("bordas: início inclusivo, fim exclusivo; aparelho sem data não conta no período", () => {
  const { inicio, fim } = cicloQueContem(new Date("2026-11-13T21:00:00Z"), new Date("2026-10-14T21:00:00Z"));
  assertEquals(inicio.toISOString(), "2026-10-14T21:00:00.000Z");
  assertEquals(fim.toISOString(), "2026-11-13T21:00:00.000Z");
  const periodo = { inicio, fim, origem: "data_fim" as const };
  assert(dispositivoContaNoLimite({ created_at: "2026-10-14T21:00:00Z" }, periodo));
  assert(!dispositivoContaNoLimite({ created_at: "2026-11-13T21:00:00Z" }, periodo));
  assert(!dispositivoContaNoLimite({ created_at: null }, periodo));
  assert(dispositivoContaNoLimite({ created_at: null }, null));
});

Deno.test("renova em DD/MM no calendário de Brasília (renovação às 01:00Z mostra o dia anterior)", () => {
  const p = { inicio: new Date("2026-10-15T01:00:00Z"), fim: new Date("2026-11-14T01:00:00Z"), origem: "data_fim" as const };
  assertEquals(formatarRenovacao(p), "13/11");
});
