export interface Cliente {
  id: string;
  nome: string;
  cpf?: string;
  cnpj?: string;
  telefone?: string;
  /** Rua / logradouro (cliente antigo: o endereço inteiro, digitado livre). */
  endereco?: string;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  data_nascimento?: string;
  created_at: string;
}

export interface FormularioCliente {
  nome: string;
  cpf?: string;
  cnpj?: string;
  telefone?: string;
  /** Rua / logradouro. */
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  data_nascimento?: string;
}
