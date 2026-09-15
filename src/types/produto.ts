export type TipoProduto = 'produto' | 'peca';

export interface Produto {
  id: string;
  nome: string;
  sku?: string | null;
  codigo_barras?: string | null;
  quantidade: number;
  custo: number;
  preco: number;
  preco_atacado?: number | null;
  lucro: number;
  created_at: string;
  tipo: 'produto';
  fotos?: string[];
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  categoria_cor?: string | null;
  produto_pai_id?: string | null;
  variacao_label?: string | null;
  exibir_no_catalogo?: boolean;
}

export interface Peca {
  id: string;
  nome: string;
  custo: number;
  preco: number;
  preco_atacado?: number | null;
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
  peca_pai_id?: string | null;
  variacao_label?: string | null;
  exibir_no_catalogo?: boolean;
}

export type ItemEstoque = Produto | Peca;

/** produto_pai_id ou peca_pai_id, conforme o tipo do item — narrowing por
 * discriminated union (item.tipo), sem precisar de acesso dinâmico/`any`. */
export const getPaiIdVariacao = (item: ItemEstoque): string | null =>
  item.tipo === 'produto' ? item.produto_pai_id ?? null : item.peca_pai_id ?? null;

export interface FormularioProduto {
  tipo: TipoProduto;
  codigo?: string;
  nome: string;
  quantidade: number;
  custo: number;
  preco: number;
  preco_atacado?: number | null;
  codigo_barras?: string;
  fotos?: string[];
  fornecedor_id?: string;
  categoria_id?: string;
}

// Uma linha de variação na tela de cadastro em lote (ex: "iPhone 11")
export interface VariacaoInput {
  label: string;
  sku?: string;
  codigo_barras?: string;
  quantidade: number;
  custo: number;
  preco: number;
  preco_atacado?: number | null;
}
