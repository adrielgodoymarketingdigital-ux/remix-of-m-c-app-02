// deno test --no-check scripts/testes-plano-vencido/
// "Plano vencido" (src/lib/planoVencido.ts): free que já foi pagante. Caso real
// (out/2026): cliente regravado como free via cancelamento continuava vendo
// "plano Free / faça upgrade" em vez de "seu plano venceu, renove".
import { assertEquals } from "jsr:@std/assert@1";
import { nomePlanoAmigavel, planoVencido, rotuloPlano, textoRenovarPlano } from "../../src/lib/planoVencido.ts";

Deno.test("textos: com e sem nome do plano anterior", () => {
  assertEquals(textoRenovarPlano("Profissional"), "Renove agora para voltar a usar todos os recursos do plano Profissional.");
  assertEquals(textoRenovarPlano(), "Renove agora para voltar a usar todos os recursos.");
  assertEquals(rotuloPlano("Básico"), "plano Básico");
  assertEquals(rotuloPlano(), "plano");
});

const AGORA = new Date("2026-10-19T15:00:00Z");

Deno.test("nunca pagou (cadastro gratuito): não é vencido", () => {
  assertEquals(planoVencido({ plano_tipo: "free", data_fim: null, payment_provider: null }, AGORA), { vencido: false });
});

Deno.test("teste de 24h (ativo ou acabou): não é vencido", () => {
  assertEquals(planoVencido({ plano_tipo: "free", data_fim: null, payment_provider: null }, AGORA).vencido, false);
  // fim do teste pelo DialogFreeTrialExpirado: trial_canceled, free_trial_ends_at zerado, sem data_fim/gateway
  assertEquals(planoVencido({ plano_tipo: "free", data_fim: null } as never, AGORA).vencido, false);
});

Deno.test("free com data_fim e provedor (heurística): vencido, sem nome do plano", () => {
  const r = planoVencido({ plano_tipo: "free", data_fim: "2026-08-10T12:00:00Z", payment_provider: "ticto" }, AGORA);
  assertEquals(r, { vencido: true, vencidoEm: "2026-08-10T12:00:00Z" });
});

Deno.test("free com data_fim e só id de gateway (sem provedor): vencido", () => {
  for (const campo of ["pagarme_customer_id", "pagarme_subscription_id", "pagarme_card_id", "stripe_customer_id", "stripe_subscription_id", "ticto_order_id"]) {
    const r = planoVencido({ plano_tipo: "free", data_fim: "2026-08-10T12:00:00Z", [campo]: "x_123" }, AGORA);
    assertEquals(r.vencido, true, campo);
  }
});

Deno.test("free com data_fim mas sem provedor nem gateway: não é vencido", () => {
  assertEquals(planoVencido({ plano_tipo: "free", data_fim: "2026-08-10T12:00:00Z", payment_provider: "" }, AGORA).vencido, false);
});

Deno.test("free com provedor mas sem data_fim: não é vencido", () => {
  assertEquals(planoVencido({ plano_tipo: "free", data_fim: null, payment_provider: "pagarme" }, AGORA).vencido, false);
});

Deno.test("free com plano_anterior (coluna nova): vencido com nome amigável", () => {
  const r = planoVencido({ plano_tipo: "free", plano_anterior: "profissional_mensal", plano_vencido_em: "2026-09-01T12:00:00Z" }, AGORA);
  assertEquals(r, { vencido: true, planoAnterior: "Profissional", vencidoEm: "2026-09-01T12:00:00Z" });
});

Deno.test("plano_anterior desconhecido: vencido, sem nome", () => {
  const r = planoVencido({ plano_tipo: "free", plano_anterior: "plano_inexistente", data_fim: "2026-09-01T12:00:00Z" }, AGORA);
  assertEquals(r, { vencido: true, planoAnterior: undefined, vencidoEm: "2026-09-01T12:00:00Z" });
});

Deno.test("plano pago ativo: não é vencido (segue a lógica atual)", () => {
  assertEquals(planoVencido({ plano_tipo: "profissional_mensal", data_fim: "2026-11-01T12:00:00Z", payment_provider: "pagarme" }, AGORA).vencido, false);
});

Deno.test("past_due em carência (plano pago): não é vencido aqui", () => {
  assertEquals(planoVencido({ plano_tipo: "intermediario_mensal", data_fim: "2026-10-18T12:00:00Z", payment_provider: "pagarme" }, AGORA).vencido, false);
});

Deno.test("canceled com plano pago: não é vencido aqui (bloqueio atual cuida)", () => {
  assertEquals(planoVencido({ plano_tipo: "basico_mensal", data_fim: "2026-08-01T12:00:00Z", payment_provider: "pagarme" }, AGORA).vencido, false);
});

Deno.test("liberação do admin: em andamento não é vencido; free_limpo depois também não", () => {
  assertEquals(planoVencido({ plano_tipo: "free", data_fim: "2026-10-30T12:00:00Z", payment_provider: "pagarme", liberacao_temp_id: "lib_1" }, AGORA).vencido, false);
  // reverter-liberacao modo free_limpo: data_fim null
  assertEquals(planoVencido({ plano_tipo: "free", data_fim: null, payment_provider: "pagarme" }, AGORA).vencido, false);
});

Deno.test("sem assinatura / outros planos (trial, demonstracao, admin): não é vencido", () => {
  assertEquals(planoVencido(null, AGORA).vencido, false);
  for (const plano_tipo of ["trial", "demonstracao", "admin"]) {
    assertEquals(planoVencido({ plano_tipo, data_fim: "2026-08-01T12:00:00Z", payment_provider: "pagarme" }, AGORA).vencido, false, plano_tipo);
  }
});

Deno.test("colunas novas ausentes (linha antiga do banco): heurística funciona e nada quebra", () => {
  // linha como vem hoje de select("*"), sem plano_anterior/plano_vencido_em
  const linhaAntiga: Record<string, unknown> = { plano_tipo: "free", status: "active", data_fim: "2026-07-01T12:00:00Z", payment_provider: "ticto", ticto_order_id: "TO_1" };
  assertEquals("plano_anterior" in linhaAntiga, false);
  assertEquals(planoVencido(linhaAntiga, AGORA), { vencido: true, vencidoEm: "2026-07-01T12:00:00Z" });
});

Deno.test("nomePlanoAmigavel", () => {
  assertEquals(nomePlanoAmigavel("profissional_ultra_anual"), "Profissional Ultra");
  assertEquals(nomePlanoAmigavel("free"), undefined);
  assertEquals(nomePlanoAmigavel(null), undefined);
});
