// deno test --allow-env supabase/functions/pagarme-webhook/
// Eventos chegam ao processarEvento como viriam do index.ts (já autenticados);
// a "Pagar.me" é um fetch falso que responde às consultas GET pelo caminho.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { bancoFake } from "../_shared/testes/bancoFake.ts";
import { processarEvento } from "./processarEvento.ts";

type Linha = Record<string, unknown>;

const AGORA = new Date("2026-10-04T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

Deno.env.set("SUPABASE_URL", "http://supabase.teste");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "teste");

/** Pagar.me falsa: GET /{colecao}/{id} → objeto (ou status de erro). O resto (dispatch, n8n) responde 200. */
function pagarme(objetos: Record<string, Linha | number | Error>) {
  const consultas: string[] = [];
  const fn = ((url: string) => {
    if (!url.startsWith("https://api.pagar.me/")) return Promise.resolve(new Response("{}"));
    const caminho = url.replace("https://api.pagar.me/core/v5/", "");
    consultas.push(caminho);
    const r = objetos[caminho];
    if (r instanceof Error) return Promise.reject(r);
    if (typeof r === "number") return Promise.resolve(new Response('{"message":"x"}', { status: r }));
    if (!r) return Promise.resolve(new Response('{"message":"not found"}', { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(r)));
  }) as typeof fetch;
  return { fn, consultas };
}

/** Roda o evento com o fetch global trocado (dispatch-event/n8n também usam fetch). */
async function processar(body: Linha, db: unknown, api: ReturnType<typeof pagarme>) {
  const original = globalThis.fetch;
  globalThis.fetch = api.fn;
  try {
    const res = await processarEvento(body, db, { fetchFn: api.fn, pagarmeKey: "sk", agora: AGORA });
    return { status: res.status, json: await res.json() };
  } finally {
    globalThis.fetch = original;
  }
}

/** u1: ex-assinante com plano pago vencido (alvo de quem forja evento para si mesmo). */
function banco(extra: Partial<Record<string, Linha[]>> = {}) {
  const tabelas: Record<string, Linha[]> = {
    assinaturas: [
      { id: "a1", user_id: "u1", plano_tipo: "intermediario_mensal", status: "canceled", payment_method: "pix", pagarme_subscription_id: null, data_fim: iso(AGORA.getTime() - 40 * DIA) },
      { id: "a2", user_id: "u2", plano_tipo: "basico_mensal", status: "past_due", payment_method: "credit_card", pagarme_subscription_id: "sub_C", data_fim: iso(AGORA.getTime() - 2 * DIA) },
    ],
    pagamentos_pix: [],
    admin_notifications: [],
    followup_control: [],
    profiles: [],
    ...extra,
  };
  return { tabelas, db: bancoFake(tabelas) };
}

const assinatura = (t: Record<string, Linha[]>, userId: string) => t.assinaturas.find((a) => a.user_id === userId)!;

// ── Eventos forjados ────────────────────────────────────────────────────

Deno.test("forjado: order.paid inventado com customer.code de um user_id real não ativa nada", async () => {
  const { tabelas, db } = banco();
  const api = pagarme({}); // or_FORJADO não existe na Pagar.me

  const r = await processar(
    { type: "order.paid", data: { id: "or_FORJADO", customer: { code: "u1" }, charges: [{ paid_at: iso(AGORA.getTime()) }] } },
    db,
    api,
  );

  assertEquals(r, { status: 200, json: { received: true, ignored: true, reason: "nao_confirmado_na_pagarme" } });
  assertEquals(api.consultas, ["orders/or_FORJADO"]);
  assertEquals(assinatura(tabelas, "u1").status, "canceled");
  const [aviso] = tabelas.admin_notifications;
  assertEquals(aviso.tipo, "webhook_nao_confirmado");
  assertStringIncludes(aviso.mensagem as string, "or_FORJADO");
});

Deno.test("forjado: pedido real de outra pessoa com customer.code trocado — vale o dono que a API informa", async () => {
  const { tabelas, db } = banco();
  // Pedido existe e está pago, mas é de um customer sem code (nenhuma conta casa).
  const api = pagarme({ "orders/or_REAL": { id: "or_REAL", status: "paid", customer: { id: "cus_x" }, charges: [{ id: "ch_1", paid_at: iso(AGORA.getTime()) }] } });

  const r = await processar({ type: "order.paid", data: { id: "or_REAL", customer: { code: "u1" } } }, db, api);

  assertEquals(r.status, 200);
  assertEquals(assinatura(tabelas, "u1").status, "canceled");
  assertEquals(assinatura(tabelas, "u1").data_fim, iso(AGORA.getTime() - 40 * DIA));
});

Deno.test("forjado: charge.paid cuja cobrança real está failed não renova", async () => {
  const { tabelas, db } = banco();
  const api = pagarme({ "charges/ch_X": { id: "ch_X", status: "failed", invoice: { subscription_id: "sub_C" } } });

  const r = await processar({ type: "charge.paid", data: { id: "ch_X", status: "paid", invoice: { subscription_id: "sub_C" } } }, db, api);

  assertEquals(r.json.reason, "nao_confirmado_na_pagarme");
  assertEquals(assinatura(tabelas, "u2").status, "past_due");
  assertStringIncludes(tabelas.admin_notifications[0].mensagem as string, 'status real "failed"');
});

Deno.test("reenvio de cobrança antiga (a API confirma paga, mas de 60 dias atrás) não estende o acesso", async () => {
  const { tabelas, db } = banco();
  const api = pagarme({ "charges/ch_VELHA": { id: "ch_VELHA", status: "paid", paid_at: iso(AGORA.getTime() - 60 * DIA), invoice: { subscription_id: "sub_C" } } });

  const r = await processar({ type: "charge.paid", data: { id: "ch_VELHA" } }, db, api);

  assertEquals(r.json.reason, "pagamento_antigo");
  assertEquals(assinatura(tabelas, "u2").status, "past_due");
});

Deno.test("reenvio de order.paid antigo de PIX já consumido não reativa", async () => {
  const pagoEm = iso(AGORA.getTime() - 45 * DIA);
  const { tabelas, db } = banco({
    pagamentos_pix: [{ id: "p1", user_id: "u1", plano_tipo: "intermediario_mensal", status: "paid", paid_at: pagoEm, pagarme_order_id: "or_ANTIGO", valor_centavos: 3990 }],
  });
  const api = pagarme({ "orders/or_ANTIGO": { id: "or_ANTIGO", status: "paid", charges: [{ id: "ch_a", paid_at: pagoEm }] } });

  const r = await processar({ type: "order.paid", data: { id: "or_ANTIGO" } }, db, api);

  assertEquals(r.json.reason, "pagamento_ja_consumido");
  assertEquals(assinatura(tabelas, "u1").status, "canceled");
});

Deno.test("evento de assinatura sem pagamento (subscription.updated) não muda nada nem consulta a API", async () => {
  const { tabelas, db } = banco();
  const api = pagarme({});

  const r = await processar({ type: "subscription.updated", data: { id: "sub_C", status: "active", customer: { code: "u2" } } }, db, api);

  assertEquals(r.json.reason, "evento_sem_pagamento");
  assertEquals(api.consultas.length, 0);
  assertEquals(assinatura(tabelas, "u2").status, "past_due");
});

// ── Eventos verdadeiros (a API confirma) ────────────────────────────────

Deno.test("verdadeiro: PIX pago confirmado ativa com período contado do pagamento", async () => {
  const pagoEm = iso(AGORA.getTime() - 60 * 60 * 1000);
  const { tabelas, db } = banco({
    pagamentos_pix: [{ id: "p1", user_id: "u1", plano_tipo: "intermediario_mensal", status: "pending", pagarme_order_id: "or_OK", valor_centavos: 3990 }],
  });
  const api = pagarme({ "orders/or_OK": { id: "or_OK", status: "paid", metadata: { origem: "renovacao" }, charges: [{ id: "ch_ok", paid_at: pagoEm }] } });

  const r = await processar({ type: "order.paid", data: { id: "or_OK" } }, db, api);

  assertEquals(r.json.processed, true);
  const a = assinatura(tabelas, "u1");
  assertEquals(a.status, "active");
  assertEquals(a.payment_method, "pix");
  assertEquals(a.data_fim, iso(new Date(pagoEm).getTime() + 30 * DIA));
  assertEquals(tabelas.pagamentos_pix[0].status, "paid");
});

Deno.test("verdadeiro: charge.paid da assinatura de cartão confirmado tira do past_due", async () => {
  const pagoEm = iso(AGORA.getTime() - 5 * 60 * 1000);
  const { tabelas, db } = banco();
  const api = pagarme({ "charges/ch_OK": { id: "ch_OK", status: "paid", paid_at: pagoEm, amount: 2990, invoice: { subscription_id: "sub_C" } } });

  const r = await processar({ type: "charge.paid", data: { id: "ch_OK" } }, db, api);

  assertEquals(r.json.renewed, true);
  assertEquals(assinatura(tabelas, "u2").status, "active");
  assertEquals(assinatura(tabelas, "u2").data_fim, iso(new Date(pagoEm).getTime() + 30 * DIA));
});

Deno.test("verdadeiro: invoice.payment_failed confirmado marca past_due", async () => {
  const { tabelas, db } = banco();
  tabelas.assinaturas[1].status = "active";
  tabelas.assinaturas[1].data_fim = iso(AGORA.getTime());
  const api = pagarme({ "invoices/in_F": { id: "in_F", status: "failed", subscription: { id: "sub_C" } } });

  const r = await processar({ type: "invoice.payment_failed", data: { id: "in_F" } }, db, api);

  assertEquals(r.json.status, "past_due");
  assertEquals(assinatura(tabelas, "u2").status, "past_due");
});

// ── Falha da consulta à API ─────────────────────────────────────────────

for (const [nome, resposta] of [["API fora do ar (500)", 500], ["erro de rede", new Error("timeout")]] as const) {
  Deno.test(`${nome}: não derruba o webhook, responde 200 e avisa o admin`, async () => {
    const { tabelas, db } = banco();
    const api = pagarme({ "charges/ch_OK": resposta });

    const r = await processar({ type: "charge.paid", data: { id: "ch_OK", invoice: { subscription_id: "sub_C" } } }, db, api);

    assertEquals(r, { status: 200, json: { received: true, ignored: true, reason: "nao_confirmado_na_pagarme" } });
    assertEquals(assinatura(tabelas, "u2").status, "past_due");
    assertEquals(tabelas.admin_notifications[0].tipo, "webhook_nao_confirmado");
  });
}

Deno.test("id malicioso (path traversal) nem chega a consultar a API", async () => {
  const { tabelas, db } = banco();
  const api = pagarme({});

  const r = await processar({ type: "order.paid", data: { id: "../customers/cus_1" } }, db, api);

  assertEquals(r.json.reason, "nao_confirmado_na_pagarme");
  assertEquals(api.consultas.length, 0);
  assertEquals(tabelas.assinaturas.map((a) => a.status), ["canceled", "past_due"]);
});
