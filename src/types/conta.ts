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
