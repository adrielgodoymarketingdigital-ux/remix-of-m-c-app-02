export type TipoVenda = "dispositivo" | "produto" | "servico";

export interface Venda {
  id: string;
  data: string;
  tipo: TipoVenda;
  cliente_id: string | null;
  dispositivo_id: string | null;
  produto_id: string | null;
  peca_id: string | null;
  quantidade: number;
  total: number;
  custo_unitario?: number;
  valor_desconto_manual?: number;
  valor_desconto_cupom?: number;
  forma_pagamento: "dinheiro" | "pix" | "debito" | "credito" | "credito_parcelado" | "a_receber" | "a_prazo" | null;
  user_id: string | null;
  cancelada?: boolean;
  data_cancelamento?: string | null;
  motivo_cancelamento?: string | null;
  estorno_estoque?: boolean;
  data_prevista_recebimento?: string | null;
  recebido?: boolean;
  data_recebimento?: string | null;
  parcela_numero?: number | null;
  total_parcelas?: number | null;
  clientes?: {
    nome: string;
    telefone: string | null;
  } | null;
  dispositivos?: {
    tipo: string;
    marca: string;
    modelo: string;
  } | null;
  produtos?: {
    nome: string;
    sku: string | null;
  } | null;
  pecas?: {
    nome: string;
  } | null;
  ordens_servico?: {
    numero_os: string;
    servico_id: string | null;
    servicos?: {
      nome: string;
    } | null;
  } | null;
  grupo_venda?: string | null;
  funcionario_id?: string | null;
  segunda_forma_pagamento?: string | null;
  valor_segunda_forma?: number | null;
}

export interface ResumoVendas {
  totalVendas: number;
  vendasDispositivos: number;
  vendasProdutos: number;
  vendasServicos: number;
  totalFaturado: number;
}

export interface VendasPorPeriodo {
  data: string;
  total: number;
  quantidade: number;
}

export interface ResumoAReceber {
  totalAReceber: number;
  quantidadeVendas: number;
  vendasVencidas: number;
  vendasVencendo: number;
}

// Interface para venda com múltiplos itens no PDV
export interface VendaGrupo {
  grupo_venda: string;
  itens: Venda[];
  total: number;
  desconto_manual_total: number;
}
