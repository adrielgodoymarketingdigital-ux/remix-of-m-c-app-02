// TZ=UTC deno test --no-check scripts/testes-campo-quantidade/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-campo-quantidade/
// Roda as funções reais de src/lib/dispositivos/campoQuantidade.ts. O teste de componente
// (campo na tela) é o run.sh desta pasta.
import { assertEquals } from "jsr:@std/assert@1";
import { normalizarQuantidade, quantidadeAoDigitar, somenteDigitos } from "../../src/lib/dispositivos/campoQuantidade.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

Deno.test("só dígitos inteiros", () => {
  assertEquals(somenteDigitos("2a,-5"), "25");
  assertEquals(somenteDigitos(" 4 un"), "4");
  assertEquals(somenteDigitos("1.5"), "15");
  assertEquals(somenteDigitos("-3"), "3");
  assertEquals(somenteDigitos(""), "");
});

Deno.test("confirmar: vazio, 0 e inválido viram 1; respeita máximo se houver", () => {
  assertEquals(normalizarQuantidade(""), 1);
  assertEquals(normalizarQuantidade("0"), 1);
  assertEquals(normalizarQuantidade("00"), 1);
  assertEquals(normalizarQuantidade("abc"), 1);
  assertEquals(normalizarQuantidade("007"), 7);
  assertEquals(normalizarQuantidade("12"), 12);
  assertEquals(normalizarQuantidade("50", 20), 20);
});

Deno.test("ao digitar: só aplica na hora quando aumenta", () => {
  assertEquals(quantidadeAoDigitar("", 3), null);      // apagou: espera, unidades ficam
  assertEquals(quantidadeAoDigitar("2", 3), null);     // diminuir: só ao confirmar
  assertEquals(quantidadeAoDigitar("3", 3), null);     // igual
  assertEquals(quantidadeAoDigitar("25", 3), 25);      // aumentar: na hora
  assertEquals(quantidadeAoDigitar("5", 1), 5);
  assertEquals(quantidadeAoDigitar("0", 1), null);
  assertEquals(quantidadeAoDigitar("99", 1, 10), 10);
});
