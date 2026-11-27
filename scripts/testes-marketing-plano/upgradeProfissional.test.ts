// deno test --no-check --allow-read scripts/testes-marketing-plano/
// Botão "Fazer upgrade para o Profissional" (bloqueio do Marketing):
// período do plano atual -> /plano?highlight=<chave do Profissional>.
import { assertEquals } from "jsr:@std/assert@1";
import { chaveUpgradeProfissional, destinoUpgradeProfissional, periodoDoHighlight } from "../../src/lib/marketing/upgradeProfissional.ts";

Deno.test("plano mensal -> Profissional mensal", () => {
  for (const p of ["basico_mensal", "intermediario_mensal"]) {
    assertEquals(destinoUpgradeProfissional(p), "/plano?highlight=profissional_mensal", p);
  }
});

Deno.test("plano anual -> Profissional anual", () => {
  for (const p of ["basico_anual", "intermediario_anual"]) {
    assertEquals(destinoUpgradeProfissional(p), "/plano?highlight=profissional_anual", p);
  }
});

Deno.test("trial, free, demonstração e sem assinatura -> Profissional mensal", () => {
  for (const p of ["trial", "free", "demonstracao", "", null, undefined]) {
    assertEquals(chaveUpgradeProfissional(p), "profissional_mensal", String(p));
  }
});

Deno.test("a chave bate com o id do cartão em /plano (plan-<chave>) e com o período que a tela abre", () => {
  for (const p of ["basico_mensal", "basico_anual", "free", null]) {
    const chave = chaveUpgradeProfissional(p);
    assertEquals(destinoUpgradeProfissional(p), `/plano?highlight=${chave}`);
    assertEquals(chave.endsWith(`_${periodoDoHighlight(chave)}`), true, chave);
  }
});

Deno.test("periodoDoHighlight: sem highlight ou mensal abre no mensal (como antes); _anual abre no anual", () => {
  assertEquals(periodoDoHighlight(null), "mensal");
  assertEquals(periodoDoHighlight("profissional_mensal"), "mensal");
  assertEquals(periodoDoHighlight("profissional_anual"), "anual");
});
