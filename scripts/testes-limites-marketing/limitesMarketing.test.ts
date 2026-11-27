// deno test --no-check --allow-read scripts/testes-limites-marketing/
// Módulo "marketing" em LimitesPlano.modulos (src/types/assinatura.ts): a página
// /marketing abre a partir do Profissional; trial e admin com acesso completo.
import { assertEquals } from "jsr:@std/assert@1";
import { LIMITES_POR_PLANO, getLimitesFree, type PlanoTipo } from "../../src/types/assinatura.ts";

const ESPERADO: Record<PlanoTipo, boolean> = {
  demonstracao: false,
  trial: true,
  free: false,
  admin: true,
  basico_mensal: false,
  basico_anual: false,
  intermediario_mensal: false,
  intermediario_anual: false,
  profissional_mensal: true,
  profissional_anual: true,
  profissional_ultra_mensal: true,
  profissional_ultra_anual: true,
};

Deno.test("marketing: Profissional, Ultra, trial e admin liberam; Free, demonstração, Básico e Intermediário não", () => {
  for (const [plano, esperado] of Object.entries(ESPERADO)) {
    assertEquals(LIMITES_POR_PLANO[plano as PlanoTipo].modulos.marketing, esperado, plano);
  }
  assertEquals(Object.keys(LIMITES_POR_PLANO).sort(), Object.keys(ESPERADO).sort());
});

Deno.test("marketing: Free legado (antes do corte) e Free novo bloqueiam", () => {
  assertEquals(getLimitesFree("2025-01-01T00:00:00Z").modulos.marketing, false);
  assertEquals(getLimitesFree("2026-06-01T00:00:00Z").modulos.marketing, false);
  assertEquals(getLimitesFree(undefined).modulos.marketing, false);
});

Deno.test("Ultra herda o marketing do Profissional e só acrescenta o Precificador", () => {
  const pro = LIMITES_POR_PLANO.profissional_mensal.modulos;
  const ultra = LIMITES_POR_PLANO.profissional_ultra_mensal.modulos;
  assertEquals({ ...ultra, precificador: pro.precificador }, pro);
  assertEquals([pro.precificador, ultra.precificador], [false, true]);
});
