// deno test --no-check scripts/testes-dashboard/
import { assertEquals } from "jsr:@std/assert@1";
import { calcularVariacaoPercentual } from "../../src/lib/variacaoPercentual.ts";

Deno.test("variação com base negativa segue o sentido real", () => {
  assertEquals(calcularVariacaoPercentual(150, 100), 50);
  assertEquals(calcularVariacaoPercentual(50, 100), -50);
  assertEquals(calcularVariacaoPercentual(-1000, -500), -100);
  assertEquals(calcularVariacaoPercentual(200, -500), 140);
  assertEquals(calcularVariacaoPercentual(100, 0), 100);
  assertEquals(calcularVariacaoPercentual(-100, 0), 0);
  assertEquals(calcularVariacaoPercentual(0, 0), 0);
});
