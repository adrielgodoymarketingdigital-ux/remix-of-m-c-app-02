// deno test --allow-env supabase/functions/cancel-pagarme-subscription/
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { bancoFake, fetchFake } from "../_shared/testes/bancoFake.ts";
import {
  MSG_FALHA_CANCELAMENTO,
  TAMANHO_MAXIMO_MOTIVO,
  cancelarMantendoAcesso,
  limparMotivo,
} from "./cancelarMantendoAcesso.ts";

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

Deno.test("grava o motivo só na assinatura de quem cancelou", async () => {
  const { tabelas, db } = cenario();
  tabelas.assinaturas.push({ id: "a2", user_id: "u2", status: "active", pagarme_subscription_id: null, motivo_cancelamento: "de outro" });

  const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: fetchFake(200).fn, pagarmeKey: "sk" }, "Preço alto");

  assertEquals(r, { ok: true });
  assertEquals(tabelas.assinaturas[0].motivo_cancelamento, "Preço alto");
  assertEquals(tabelas.assinaturas[1].motivo_cancelamento, "de outro");
  assertEquals(tabelas.assinaturas[1].status, "active");
});

Deno.test("sem resposta: não fica o motivo de um cancelamento anterior", async () => {
  const { tabelas, db } = cenario();
  tabelas.assinaturas[0].motivo_cancelamento = "Motivo antigo";
  await cancelarMantendoAcesso(db, "u1", { fetchFn: fetchFake(200).fn, pagarmeKey: "sk" });
  assertEquals(tabelas.assinaturas[0].motivo_cancelamento, null);
});

Deno.test("falha na Pagar.me: não grava motivo", async () => {
  const { tabelas, db } = cenario();
  const r = await cancelarMantendoAcesso(db, "u1", { fetchFn: fetchFake(500).fn, pagarmeKey: "sk" }, "Preço alto");
  assertEquals(r.ok, false);
  assertEquals(tabelas.assinaturas[0].motivo_cancelamento, undefined);
  assertEquals(tabelas.assinaturas[0].status, "active");
});

Deno.test("limparMotivo aceita só texto e limita o tamanho", () => {
  assertEquals(limparMotivo("  Preço alto  "), "Preço alto");
  assertEquals(limparMotivo("   "), null);
  assertEquals(limparMotivo(""), null);
  assertEquals(limparMotivo(undefined), null);
  assertEquals(limparMotivo({ user_id: "u2" }), null);
  assertEquals(limparMotivo("x".repeat(TAMANHO_MAXIMO_MOTIVO + 50))?.length, TAMANHO_MAXIMO_MOTIVO);
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
