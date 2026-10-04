// "Cancelar plano" (volta ao free). A assinatura na Pagar.me tem que ser
// cancelada de verdade antes de soltar o id local: se o DELETE falha, limpar o
// id deixaria a assinatura cobrando o cartão sem dono no sistema.
import {
  type AdminClient,
  type OpcoesPagarme,
  avisarAdmin,
  cancelamentoConcluido,
  deletarAssinaturaPagarme,
} from "../_shared/pagarmeAssinatura.ts";

export const MSG_FALHA_CANCELAMENTO = "Não foi possível cancelar agora, tente novamente.";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

export type ResultadoCancelarPlano =
  | { success: true; message: string; was_trial: boolean }
  | { success: false; error: string; message: string };

export async function cancelarPlanoParaFree(
  supabaseClient: AdminClient,
  user: { id: string; email: string },
  opts: OpcoesPagarme = {}
): Promise<ResultadoCancelarPlano> {
  const { data: assinatura, error: assinaturaError } = await supabaseClient
    .from("assinaturas")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (assinaturaError || !assinatura) {
    throw new Error("Assinatura não encontrada");
  }
  logStep("Subscription found", {
    plano_tipo: assinatura.plano_tipo,
    status: assinatura.status,
    payment_provider: assinatura.payment_provider,
    pagarme_subscription_id: assinatura.pagarme_subscription_id,
  });

  const isTrialWithCard = assinatura.trial_with_card === true || assinatura.status === "trialing";
  const provider = assinatura.payment_provider;
  const subscriptionId = assinatura.pagarme_subscription_id as string | null;

  // Cancelar na Pagar.me se houver subscription recorrente
  if (subscriptionId) {
    logStep("Cancelando subscription na Pagar.me", { subscriptionId });
    const r = await deletarAssinaturaPagarme(subscriptionId, opts);

    if (!cancelamentoConcluido(r)) {
      // Não mexe no plano nem no id: a assinatura segue ativa na Pagar.me e precisa continuar ligada à conta.
      logStep("Falha ao cancelar na Pagar.me — plano mantido", { subscriptionId, motivo: r.motivo });
      await avisarAdmin(supabaseClient, {
        tipo: "cancelamento_pagarme_falhou",
        titulo: "Cancelamento de plano falhou na Pagar.me",
        mensagem: `Usuário ${user.email} tentou cancelar o plano, mas a Pagar.me não cancelou a assinatura ${subscriptionId}. Plano e assinatura mantidos. Motivo: ${r.motivo}`,
        dados: { user_id: user.id, email: user.email, subscription_id: subscriptionId, motivo: r.motivo },
      });
      return { success: false, error: MSG_FALHA_CANCELAMENTO, message: MSG_FALHA_CANCELAMENTO };
    }
    logStep(r.ok ? "Subscription cancelada na Pagar.me" : "Subscription já estava cancelada na Pagar.me (404)");
  } else {
    // PIX ou acesso manual: cancela apenas localmente
    logStep("Sem pagarme_subscription_id — cancelamento local apenas", {
      provider: provider || "sem provedor",
    });
  }

  // Baixar plano no banco
  const updateData: Record<string, unknown> = {
    plano_tipo: "free",
    status: "active",
    pagarme_subscription_id: null,
    data_fim: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    trial_with_card: false,
  };

  if (isTrialWithCard) {
    updateData.trial_canceled = true;
    updateData.trial_canceled_at = new Date().toISOString();
    logStep("Marking trial as canceled");
  }

  const { error: updateError } = await supabaseClient
    .from("assinaturas")
    .update(updateData)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Erro ao atualizar assinatura: ${updateError.message}`);
  }
  logStep("Subscription updated to free/active");

  await supabaseClient.from("admin_notifications").insert({
    tipo: isTrialWithCard ? "trial_cancelado" : "cancelamento",
    titulo: isTrialWithCard ? "Trial cancelado pelo usuário" : "Assinatura cancelada",
    mensagem: isTrialWithCard
      ? `Usuário ${user.email} cancelou o trial antes de converter`
      : `Usuário ${user.email} cancelou a assinatura (${provider || "sem provedor"})`,
    dados: {
      user_id: user.id,
      email: user.email,
      plano_anterior: assinatura.plano_tipo,
      payment_provider: provider,
      was_trial: isTrialWithCard,
    },
  });

  const message = isTrialWithCard
    ? "Trial cancelado com sucesso. Você pode assinar um plano quando quiser."
    : "Plano cancelado com sucesso. Você foi movido para o plano gratuito.";

  return { success: true, message, was_trial: isTrialWithCard };
}
