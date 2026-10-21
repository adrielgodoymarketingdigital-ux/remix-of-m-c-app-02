// deno test --no-check --allow-read scripts/testes-marketing-cadastros/
// Painel Marketing (src/lib/marketing/cadastrosPorDia.ts): período em datas de
// Brasília, período anterior de mesmo tamanho, dias sem cadastro preenchidos
// com zero (a RPC admin_mkt_cadastros_por_dia não devolve esses dias) e
// variação % sem divisão por zero.
import { assertEquals } from "jsr:@std/assert@1";
import {
  calcularPeriodos,
  calcularVariacao,
  diasNoIntervalo,
  formatarVariacao,
  percentual,
  preencherDias,
  somarTotais,
} from "../../src/lib/marketing/cadastrosPorDia.ts";

Deno.test("últimos 7 dias termina hoje e o anterior são os 7 dias antes", () => {
  assertEquals(calcularPeriodos("7d", "2026-10-21"), {
    atual: { inicio: "2026-10-15", fim: "2026-10-21" },
    anterior: { inicio: "2026-10-08", fim: "2026-10-14" },
  });
});

Deno.test("últimos 14 e 30 dias têm o tamanho certo, inclusive cruzando mês", () => {
  const p14 = calcularPeriodos("14d", "2026-10-05");
  assertEquals(p14.atual, { inicio: "2026-09-22", fim: "2026-10-05" });
  assertEquals(p14.anterior, { inicio: "2026-09-08", fim: "2026-09-21" });
  const p30 = calcularPeriodos("30d", "2026-10-21");
  assertEquals(diasNoIntervalo(p30.atual), 30);
  assertEquals(diasNoIntervalo(p30.anterior), 30);
  assertEquals(p30.anterior.fim, "2026-09-21");
});

Deno.test("este mês vai do dia 1 até hoje; anterior com o mesmo número de dias", () => {
  assertEquals(calcularPeriodos("mes", "2026-10-21"), {
    atual: { inicio: "2026-10-01", fim: "2026-10-21" },
    anterior: { inicio: "2026-09-10", fim: "2026-09-30" },
  });
  // Dia 1: período de 1 dia, comparado com o último dia do mês anterior.
  assertEquals(calcularPeriodos("mes", "2026-03-01"), {
    atual: { inicio: "2026-03-01", fim: "2026-03-01" },
    anterior: { inicio: "2026-02-28", fim: "2026-02-28" },
  });
});

Deno.test("virada de ano", () => {
  assertEquals(calcularPeriodos("7d", "2027-01-03").atual, { inicio: "2026-12-28", fim: "2027-01-03" });
});

Deno.test("preencherDias completa com zero os dias que a RPC não devolveu", () => {
  const dias = preencherDias(
    [
      { dia: "2026-10-02", cadastros: 5, com_utm: 2, meta: 1 },
      { dia: "2026-10-04", cadastros: "3", com_utm: "0", meta: "3" }, // bigint como string
    ],
    { inicio: "2026-10-01", fim: "2026-10-05" },
  );
  assertEquals(dias, [
    { dia: "2026-10-01", cadastros: 0, com_utm: 0, meta: 0 },
    { dia: "2026-10-02", cadastros: 5, com_utm: 2, meta: 1 },
    { dia: "2026-10-03", cadastros: 0, com_utm: 0, meta: 0 },
    { dia: "2026-10-04", cadastros: 3, com_utm: 0, meta: 3 },
    { dia: "2026-10-05", cadastros: 0, com_utm: 0, meta: 0 },
  ]);
});

Deno.test("preencherDias ignora linhas fora do intervalo e aceita resposta vazia", () => {
  const dias = preencherDias([{ dia: "2026-09-30", cadastros: 9, com_utm: 9, meta: 9 }], { inicio: "2026-10-01", fim: "2026-10-02" });
  assertEquals(somarTotais(dias), { cadastros: 0, com_utm: 0, meta: 0 });
  assertEquals(preencherDias([], { inicio: "2026-10-01", fim: "2026-10-03" }).length, 3);
});

Deno.test("somarTotais soma as três colunas", () => {
  const dias = preencherDias(
    [
      { dia: "2026-10-01", cadastros: 4, com_utm: 1, meta: 1 },
      { dia: "2026-10-02", cadastros: 6, com_utm: 3, meta: 2 },
    ],
    { inicio: "2026-10-01", fim: "2026-10-02" },
  );
  assertEquals(somarTotais(dias), { cadastros: 10, com_utm: 4, meta: 3 });
});

Deno.test("variação: percentual, novo (anterior zero) e — (ambos zero)", () => {
  assertEquals(calcularVariacao(15, 10), { tipo: "percentual", valor: 50 });
  assertEquals(calcularVariacao(5, 10), { tipo: "percentual", valor: -50 });
  assertEquals(calcularVariacao(7, 0), { tipo: "novo" });
  assertEquals(calcularVariacao(0, 0), { tipo: "sem_dados" });
  assertEquals(calcularVariacao(0, 4), { tipo: "percentual", valor: -100 });
});

Deno.test("formatarVariacao", () => {
  assertEquals(formatarVariacao(calcularVariacao(15, 10)), "+50%");
  assertEquals(formatarVariacao(calcularVariacao(2, 3)), "-33%");
  assertEquals(formatarVariacao(calcularVariacao(10, 10)), "0%");
  assertEquals(formatarVariacao(calcularVariacao(1, 0)), "novo");
  assertEquals(formatarVariacao(calcularVariacao(0, 0)), "—");
});

Deno.test("percentual sobre o total não divide por zero", () => {
  assertEquals(percentual(1, 4), 25);
  assertEquals(percentual(0, 0), 0);
});
