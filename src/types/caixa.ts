export interface Caixa {
  id: string;
  user_id: string;
  data_abertura: string;
  data_fechamento: string | null;
  saldo_inicial: number;
  saldo_final: number | null;
  total_vendas: number;
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_a_receber: number;
  observacoes: string | null;
  status: 'aberto' | 'fechado';
  created_at: string;
}
