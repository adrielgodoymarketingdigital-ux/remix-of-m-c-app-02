export interface Fornecedor {
  id: string;
  nome: string;
  nome_fantasia?: string;
  cnpj?: string;
  cpf?: string;
  tipo: 'juridica' | 'fisica';
  email?: string;
  telefone?: string;
  celular?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormularioFornecedor {
  nome: string;
  nome_fantasia?: string;
  cnpj?: string;
  cpf?: string;
  tipo: 'juridica' | 'fisica';
  email?: string;
  telefone?: string;
  celular?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacoes?: string;
  ativo: boolean;
}
