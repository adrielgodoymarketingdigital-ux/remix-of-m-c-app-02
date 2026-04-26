export type TipoProduto = 'produto' | 'peca';

export interface Produto {
  id: string;
  nome: string;
  sku?: string | null;
  codigo_barras?: string | null;
  quantidade: number;
  custo: number;
  preco: number;
  lucro: number;
  created_at: string;
  tipo: 'produto';
  fotos?: string[];
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  categoria_cor?: string | null;
}

export interface Peca {
  id: string;
  nome: string;
  custo: number;
  preco: number;
  quantidade: number;
  created_at: string;
  tipo: 'peca';
  codigo_barras?: string;
  fotos?: string[];
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  categoria_cor?: string | null;
}

export type ItemEstoque = Produto | Peca;

export interface FormularioProduto {
  tipo: TipoProduto;
  codigo?: string;
  nome: string;
  quantidade: number;
  custo: number;
  preco: number;
  codigo_barras?: string;
  fotos?: string[];
  fornecedor_id?: string;
  categoria_id?: string;
}
