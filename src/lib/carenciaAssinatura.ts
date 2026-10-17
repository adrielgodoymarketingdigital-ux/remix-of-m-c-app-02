/**
 * Carência de acesso depois do vencimento da assinatura paga.
 *
 * Regra de negócio: o acesso só bloqueia DIAS_CARENCIA dias depois de
 * data_fim — com status 'active' (webhook/cron ainda não rodou) e também com
 * 'past_due'/'unpaid' (o gateway avisou que a cobrança falhou no dia).
 *
 * Funções puras: o "agora" é sempre parâmetro (nada de Date.now() aqui
 * dentro), para dar para testar. Sem imports, para rodar também no deno test:
 *   deno test src/lib/carenciaAssinatura.test.ts
 */

export const DIAS_CARENCIA = 3;

const CARENCIA_MS = DIAS_CARENCIA * 24 * 60 * 60 * 1000;

const PLANOS_PAGOS = [
  "basico_mensal", "basico_anual",
  "intermediario_mensal", "intermediario_anual",
  "profissional_mensal", "profissional_anual",
  "profissional_ultra_mensal", "profissional_ultra_anual",
];

const STATUS_PAGAMENTO_ATRASADO = ["past_due", "unpaid"];

type Instante = string | Date | null | undefined;

function emMs(instante: Instante): number | null {
  if (!instante) return null;
  const ms = new Date(instante).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Instante em que a carência acaba (vencimento + DIAS_CARENCIA). null se a data for nula/inválida. */
export function fimDaCarencia(dataFim: Instante): Date | null {
  const ms = emMs(dataFim);
  return ms === null ? null : new Date(ms + CARENCIA_MS);
}

/** true quando agora < dataFim + DIAS_CARENCIA. Data nula/inválida = false (bloqueia). */
export function dentroDaCarencia(dataFim: Instante, agora: Date): boolean {
  const fim = fimDaCarencia(dataFim);
  return fim !== null && agora.getTime() < fim.getTime();
}

/**
 * true só quando há data válida e a carência já acabou. Data nula/inválida =
 * false: para status 'active' o app sempre confiou no status nesse caso.
 */
export function carenciaEsgotada(dataFim: Instante, agora: Date): boolean {
  return fimDaCarencia(dataFim) !== null && !dentroDaCarencia(dataFim, agora);
}

interface AssinaturaCarencia {
  plano_tipo?: string | null;
  status?: string | null;
  data_fim?: string | null;
  updated_at?: string | null;
}

/**
 * Quanto antes de data_fim o gateway pode tentar a cobrança da renovação: a
 * Pagar.me cobra de madrugada no dia do aniversário (e em fevereiro até 2 dias
 * antes de data_fim = paid_at + 30 dias). Mesma folga de falhaDeveSerIgnorada
 * (supabase/functions/pagarme-webhook/falhaCartaoPix.ts).
 */
const FOLGA_COBRANCA_ANTECIPADA_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Vencimento de referência de uma cobrança que falhou (past_due/unpaid).
 * Os webhooks gravam past_due com updated_at = agora e NÃO mexem em data_fim.
 *
 * Normalmente é o próprio data_fim. Teto: nunca depois de 2 dias da falha
 * (updated_at). Por quê: a assinatura de cartão nova nasce com data_fim =
 * hoje + 30 dias ainda com a cobrança pendente (create-pagarme-subscription);
 * se essa primeira cobrança falhar, fica past_due com data_fim 30 dias no
 * futuro sem nada pago — sem o teto, a carência liberaria ~33 dias de graça.
 * Na renovação a falha chega no máximo 2 dias antes de data_fim, então o teto
 * não encurta a carência dela. Nunca passa de data_fim + DIAS_CARENCIA.
 */
export function vencimentoDaCobrancaAtrasada(assinatura: AssinaturaCarencia): Date | null {
  const fim = emMs(assinatura.data_fim);
  if (fim === null) return null;
  const falha = emMs(assinatura.updated_at);
  return new Date(falha === null ? fim : Math.min(fim, falha + FOLGA_COBRANCA_ANTECIPADA_MS));
}

/** Instante em que o acesso de um plano pago com pagamento atrasado bloqueia. */
export function fimDaCarenciaPagamentoAtrasado(assinatura: AssinaturaCarencia): Date | null {
  return fimDaCarencia(vencimentoDaCobrancaAtrasada(assinatura));
}

/**
 * Plano PAGO com status past_due/unpaid que ainda está dentro da carência
 * (deve continuar liberado). Fora disso — outros status, trial, free,
 * demonstração, sem data_fim — retorna false e o app segue a regra de antes.
 */
export function pagamentoAtrasadoEmCarencia(assinatura: AssinaturaCarencia | null | undefined, agora: Date): boolean {
  if (!assinatura) return false;
  if (!PLANOS_PAGOS.includes(assinatura.plano_tipo ?? "")) return false;
  if (!STATUS_PAGAMENTO_ATRASADO.includes(assinatura.status ?? "")) return false;
  return dentroDaCarencia(vencimentoDaCobrancaAtrasada(assinatura), agora);
}
