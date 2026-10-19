/**
 * "Plano vencido": cliente que já pagou e foi regravado como plano free
 * (cancelamento Ticto/Hotmart, "Cancelar Plano", check-subscription...).
 * Só muda TEXTOS na interface — acesso e limites continuam os do free.
 *
 * Quem tem plano pago (qualquer status: active, past_due, canceled) NÃO entra
 * aqui: segue a lógica atual (carência e bloqueio em useVerificacaoAcesso).
 *
 * Função pura, sem imports (roda também no deno test):
 *   deno test --no-check scripts/testes-plano-vencido/
 */

/** Nome amigável do plano, sem a periodicidade (vai no meio da frase). */
const NOMES_PLANO: Record<string, string> = {
  basico_mensal: "Básico",
  basico_anual: "Básico",
  intermediario_mensal: "Intermediário",
  intermediario_anual: "Intermediário",
  profissional_mensal: "Profissional",
  profissional_anual: "Profissional",
  profissional_ultra_mensal: "Profissional Ultra",
  profissional_ultra_anual: "Profissional Ultra",
};

/**
 * Campos lidos da assinatura (select("*")). plano_anterior / plano_vencido_em
 * podem ainda não existir no banco: são opcionais e só usados se vierem.
 */
export interface AssinaturaPlanoVencido {
  plano_tipo?: string | null;
  data_fim?: string | null;
  payment_provider?: string | null;
  pagarme_subscription_id?: string | null;
  pagarme_customer_id?: string | null;
  pagarme_card_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  ticto_order_id?: string | null;
  liberacao_temp_id?: string | null;
  plano_anterior?: string | null;
  plano_vencido_em?: string | null;
}

export interface ResultadoPlanoVencido {
  vencido: boolean;
  /** Nome amigável do plano anterior, quando conhecido (coluna plano_anterior). */
  planoAnterior?: string;
  /** Quando o plano venceu: plano_vencido_em, ou data_fim pela heurística. */
  vencidoEm?: string;
}

const preenchido = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** "Renove agora para voltar a usar todos os recursos do plano X." (sem " do plano X" se desconhecido). */
export function textoRenovarPlano(planoAnterior?: string): string {
  return `Renove agora para voltar a usar todos os recursos${planoAnterior ? ` do plano ${planoAnterior}` : ""}.`;
}

/** "plano X" ou só "plano" quando o nome é desconhecido. */
export function rotuloPlano(planoAnterior?: string): string {
  return planoAnterior ? `plano ${planoAnterior}` : "plano";
}

/** Nome amigável de um plano_tipo pago; undefined se não for plano pago conhecido. */
export function nomePlanoAmigavel(planoTipo: string | null | undefined): string | undefined {
  return planoTipo ? NOMES_PLANO[planoTipo] : undefined;
}

/**
 * vencido = plano free + sinal de que já foi pagante:
 *   - plano_anterior preenchido (coluna nova, se existir), OU
 *   - data_fim preenchido E (payment_provider OU algum id de gateway).
 * `agora` fica na assinatura para casar com o padrão das outras regras de plano
 * (hoje a decisão não depende do relógio: free com sinal de pagamento já venceu).
 */
export function planoVencido(
  assinatura: AssinaturaPlanoVencido | null | undefined,
  _agora: Date = new Date(),
): ResultadoPlanoVencido {
  if (!assinatura || assinatura.plano_tipo !== "free") return { vencido: false };
  // Liberação temporária do admin em andamento: não é "plano vencido"
  if (preenchido(assinatura.liberacao_temp_id)) return { vencido: false };

  if (preenchido(assinatura.plano_anterior)) {
    return {
      vencido: true,
      planoAnterior: nomePlanoAmigavel(assinatura.plano_anterior),
      vencidoEm: assinatura.plano_vencido_em || assinatura.data_fim || undefined,
    };
  }

  const temGateway = [
    assinatura.payment_provider,
    assinatura.pagarme_subscription_id,
    assinatura.pagarme_customer_id,
    assinatura.pagarme_card_id,
    assinatura.stripe_subscription_id,
    assinatura.stripe_customer_id,
    assinatura.ticto_order_id,
  ].some(preenchido);

  if (preenchido(assinatura.data_fim) && temGateway) {
    return { vencido: true, vencidoEm: assinatura.data_fim as string };
  }
  return { vencido: false };
}
