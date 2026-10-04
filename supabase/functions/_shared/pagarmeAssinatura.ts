// Cancelamento de assinatura recorrente na Pagar.me compartilhado entre as
// funções (webhook, upgrade no cartão, cancelamentos). Regra de ordem: o id é
// tirado do banco ANTES do DELETE, para o subscription.canceled que a Pagar.me
// dispara em seguida não encontrar a linha e não reprocessar a assinatura.

// deno-lint-ignore no-explicit-any
export type AdminClient = any;

export const PAGARME_API = "https://api.pagar.me/core/v5";

export type OpcoesPagarme = { fetchFn?: typeof fetch; pagarmeKey?: string | undefined };

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAGARME] ${step}${d}`);
};

/** Grava um aviso para o admin. Nunca lança: o aviso não pode derrubar o fluxo principal. */
export async function avisarAdmin(supabaseAdmin: AdminClient, aviso: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("admin_notifications").insert(aviso);
  } catch (err) {
    log("⚠️ Erro ao gravar aviso para o admin", { error: String(err) });
  }
}

export interface ResultadoDelete {
  /** 2xx da Pagar.me. */
  ok: boolean;
  /** Status HTTP, ou null quando nem chegou a responder (sem chave, rede). */
  status: number | null;
  motivo: string | null;
}

/** DELETE /subscriptions/{id}. Nunca lança: o chamador decide o que é falha. */
export async function deletarAssinaturaPagarme(subscriptionId: string, opts: OpcoesPagarme = {}): Promise<ResultadoDelete> {
  const fetchFn = opts.fetchFn ?? fetch;
  const pagarmeKey = "pagarmeKey" in opts ? opts.pagarmeKey : Deno.env.get("PAGARME_SECRET_KEY");
  if (!pagarmeKey) return { ok: false, status: null, motivo: "PAGARME_SECRET_KEY não configurada" };
  try {
    const res = await fetchFn(`${PAGARME_API}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${pagarmeKey}:`)}`,
      },
    });
    if (res.ok) {
      await res.body?.cancel();
      return { ok: true, status: res.status, motivo: null };
    }
    const corpo = await res.text().catch(() => "");
    return { ok: false, status: res.status, motivo: `Pagar.me respondeu ${res.status}: ${corpo.substring(0, 200)}` };
  } catch (err) {
    return { ok: false, status: null, motivo: String(err) };
  }
}

/** Sucesso ou 404 (a assinatura já não existe/está cancelada na Pagar.me). */
export const cancelamentoConcluido = (r: ResultadoDelete) => r.ok || r.status === 404;

/**
 * Cancela na Pagar.me uma assinatura de cartão que não deve mais cobrar (cliente
 * renovou por PIX, ou fez upgrade e ganhou uma assinatura nova). Limpa
 * pagarme_subscription_id no banco ANTES do DELETE — só se a linha ainda aponta
 * para ela. Nunca lança: em qualquer falha só avisa o admin e o fluxo segue.
 */
export async function cancelarAssinaturaCartaoAntiga(
  supabaseAdmin: AdminClient,
  params: { assinaturaId: string; userId: string; subscriptionId: string; orderId?: string | null },
  opts: OpcoesPagarme & { tituloAviso?: string } = {}
): Promise<"cancelada" | "falhou"> {
  const { assinaturaId, userId, subscriptionId, orderId } = params;

  const falhou = async (motivo: string) => {
    log("⚠️ Não foi possível cancelar a assinatura de cartão antiga", { userId, subscriptionId, motivo });
    await avisarAdmin(supabaseAdmin, {
      tipo: "cancelamento_cartao_falhou",
      titulo: opts.tituloAviso ?? "Renovou por PIX, mas a assinatura de cartão antiga não foi cancelada",
      mensagem: `Cancele a assinatura ${subscriptionId} manualmente na Pagar.me. Motivo: ${motivo}`,
      dados: { user_id: userId, subscription_id: subscriptionId, pagarme_order_id: orderId ?? null, motivo },
    });
    return "falhou" as const;
  };

  try {
    const { error: errLimpar } = await supabaseAdmin
      .from("assinaturas")
      .update({ pagarme_subscription_id: null })
      .eq("id", assinaturaId)
      .eq("pagarme_subscription_id", subscriptionId);
    // Sem limpar o banco, cancelar na Pagar.me faria o subscription.canceled marcar a assinatura como canceled.
    if (errLimpar) return await falhou(`erro ao limpar pagarme_subscription_id: ${errLimpar.message}`);

    const r = await deletarAssinaturaPagarme(subscriptionId, opts);
    if (!r.ok) return await falhou(r.motivo ?? "erro desconhecido");

    log("🧹 Assinatura de cartão antiga cancelada", { userId, subscriptionId, orderId });
    return "cancelada";
  } catch (err) {
    return await falhou(String(err));
  }
}
