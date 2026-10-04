// O corpo do webhook não é confiável (pode ser forjado: sem PAGARME_WEBHOOK_SECRET
// ninguém assina o evento). Antes de mexer em qualquer assinatura, o objeto do
// evento é buscado direto na API da Pagar.me e só a resposta dela é usada.
import { type OpcoesPagarme, PAGARME_API } from "../_shared/pagarmeAssinatura.ts";

export type ColecaoPagarme = "orders" | "charges" | "invoices" | "subscriptions";

type Regra = { colecao: ColecaoPagarme; status: string[] };

/** Eventos que alteram assinatura: onde buscar o objeto e qual status real ele precisa ter. */
export const REGRAS_EVENTO: Record<string, Regra> = {
  "order.paid": { colecao: "orders", status: ["paid"] },
  "charge.paid": { colecao: "charges", status: ["paid", "overpaid"] },
  "invoice.paid": { colecao: "invoices", status: ["paid"] },
  "charge.payment_failed": { colecao: "charges", status: ["failed"] },
  "charge.refused": { colecao: "charges", status: ["failed"] },
  "invoice.payment_failed": { colecao: "invoices", status: ["failed"] },
  "subscription.canceled": { colecao: "subscriptions", status: ["canceled"] },
  "subscription.deleted": { colecao: "subscriptions", status: ["canceled"] },
};

/**
 * Eventos de assinatura que não provam pagamento nem falha de um ciclo: antes
 * estendiam data_fim (ou marcavam past_due) só pelo corpo do evento. Renovação
 * agora vem só de charge.paid/invoice.paid/order.paid, confirmados na API.
 */
export const EVENTOS_SEM_EFEITO = [
  "subscription.charged",
  "subscription.activated",
  "subscription.created",
  "subscription.updated",
  "subscription.payment_failed",
];

// Ids da Pagar.me (or_…, ch_…, in_…, sub_…): bloqueia path traversal na URL da consulta.
const ID_VALIDO = /^[A-Za-z0-9_-]{3,64}$/;

export type Confirmacao =
  // deno-lint-ignore no-explicit-any
  | { ok: true; objeto: any }
  | { ok: false; motivo: string };

/** GET /{colecao}/{id} na Pagar.me e confere o status real. Nunca lança. */
export async function confirmarNaPagarme(
  regra: Regra,
  id: unknown,
  opts: OpcoesPagarme = {}
): Promise<Confirmacao> {
  if (typeof id !== "string" || !ID_VALIDO.test(id)) {
    return { ok: false, motivo: "evento sem id válido" };
  }
  const fetchFn = opts.fetchFn ?? fetch;
  const pagarmeKey = "pagarmeKey" in opts ? opts.pagarmeKey : Deno.env.get("PAGARME_SECRET_KEY");
  if (!pagarmeKey) return { ok: false, motivo: "PAGARME_SECRET_KEY não configurada" };

  try {
    const res = await fetchFn(`${PAGARME_API}/${regra.colecao}/${id}`, {
      method: "GET",
      headers: { Authorization: `Basic ${btoa(`${pagarmeKey}:`)}` },
    });
    if (!res.ok) {
      await res.body?.cancel();
      return { ok: false, motivo: `consulta à Pagar.me respondeu ${res.status}` };
    }
    const objeto = await res.json();
    if (objeto?.id !== id) return { ok: false, motivo: "a Pagar.me devolveu outro objeto" };
    if (!regra.status.includes(objeto?.status)) {
      return { ok: false, motivo: `status real "${objeto?.status}", esperado ${regra.status.join("/")}` };
    }
    return { ok: true, objeto };
  } catch (err) {
    return { ok: false, motivo: `falha na consulta à Pagar.me: ${String(err)}` };
  }
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Data do pagamento informada pela API (cobrança, fatura ou pedido). */
// deno-lint-ignore no-explicit-any
export function dataPagamento(objeto: any): string | null {
  const data =
    objeto?.paid_at ??
    objeto?.charge?.paid_at ??
    objeto?.charges?.[0]?.paid_at ??
    null;
  return typeof data === "string" && Number.isFinite(new Date(data).getTime()) ? data : null;
}

/**
 * Fim do período pago contado da DATA DO PAGAMENTO, não de agora: reenviar um
 * evento antigo (que a API confirma como pago) não pode render mais um período.
 */
export function fimDoPeriodo(paidAt: string, planoTipo: string): Date {
  const dias = planoTipo.includes("anual") ? 365 : 30;
  return new Date(new Date(paidAt).getTime() + dias * DIA_MS);
}
