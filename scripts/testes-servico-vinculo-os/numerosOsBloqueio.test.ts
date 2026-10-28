// deno test --no-check scripts/testes-servico-vinculo-os/
import { assertEquals } from "jsr:@std/assert@1";
import { resumirNumerosOs } from "../../src/lib/servicos/numerosOsBloqueio.ts";

Deno.test("ordem numérica, sem repetir, sem vazio", () => {
  assertEquals(resumirNumerosOs(["120", "9", "101", "9", " ", "1000"]), { lista: "9, 101, 120, 1000", restantes: 0 });
});

Deno.test("até 10 números e quantos ficaram de fora", () => {
  const numeros = Array.from({ length: 13 }, (_, i) => String(200 - i));
  assertEquals(resumirNumerosOs(numeros), { lista: "188, 189, 190, 191, 192, 193, 194, 195, 196, 197", restantes: 3 });
  assertEquals(resumirNumerosOs(numeros.slice(0, 10)).restantes, 0);
});

Deno.test("lista vazia", () => {
  assertEquals(resumirNumerosOs([]), { lista: "", restantes: 0 });
});
