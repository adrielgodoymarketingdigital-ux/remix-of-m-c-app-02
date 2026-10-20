// Cobrança da fatura em aberto depois da troca de cartão (acesso pago não válido:
// past_due/unpaid, plano vencido, ou Free com assinatura ainda na Pagar.me).
// Separado do index.ts para ser testável (fetch injetável).
//
// Endpoints (API core v5, conferidos na documentação da Pagar.me):
//   GET   /subscriptions/{id}            → status active | canceled | future, next_billing_at
//   GET   /invoices?subscription_id&status → data[].charge { id, status }
//   PATCH /charges/{id}/card             → só aceita cobrança com transação não autorizada
//   POST  /charges/{id}/retry            → devolve a cobrança com o status novo
//
// Regras para nunca cobrar em dobro:
//   - só mexe em cobrança com status "failed" (nunca pending/processing/paid);
//   - depois de trocar o cartão da cobrança, lê o status devolvido e só retenta se
//     ela ainda estiver "failed" (a documentação não diz se a troca já tenta cobrar);
//   - nunca cria cobrança nova.

export const PAGARME_API = "https://api.pagar.me/core/v5";

export const PLANOS_PAGOS = [
  "basico_mensal", "basico_anual",
  "intermediario_mensal", "intermediario_anual",
  "profissional_mensal", "profissional_anual",
  "profissional_ultra_mensal", "profissional_ultra_anual",
];

/** Mesma carência do app (src/lib/carenciaAssinatura.ts) e do job de vencidos. */
const CARENCIA_MS = 3 * 24 * 60 * 60 * 1000;

export interface AssinaturaLocal {
  plano_tipo: string | null;
  status: string | null;
  data_fim: string | null;
}

/**
 * O acesso pago está valendo? Só então a troca de cartão dispensa consultar a
 * Pagar.me. Não depende só do status: plano Free com id de assinatura (ex.: depois
 * de uma liberação temporária revertida), past_due/unpaid e plano pago vencido
 * fora da carência contam como acesso NÃO válido.
 */
export function acessoPagoValido(a: AssinaturaLocal, agora: Date): boolean {
  if (!PLANOS_PAGOS.includes(a.plano_tipo ?? "")) return false;
  if (a.status !== "active" && a.status !== "trialing") return false;
  if (!a.data_fim) return true;
  const fim = new Date(a.data_fim).getTime();
  return Number.isFinite(fim) && fim + CARENCIA_MS > agora.getTime();
}

export type ResultadoCobranca =
  | { cobranca: "nao_necessaria"; mensagem?: string }
  | { cobranca: "paga" }
  | { cobranca: "pendente"; mensagem?: string }
  | { cobranca: "recusada"; mensagem: string }
  | { cobranca: "erro"; mensagem: string }
  // Assinatura ativa na Pagar.me, sem fatura em atraso: o cartão novo vale na próxima cobrança.
  | { cobranca: "proxima_cobranca"; proxima_cobranca_em: string; mensagem?: string }
  // Nada foi trocado: não há assinatura viva na Pagar.me para usar o cartão.
  | { cobranca: "assinatura_cancelada_reassinar"; mensagem: string }
  | { cobranca: "assinatura_inexistente"; mensagem: string }
  // Conta sem plano pago e sem como saber qual plano devolver: não troca nem cobra.
  | { cobranca: "plano_desconhecido"; mensagem: string };

export interface OpcoesPagarme {
  pagarmeAuth: string;
  fetchFn?: typeof fetch;
  log?: (s: string, d?: unknown) => void;
}

export type Acao = "retentar" | "aguardar" | "nenhuma";

/** Decide o que fazer com a cobrança da fatura em aberto, só pelo status dela. */
export function decidirAcao(statusCobranca: unknown): Acao {
  if (statusCobranca === "failed") return "retentar";
  // pending/processing: a Pagar.me já está cobrando; paid/overpaid: já pago,
  // falta o webhook confirmar. Em nenhum desses casos se cobra de novo.
  if (["pending", "processing", "paid", "overpaid"].includes(String(statusCobranca))) return "aguardar";
  return "nenhuma";
}

// deno-lint-ignore no-explicit-any
type Json = any;

export function mensagemGateway(payload: Json): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.errors) && typeof payload.errors[0]?.message === "string") return payload.errors[0].message;
  if (typeof payload.message === "string") return payload.message;
  return null;
}

/** Motivo da recusa na última transação da cobrança. */
export function motivoRecusa(charge: Json): string {
  const t = charge?.last_transaction;
  return (
    mensagemGateway(t?.gateway_response) ||
    (typeof t?.acquirer_message === "string" && t.acquirer_message) ||
    "Pagamento recusado pela operadora do cartão."
  );
}

async function chamar(
  opts: OpcoesPagarme,
  metodo: "GET" | "PATCH" | "POST",
  caminho: string,
  corpo?: unknown,
): Promise<{ ok: true; dados: Json } | { ok: false; mensagem: string; status?: number }> {
  const fetchFn = opts.fetchFn ?? fetch;
  try {
    const res = await fetchFn(`${PAGARME_API}${caminho}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", Authorization: opts.pagarmeAuth },
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
    const dados = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, mensagem: mensagemGateway(dados) || `Pagar.me respondeu ${res.status}`, status: res.status };
    }
    return { ok: true, dados };
  } catch (err) {
    return { ok: false, mensagem: `Falha de comunicação com a Pagar.me: ${String(err)}` };
  }
}

export type SituacaoAssinatura =
  // planoTipo: metadata.plano_tipo gravado pelo create-pagarme-subscription (só se for plano pago)
  | { situacao: "viva"; proximaCobrancaEm: string | null; planoTipo: string | null }
  | { situacao: "cancelada" }
  | { situacao: "inexistente" }
  | { erro: string };

/**
 * Consulta a assinatura na Pagar.me antes de trocar o cartão.
 * viva = existe e não está cancelada (com a data da próxima cobrança, se houver);
 * inexistente = a Pagar.me respondeu 404; erro = não deu para consultar.
 */
export async function consultarAssinatura(
  subscriptionId: string,
  opts: OpcoesPagarme,
): Promise<SituacaoAssinatura> {
  const r = await chamar(opts, "GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!r.ok) return r.status === 404 ? { situacao: "inexistente" } : { erro: r.mensagem };
  if (r.dados?.status === "canceled") return { situacao: "cancelada" };
  const proxima = r.dados?.next_billing_at;
  const plano = r.dados?.metadata?.plano_tipo;
  return {
    situacao: "viva",
    proximaCobrancaEm: typeof proxima === "string" && proxima ? proxima : null,
    planoTipo: typeof plano === "string" && PLANOS_PAGOS.includes(plano) ? plano : null,
  };
}

/** Fatura em aberto mais recente da assinatura (failed ou pending), com a cobrança dela. */
async function faturaEmAberto(
  subscriptionId: string,
  opts: OpcoesPagarme,
): Promise<{ ok: true; fatura: Json | null } | { ok: false; mensagem: string }> {
  const candidatas: Json[] = [];
  for (const status of ["failed", "pending"]) {
    const r = await chamar(opts, "GET", `/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&status=${status}&size=10`);
    if (!r.ok) return { ok: false, mensagem: r.mensagem };
    candidatas.push(...(Array.isArray(r.dados?.data) ? r.dados.data : []));
  }
  candidatas.sort((a, b) => String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")));
  return { ok: true, fatura: candidatas[0] ?? null };
}

/** Converte o status da cobrança depois de trocar o cartão ou retentar. */
function resultadoPorStatus(charge: Json): ResultadoCobranca | null {
  switch (charge?.status) {
    case "paid":
    case "overpaid":
      return { cobranca: "paga" };
    case "pending":
    case "processing":
      return { cobranca: "pendente" };
    case "failed":
      return null; // quem chama decide (retentar ou recusada)
    default:
      return { cobranca: "erro", mensagem: `Cobrança ficou com status inesperado: ${String(charge?.status)}` };
  }
}

/**
 * Depois que o cartão da assinatura já foi trocado: coloca o cartão novo na
 * cobrança que falhou e retenta. Nunca lança; erros viram { cobranca: "erro" }.
 */
export async function cobrarFaturaEmAberto(
  subscriptionId: string,
  cardId: string,
  opts: OpcoesPagarme,
  proximaCobrancaEm: string | null = null,
): Promise<ResultadoCobranca> {
  const log = opts.log ?? (() => {});

  const busca = await faturaEmAberto(subscriptionId, opts);
  if (!busca.ok) return { cobranca: "erro", mensagem: busca.mensagem };
  const fatura = busca.fatura;
  if (!fatura) {
    log("Nenhuma fatura em aberto na Pagar.me", { subscriptionId, proximaCobrancaEm });
    // Nada em atraso: nunca cria cobrança avulsa; o cartão novo vale na próxima cobrança.
    if (proximaCobrancaEm) return { cobranca: "proxima_cobranca", proxima_cobranca_em: proximaCobrancaEm };
    return { cobranca: "nao_necessaria", mensagem: "Não há cobrança em aberto na Pagar.me." };
  }

  const charge = fatura.charge;
  if (!charge?.id) return { cobranca: "erro", mensagem: "A fatura em aberto não tem cobrança associada." };

  const acao = decidirAcao(charge.status);
  log("Fatura em aberto", { invoiceId: fatura.id, chargeId: charge.id, chargeStatus: charge.status, acao });
  if (acao === "aguardar") return { cobranca: "pendente" };
  if (acao === "nenhuma") {
    return { cobranca: "erro", mensagem: `Cobrança em aberto com status "${String(charge.status)}"; não foi retentada.` };
  }

  // 1. Cartão novo na cobrança que falhou
  const troca = await chamar(opts, "PATCH", `/charges/${encodeURIComponent(charge.id)}/card`, { card_id: cardId });
  if (!troca.ok) return { cobranca: "erro", mensagem: troca.mensagem };
  const aposTroca = resultadoPorStatus(troca.dados);
  if (aposTroca) return aposTroca; // a própria troca já cobrou (ou está processando)

  // 2. Ainda "failed": retenta uma única vez
  const retry = await chamar(opts, "POST", `/charges/${encodeURIComponent(charge.id)}/retry`);
  if (!retry.ok) return { cobranca: "erro", mensagem: retry.mensagem };
  const aposRetry = resultadoPorStatus(retry.dados);
  if (aposRetry) return aposRetry;
  return { cobranca: "recusada", mensagem: motivoRecusa(retry.dados) };
}
