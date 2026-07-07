export interface CategoriaProduto {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  categoria_pai_id?: string | null;
  created_at: string;
  subcategorias?: CategoriaProduto[];
}

export interface FormularioCategoria {
  nome: string;
  cor: string;
  categoria_pai_id?: string | null;
}
