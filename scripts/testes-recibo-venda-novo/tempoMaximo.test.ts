// deno test --no-check scripts/testes-recibo-venda-novo/
// Tempo máximo do recibo novo: esgotou → valor de reserva (o diálogo cai no recibo antigo).
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { comTempoMaximo, TEMPO_MAXIMO_RECIBO_NOVO_MS } from "../../src/lib/tempoMaximo.ts";

const nunca = <T>() => new Promise<T>(() => {});
const depois = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

Deno.test("termina antes do limite: devolve o valor", async () => {
  assertEquals(await comTempoMaximo(depois(5, "kit"), 200, () => null), "kit");
});

Deno.test("nunca termina: devolve a reserva no limite", async () => {
  let esgotou = 0;
  const inicio = Date.now();
  assertEquals(await comTempoMaximo(nunca<string | null>(), 50, () => (esgotou++, null)), null);
  assertEquals(esgotou, 1);
  assertEquals(Date.now() - inicio >= 45, true);
});

Deno.test("erro continua sendo erro (quem chama já cai no recibo antigo)", async () => {
  await assertRejects(() => comTempoMaximo(Promise.reject(new Error("chunk")), 200, () => null), Error, "chunk");
});

Deno.test("terminou a tempo: a reserva não é chamada e o timer é limpo", async () => {
  let esgotou = 0;
  assertEquals(await comTempoMaximo(Promise.resolve(1), 30, () => (esgotou++, 0)), 1);
  await depois(60, null);
  assertEquals(esgotou, 0);
});

Deno.test("limite do recibo novo é ~8s", () => {
  assertEquals(TEMPO_MAXIMO_RECIBO_NOVO_MS, 8000);
});
