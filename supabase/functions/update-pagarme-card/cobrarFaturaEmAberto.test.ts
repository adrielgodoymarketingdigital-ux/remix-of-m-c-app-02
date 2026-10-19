// deno test supabase/functions/update-pagarme-card/
// Troca de cartão com fatura em aberto: a "Pagar.me" é um fetch falso que responde
// por método + caminho e registra as chamadas (para provar quando NÃO se cobra).
import { assertEquals } from "jsr:@std/assert@1";
import { cobrarFaturaEmAberto, consultarAssinatura, decidirAcao } from "./cobrarFaturaEmAberto.ts";

type Resposta = { status?: number; corpo?: unknown } | Error;

function pagarme(rotas: Record<string, Resposta>) {
  const chamadas: string[] = [];
  const fn = ((url: string, init?: RequestInit) => {
    const chave = `${init?.method ?? "GET"} ${url.replace("https://api.pagar.me/core/v5", "")}`;
    chamadas.push(chave);
    const r = rotas[chave];
    if (r instanceof Error) return Promise.reject(r);
    if (!r) return Promise.resolve(new Response('{"message":"not found"}', { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200 }));
  }) as typeof fetch;
  return { fn, chamadas };
}

const SUB = "sub_teste";
const CARD = "card_novo";
const FAILED = `GET /invoices?subscription_id=${SUB}&status=failed&size=10`;
const PENDING = `GET /invoices?subscription_id=${SUB}&status=pending&size=10`;
const TROCA = "PATCH /charges/ch_1/card";
const RETRY = "POST /charges/ch_1/retry";

const fatura = (chargeStatus: string, created_at = "2026-10-17T09:00:00Z") =>
  ({ id: "in_1", status: "failed", created_at, charge: { id: "ch_1", status: chargeStatus } });
const lista = (...faturas: unknown[]) => ({ corpo: { data: faturas } });
const recusa = { status: "failed", last_transaction: { acquirer_message: "Saldo insuficiente" } };

const rodar = (p: ReturnType<typeof pagarme>) =>
  cobrarFaturaEmAberto(SUB, CARD, { pagarmeAuth: "Basic x", fetchFn: p.fn });

// ── decisão por status da cobrança ─────────────────────────────────────────
Deno.test("decidirAcao: failed → retentar", () => assertEquals(decidirAcao("failed"), "retentar"));
Deno.test("decidirAcao: pending/processing/paid/overpaid → aguardar (nunca cobra de novo)", () => {
  for (const s of ["pending", "processing", "paid", "overpaid"]) assertEquals(decidirAcao(s), "aguardar", s);
});
Deno.test("decidirAcao: canceled/underpaid/chargedback/desconhecido → nenhuma", () => {
  for (const s of ["canceled", "underpaid", "chargedback", undefined, ""]) assertEquals(decidirAcao(s), "nenhuma", String(s));
});

// ── fluxo completo ─────────────────────────────────────────────────────────
Deno.test("failed → troca o cartão da cobrança, retenta e fica paga", async () => {
  const p = pagarme({
    [FAILED]: lista(fatura("failed")), [PENDING]: lista(),
    [TROCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: { id: "ch_1", status: "paid" } },
  });
  assertEquals(await rodar(p), { cobranca: "paga" });
  assertEquals(p.chamadas, [FAILED, PENDING, TROCA, RETRY]);
});

Deno.test("failed → retenta e é recusada: devolve o motivo do gateway", async () => {
  const p = pagarme({
    [FAILED]: lista(fatura("failed")), [PENDING]: lista(),
    [TROCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: recusa },
  });
  assertEquals(await rodar(p), { cobranca: "recusada", mensagem: "Saldo insuficiente" });
});

Deno.test("failed → retry fica processing: pendente", async () => {
  const p = pagarme({
    [FAILED]: lista(fatura("failed")), [PENDING]: lista(),
    [TROCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: { id: "ch_1", status: "processing" } },
  });
  assertEquals(await rodar(p), { cobranca: "pendente" });
});

Deno.test("a própria troca do cartão da cobrança já cobrou: NÃO chama retry (sem cobrança em dobro)", async () => {
  const p = pagarme({
    [FAILED]: lista(fatura("failed")), [PENDING]: lista(),
    [TROCA]: { corpo: { id: "ch_1", status: "paid" } },
  });
  assertEquals(await rodar(p), { cobranca: "paga" });
  assertEquals(p.chamadas.includes(RETRY), false);
});

Deno.test("a troca deixou a cobrança processing: NÃO chama retry", async () => {
  const p = pagarme({
    [FAILED]: lista(fatura("failed")), [PENDING]: lista(),
    [TROCA]: { corpo: { id: "ch_1", status: "processing" } },
  });
  assertEquals(await rodar(p), { cobranca: "pendente" });
  assertEquals(p.chamadas.includes(RETRY), false);
});

for (const status of ["pending", "processing", "paid"]) {
  Deno.test(`cobrança em aberto ${status} → pendente, sem trocar cartão da cobrança nem retentar`, async () => {
    const p = pagarme({ [FAILED]: lista(), [PENDING]: lista(fatura(status)) });
    assertEquals(await rodar(p), { cobranca: "pendente" });
    assertEquals(p.chamadas, [FAILED, PENDING]);
  });
}

Deno.test("sem fatura em aberto → nao_necessaria, sem cobrar", async () => {
  const p = pagarme({ [FAILED]: lista(), [PENDING]: lista() });
  assertEquals((await rodar(p)).cobranca, "nao_necessaria");
  assertEquals(p.chamadas, [FAILED, PENDING]);
});

Deno.test("várias faturas: age só na mais recente", async () => {
  const antiga = { ...fatura("failed", "2026-08-17T09:00:00Z"), charge: { id: "ch_antiga", status: "failed" } };
  const p = pagarme({
    [FAILED]: lista(antiga, fatura("failed", "2026-10-17T09:00:00Z")), [PENDING]: lista(),
    [TROCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: { id: "ch_1", status: "paid" } },
  });
  assertEquals(await rodar(p), { cobranca: "paga" });
  assertEquals(p.chamadas.some((c) => c.includes("ch_antiga")), false);
});

Deno.test("cobrança com status inesperado (canceled) → erro, sem retentar", async () => {
  const p = pagarme({ [FAILED]: lista(fatura("canceled")), [PENDING]: lista() });
  assertEquals((await rodar(p)).cobranca, "erro");
  assertEquals(p.chamadas, [FAILED, PENDING]);
});

Deno.test("fatura sem cobrança associada → erro", async () => {
  const p = pagarme({ [FAILED]: lista({ id: "in_1", created_at: "2026-10-17T09:00:00Z" }), [PENDING]: lista() });
  assertEquals((await rodar(p)).cobranca, "erro");
});

// ── erro do gateway em cada passo ──────────────────────────────────────────
Deno.test("erro ao listar faturas failed → erro, nada mais é chamado", async () => {
  const p = pagarme({ [FAILED]: { status: 500, corpo: { message: "Internal error" } } });
  assertEquals(await rodar(p), { cobranca: "erro", mensagem: "Internal error" });
  assertEquals(p.chamadas, [FAILED]);
});

Deno.test("erro ao listar faturas pending → erro, sem cobrar", async () => {
  const p = pagarme({ [FAILED]: lista(fatura("failed")), [PENDING]: { status: 502, corpo: {} } });
  assertEquals((await rodar(p)).cobranca, "erro");
  assertEquals(p.chamadas.includes(TROCA), false);
});

Deno.test("erro ao trocar o cartão da cobrança (412) → erro, sem retry", async () => {
  const p = pagarme({
    [FAILED]: lista(fatura("failed")), [PENDING]: lista(),
    [TROCA]: { status: 412, corpo: { message: "This charge may not have changed the card." } },
  });
  assertEquals(await rodar(p), { cobranca: "erro", mensagem: "This charge may not have changed the card." });
  assertEquals(p.chamadas.includes(RETRY), false);
});

Deno.test("erro no retry → erro com a mensagem do gateway", async () => {
  const p = pagarme({
    [FAILED]: lista(fatura("failed")), [PENDING]: lista(),
    [TROCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { status: 400, corpo: { errors: [{ message: "Charge cannot be retried" }] } },
  });
  assertEquals(await rodar(p), { cobranca: "erro", mensagem: "Charge cannot be retried" });
});

Deno.test("falha de rede → erro (nunca lança)", async () => {
  const p = pagarme({ [FAILED]: new Error("timeout") });
  assertEquals((await rodar(p)).cobranca, "erro");
});

// ── assinatura cancelada na Pagar.me ───────────────────────────────────────
Deno.test("consultarAssinatura: canceled → cancelada", async () => {
  const p = pagarme({ [`GET /subscriptions/${SUB}`]: { corpo: { id: SUB, status: "canceled" } } });
  assertEquals(await consultarAssinatura(SUB, { pagarmeAuth: "Basic x", fetchFn: p.fn }), { cancelada: true });
});

Deno.test("consultarAssinatura: active → não cancelada", async () => {
  const p = pagarme({ [`GET /subscriptions/${SUB}`]: { corpo: { id: SUB, status: "active" } } });
  assertEquals(await consultarAssinatura(SUB, { pagarmeAuth: "Basic x", fetchFn: p.fn }), { cancelada: false });
});

Deno.test("consultarAssinatura: erro do gateway → erro (index.ts não troca nada)", async () => {
  const p = pagarme({ [`GET /subscriptions/${SUB}`]: { status: 500, corpo: { message: "Internal error" } } });
  assertEquals(await consultarAssinatura(SUB, { pagarmeAuth: "Basic x", fetchFn: p.fn }), { erro: "Internal error" });
});
