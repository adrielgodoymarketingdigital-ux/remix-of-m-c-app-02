// deno test --no-check scripts/testes-dashboard/
import { assertEquals } from "jsr:@std/assert@1";
import { periodoComparacaoMesAnterior } from "../../src/lib/periodoComparacao.ts";
import { calcularVariacaoPercentual } from "../../src/lib/variacaoPercentual.ts";

const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

Deno.test("mês em andamento compara com os mesmos dias do mês anterior", () => {
  const p = periodoComparacaoMesAnterior(new Date(2026, 10, 1), new Date(2026, 10, 2, 15));
  assertEquals(dia(p.inicio), "2026-10-1");
  assertEquals(dia(p.fim), "2026-10-2");
  assertEquals(p.mesEmAndamento, true);
});

Deno.test("dia que o mês anterior não tem para no último dia dele", () => {
  const p = periodoComparacaoMesAnterior(new Date(2026, 2, 1), new Date(2026, 2, 31, 9));
  assertEquals(dia(p.fim), "2026-2-28");
});

Deno.test("mês fechado compara com o mês anterior inteiro", () => {
  const p = periodoComparacaoMesAnterior(new Date(2026, 8, 1), new Date(2026, 10, 2));
  assertEquals(dia(p.inicio), "2026-8-1");
  assertEquals(dia(p.fim), "2026-8-31");
  assertEquals(p.mesEmAndamento, false);
});

Deno.test("janeiro compara com dezembro do ano anterior", () => {
  const p = periodoComparacaoMesAnterior(new Date(2027, 0, 1), new Date(2027, 0, 15));
  assertEquals(dia(p.inicio), "2026-12-1");
  assertEquals(dia(p.fim), "2026-12-15");
});

Deno.test("variação com base negativa segue o sentido real", () => {
  assertEquals(calcularVariacaoPercentual(150, 100), 50);
  assertEquals(calcularVariacaoPercentual(50, 100), -50);
  assertEquals(calcularVariacaoPercentual(-1000, -500), -100);
  assertEquals(calcularVariacaoPercentual(200, -500), 140);
  assertEquals(calcularVariacaoPercentual(100, 0), 100);
  assertEquals(calcularVariacaoPercentual(-100, 0), 0);
  assertEquals(calcularVariacaoPercentual(0, 0), 0);
});
