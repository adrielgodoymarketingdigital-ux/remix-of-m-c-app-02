/**
 * Regras puras da aba Lista de Compras no computador (≥1024px): o resumo de uma lista
 * aberta, calculado sobre os itens que useItensLista já carregou (nenhuma consulta nova).
 * Sem dependências (testado com Deno em scripts/testes-pedidos-layout/).
 */

export interface ItemDaLista {
  concluido: boolean;
}

export interface ResumoItensLista {
  total: number;
  pendentes: number;
  comprados: number;
  /** % inteiro de comprados sobre o total (lista vazia = 0). */
  percentualComprado: number;
}

export function resumoItensLista(itens: readonly ItemDaLista[]): ResumoItensLista {
  const total = itens.length;
  const comprados = itens.filter((i) => i.concluido).length;
  return {
    total,
    pendentes: total - comprados,
    comprados,
    percentualComprado: total ? Math.floor((comprados / total) * 100) : 0,
  };
}
