/**
 * Textos e números da tela de Plano no computador. Só apresentação: não decide
 * acesso, limite nem cobrança. A fonte continua sendo types/plano.ts e types/assinatura.ts.
 *
 * Funções puras, sem imports (rodam também no deno test):
 *   deno test --no-check scripts/testes-apresentacao-plano/
 */

/** Nomes de quem não tem cartão em PLANOS. */
const NOMES_FORA_DO_CATALOGO: Record<string, string> = {
  admin: "Plano Admin",
  trial: "Período de Teste",
  demonstracao: "Demonstração",
};

/** Nome exibido no card do plano atual. */
export function nomePlanoAtual(
  planoTipo: string | null | undefined,
  planos: Record<string, { nome: string }>,
): string {
  if (!planoTipo) return "";
  return planos[planoTipo]?.nome ?? NOMES_FORA_DO_CATALOGO[planoTipo] ?? planoTipo.replace(/_/g, " ");
}

/** Público de cada plano: mesmos textos de landing-v4/components/Planos.tsx. O Free não tem. */
const DESCRICOES_POR_NIVEL: Record<string, string> = {
  basico: "Para quem está começando",
  intermediario: "Para a loja que está crescendo",
  profissional: "Para operações maiores",
  profissional_ultra: "Para redes e múltiplas filiais",
};

export function descricaoPlano(planoKey: string): string | undefined {
  return DESCRICOES_POR_NIVEL[planoKey.replace(/_(mensal|anual)$/, "")];
}

/** Tira os "✅" e "🔜" do começo do recurso (o cartão já desenha o próprio ícone). */
export function limparRecurso(recurso: string): string {
  return recurso.replace(/^[\s✅\u{1F51C}️]+/u, "");
}

export interface DescontoAnual {
  valorMensalEquivalente: number;
  economia: number;
  percentualDesconto: number;
}

/** Desconto real do anual contra 12 mensalidades. null se um dos dois planos não existir. */
export function descontoAnual(
  keyAnual: string,
  planos: Record<string, { preco: number }>,
): DescontoAnual | null {
  if (!keyAnual.endsWith("_anual")) return null;
  const mensal = planos[keyAnual.replace("_anual", "_mensal")];
  const anual = planos[keyAnual];
  if (!mensal || !anual) return null;

  const precoMensalTotal = mensal.preco * 12;
  const economia = precoMensalTotal - anual.preco;
  return {
    valorMensalEquivalente: anual.preco / 12,
    economia,
    percentualDesconto: Math.round((economia / precoMensalTotal) * 100 * 10) / 10,
  };
}

/** "20,1%" (sempre com uma casa, como os preços em pt-BR). */
export function formatarPercentual(percentual: number): string {
  return `${percentual.toFixed(1).replace(".", ",")}%`;
}

/** Limite de armazenamento do plano. -1 é ilimitado (admin). */
export function textoLimiteArmazenamento(mb: number): string {
  if (mb < 0) return "Ilimitado";
  return mb >= 1000 ? `${mb / 1000}GB` : `${mb}MB`;
}

/** Período em que o seletor abre: o do plano atual, quando ele é anual. */
export function periodoDoPlano(planoTipo: string | null | undefined): "mensal" | "anual" {
  return planoTipo?.endsWith("_anual") ? "anual" : "mensal";
}

interface AssinaturaVencimento {
  plano_tipo?: string | null;
  payment_method?: string | null;
  pagarme_subscription_id?: string | null;
  data_fim?: string | null;
  data_proxima_cobranca?: string | null;
}

/**
 * Linha abaixo do nome do plano. null quando não há data a mostrar
 * (Free, admin, trial sem plano pago, temporário sem data).
 *
 * @param diasRestantes de getInfoPlanoCompacto (data_fim); 0 ou menos = já passou.
 * @param dataISO instante para YYYY-MM-DD de Brasília (partesDataHoraBrasilia).
 */
export function textoVencimentoPlano(
  assinatura: AssinaturaVencimento | null | undefined,
  diasRestantes: number | null,
  dataISO: (instante: string) => string,
): string | null {
  if (!assinatura || !/_(mensal|anual)$/.test(assinatura.plano_tipo ?? "")) return null;

  const dataBR = (instante: string) => dataISO(instante).split("-").reverse().join("/");
  const recorrenteNoCartao = assinatura.payment_method === "credit_card" && !!assinatura.pagarme_subscription_id;
  const data = recorrenteNoCartao
    ? assinatura.data_proxima_cobranca || assinatura.data_fim
    : assinatura.data_fim;
  if (!data) return null;

  if (diasRestantes !== null && diasRestantes <= 0) return `Venceu em ${dataBR(data)}`;
  if (recorrenteNoCartao) return `Próxima cobrança em ${dataBR(data)}`;
  if (diasRestantes === null) return `Vence em ${dataBR(data)}`;
  return `Vence em ${dataBR(data)} · ${diasRestantes === 1 ? "falta 1 dia" : `faltam ${diasRestantes} dias`}`;
}
