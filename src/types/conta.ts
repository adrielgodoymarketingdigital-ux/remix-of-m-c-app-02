export interface Conta {
  id: string;
  nome: string;
  tipo: 'pagar' | 'receber';
  valor: number;
  data: string;
  status: 'pendente' | 'pago' | 'recebido';
  recorrente: boolean;
  categoria?: string;
  descricao?: string;
  user_id?: string;
  created_at: string;
  data_vencimento?: string;
  valor_pago?: number;
  os_numero?: string;
  fornecedor_id?: string;
  cliente_id?: string;
  data_pagamento?: string;
  forma_pagamento?: string;
  forma_pagamento_entrada?: string;
  /** true = usa a tabela pagamentos_contas (recebimento parcial + recibo). Contas antigas = false. */
  usa_historico_pagamentos?: boolean;
  /** Nome do cliente vinculado, resolvido via JOIN (read-only, não persiste). */
  cliente_nome?: string;
}

/** Uma linha de recebimento/pagamento parcial de uma conta (tabela pagamentos_contas). */
export interface PagamentoConta {
  id: string;
  conta_id: string;
  user_id: string;
  empresa_id?: string | null;
  valor: number;
  data_pagamento: string;
  forma_pagamento?: string | null;
  observacao?: string | null;
  estornado: boolean;
  estornado_em?: string | null;
  estornado_motivo?: string | null;
  created_at: string;
}

export interface FormularioConta {
  nome: string;
  tipo: 'pagar' | 'receber';
  valor: number;
  data: string;
  status: 'pendente' | 'pago' | 'recebido';
  recorrente: boolean;
  categoria?: string;
  descricao?: string;
  fornecedor_id?: string;
  cliente_id?: string;
  data_pagamento?: string;
  forma_pagamento?: string;
  valor_pago?: number;
  forma_pagamento_entrada?: string;
}

export const CATEGORIAS_CONTA = [
  'Aluguel',
  'Água',
  'Luz',
  'Internet',
  'Telefone',
  'Fornecedores',
  'Salários',
  'Impostos',
  'Marketing',
  'Manutenção',
  'Custo Operacional',
  'Taxa de Cartão',
  'Outros',
];
