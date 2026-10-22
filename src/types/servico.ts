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
  /**
   * Na OS: serviço com peça vinculada em que `preco` é só a mão de obra e a
   * peça é repassada ao cliente pelo custo (valor da linha = mão de obra +
   * peça; lucro = mão de obra). Ver lib/ordemServico/totaisPecasOS.
   */
  peca_repassada?: boolean;
  // Colunas fiscais (etapa 2A), lidas pelo select '*'.
  codigo_lc116?: string | null;
  codigo_municipal?: string | null;
  aliquota_iss?: number | null;
  iss_retido?: boolean | null;
  perfil_tributario_id?: string | null;
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
