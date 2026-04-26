export type TipoPessoa = 'fisica' | 'juridica';
export type TipoOrigemDispositivo = 'estoque_proprio' | 'fornecedor' | 'terceiro';
export type FormaPagamentoCompra = 'pix' | 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'transferencia' | 'boleto';

export interface OrigemPessoa {
  id: string;
  user_id: string;
  tipo: TipoPessoa;
  nome: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  rg?: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  documento_frente_url?: string;
  documento_verso_url?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormularioOrigemPessoa {
  tipo: TipoPessoa;
  nome: string;
  nome_fantasia?: string;
  cpf_cnpj?: string;
  rg?: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  documento_frente_url?: string;
  documento_verso_url?: string;
  observacoes?: string;
  ativo?: boolean;
}

export interface CompraDispositivo {
  id: string;
  user_id: string;
  pessoa_id?: string;
  fornecedor_id?: string;
  dispositivo_id: string;
  data_compra: string;
  valor_pago: number;
  forma_pagamento: FormaPagamentoCompra;
  funcionario_responsavel?: string;
  unidade?: string;
  condicao_aparelho: string;
  situacao_conta?: string;
  checklist?: Record<string, boolean>;
  observacoes?: string;
  termo_pdf_url?: string;
  fotos?: string[];
  documento_vendedor_frente?: string;
  documento_vendedor_verso?: string;
  assinatura_vendedor?: string;
  assinatura_vendedor_ip?: string;
  assinatura_vendedor_data?: string;
  assinatura_cliente?: string;
  assinatura_cliente_ip?: string;
  assinatura_cliente_data?: string;
  created_at: string;
  updated_at: string;
  
  // Joins - campos parciais para evitar conflitos de tipos
  origem_pessoas?: Partial<OrigemPessoa> & { id: string; nome: string };
  fornecedores?: {
    nome: string;
  };
  dispositivos?: {
    marca: string;
    modelo: string;
    imei?: string;
  };
}

export interface FormularioCompraDispositivo {
  pessoa_id?: string;
  fornecedor_id?: string;
  dispositivo_id: string;
  data_compra: string;
  valor_pago: number;
  forma_pagamento: FormaPagamentoCompra;
  funcionario_responsavel?: string;
  unidade?: string;
  condicao_aparelho: string;
  situacao_conta?: string;
  checklist?: Record<string, boolean>;
  observacoes?: string;
  fotos?: string[];
  documento_vendedor_frente?: string;
  documento_vendedor_verso?: string;
  assinatura_vendedor?: string;
  assinatura_vendedor_ip?: string;
  assinatura_cliente?: string;
  assinatura_cliente_ip?: string;
}
