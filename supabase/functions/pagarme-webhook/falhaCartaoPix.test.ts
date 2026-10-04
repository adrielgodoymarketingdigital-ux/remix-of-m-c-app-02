// deno test --allow-env supabase/functions/pagarme-webhook/
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  cancelarAssinaturaCartaoAntiga,
  ehRenovacaoDoPlano,
  processarFalhaCobranca,
} from "./falhaCartaoPix.ts";

type Linha = Record<string, unknown>;

/** Supabase em memória: só o que o módulo usa (select/eq/maybeSingle/update/insert). */
function bancoFake(tabelas: Record<string, Linha[]>) {
  const from = (tabela: string) => {
    let op: "select" | "update" | "insert" = "select";
    let payload: Linha = {};
    const filtros: [string, unknown][] = [];
    const linhas = () => (tabelas[tabela] ??= []).filter((r) => filtros.every(([c, v]) => r[c] === v));
    const executar = () => {
      if (op === "update") linhas().forEach((r) => Object.assign(r, payload));
      if (op === "insert") (tabelas[tabela] ??= []).push({ ...payload });
      return { data: op === "select" ? linhas() : null, error: null };
    };
    // deno-lint-ignore no-explicit-any
    const b: any = {
      select: () => b,
      eq: (c: string, v: unknown) => (filtros.push([c, v]), b),
      update: (p: Linha) => ((op = "update"), (payload = p), b),
      insert: (p: Linha) => ((op = "insert"), (payload = p), b),
      maybeSingle: () => Promise.resolve({ data: executar().data?.[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, erro),
    };
    return b;
  };
  return { from };
}

const DIA = 24 * 60 * 60 * 1000;
// Mesmo momento da falha real de 02/10/2026 (Andystts25).
const AGORA = new Date("2026-10-02T03:36:10Z");

function cenario(assinatura: Linha) {
  const tabelas: Record<string, Linha[]> = {
    assinaturas: [{
      id: "a1",
      user_id: "u1",
      plano_tipo: "intermediario_mensal",
      status: "active",
      pagarme_subscription_id: "sub_5KNMNKCPBiQbm1aq",
      ...assinatura,
    }],
    admin_notifications: [],
  };
  return { tabelas, db: bancoFake(tabelas) };
}

const falhaCartao = { type: "charge.payment_failed", data: { subscription_id: "sub_5KNMNKCPBiQbm1aq" } };

Deno.test("falha de cartão com período pago por PIX: não bloqueia e avisa o admin", async () => {
  // Caso real: PIX pago em 30/09 → data_fim 30/10.
  const { tabelas, db } = cenario({ payment_method: "pix", data_fim: "2026-10-30T19:36:13.168Z" });

  const r = await processarFalhaCobranca(falhaCartao, db, AGORA);

  assertEquals(r, { processed: true, ignored: true, reason: "periodo_pago_pix" });
  assertEquals(tabelas.assinaturas[0].status, "active");
  const [aviso] = tabelas.admin_notifications;
  assertEquals(aviso.tipo, "falha_cartao_ignorada");
  assertStringIncludes(aviso.mensagem as string, "30/10/2026");
  assertStringIncludes(aviso.mensagem as string, "sub_5KNMNKCPBiQbm1aq");
});

Deno.test("falha com data_fim vencida: bloqueia (past_due)", async () => {
  const { tabelas, db } = cenario({ payment_method: "pix", data_fim: new Date(AGORA.getTime() - DIA).toISOString() });

  const r = await processarFalhaCobranca(falhaCartao, db, AGORA);

  assertEquals(r, { processed: true, status: "past_due" });
  assertEquals(tabelas.assinaturas[0].status, "past_due");
  assertEquals(tabelas.admin_notifications[0].tipo, "pagamento_falhou");
});

Deno.test("falha a menos de 2 dias do vencimento: bloqueia (é o ciclo atual)", async () => {
  const { tabelas, db } = cenario({ payment_method: "pix", data_fim: new Date(AGORA.getTime() + DIA).toISOString() });
  await processarFalhaCobranca(falhaCartao, db, AGORA);
  assertEquals(tabelas.assinaturas[0].status, "past_due");
});

Deno.test("falha com período vigente pago no cartão (não PIX): bloqueia", async () => {
  const { tabelas, db } = cenario({ payment_method: "credit_card", data_fim: "2026-10-30T19:36:13.168Z" });
  await processarFalhaCobranca(falhaCartao, db, AGORA);
  assertEquals(tabelas.assinaturas[0].status, "past_due");
});

Deno.test("renovação por PIX: limpa o id no banco antes de cancelar na Pagar.me", async () => {
  const { tabelas, db } = cenario({ payment_method: "pix" });
  const chamadas: { url: string; method?: string; idNoBancoNaHora: unknown }[] = [];
  const fetchFn = ((url: string, init?: RequestInit) => {
    chamadas.push({ url, method: init?.method, idNoBancoNaHora: tabelas.assinaturas[0].pagarme_subscription_id });
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;

  const r = await cancelarAssinaturaCartaoAntiga(
    db,
    { assinaturaId: "a1", userId: "u1", subscriptionId: "sub_5KNMNKCPBiQbm1aq", orderId: "or_x" },
    { fetchFn, pagarmeKey: "sk_test" },
  );

  assertEquals(r, "cancelada");
  assertEquals(chamadas, [{
    url: "https://api.pagar.me/core/v5/subscriptions/sub_5KNMNKCPBiQbm1aq",
    method: "DELETE",
    idNoBancoNaHora: null,
  }]);
  assertEquals(tabelas.admin_notifications.length, 0);
});

Deno.test("cancelamento recusado pela Pagar.me: só avisa o admin, não lança", async () => {
  const { tabelas, db } = cenario({ payment_method: "pix" });
  const fetchFn = (() => Promise.resolve(new Response('{"message":"not found"}', { status: 404 }))) as typeof fetch;

  const r = await cancelarAssinaturaCartaoAntiga(
    db,
    { assinaturaId: "a1", userId: "u1", subscriptionId: "sub_5KNMNKCPBiQbm1aq", orderId: "or_x" },
    { fetchFn, pagarmeKey: "sk_test" },
  );

  assertEquals(r, "falhou");
  assertEquals(tabelas.assinaturas[0].pagarme_subscription_id, null);
  const [aviso] = tabelas.admin_notifications;
  assertEquals(aviso.tipo, "cancelamento_cartao_falhou");
  assertStringIncludes(aviso.mensagem as string, "404");
});

Deno.test("cancelamento sem chave da Pagar.me: avisa o admin, sem chamar a API", async () => {
  const { tabelas, db } = cenario({ payment_method: "pix" });
  let chamou = false;
  const fetchFn = (() => ((chamou = true), Promise.resolve(new Response("{}")))) as typeof fetch;

  const r = await cancelarAssinaturaCartaoAntiga(
    db,
    { assinaturaId: "a1", userId: "u1", subscriptionId: "sub_5KNMNKCPBiQbm1aq", orderId: "or_x" },
    { fetchFn, pagarmeKey: undefined },
  );

  assertEquals(r, "falhou");
  assert(!chamou);
  assertEquals(tabelas.admin_notifications[0].tipo, "cancelamento_cartao_falhou");
});

Deno.test("só é renovação quando vem do fluxo de renovação ou paga o mesmo plano", () => {
  assert(ehRenovacaoDoPlano("renovacao", null, "intermediario_mensal"));
  assert(ehRenovacaoDoPlano(null, "intermediario_mensal", "intermediario_mensal"));
  assert(!ehRenovacaoDoPlano(null, "basico_mensal", "intermediario_mensal")); // troca de plano
  assert(!ehRenovacaoDoPlano(null, "demonstracao", "intermediario_mensal")); // primeira compra
  assert(!ehRenovacaoDoPlano(null, null, "intermediario_mensal"));
});
