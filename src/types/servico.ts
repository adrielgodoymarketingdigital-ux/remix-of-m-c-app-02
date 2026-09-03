export interface Servico {
  id: string;
  codigo?: string;
  nome: string;
  custo: number;
  preco: number;
  lucro: number;
  quantidade: number;
  peca_id?: string;
  peca_nome?: string;
  tempo_medio_estimado_horas?: number | null;
  created_at: string;
  /** custo do item já confirmado (respondido no banner ou custo > 0 na OS) */
  custo_confirmado?: boolean;
  /**
   * Vínculo direto com um "Tipo de Serviço" (tipos_servico) — usado para
   * calcular a comissão do técnico SEM correspondência por nome. Opcional:
   * serviço sem vínculo cai no fluxo de match por nome.
   */
  tipo_servico_id?: string | null;
}

export interface FormularioServico {
  codigo?: string;
  nome: string;
  custo: number;
  preco: number;
  quantidade?: number;
  peca_id?: string;
  tempo_medio_estimado_horas?: number | null;
  tipo_servico_id?: string | null;
}
