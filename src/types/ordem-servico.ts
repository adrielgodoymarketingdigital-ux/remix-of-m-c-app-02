export type TipoSenha = 'numero' | 'letra' | 'padrao';

export interface SenhaDesbloqueio {
  tipo: TipoSenha;
  valor: string;
  padrao?: number[];
}

export interface ChecklistItem {
  [key: string]: boolean;
}

export interface Checklist {
  entrada: ChecklistItem;
  saida: ChecklistItem;
  sem_teste?: boolean;
  peca_trocada_descricao_entrada?: string;
  peca_trocada_descricao_saida?: string;
}

export interface AvariaVisual {
  x: number;
  y: number;
  tipo: 'riscos' | 'trinca' | 'amassado' | 'quebrado' | 'outro';
  lado: 'frente' | 'traseira';
  descricao?: string;
}

export interface ServicoRealizado {
  id: string;
  nome: string;
  preco: number;
  custo: number;
  lucro: number;
}

export type TipoAssinatura = 'digital' | 'fisica';

export interface AssinaturaDigital {
  cliente_entrada?: string;      // Base64 da assinatura na abertura
  cliente_saida?: string;        // Base64 da assinatura na entrega
  data_assinatura_entrada?: string;
  data_assinatura_saida?: string;
  tipo_assinatura_entrada?: TipoAssinatura;
  tipo_assinatura_saida?: TipoAssinatura;
}

export interface ProdutoUtilizado {
  id: string;
  nome: string;
  tipo: 'produto' | 'peca';
  quantidade: number;
  preco_unitario: number;
  custo_unitario: number;
  preco_total: number;
  estoque_disponivel?: number; // Para validação no formulário
}

export interface CustoAdicional {
  id: string;
  descricao: string;
  tipo: 'frete' | 'brinde' | 'outro';
  valor: number;
  repassar_cliente: boolean; // true = cliente paga, false = loja assume
}

export interface AvariasOS {
  senha_desbloqueio?: SenhaDesbloqueio;
  checklist?: Checklist;
  avarias_visuais?: AvariaVisual[];
  servicos_realizados?: ServicoRealizado[];
  produtos_utilizados?: ProdutoUtilizado[];
  custos_adicionais?: CustoAdicional[];
  assinaturas?: AssinaturaDigital;
  fotos_dispositivo?: string[];
  dados_pagamento?: DadosPagamento;
  observacoes_internas?: string;
}

export interface DadosPagamento {
  forma: 'dinheiro' | 'pix' | 'debito' | 'credito' | 'credito_parcelado' | 'a_prazo';
  parcelas?: number;
  desconto: number;
  subtotal: number;
  total: number;
  entrada?: number;
  saldo?: number;
  data_vencimento_prazo?: string;
}
