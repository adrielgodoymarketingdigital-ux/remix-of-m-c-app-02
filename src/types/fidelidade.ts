export interface FidelidadeConfig {
  id: string;
  user_id: string;
  ativo: boolean;
  pontos_por_real_venda: number;
  pontos_por_real_os: number;
  validade_pontos_dias: number | null;
  tipo_resgate: 'cupom' | 'valor' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface FidelidadeNivel {
  id: string;
  user_id: string;
  nome: string;
  pontos_minimos: number;
  cor: string;
  beneficio: string | null;
  ordem: number;
}

export interface FidelidadePontos {
  id: string;
  user_id: string;
  cliente_id: string;
  pontos: number;
  tipo: 'venda' | 'os' | 'resgate' | 'expiracao';
  referencia_id: string | null;
  descricao: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ClienteFidelidade {
  cliente_id: string;
  nome: string;
  celular: string | null;
  email: string | null;
  total_pontos: number;
  total_vendas: number;
  total_os: number;
  valor_total_gasto: number;
  nivel: FidelidadeNivel | null;
  ultima_compra: string | null;
}
