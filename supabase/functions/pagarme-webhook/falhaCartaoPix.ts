// Cliente que renova por PIX mas ainda tem uma assinatura de cartão antiga na
// Pagar.me: ela segue tentando cobrar todo mês e cada falha marcava past_due,
// bloqueando quem já tinha pago o período por PIX. Aqui ficam a busca da
// assinatura, o tratamento das falhas de cobrança e o cancelamento da
// assinatura de cartão na renovação por PIX (testáveis sem subir o servidor).

import { type AdminClient, avisarAdmin } from "../_shared/pagarmeAssinatura.ts";

export type { AdminClient };
// O cancelamento da sub de cartão antiga também é usado pelo upgrade no cartão.
export { cancelarAssinaturaCartaoAntiga } from "../_shared/pagarmeAssinatura.ts";

export type AssinaturaMin = {
  id: string;
  user_id: string;
  plano_tipo: string;
  pagarme_subscription_id: string | null;
  payment_method: string | null;
  data_fim: string | null;
};

const DOIS_DIAS_MS = 2 * 24 * 60 * 60 * 1000;

const COLUNAS_ASSINATURA = "id, user_id, plano_tipo, pagarme_subscription_id, payment_method, data_fim";

export const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAGARME-WEBHOOK] ${step}${d}`);
};

// Mapeia subscription_id → user_id/plano via tabela `assinaturas`
export async function findAssinaturaBySubscription(
  supabaseAdmin: AdminClient,
  subscriptionId: string
) {
  const { data } = await supabaseAdmin
    .from("assinaturas")
    .select(COLUNAS_ASSINATURA)
    .eq("pagarme_subscription_id", subscriptionId)
    .maybeSingle();
  return data as AssinaturaMin | null;
}

// Fallback: busca por customer.code (user_id) quando pagarme_subscription_id é nulo
export async function findAssinaturaByCustomerCode(
  supabaseAdmin: AdminClient,
  customerCode: string
) {
  const { data } = await supabaseAdmin
    .from("assinaturas")
    .select(COLUNAS_ASSINATURA)
    .eq("user_id", customerCode)
    .maybeSingle();
  return data as AssinaturaMin | null;
}

/**
 * Falha que NÃO deve bloquear: o período atual foi pago por PIX e ainda vale
 * por mais de 2 dias. A Pagar.me cobra o cartão perto do vencimento, então uma
 * falha tão antes do fim só pode ser de uma assinatura de cartão antiga.
 */
export function falhaDeveSerIgnorada(
  assinatura: Pick<AssinaturaMin, "payment_method" | "data_fim">,
  agora: Date = new Date()
): boolean {
  if (assinatura.payment_method !== "pix" || !assinatura.data_fim) return false;
  const fim = new Date(assinatura.data_fim).getTime();
  return Number.isFinite(fim) && fim > agora.getTime() + DOIS_DIAS_MS;
}

/**
 * PIX de renovação do plano (e não primeira compra/troca de plano): gerado pelo
 * fluxo de renovação, ou pagando o mesmo plano que a assinatura já tinha.
 */
export function ehRenovacaoDoPlano(
  orderOrigem: string | null,
  planoAnterior: string | null,
  planoPago: string
): boolean {
  return orderOrigem === "renovacao" || (!!planoAnterior && planoAnterior === planoPago);
}

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Trata subscription/invoice/charge payment_failed. Retorna o payload da resposta. */
export async function processarFalhaCobranca(
  body: Record<string, unknown>,
  supabaseAdmin: AdminClient,
  agora: Date = new Date()
): Promise<Record<string, unknown>> {
  const data = body?.data as Record<string, unknown> | undefined;
  const eventType = (body?.type as string) || "";
  const subscriptionId =
    (data?.subscription_id as string) ??
    ((data?.subscription as Record<string, unknown>)?.id as string) ??
    ((data?.invoice as Record<string, unknown>)?.subscription_id as string) ??
    null;

  const customerCodeFailed =
    ((data?.customer as Record<string, unknown>)?.code as string) ??
    ((data?.subscription as Record<string, unknown>)?.customer as Record<string, unknown>)?.code as string ??
    null;

  if (!subscriptionId && !customerCodeFailed) {
    log("payment_failed sem subscription_id e sem customer.code");
    return { ignored: true };
  }

  let assinatura = subscriptionId
    ? await findAssinaturaBySubscription(supabaseAdmin, subscriptionId)
    : null;

  if (!assinatura && customerCodeFailed) {
    assinatura = await findAssinaturaByCustomerCode(supabaseAdmin, customerCodeFailed);
  }

  if (!assinatura) {
    return { warning: "assinatura_nao_encontrada" };
  }

  // Período pago por PIX ainda vigente: a falha é da assinatura de cartão antiga,
  // não do ciclo atual — mantém o acesso e avisa o admin para cancelá-la.
  if (falhaDeveSerIgnorada(assinatura, agora)) {
    const subParaCancelar = subscriptionId ?? assinatura.pagarme_subscription_id;
    await avisarAdmin(supabaseAdmin, {
      tipo: "falha_cartao_ignorada",
      titulo: "Cobrança de cartão antiga falhou — acesso mantido",
      mensagem: `Período pago por PIX até ${dataBR(assinatura.data_fim!)}. Cancele a assinatura ${subParaCancelar ?? "(sem id)"} na Pagar.me.`,
      dados: {
        user_id: assinatura.user_id,
        plano_tipo: assinatura.plano_tipo,
        subscription_id: subParaCancelar,
        data_fim: assinatura.data_fim,
        evento: eventType,
      },
    });
    log("Falha de cobrança ignorada — período pago por PIX", {
      userId: assinatura.user_id,
      subscriptionId: subParaCancelar,
      dataFim: assinatura.data_fim,
    });
    return { processed: true, ignored: true, reason: "periodo_pago_pix" };
  }

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "past_due",
      updated_at: agora.toISOString(),
    })
    .eq("id", assinatura.id);

  if (error) throw new Error(`Erro past_due: ${error.message}`);

  // Notifica admin
  await supabaseAdmin.from("admin_notifications").insert({
    tipo: "pagamento_falhou",
    titulo: "Pagamento recorrente falhou",
    mensagem: `Pagar.me não conseguiu cobrar a assinatura ${assinatura.plano_tipo}`,
    dados: {
      user_id: assinatura.user_id,
      subscription_id: subscriptionId,
    },
  });

  log("⚠️ Pagamento recorrente falhou", {
    userId: assinatura.user_id,
    subscriptionId,
  });

  return { processed: true, status: "past_due" };
}
