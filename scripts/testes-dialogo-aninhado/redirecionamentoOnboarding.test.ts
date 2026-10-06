// deno test --no-check scripts/testes-dialogo-aninhado/
// Roda a função real de src/lib/onboarding/redirecionamentoOnboarding.ts.
// Caso real (out/2026, Android/PWA): no Registrar Nova Compra, "+ Novo
// Dispositivo" cadastrava o aparelho e, para quem ainda não tinha OS, o
// onboarding navegava para /os — a página de compras desmontava e o formulário
// sumia sem erro (a compra nunca era enviada).
import { assertEquals } from "jsr:@std/assert@1";
import { deveIrParaOSAposCadastrarDispositivo } from "../../src/lib/onboarding/redirecionamentoOnboarding.ts";

Deno.test("cadastro aninhado na compra nunca navega, com ou sem OS criada", () => {
  assertEquals(deveIrParaOSAposCadastrarDispositivo(false, false), false);
  assertEquals(deveIrParaOSAposCadastrarDispositivo(true, false), false);
  assertEquals(deveIrParaOSAposCadastrarDispositivo(null, false), false);
  assertEquals(deveIrParaOSAposCadastrarDispositivo(undefined, false), false);
});

Deno.test("tela de Dispositivos (padrão) continua levando para /os quem não criou OS", () => {
  assertEquals(deveIrParaOSAposCadastrarDispositivo(false, true), true);
  assertEquals(deveIrParaOSAposCadastrarDispositivo(true, true), false);
});

Deno.test("sem linha de onboarding conta como OS não criada", () => {
  assertEquals(deveIrParaOSAposCadastrarDispositivo(null, true), true);
  assertEquals(deveIrParaOSAposCadastrarDispositivo(undefined, true), true);
});
