// deno test --allow-env supabase/functions/cancel-pagarme-subscription/
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { bancoFake, fetchFake } from "../_shared/testes/bancoFake.ts";
import { MSG_FALHA_CANCELAMENTO, cancelarMantendoAcesso } from "./cancelarMantendoAcesso.ts";

type Linha = Record<string, unknown>;

function cenario(falhar?: (tabela: string, op: string, payload: Linha) => string | null) {
  const tabelas: Record<string, Linha[]> = {
    assinaturas: [{
      id: "a1",
      user_id: "u1",
      plano_tipo: "intermediario_mensal",
      status: "active",
      pagarme_subscription_id: "sub_X",
    }],
    admin_notifications: [],
  };
  return { tabelas, db: bancoFake(tabelas, falhar) };
}

Deno.test("limpa o id ANTES do DELETE e marca canceled", async () => {
  const { tabelas, db } = cenario();
  const idNaHoraDoDelete: unknown[] = [];
  const api = fetchFake(200, () => idNaHoraDoDelete.push(tabelas.assinaturas[0].pagarme_subscription_id));

  const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(r, { ok: true });
  assertEquals(api.chamadas, [{ url: "https://api.pagar.me/core/v5/subscriptions/sub_X", method: "DELETE" }]);
  assertEquals(idNaHoraDoDelete, [null]);
  assertEquals(tabelas.assinaturas[0].status, "canceled");
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, null);
});

Deno.test("404 (já cancelada na Pagar.me): conclui como sucesso", async () => {
  const { tabelas, db } = cenario();
  const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: fetchFake(404).fn, pagarmeKey: "sk" });
  assertEquals(r, { ok: true });
  assertEquals(tabelas.assinaturas[0].status, "canceled");
});

for (const [nome, resposta, chave] of [
  ["API recusou (500)", 500, "sk"],
  ["erro de rede", new Error("timeout"), "sk"],
  ["sem PAGARME_SECRET_KEY", 200, undefined],
] as const) {
  Deno.test(`${nome}: restaura o id, não marca canceled e devolve erro`, async () => {
    const { tabelas, db } = cenario();

    const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: fetchFake(resposta).fn, pagarmeKey: chave });

    assertEquals(r, { ok: false, httpStatus: 502, erro: MSG_FALHA_CANCELAMENTO });
    assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, "sub_X");
    assertEquals(tabelas.assinaturas[0].status, "active");
    assertEquals(tabelas.admin_notifications.length, 0);
  });
}

Deno.test("DELETE falhou e o id não pôde ser restaurado: avisa o admin", async () => {
  const { tabelas, db } = cenario((tabela, op, payload) =>
    tabela === "assinaturas" && op === "update" && payload.pagarme_subscription_id === "sub_X" ? "banco indisponível" : null
  );

  const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: fetchFake(500).fn, pagarmeKey: "sk" });

  assertEquals(r.ok, false);
  const [aviso] = tabelas.admin_notifications;
  assertEquals(aviso.tipo, "cancelamento_pagarme_falhou");
  assertStringIncludes(aviso.mensagem as string, "sub_X");
  assertEquals((aviso.dados as Linha).user_id, "u1");
});

Deno.test("não conseguiu limpar o id: não chama a API e devolve erro", async () => {
  const { tabelas, db } = cenario((tabela, op, payload) =>
    tabela === "assinaturas" && op === "update" && payload.pagarme_subscription_id === null ? "banco indisponível" : null
  );
  const api = fetchFake(200);

  const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(r, { ok: false, httpStatus: 500, erro: MSG_FALHA_CANCELAMENTO });
  assertEquals(api.chamadas.length, 0);
  assertEquals(tabelas.assinaturas[0].status, "active");
});

Deno.test("sem assinatura na Pagar.me (PIX): só marca canceled, sem chamar a API", async () => {
  const { tabelas, db } = cenario();
  tabelas.assinaturas[0].pagarme_subscription_id = null;
  const api = fetchFake(500);

  const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(r, { ok: true });
  assertEquals(api.chamadas.length, 0);
  assertEquals(tabelas.assinaturas[0].status, "canceled");
});
