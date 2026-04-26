export interface Dispositivo {
  id: string;
  marca: string;
  modelo: string;
  tipo: string;
  cor?: string;
  capacidade_gb?: number;
  imei?: string;
  numero_serie?: string;
  saude_bateria?: number;
  garantia: boolean;
  tempo_garantia?: number;
  subtipo_computador?: string;
  condicao: 'novo' | 'semi_novo' | 'usado';
  custo?: number;
  preco?: number;
  preco_promocional?: number | null;
  lucro?: number;
  vendido: boolean;
  quantidade: number;
  fornecedor_id?: string;
  fornecedores?: {
    nome: string;
  };
  foto_url?: string;
  fotos?: string[];
  checklist?: {
    entrada?: Record<string, boolean>;
    saida?: Record<string, boolean>;
  };
  origem_tipo?: 'terceiro' | 'fornecedor' | 'estoque_proprio';
  codigo_barras?: string;
  created_at: string;
}

export interface FormularioDispositivo {
  marca: string;
  modelo: string;
  tipo: string;
  cor?: string;
  capacidade_gb?: number;
  imei?: string;
  numero_serie?: string;
  saude_bateria?: number;
  garantia: boolean;
  tempo_garantia?: number;
  subtipo_computador?: string;
  condicao: 'novo' | 'semi_novo' | 'usado';
  custo?: number;
  preco?: number;
  quantidade: number;
  fornecedor_id?: string | null;
  foto_url?: string;
  fotos?: string[];
  checklist?: {
    entrada?: Record<string, boolean>;
    saida?: Record<string, boolean>;
  };
  codigo_barras?: string | null;
}
