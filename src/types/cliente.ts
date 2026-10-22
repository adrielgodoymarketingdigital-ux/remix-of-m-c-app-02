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
  // Colunas fiscais (etapa 2A), lidas pelo select '*'.
  email?: string | null;
  complemento?: string | null;
  inscricao_estadual?: string | null;
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
  /** Colunas fiscais: só vêm quando useFiscalVisivel (bloco na tela). */
  email?: string | null;
  complemento?: string | null;
  inscricao_estadual?: string | null;
}
