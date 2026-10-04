// "Cancelar assinatura" mantendo o acesso até o fim do período pago. O id sai do
// banco ANTES do DELETE, para o subscription.canceled da Pagar.me não reprocessar
// a linha; se o DELETE falha (não 404), o id volta e o usuário recebe o erro.
import {
  type AdminClient,
  type OpcoesPagarme,
  avisarAdmin,
  cancelamentoConcluido,
  deletarAssinaturaPagarme,
} from "../_shared/pagarmeAssinatura.ts";

export const MSG_FALHA_CANCELAMENTO = "Não foi possível cancelar agora, tente novamente.";

const log = (s: string, d?: unknown) =>
  console.log(`[CANCEL-PAGARME-SUB] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

export type ResultadoCancelamento =
  | { ok: true }
  | { ok: false; httpStatus: number; erro: string };

export async function cancelarMantendoAcesso(
  supabaseAdmin: AdminClient,
  userId: string,
  opts: OpcoesPagarme = {}
): Promise<ResultadoCancelamento> {
  const { data: assinatura } = await supabaseAdmin
    .from("assinaturas")
    .select("id, pagarme_subscription_id, status, plano_tipo")
    .eq("user_id", userId)
    .maybeSingle();

  if (!assinatura) {
    return { ok: false, httpStatus: 404, erro: "Nenhuma assinatura Pagar.me encontrada." };
  }

  const subscriptionId = assinatura.pagarme_subscription_id as string | null;

  // Se tem subscription recorrente na Pagar.me, cancela via API
  if (subscriptionId) {
    const { error: errLimpar } = await supabaseAdmin
      .from("assinaturas")
      .update({ pagarme_subscription_id: null })
      .eq("id", assinatura.id)
      .eq("pagarme_subscription_id", subscriptionId);
    if (errLimpar) {
      log("Erro ao limpar pagarme_subscription_id — nada cancelado", { userId, error: errLimpar.message });
      return { ok: false, httpStatus: 500, erro: MSG_FALHA_CANCELAMENTO };
    }

    log("Cancelando subscription recorrente na Pagar.me", { subscriptionId });
    const r = await deletarAssinaturaPagarme(subscriptionId, opts);

    if (!cancelamentoConcluido(r)) {
      log("Erro Pagar.me — restaurando o id", { subscriptionId, motivo: r.motivo });
      const { error: errRestaurar } = await supabaseAdmin
        .from("assinaturas")
        .update({ pagarme_subscription_id: subscriptionId })
        .eq("id", assinatura.id)
        .is("pagarme_subscription_id", null);
      if (errRestaurar) {
        // A assinatura segue ativa na Pagar.me, mas a conta perdeu o vínculo com ela.
        await avisarAdmin(supabaseAdmin, {
          tipo: "cancelamento_pagarme_falhou",
          titulo: "Cancelamento falhou e o id da assinatura não pôde ser restaurado",
          mensagem: `A Pagar.me não cancelou a assinatura ${subscriptionId} (${r.motivo}) e o id não voltou para a conta (${errRestaurar.message}). Ela segue cobrando: cancele manualmente ou restaure o id.`,
          dados: { user_id: userId, subscription_id: subscriptionId, motivo: r.motivo },
        });
      }
      return { ok: false, httpStatus: 502, erro: MSG_FALHA_CANCELAMENTO };
    }

    log(r.ok ? "Subscription cancelada na Pagar.me" : "Subscription já estava cancelada na Pagar.me (404)");
  } else {
    // PIX ou sem subscription recorrente: cancela apenas localmente
    log("Sem subscription_id — cancelamento apenas local (PIX/manual)", { userId });
  }

  // Marca local como canceled. Acesso continua até data_proxima_cobranca.
  await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assinatura.id);

  log("Cancelada com sucesso");
  return { ok: true };
}
