export interface Servico {
  id: string;
  codigo?: string;
  nome: string;
  custo: number;
  preco: number;
  lucro: number;
  quantidade: number;
  peca_id?: string;
  peca_nome?: string;
  tempo_medio_estimado_horas?: number | null;
  created_at: string;
}

export interface FormularioServico {
  codigo?: string;
  nome: string;
  custo: number;
  preco: number;
  quantidade?: number;
  peca_id?: string;
  tempo_medio_estimado_horas?: number | null;
}
