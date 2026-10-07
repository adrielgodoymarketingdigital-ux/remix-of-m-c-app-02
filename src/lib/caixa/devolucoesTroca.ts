/**
 * Devoluções da diferença da troca (vendas_trocas.valor_devolvido) no caixa e
 * no Financeiro. Módulo puro: a leitura do banco fica em carregarDevolucoesTroca.ts.
 *
 * Regra do caixa: a devolução pertence ao caixa em que foi feita
 * (vendas_trocas.caixa_id). Em DINHEIRO ela saiu da gaveta e abate o dinheiro
 * esperado; em PIX é só informação (não mexe na gaveta). Devolução de troca
 * cancelada não entra (ver contaNoCaixa).
 */

export interface DevolucaoTrocaLida {
  valor_devolvido: number | string | null;
  forma_devolucao: string | null;
  cancelada: boolean | null;
}

export interface TotaisDevolucoesTroca {
  dinheiro: number;
  pix: number;
  quantidadeDinheiro: number;
  quantidadePix: number;
}

export const TOTAIS_DEVOLUCOES_ZERO: TotaisDevolucoesTroca = { dinheiro: 0, pix: 0, quantidadeDinheiro: 0, quantidadePix: 0 };

/** Devolução que entra nas contas: troca ativa e valor > 0. */
export const contaNoCaixa = (d: DevolucaoTrocaLida) => d.cancelada !== true && (Number(d.valor_devolvido) || 0) > 0;

/** Soma as devoluções por forma, em centavos exatos. */
export function somarDevolucoesTroca(devolucoes: DevolucaoTrocaLida[]): TotaisDevolucoesTroca {
  let dinheiroC = 0;
  let pixC = 0;
  let quantidadeDinheiro = 0;
  let quantidadePix = 0;
  for (const d of devolucoes) {
    if (!contaNoCaixa(d)) continue;
    const c = Math.round((Number(d.valor_devolvido) || 0) * 100);
    if (d.forma_devolucao === "dinheiro") { dinheiroC += c; quantidadeDinheiro++; }
    else if (d.forma_devolucao === "pix") { pixC += c; quantidadePix++; }
  }
  return { dinheiro: dinheiroC / 100, pix: pixC / 100, quantidadeDinheiro, quantidadePix };
}
