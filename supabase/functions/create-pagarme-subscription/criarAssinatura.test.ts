// deno test --allow-env supabase/functions/create-pagarme-subscription/
import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { bancoFake } from "../_shared/testes/bancoFake.ts";
import { criarEGravarAssinatura } from "./criarAssinatura.ts";

type Linha = Record<string, unknown>;

function cenario(anterior: string | null, falharGravacao = false) {
  const tabelas: Record<string, Linha[]> = {
    assinaturas: [{
      id: "a1",
      user_id: "u1",
      plano_tipo: "basico_mensal",
      status: "active",
      payment_method: "credit_card",
      pagarme_subscription_id: anterior,
    }],
    admin_notifications: [],
  };
  const db = bancoFake(tabelas, (tabela, op, payload) =>
    falharGravacao && tabela === "assinaturas" && op === "update" && "plano_tipo" in payload ? "timeout no banco" : null
  );
  return { tabelas, db };
}

/** Pagar.me falsa: POST /subscriptions responde `criacao`; DELETE responde `cancelamento`. */
function pagarme(criacao: { status: number; body: Linha }, cancelamento: number) {
  const chamadas: { method: string; url: string; idNoBanco?: unknown }[] = [];
  let tabelas: Record<string, Linha[]> | null = null;
  const fn = ((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    chamadas.push({ method, url, idNoBanco: tabelas?.assinaturas[0].pagarme_subscription_id });
    if (method === "POST") return Promise.resolve(new Response(JSON.stringify(criacao.body), { status: criacao.status }));
    return Promise.resolve(new Response('{"message":"x"}', { status: cancelamento }));
  }) as typeof fetch;
  return { fn, chamadas, observar: (t: Record<string, Linha[]>) => (tabelas = t) };
}

const APROVADA = { status: 200, body: { id: "sub_NOVA", status: "active", current_charge: { status: "paid" } } };
const PARAMS = {
  userId: "u1",
  plano: "intermediario_mensal",
  customerId: "cus_1",
  subscriptionPayload: { plan_id: "plan_x" },
};

Deno.test("upgrade: grava o id novo e depois cancela a assinatura anterior", async () => {
  const { tabelas, db } = cenario("sub_ANTIGA");
  const api = pagarme(APROVADA, 200);
  api.observar(tabelas);

  const r = await criarEGravarAssinatura(db, { ...PARAMS, subscriptionIdAnterior: "sub_ANTIGA" }, { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(r.paymentApproved, true);
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, "sub_NOVA");
  assertEquals(tabelas.assinaturas[0].plano_tipo, "intermediario_mensal");
  // O DELETE da antiga acontece com o id NOVO já no banco (o subscription.canceled não acha a linha).
  assertEquals(api.chamadas.map((c) => [c.method, c.url, c.idNoBanco]), [
    ["POST", "https://api.pagar.me/core/v5/subscriptions", "sub_ANTIGA"],
    ["DELETE", "https://api.pagar.me/core/v5/subscriptions/sub_ANTIGA", "sub_NOVA"],
  ]);
  assertEquals(tabelas.admin_notifications.length, 0);
});

Deno.test("upgrade com falha ao cancelar a anterior: avisa o admin e segue", async () => {
  const { tabelas, db } = cenario("sub_ANTIGA");
  const api = pagarme(APROVADA, 500);

  const r = await criarEGravarAssinatura(db, { ...PARAMS, subscriptionIdAnterior: "sub_ANTIGA" }, { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(r.subData.id, "sub_NOVA");
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, "sub_NOVA");
  const [aviso] = tabelas.admin_notifications;
  assertEquals(aviso.tipo, "cancelamento_cartao_falhou");
  assertStringIncludes(aviso.titulo as string, "Upgrade no cartão");
  assertStringIncludes(aviso.mensagem as string, "sub_ANTIGA");
});

Deno.test("criação recusada pela API: lança e não muda nada no banco nem cancela a anterior", async () => {
  const { tabelas, db } = cenario("sub_ANTIGA");
  const api = pagarme({ status: 422, body: { message: "Cartão inválido" } }, 200);
  const antes = structuredClone(tabelas);

  await assertRejects(
    () => criarEGravarAssinatura(db, { ...PARAMS, subscriptionIdAnterior: "sub_ANTIGA" }, { fetchFn: api.fn, pagarmeKey: "sk" }),
    Error,
    "Cartão inválido",
  );
  assertEquals(tabelas, antes);
  assertEquals(api.chamadas.map((c) => c.method), ["POST"]);
});

Deno.test("primeira cobrança recusada: lança e não muda nada no banco", async () => {
  const { tabelas, db } = cenario("sub_ANTIGA");
  const recusada = { status: 200, body: { id: "sub_NOVA", status: "failed", current_charge: { status: "failed", last_transaction: { status: "not_authorized", acquirer_message: "Saldo insuficiente" } } } };
  const api = pagarme(recusada, 200);
  const antes = structuredClone(tabelas);

  await assertRejects(
    () => criarEGravarAssinatura(db, { ...PARAMS, subscriptionIdAnterior: "sub_ANTIGA" }, { fetchFn: api.fn, pagarmeKey: "sk" }),
    Error,
    "Saldo insuficiente",
  );
  assertEquals(tabelas, antes);
});

Deno.test("id novo não gravado no banco: NÃO cancela a anterior e avisa o admin com os dois ids", async () => {
  const { tabelas, db } = cenario("sub_ANTIGA", true);
  const api = pagarme(APROVADA, 200);

  await criarEGravarAssinatura(db, { ...PARAMS, subscriptionIdAnterior: "sub_ANTIGA" }, { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(api.chamadas.map((c) => c.method), ["POST"]);
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, "sub_ANTIGA");
  const [aviso] = tabelas.admin_notifications;
  assertEquals(aviso.tipo, "cancelamento_cartao_falhou");
  assertStringIncludes(aviso.mensagem as string, "sub_NOVA");
  assertStringIncludes(aviso.mensagem as string, "sub_ANTIGA");
});

Deno.test("primeira assinatura (sem anterior): não chama DELETE", async () => {
  const { tabelas, db } = cenario(null);
  const api = pagarme(APROVADA, 200);

  await criarEGravarAssinatura(db, { ...PARAMS, subscriptionIdAnterior: null }, { fetchFn: api.fn, pagarmeKey: "sk" });

  assertEquals(api.chamadas.map((c) => c.method), ["POST"]);
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, "sub_NOVA");
});
