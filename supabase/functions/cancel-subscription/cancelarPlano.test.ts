// deno test --allow-env supabase/functions/cancel-subscription/
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { bancoFake, fetchFake } from "../_shared/testes/bancoFake.ts";
import { MSG_FALHA_CANCELAMENTO, cancelarPlanoParaFree } from "./cancelarPlano.ts";

const USER = { id: "u1", email: "cliente@teste.com" };

function cenario() {
  const tabelas: Record<string, Record<string, unknown>[]> = {
    assinaturas: [{
      id: "a1",
      user_id: "u1",
      plano_tipo: "intermediario_mensal",
      status: "active",
      payment_provider: "pagarme",
      pagarme_subscription_id: "sub_X",
      trial_with_card: false,
    }],
    admin_notifications: [],
  };
  return { tabelas, db: bancoFake(tabelas) };
}

Deno.test("DELETE com sucesso: vai para o free e limpa o id", async () => {
  const { tabelas, db } = cenario();
  const api = fetchFake(200);

  const r = await cancelarPlanoParaFree(db, USER, { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(r.success, true);
  assertEquals(api.chamadas, [{ url: "https://api.pagar.me/core/v5/subscriptions/sub_X", method: "DELETE" }]);
  assertEquals(tabelas.assinaturas[0].plano_tipo, "free");
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, null);
  assertEquals(tabelas.admin_notifications[0].tipo, "cancelamento");
});

Deno.test("404 (já cancelada na Pagar.me): segue como sucesso", async () => {
  const { tabelas, db } = cenario();
  const r = await cancelarPlanoParaFree(db, USER, { fetchFn: fetchFake(404).fn, pagarmeKey: "sk" });
  assertEquals(r.success, true);
  assertEquals(tabelas.assinaturas[0].plano_tipo, "free");
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, null);
});

for (const [nome, resposta, chave] of [
  ["API recusou (500)", 500, "sk"],
  ["erro de rede", new Error("conexão recusada"), "sk"],
  ["sem PAGARME_SECRET_KEY", 200, undefined],
] as const) {
  Deno.test(`${nome}: não muda plano nem id, devolve erro claro e avisa o admin`, async () => {
    const { tabelas, db } = cenario();
    const api = fetchFake(resposta);

    const r = await cancelarPlanoParaFree(db, USER, { fetchFn: api.fn, pagarmeKey: chave });

    assertEquals(r, { success: false, error: MSG_FALHA_CANCELAMENTO, message: MSG_FALHA_CANCELAMENTO });
    assertEquals(tabelas.assinaturas[0].plano_tipo, "intermediario_mensal");
    assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, "sub_X");
    assertEquals(tabelas.admin_notifications.length, 1);
    const aviso = tabelas.admin_notifications[0];
    assertEquals(aviso.tipo, "cancelamento_pagarme_falhou");
    assertEquals((aviso.dados as Record<string, unknown>).user_id, "u1");
    assertEquals((aviso.dados as Record<string, unknown>).subscription_id, "sub_X");
    assertStringIncludes(aviso.mensagem as string, "sub_X");
    if (chave === undefined) assertEquals(api.chamadas.length, 0);
  });
}

Deno.test("sem assinatura na Pagar.me (PIX/manual): cancela só localmente, sem chamar a API", async () => {
  const { tabelas, db } = cenario();
  tabelas.assinaturas[0].pagarme_subscription_id = null;
  const api = fetchFake(500);

  const r = await cancelarPlanoParaFree(db, USER, { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(r.success, true);
  assertEquals(api.chamadas.length, 0);
  assertEquals(tabelas.assinaturas[0].plano_tipo, "free");
});
