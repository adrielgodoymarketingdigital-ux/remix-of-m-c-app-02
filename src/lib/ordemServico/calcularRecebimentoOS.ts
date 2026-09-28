import { supabase } from "@/integrations/supabase/client";

export interface ContaReceberOS {
  id: string;
  status: string | null;
  valor: number | null;
  valor_pago: number | null;
  data_vencimento: string | null;
}

interface OrdemRecebimentoLike {
  total?: number | string | null;
  avarias?: unknown;
}

interface DadosPagamentoLike {
  entrada?: number | string | null;
  saldo_cancelado?: boolean;
  data_vencimento_prazo?: string | null;
}

export interface RecebimentoOS {
  /** ordens_servico.total — só referência interna, o recibo não exibe. */
  total: number;
  /** Valor efetivamente recebido até agora. */
  recebido: number;
  /** Saldo em aberto (0 quando quitada ou saldo cancelado). */
  aReceber: number;
  /** Vencimento do saldo (YYYY-MM-DD). null = sem prazo definido. */
  vencimentoSaldo: string | null;
}

const toNumber = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const arredondar = (v: number): number => Math.round(v * 100) / 100;

// "pago" em conta a receber é legado (8 linhas em prod, set/2026) — mesmo
// significado de "recebido" para efeito de recibo.
const isContaQuitada = (c: ContaReceberOS) => c.status === "recebido" || c.status === "pago";

/**
 * Quanto de uma OS já foi recebido e quanto falta, para o recibo ao cliente.
 *
 * Âncora = ordens_servico.total, porque `contas.valor` tem semânticas
 * diferentes nos dois modelos (antigo: saldo; novo: total — e a edição/entrega
 * de OS ainda grava no modelo antigo, ver DIVIDA-TECNICA.md). Regras:
 * - alguma conta a receber quitada → recebido = total
 * - saldo_cancelado → recebido = entrada, nada a receber
 * - conta pendente → recebido = valor_pago (ou entrada, se vazio)
 * - sem conta → recebido = entrada
 * Contas duplicadas: qualquer quitada vence; senão a pendente de maior valor_pago.
 *
 * NÃO usar getValorFaturavelOS aqui — aquilo é faturamento, não dinheiro recebido.
 */
export function calcularRecebimentoOS(ordem: OrdemRecebimentoLike, contas: ContaReceberOS[]): RecebimentoOS {
  const total = toNumber(ordem.total);
  const dadosPagamento = (ordem.avarias as { dados_pagamento?: DadosPagamentoLike } | null | undefined)?.dados_pagamento;
  const entrada = toNumber(dadosPagamento?.entrada);

  const montar = (recebidoBruto: number, vencimento: string | null, semSaldo = false): RecebimentoOS => {
    const recebido = arredondar(Math.min(Math.max(recebidoBruto, 0), total));
    const aReceber = semSaldo ? 0 : arredondar(Math.max(total - recebido, 0));
    return { total, recebido, aReceber, vencimentoSaldo: aReceber > 0 ? vencimento : null };
  };

  if (contas.some(isContaQuitada)) return montar(total, null);

  if (dadosPagamento?.saldo_cancelado === true) return montar(entrada, null, true);

  const pendentes = contas.filter((c) => c.status === "pendente");
  if (pendentes.length > 0) {
    const conta = pendentes.reduce((maior, c) => (toNumber(c.valor_pago) > toNumber(maior.valor_pago) ? c : maior));
    const valorPago = toNumber(conta.valor_pago);
    return montar(valorPago > 0 ? valorPago : entrada, conta.data_vencimento);
  }

  const vencimentoPrazo = dadosPagamento?.data_vencimento_prazo;
  return montar(entrada, vencimentoPrazo && vencimentoPrazo !== "sem_prazo" ? vencimentoPrazo : null);
}

/**
 * Contas a receber vinculadas à OS. Busca o user_id (dono) pela própria OS —
 * o tipo OrdemServico do front não carrega user_id, e os_numero só é único
 * dentro do mesmo dono.
 */
export async function buscarContasReceberOS(ordemId: string, numeroOS: string): Promise<ContaReceberOS[]> {
  const { data: os, error: erroOS } = await supabase
    .from("ordens_servico")
    .select("user_id")
    .eq("id", ordemId)
    .single();
  if (erroOS) throw erroOS;
  if (!os?.user_id) return [];

  const { data, error } = await supabase
    .from("contas")
    .select("id, status, valor, valor_pago, data_vencimento")
    .eq("user_id", os.user_id)
    .eq("os_numero", numeroOS)
    .eq("tipo", "receber");
  if (error) throw error;
  return data ?? [];
}
