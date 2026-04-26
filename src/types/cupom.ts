export type TipoDesconto = 'percentual' | 'valor_fixo';
export type StatusCupom = 'ativo' | 'inativo' | 'expirado';

export interface Cupom {
  id: string;
  user_id: string;
  codigo: string;
  descricao?: string;
  tipo_desconto: TipoDesconto;
  valor: number;
  valor_minimo_compra: number;
  quantidade_maxima_uso?: number;
  quantidade_usada: number;
  data_inicio: string;
  data_validade?: string;
  status: StatusCupom;
  created_at: string;
  updated_at: string;
}

export interface CupomValidacao {
  valido: boolean;
  mensagem: string;
  valorDesconto?: number;
  cupom?: Cupom;
}

export interface VendaCupom {
  id: string;
  venda_id: string;
  cupom_id: string;
  codigo_cupom: string;
  valor_desconto: number;
  created_at: string;
}
