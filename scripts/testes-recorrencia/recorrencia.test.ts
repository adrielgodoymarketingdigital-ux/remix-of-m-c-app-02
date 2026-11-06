// TZ=America/Sao_Paulo deno test --no-check --no-lock scripts/testes-recorrencia/
// (também rodar com TZ=UTC: o resultado não pode depender do fuso)
import { assertEquals } from "jsr:@std/assert@1";
import { proximaDataRecorrente as prox } from "../../src/lib/contas/recorrencia.ts";

Deno.test("mantém o dia no mês seguinte (não recua 1 dia no fuso do Brasil)", () => {
  assertEquals(prox("2026-11-20").data, "2026-12-20");
  assertEquals(prox("2026-11-01").data, "2026-12-01");
  assertEquals(prox("2026-03-15").data, "2026-04-15");
});

Deno.test("aceita timestamp e usa só a data", () => {
  assertEquals(prox("2026-11-20T00:00:00+00:00").data, "2026-12-20");
});

Deno.test("dezembro vira janeiro do ano seguinte", () => {
  assertEquals(prox("2026-12-31").data, "2027-01-31");
  assertEquals(prox("2026-12-05").ano, 2027);
});

Deno.test("dia que não existe no mês seguinte usa o último dia (não pula o mês)", () => {
  assertEquals(prox("2027-01-31").data, "2027-02-28");
  assertEquals(prox("2028-01-31").data, "2028-02-29"); // bissexto
  assertEquals(prox("2027-01-30").data, "2027-02-28");
  assertEquals(prox("2026-03-31").data, "2026-04-30");
  assertEquals(prox("2026-08-31").data, "2026-09-30");
});

Deno.test("diaAnterior = onde o código antigo teria gerado (para não duplicar)", () => {
  assertEquals(prox("2026-11-20"), { data: "2026-12-20", diaAnterior: "2026-12-19", ano: 2026, mes: 12 });
  assertEquals(prox("2026-11-01").diaAnterior, "2026-11-30"); // vira o mês para trás
  assertEquals(prox("2026-12-01").diaAnterior, "2026-12-31");
  assertEquals(prox("2027-01-31").diaAnterior, "2027-02-27");
});

Deno.test("12 meses seguidos a partir do dia 20 continuam no dia 20", () => {
  let d = "2026-01-20";
  for (let i = 0; i < 12; i++) d = prox(d).data;
  assertEquals(d, "2027-01-20");
});
