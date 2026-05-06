export interface MensagensWhatsAppOS {
  pendente?: string;
  em_andamento?: string;
  aguardando_aprovacao?: string;
  aguardando_retirada?: string;
  finalizado?: string;
  entregue?: string;
  cancelada?: string;
  [key: string]: string | undefined;
}

// Termo de Responsabilidade
export interface ClausulaTermoResponsabilidade {
  id: string;
  texto: string;
  ativo: boolean;
}

export interface SecaoTermoResponsabilidade {
  id: string;
  titulo: string;
  clausulas: ClausulaTermoResponsabilidade[];
}

export interface TermoResponsabilidadeConfig {
  ativo: boolean;
  titulo: string;
  introducao?: string;
  secoes: SecaoTermoResponsabilidade[];
  declaracao_final?: string;
  exibir_na_impressao_os: boolean;
  imprimir_separado: boolean;
  cor_primaria?: string; // Cor principal do termo (hex)
}

export interface TermoGarantiaConfig {
  termo_90_dias?: string;
  termo_outros_dias?: string;
  termo_sem_garantia?: string;
}

export interface Layout80mmConfig {
  mostrar_logo?: boolean;
  mostrar_dados_loja?: boolean;
  mostrar_dados_cliente?: boolean;
  mostrar_dados_dispositivo?: boolean;
  mostrar_defeito?: boolean;
  mostrar_servicos?: boolean;
  mostrar_valor?: boolean;
  mostrar_checklist?: boolean;
  mostrar_avarias?: boolean;
  mostrar_senha?: boolean;
  mostrar_assinaturas?: boolean;
  mostrar_termos_condicoes?: boolean;
  mostrar_forma_pagamento?: boolean;
  mostrar_custos_adicionais?: boolean;
}

export interface EtiquetaOSConfig {
  largura_mm?: number;
  altura_mm?: number;
  mostrar_numero_os?: boolean;
  mostrar_defeito?: boolean;
  mostrar_cliente?: boolean;
  mostrar_dispositivo?: boolean;
  mostrar_data?: boolean;
  mostrar_senha?: boolean;
  mostrar_marca_modelo?: boolean;
  mostrar_telefone?: boolean;
  mostrar_logo?: boolean;
  mostrar_valor?: boolean;
  tamanho_fonte?: 'pequeno' | 'normal' | 'grande';
}

export interface LayoutOSConfig {
  mostrar_logo_impressao?: boolean;
  mostrar_logo_whatsapp?: boolean;
  mostrar_checklist?: boolean;
  mostrar_avarias?: boolean;
  mostrar_senha?: boolean;
  mostrar_assinaturas?: boolean;
  mostrar_termos_condicoes?: boolean;
  cor_primaria?: string;
  tamanho_fonte?: 'pequeno' | 'normal' | 'grande';
  formato_papel?: 'a4' | '80mm';
  config_80mm?: Layout80mmConfig;
  etiqueta_config?: EtiquetaOSConfig;
}

// Layout config para PDV
export interface LayoutPDVConfig {
  formato_papel?: 'a4' | '80mm' | '58mm' | 'personalizado';
  largura_mm?: number;
  altura_mm?: number;
  tamanho_fonte?: 'pequeno' | 'normal' | 'grande';
  config_80mm?: Layout80mmPDVConfig;
}

export interface Layout80mmPDVConfig {
  mostrar_logo?: boolean;
  mostrar_dados_loja?: boolean;
  mostrar_dados_cliente?: boolean;
  mostrar_itens?: boolean;
  mostrar_subtotal?: boolean;
  mostrar_descontos?: boolean;
  mostrar_total?: boolean;
  mostrar_forma_pagamento?: boolean;
  mostrar_assinaturas?: boolean;
}

// Layout config para Vendas
export interface LayoutVendasConfig {
  formato_papel?: 'a4' | '80mm' | '58mm' | 'personalizado';
  largura_mm?: number;
  altura_mm?: number;
  tamanho_fonte?: 'pequeno' | 'normal' | 'grande';
  config_80mm?: Layout80mmVendasConfig;
}

export interface Layout80mmVendasConfig {
  mostrar_logo?: boolean;
  mostrar_dados_loja?: boolean;
  mostrar_dados_cliente?: boolean;
  mostrar_itens?: boolean;
  mostrar_subtotal?: boolean;
  mostrar_descontos?: boolean;
  mostrar_total?: boolean;
  mostrar_forma_pagamento?: boolean;
  mostrar_parcelas?: boolean;
  mostrar_assinaturas?: boolean;
}

export interface ConfiguracaoLoja {
  id: string;
  nome_loja: string;
  razao_social?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  logo_url?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  whatsapp?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  site?: string;
  horario_funcionamento?: string;
  instagram?: string;
  facebook?: string;
  mensagens_whatsapp_os?: MensagensWhatsAppOS;
  termo_garantia_config?: TermoGarantiaConfig;
  layout_os_config?: LayoutOSConfig;
  layout_pdv_config?: LayoutPDVConfig;
  layout_vendas_config?: LayoutVendasConfig;
  termo_responsabilidade_config?: TermoResponsabilidadeConfig;
  layout_dispositivos_config?: Record<string, any>;
  termo_garantia_dispositivo_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
