export type StatusOrcamento = "pendente" | "aprovado" | "rejeitado" | "expirado" | "convertido";

export interface ItemOrcamento {
  id: string;
  tipo: "produto" | "servico" | "dispositivo";
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface ChecklistOrcamento {
  entrada: Record<string, boolean>;
  saida: Record<string, boolean>;
  sem_teste?: boolean;
  peca_trocada_descricao_entrada?: string;
  peca_trocada_descricao_saida?: string;
}

export interface Orcamento {
  id: string;
  user_id: string;
  numero_orcamento: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_email?: string;
  status: StatusOrcamento;
  itens: ItemOrcamento[];
  subtotal: number;
  desconto: number;
  valor_total: number;
  validade_dias: number;
  data_validade?: string;
  observacoes?: string;
  termos_condicoes?: string;
  tipo_dispositivo?: string;
  sistema_operacional?: string;
  fabricante?: string;
  marca_dispositivo?: string;
  modelo_dispositivo?: string;
  cor_dispositivo?: string;
  checklist?: ChecklistOrcamento;
  created_at: string;
  updated_at: string;
}
