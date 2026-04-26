export interface LucroPorItem {
  id: string;
  nome: string;
  tipo: "dispositivo" | "produto" | "servico";
  quantidadeVendida: number;
  custoTotal: number;
  receitaTotal: number;
  lucroTotal: number;
  margemLucro: number;
  parcelamentoDetalhes?: Array<{
    formaPagamento: "a_receber" | "a_prazo";
    parcelaNumero: number | null;
    totalParcelas: number | null;
    valorParcela: number;
  }>;
}

export interface CustoOperacional {
  mes: string;
  contas: number;
  total: number;
}

export interface ContaPagaDetalhe {
  id: string;
  nome: string;
  categoria: string | null;
  valor: number;
  data: string;
}

export interface TaxaCartaoDetalhe {
  id: string;
  nome: string;
  bandeira: string;
  valor: number;
  data: string;
  descricao: string;
}

export interface EvolucaoMensal {
  mes: string;
  receita: number;
  custo: number;
  lucro: number;
}

export interface ResumoFinanceiro {
  receitaTotal: number;
  custoTotal: number;
  lucroTotal: number;
  margemLucroMedia: number;
  custoOperacional: number;
  lucroLiquido: number;
  taxasCartao: number;
  contasPagasDetalhes?: ContaPagaDetalhe[];
  taxasCartaoDetalhes?: TaxaCartaoDetalhe[];
}

export interface FiltrosRelatorio {
  dataInicio: string;
  dataFim: string;
  tipo?: "dispositivo" | "produto" | "todos";
}
