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
  empresa_id?: string | null;

  // Joins - campos parciais para evitar conflitos de tipos
  origem_pessoas?: Partial<OrigemPessoa> & { id: string; nome: string };
  fornecedores?: {
    nome: string;
  };
  dispositivos?: {
    id?: string;
    marca: string;
    modelo: string;
    imei?: string;
    numero_serie?: string | null;
  };
  /** Todos os aparelhos com dispositivos.compra_id = esta compra (vêm no mesmo select da lista, para a busca). */
  aparelhos?: {
    id: string;
    marca: string | null;
    modelo: string | null;
    imei?: string | null;
    imei2?: string | null;
    numero_serie?: string | null;
  }[];
}

export interface FormularioCompraDispositivo {
  pessoa_id?: string;
  fornecedor_id?: string;
  /** Aparelho principal (compras_dispositivos.dispositivo_id). */
  dispositivo_id: string;
  /**
   * Demais aparelhos da mesma compra (o "+" do registro). Não é coluna: o hook
   * tira do insert e grava dispositivos.compra_id em todos, junto com o principal.
   */
  dispositivos_adicionais?: string[];
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
