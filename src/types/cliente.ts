export interface Cliente {
  id: string;
  nome: string;
  cpf?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  data_nascimento?: string;
  created_at: string;
}

export interface FormularioCliente {
  nome: string;
  cpf?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  data_nascimento?: string;
}
