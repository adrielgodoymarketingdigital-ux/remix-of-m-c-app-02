// Criação da assinatura no cartão (passos 6 a 8 do create-pagarme-subscription).
// Upgrade/nova assinatura com uma anterior ainda ligada à conta: o id novo é
// gravado ANTES de cancelar a anterior, para o subscription.canceled dela não
// encontrar a linha. Se a criação na API falha, nada muda no banco.
import {
  type AdminClient,
  type OpcoesPagarme,
  PAGARME_API,
  avisarAdmin,
  cancelarAssinaturaCartaoAntiga,
} from "../_shared/pagarmeAssinatura.ts";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PAGARME-SUBSCRIPTION] ${step}${d}`);
};

export const extractGatewayMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const errors = (payload as Record<string, unknown>).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as Record<string, unknown>;
    if (typeof first?.message === "string") return first.message;
  }
  const message = (payload as Record<string, unknown>).message;
  if (typeof message === "string") return message;
  return null;
};

export async function criarEGravarAssinatura(
  supabaseAdmin: AdminClient,
  params: {
    userId: string;
    plano: string;
    customerId: string;
    subscriptionPayload: Record<string, unknown>;
    /** pagarme_subscription_id que a conta tinha antes desta compra. */
    subscriptionIdAnterior: string | null;
  },
  opts: OpcoesPagarme = {}
  // deno-lint-ignore no-explicit-any
): Promise<{ subData: any; paymentApproved: boolean }> {
  const { userId, plano, customerId, subscriptionPayload, subscriptionIdAnterior } = params;
  const fetchFn = opts.fetchFn ?? fetch;
  const pagarmeKey = "pagarmeKey" in opts ? opts.pagarmeKey : Deno.env.get("PAGARME_SECRET_KEY");
  const pagarmeAuth = `Basic ${btoa(`${pagarmeKey}:`)}`;

  const subRes = await fetchFn(`${PAGARME_API}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: pagarmeAuth,
    },
    body: JSON.stringify(subscriptionPayload),
  });
  const subData = await subRes.json();

  if (!subRes.ok) {
    log("Erro ao criar subscription", {
      status: subRes.status,
      body: JSON.stringify(subData),
      payload_sent: JSON.stringify(subscriptionPayload),
    });
    throw new Error(
      extractGatewayMessage(subData) ||
        "Falha ao criar assinatura na Pagar.me."
    );
  }

  // ── 7. Verificar status da primeira cobrança ─────────────────────
  const currentCharge = subData.current_charge ?? subData.charges?.[0];
  const chargeStatus = currentCharge?.status;
  const lastTransaction = currentCharge?.last_transaction;
  const cardId =
    lastTransaction?.card?.id ??
    currentCharge?.card?.id ??
    null;

  log("Subscription criada", {
    subscriptionId: subData.id,
    subscriptionStatus: subData.status,
    chargeStatus,
    lastTransactionStatus: lastTransaction?.status,
    acquirerMessage: lastTransaction?.acquirer_message,
    gatewayResponse: JSON.stringify(lastTransaction?.gateway_response),
  });

  // "pending" na primeira cobrança é normal na Pagar.me — significa processando
  const paymentApproved =
    subData.status === "active" ||
    subData.status === "pending" ||
    chargeStatus === "paid" ||
    chargeStatus === "captured" ||
    chargeStatus === "pending" ||
    chargeStatus === "processing";

  if (
    chargeStatus === "failed" ||
    lastTransaction?.status === "not_authorized" ||
    lastTransaction?.status === "refused"
  ) {
    const reason =
      extractGatewayMessage(lastTransaction?.gateway_response) ||
      lastTransaction?.acquirer_message ||
      "Cartão recusado pela operadora.";
    log("Cobrança recusada", { reason });
    throw new Error(`Pagamento recusado: ${reason}`);
  }

  // ── 8. Atualizar/criar registro em assinaturas ───────────────────
  const isAnual = plano.includes("anual");
  const dataInicio = new Date().toISOString();
  const dataFim = new Date(
    Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000
  ).toISOString();

  const baseData = {
    plano_tipo: plano,
    status: paymentApproved ? "active" : "pending",
    data_inicio: dataInicio,
    data_fim: dataFim,
    data_proxima_cobranca: dataFim,
    payment_provider: "pagarme",
    payment_method: "credit_card",
    pagarme_customer_id: customerId,
    pagarme_subscription_id: subData.id,
    pagarme_card_id: cardId,
    updated_at: dataInicio,
  };

  const { data: assinaturaExistente } = await supabaseAdmin
    .from("assinaturas")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let erroGravacao: string | null = null;
  if (assinaturaExistente) {
    const { error } = await supabaseAdmin
      .from("assinaturas")
      .update(baseData)
      .eq("user_id", userId);
    erroGravacao = error?.message ?? null;

    // Remover bloqueio "ate_assinar"
    await supabaseAdmin
      .from("assinaturas")
      .update({
        bloqueado_admin: false,
        bloqueado_admin_em: null,
        bloqueado_admin_motivo: null,
        bloqueado_tipo: null,
      })
      .eq("user_id", userId)
      .eq("bloqueado_tipo", "ate_assinar");

    log("Assinatura atualizada", { userId });
  } else {
    const { error } = await supabaseAdmin
      .from("assinaturas")
      .insert({ user_id: userId, ...baseData });
    erroGravacao = error?.message ?? null;
    log("Assinatura criada", { userId });
  }

  // ── 8.1 Cancelar a assinatura anterior (upgrade) ─────────────────
  if (subscriptionIdAnterior && subscriptionIdAnterior !== subData.id) {
    if (erroGravacao) {
      // O banco ainda aponta para a anterior: cancelá-la agora faria o subscription.canceled
      // marcar a conta como canceled. Fica para o admin, com os dois ids.
      log("⚠️ Id novo não gravado — assinatura anterior mantida", { userId, erroGravacao });
      await avisarAdmin(supabaseAdmin, {
        tipo: "cancelamento_cartao_falhou",
        titulo: "Upgrade no cartão: assinatura nova não foi gravada",
        mensagem: `A assinatura ${subData.id} foi criada na Pagar.me, mas não foi gravada no banco (${erroGravacao}). A anterior ${subscriptionIdAnterior} NÃO foi cancelada — confira as duas.`,
        dados: { user_id: userId, subscription_id: subscriptionIdAnterior, subscription_id_nova: subData.id, motivo: erroGravacao },
      });
    } else {
      log("Upgrade: cancelando assinatura anterior", { anterior: subscriptionIdAnterior, nova: subData.id });
      await cancelarAssinaturaCartaoAntiga(
        supabaseAdmin,
        { assinaturaId: assinaturaExistente?.id ?? "", userId, subscriptionId: subscriptionIdAnterior },
        { ...opts, tituloAviso: "Upgrade no cartão, mas a assinatura anterior não foi cancelada" },
      );
    }
  }

  return { subData, paymentApproved };
}
