// Troca de cartão na Pagar.me + cobrança da fatura em atraso, sem Supabase
// (fetch injetável), para o index.ts só cuidar de auth, banco e resposta HTTP.
//
// Quando o acesso pago NÃO está valendo (acessoPagoValido), a decisão vem da
// Pagar.me, não do status local: consulta a assinatura e as faturas antes.
//   - cancelada/inexistente lá → não troca nada; o cliente precisa assinar de novo;
//   - viva → troca o cartão e cobra a fatura failed (uma tentativa, como antes);
//     sem fatura em atraso → informa a data da próxima cobrança.
// Nunca cria cobrança avulsa nem retenta mais de uma vez (ver cobrarFaturaEmAberto).
import {
  type AssinaturaLocal,
  type OpcoesPagarme,
  PAGARME_API,
  PLANOS_PAGOS,
  type ResultadoCobranca,
  acessoPagoValido,
  cobrarFaturaEmAberto,
  consultarAssinatura,
  mensagemGateway,
} from "./cobrarFaturaEmAberto.ts";

export interface AssinaturaTroca extends AssinaturaLocal {
  pagarme_subscription_id: string;
  pagarme_customer_id: string;
}

export const MSG_CANCELADA =
  "Sua assinatura foi cancelada. Assine novamente para voltar a ter acesso.";
export const MSG_INEXISTENTE =
  "Não encontramos sua assinatura no cartão. Assine novamente para voltar a ter acesso.";

export type RespostaTroca =
  | {
      trocou: false;
      corpo: { success: false; cobranca: "assinatura_cancelada_reassinar" | "assinatura_inexistente"; mensagem: string; status_assinatura: string | null };
    }
  | {
      trocou: true;
      cardId: string;
      /** Plano da assinatura na Pagar.me (metadata.plano_tipo), quando foi consultada. */
      planoPagarme: string | null;
      corpo: {
        success: true;
        card_id: string;
        last_four_digits?: string;
        brand?: string;
        status_assinatura: string | null;
        acesso_pago_valido: boolean;
      } & ResultadoCobranca;
    };

/** Lança Error com a mensagem do gateway quando não dá para consultar, salvar o cartão ou trocá-lo. */
export async function trocarCartao(
  assinatura: AssinaturaTroca,
  cardToken: string,
  agora: Date,
  opts: OpcoesPagarme,
): Promise<RespostaTroca> {
  const fetchFn = opts.fetchFn ?? fetch;
  const log = opts.log ?? (() => {});
  const subId = assinatura.pagarme_subscription_id;
  const acessoValido = acessoPagoValido(assinatura, agora);

  // 1. Acesso pago não valendo: antes de mexer em qualquer coisa, a Pagar.me diz o que existe.
  let proximaCobrancaEm: string | null = null;
  let planoPagarme: string | null = null;
  if (!acessoValido) {
    const consulta = await consultarAssinatura(subId, opts);
    if ("erro" in consulta) {
      log("Erro ao consultar assinatura", { erro: consulta.erro });
      throw new Error("Não foi possível consultar sua assinatura na Pagar.me. Tente novamente em instantes.");
    }
    if (consulta.situacao === "cancelada" || consulta.situacao === "inexistente") {
      log("Assinatura sem uso na Pagar.me — nada trocado", { subscriptionId: subId, situacao: consulta.situacao });
      return {
        trocou: false,
        corpo: {
          success: false,
          cobranca: consulta.situacao === "cancelada" ? "assinatura_cancelada_reassinar" : "assinatura_inexistente",
          mensagem: consulta.situacao === "cancelada" ? MSG_CANCELADA : MSG_INEXISTENTE,
          status_assinatura: assinatura.status,
        },
      };
    }
    proximaCobrancaEm = consulta.proximaCobrancaEm;
    planoPagarme = consulta.planoTipo;
  }

  // 2. Cria o novo cartão no customer a partir do token
  log("Criando novo cartão", { customerId: assinatura.pagarme_customer_id });
  const cardRes = await fetchFn(`${PAGARME_API}/customers/${assinatura.pagarme_customer_id}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: opts.pagarmeAuth },
    body: JSON.stringify({ token: cardToken }),
  });
  const cardData = await cardRes.json().catch(() => null);
  if (!cardRes.ok) {
    log("Erro ao criar cartão", { status: cardRes.status, erro: mensagemGateway(cardData) });
    throw new Error(mensagemGateway(cardData) || "Falha ao salvar novo cartão.");
  }
  const cardId = cardData.id as string;

  // 3. A assinatura passa a usar o novo cartão
  log("Atualizando card_id na subscription", { cardId });
  const subRes = await fetchFn(`${PAGARME_API}/subscriptions/${subId}/card`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: opts.pagarmeAuth },
    body: JSON.stringify({ card_id: cardId }),
  });
  const subData = await subRes.json().catch(() => null);
  if (!subRes.ok) {
    log("Erro ao atualizar subscription", { status: subRes.status, erro: mensagemGateway(subData) });
    throw new Error(mensagemGateway(subData) || "Falha ao vincular novo cartão à assinatura.");
  }

  // 4. Acesso não valendo: cobra a fatura em atraso (ou informa a próxima cobrança).
  // A liberação do acesso continua sendo do webhook (charge.paid confirmado na API).
  const resultado: ResultadoCobranca = acessoValido
    ? { cobranca: "nao_necessaria" }
    : await cobrarFaturaEmAberto(subId, cardId, opts, proximaCobrancaEm);
  log("Resultado da cobrança", resultado);

  return {
    trocou: true,
    cardId,
    planoPagarme,
    corpo: {
      success: true,
      card_id: cardId,
      last_four_digits: cardData.last_four_digits,
      brand: cardData.brand,
      status_assinatura: assinatura.status,
      acesso_pago_valido: acessoValido,
      ...resultado,
    },
  };
}

/**
 * Cobrança paga (confirmada pela própria API da Pagar.me) numa conta cujo plano
 * local NÃO é pago — ex.: virou Free ao fim de uma liberação temporária. O webhook
 * de renovação só atualiza status/data_fim, não o plano: sem isto o cliente pagaria
 * e continuaria no Free. Devolve o plano a restaurar (o da assinatura na Pagar.me;
 * senão o plano anterior conhecido) ou null quando não há nada a restaurar.
 */
export function planoParaRestaurar(
  planoLocal: string | null,
  resultado: ResultadoCobranca,
  planoPagarme: string | null,
  planoAnteriorConhecido: string | null,
): string | null {
  if (resultado.cobranca !== "paga") return null;
  if (PLANOS_PAGOS.includes(planoLocal ?? "")) return null;
  if (planoPagarme && PLANOS_PAGOS.includes(planoPagarme)) return planoPagarme;
  if (planoAnteriorConhecido && PLANOS_PAGOS.includes(planoAnteriorConhecido)) return planoAnteriorConhecido;
  return null;
}

/** Mesmo período do webhook (fimDoPeriodo em pagarme-webhook/confirmarNaPagarme.ts). */
export function fimDoPeriodoPago(pagoEm: Date, planoTipo: string): Date {
  const dias = planoTipo.includes("anual") ? 365 : 30;
  return new Date(pagoEm.getTime() + dias * 24 * 60 * 60 * 1000);
}
