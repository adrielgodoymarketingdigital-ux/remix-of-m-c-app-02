export interface RelatorioDispositivo {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  quantidadeVendida: number;
  receitaTotal: number;
  custoTotal: number;
  lucroTotal: number;
  ticketMedio: number;
}

export interface RelatorioProduto {
  id: string;
  nome: string;
  sku: string | null;
  quantidadeVendida: number;
  estoqueAtual: number;
  receitaTotal: number;
  custoTotal: number;
  lucroTotal: number;
  ticketMedio: number;
}

export interface RelatorioServico {
  id: string;
  nomeServico: string;
  quantidadeRealizada: number;
  receitaTotal: number;
  tempoMedioConclusao: number;
  statusDistribuicao: {
    pendente: number;
    em_andamento: number;
    concluido: number;
  };
}

export interface FiltrosRelatorioVendas {
  dataInicio?: string;
  dataFim?: string;
}
