// deno test supabase/functions/update-pagarme-card/
// Troca de cartão decidida pela Pagar.me (não pelo status local). A "Pagar.me" é
// um fetch falso que responde por método + caminho e registra as chamadas, para
// provar quando NÃO se troca/cobra, que há no máximo um retry e nenhuma cobrança avulsa.
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { type AssinaturaTroca, MSG_CANCELADA, MSG_INEXISTENTE, trocarCartao } from "./trocarCartao.ts";

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
const CUS = "cus_teste";
const AGORA = new Date("2026-10-20T15:00:00Z");
const PROXIMA = "2026-11-17T00:00:00Z";

const GET_SUB = `GET /subscriptions/${SUB}`;
const CRIA_CARTAO = `POST /customers/${CUS}/cards`;
const TROCA_SUB = `PATCH /subscriptions/${SUB}/card`;
const FAILED = `GET /invoices?subscription_id=${SUB}&status=failed&size=10`;
const PENDING = `GET /invoices?subscription_id=${SUB}&status=pending&size=10`;
const TROCA_COBRANCA = "PATCH /charges/ch_1/card";
const RETRY = "POST /charges/ch_1/retry";

const cartaoCriado = { corpo: { id: "card_novo", last_four_digits: "4242", brand: "Visa" } };
const subViva = { corpo: { id: SUB, status: "active", next_billing_at: PROXIMA } };
const faturaFailed = { corpo: { data: [{ id: "in_1", status: "failed", created_at: "2026-10-17T09:00:00Z", charge: { id: "ch_1", status: "failed" } }] } };
const semFaturas = { corpo: { data: [] } };

// Linha local de quem virou Free ao fim de uma liberação, mas tem assinatura na Pagar.me.
const free: AssinaturaTroca = { plano_tipo: "free", status: "active", data_fim: null, pagarme_subscription_id: SUB, pagarme_customer_id: CUS };
const pastDue: AssinaturaTroca = { ...free, plano_tipo: "profissional_mensal", status: "past_due", data_fim: "2026-10-17T13:00:00Z" };
const ativaNoPrazo: AssinaturaTroca = { ...free, plano_tipo: "profissional_mensal", status: "active", data_fim: PROXIMA };
const ativaVencida: AssinaturaTroca = { ...free, plano_tipo: "profissional_mensal", status: "active", data_fim: "2026-10-15T00:00:00Z" };

const rodar = (a: AssinaturaTroca, p: ReturnType<typeof pagarme>) =>
  trocarCartao(a, "tok_teste", AGORA, { pagarmeAuth: "Basic x", fetchFn: p.fn });

// ── Free com id de assinatura (caso do cliente) ────────────────────────────
Deno.test("Free + fatura failed → consulta a Pagar.me, troca o cartão, retenta uma vez e fica paga", async () => {
  const p = pagarme({
    [GET_SUB]: subViva, [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} },
    [FAILED]: faturaFailed, [PENDING]: semFaturas,
    [TROCA_COBRANCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: { id: "ch_1", status: "paid" } },
  });
  const r = await rodar(free, p);
  assertEquals(r.trocou, true);
  assertEquals(r.corpo.cobranca, "paga");
  assertEquals(r.corpo.success, true);
  assertEquals(p.chamadas, [GET_SUB, CRIA_CARTAO, TROCA_SUB, FAILED, PENDING, TROCA_COBRANCA, RETRY]);
});

Deno.test("Free + assinatura cancelada na Pagar.me → não troca nada e pede para assinar de novo", async () => {
  const p = pagarme({ [GET_SUB]: { corpo: { id: SUB, status: "canceled" } } });
  const r = await rodar(free, p);
  assertEquals(r, {
    trocou: false,
    corpo: { success: false, cobranca: "assinatura_cancelada_reassinar", mensagem: MSG_CANCELADA, status_assinatura: "active" },
  });
  assertEquals(p.chamadas, [GET_SUB]); // nem cartão novo é criado
});

Deno.test("Free + assinatura ativa sem fatura em atraso → informa a próxima cobrança, sem cobrar", async () => {
  const p = pagarme({
    [GET_SUB]: subViva, [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} },
    [FAILED]: semFaturas, [PENDING]: semFaturas,
  });
  const r = await rodar(free, p);
  assertEquals(r.trocou, true);
  assertEquals(r.corpo.cobranca, "proxima_cobranca");
  if (r.trocou && r.corpo.cobranca === "proxima_cobranca") assertEquals(r.corpo.proxima_cobranca_em, PROXIMA);
  assertEquals(r.corpo.success && r.corpo.acesso_pago_valido, false);
  assertEquals(p.chamadas, [GET_SUB, CRIA_CARTAO, TROCA_SUB, FAILED, PENDING]); // nenhuma cobrança
});

Deno.test("Free sem assinatura na Pagar.me (404) → não troca nada e orienta a assinar de novo", async () => {
  const p = pagarme({}); // GET da assinatura cai no 404
  const r = await rodar(free, p);
  assertEquals(r, {
    trocou: false,
    corpo: { success: false, cobranca: "assinatura_inexistente", mensagem: MSG_INEXISTENTE, status_assinatura: "active" },
  });
  assertEquals(p.chamadas, [GET_SUB]);
});

// ── past_due: como hoje ────────────────────────────────────────────────────
Deno.test("past_due + fatura failed → mesmo fluxo de antes (consulta, troca, um retry)", async () => {
  const p = pagarme({
    [GET_SUB]: subViva, [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} },
    [FAILED]: faturaFailed, [PENDING]: semFaturas,
    [TROCA_COBRANCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: { id: "ch_1", status: "paid" } },
  });
  const r = await rodar(pastDue, p);
  assertEquals(r.corpo.cobranca, "paga");
  assertEquals(p.chamadas, [GET_SUB, CRIA_CARTAO, TROCA_SUB, FAILED, PENDING, TROCA_COBRANCA, RETRY]);
});

Deno.test("past_due + retry recusado → recusada, sem segunda tentativa", async () => {
  const p = pagarme({
    [GET_SUB]: subViva, [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} },
    [FAILED]: faturaFailed, [PENDING]: semFaturas,
    [TROCA_COBRANCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: { id: "ch_1", status: "failed", last_transaction: { acquirer_message: "Saldo insuficiente" } } },
  });
  const r = await rodar(pastDue, p);
  assertEquals(r.corpo.cobranca, "recusada");
  assertEquals(p.chamadas.filter((c) => c === RETRY).length, 1);
});

Deno.test("past_due + assinatura cancelada → assinar de novo (antes: assinatura_cancelada)", async () => {
  const p = pagarme({ [GET_SUB]: { corpo: { id: SUB, status: "canceled" } } });
  const r = await rodar(pastDue, p);
  assertEquals(r.corpo.cobranca, "assinatura_cancelada_reassinar");
  assertEquals(p.chamadas, [GET_SUB]);
});

// ── outros estados locais ──────────────────────────────────────────────────
Deno.test("active vencido fora da carência + fatura failed → agora cobra (antes devolvia nao_necessaria)", async () => {
  const p = pagarme({
    [GET_SUB]: subViva, [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} },
    [FAILED]: faturaFailed, [PENDING]: semFaturas,
    [TROCA_COBRANCA]: { corpo: { id: "ch_1", status: "paid" } },
  });
  const r = await rodar(ativaVencida, p);
  assertEquals(r.corpo.cobranca, "paga");
  assertEquals(p.chamadas, [GET_SUB, CRIA_CARTAO, TROCA_SUB, FAILED, PENDING, TROCA_COBRANCA]); // pago na troca: sem retry
});

Deno.test("active no prazo → só troca o cartão, sem consultar assinatura nem faturas", async () => {
  const p = pagarme({ [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} } });
  const r = await rodar(ativaNoPrazo, p);
  assertEquals(r.corpo.cobranca, "nao_necessaria");
  assertEquals(r.corpo.success && r.corpo.acesso_pago_valido, true);
  assertEquals(p.chamadas, [CRIA_CARTAO, TROCA_SUB]);
});

// ── erros: nada pela metade ────────────────────────────────────────────────
Deno.test("erro ao consultar a assinatura (500) → lança, sem criar cartão", async () => {
  const p = pagarme({ [GET_SUB]: { status: 500, corpo: { message: "Internal error" } } });
  await assertRejects(() => rodar(free, p), Error, "Não foi possível consultar sua assinatura");
  assertEquals(p.chamadas, [GET_SUB]);
});

Deno.test("cartão recusado ao salvar → lança com a mensagem do gateway, sem trocar nem cobrar", async () => {
  const p = pagarme({ [GET_SUB]: subViva, [CRIA_CARTAO]: { status: 400, corpo: { errors: [{ message: "Cartão inválido" }] } } });
  await assertRejects(() => rodar(free, p), Error, "Cartão inválido");
  assertEquals(p.chamadas, [GET_SUB, CRIA_CARTAO]);
});

Deno.test("nenhum caminho cria cobrança avulsa (POST /orders ou /charges)", async () => {
  const cenarios: Array<[AssinaturaTroca, Record<string, Resposta>]> = [
    [free, { [GET_SUB]: subViva, [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} }, [FAILED]: semFaturas, [PENDING]: semFaturas }],
    [ativaVencida, { [GET_SUB]: { corpo: { id: SUB, status: "active" } }, [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} }, [FAILED]: semFaturas, [PENDING]: semFaturas }],
  ];
  for (const [a, rotas] of cenarios) {
    const p = pagarme(rotas);
    await rodar(a, p);
    assertEquals(p.chamadas.some((c) => /^POST \/(orders|charges)$/.test(c)), false);
  }
});

// ── plano restaurado quando a cobrança de uma conta Free é paga ────────────
import { fimDoPeriodoPago, planoParaRestaurar } from "./trocarCartao.ts";

Deno.test("Free + fatura failed paga → devolve o plano da assinatura na Pagar.me (metadata)", async () => {
  const p = pagarme({
    [GET_SUB]: { corpo: { id: SUB, status: "active", next_billing_at: PROXIMA, metadata: { plano_tipo: "profissional_mensal" } } },
    [CRIA_CARTAO]: cartaoCriado, [TROCA_SUB]: { corpo: {} },
    [FAILED]: faturaFailed, [PENDING]: semFaturas,
    [TROCA_COBRANCA]: { corpo: { id: "ch_1", status: "failed" } },
    [RETRY]: { corpo: { id: "ch_1", status: "paid" } },
  });
  const r = await rodar(free, p);
  if (!r.trocou) throw new Error("devia trocar");
  assertEquals(r.planoPagarme, "profissional_mensal");
  assertEquals(planoParaRestaurar("free", r.corpo, r.planoPagarme, null), "profissional_mensal");
});

Deno.test("planoParaRestaurar: só com cobrança paga e plano local não pago", () => {
  const paga = { cobranca: "paga" } as const;
  assertEquals(planoParaRestaurar("free", { cobranca: "pendente" }, "profissional_mensal", null), null);
  assertEquals(planoParaRestaurar("free", { cobranca: "recusada", mensagem: "x" }, "profissional_mensal", null), null);
  assertEquals(planoParaRestaurar("profissional_mensal", paga, "basico_mensal", null), null); // já é pago: não mexe
  assertEquals(planoParaRestaurar("free", paga, null, "intermediario_anual"), "intermediario_anual"); // sem metadata: plano anterior
  assertEquals(planoParaRestaurar("free", paga, "plano_invalido", null), null);
  assertEquals(planoParaRestaurar("free", paga, null, null), null);
});

Deno.test("fimDoPeriodoPago: 30 dias no mensal, 365 no anual (mesma regra do webhook)", () => {
  const t = new Date("2026-10-20T12:00:00Z");
  assertEquals(fimDoPeriodoPago(t, "profissional_mensal").toISOString(), "2026-11-19T12:00:00.000Z");
  assertEquals(fimDoPeriodoPago(t, "basico_anual").toISOString(), "2027-10-20T12:00:00.000Z");
});
