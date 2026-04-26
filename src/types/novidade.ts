export type TipoSecao = 'banner' | 'video' | 'imagem' | 'card' | 'texto' | 'grid';

// Configurações de estilo compartilhadas para todas as seções
export interface EstiloSecao {
  // Tamanho da seção
  tamanho?: 'pequeno' | 'medio' | 'grande' | 'auto';
  // Cor de fundo
  corFundo?: string;
  // Cor do texto
  corTexto?: string;
  // Família da fonte
  fonte?: 'default' | 'serif' | 'mono' | 'display';
  // Tamanho do texto
  tamanhoTexto?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  // Padding interno
  padding?: 'none' | 'sm' | 'md' | 'lg';
  // Borda arredondada
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export interface SecaoBannerConfig {
  imagem_url: string;
  link_url?: string;
  largura: 'full' | 'half';
  altura: 'small' | 'medium' | 'large';
}

export interface SecaoVideoConfig {
  video_url: string;
  titulo?: string;
  descricao?: string;
}

export interface SecaoImagemConfig {
  imagem_url: string;
  legenda?: string;
  posicao: 'left' | 'center' | 'right';
}

// Estilo individual para textos do card
export interface EstiloTextoCard {
  corTexto?: string;
  tamanhoTexto?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  fonte?: 'default' | 'serif' | 'mono' | 'display';
  negrito?: boolean;
  italico?: boolean;
}

export interface SecaoCardConfig {
  titulo: string;
  descricao?: string;
  imagem_url?: string;
  link_url?: string;
  botao_texto?: string;
  // Estilos individuais para cada texto
  estiloTitulo?: EstiloTextoCard;
  estiloDescricao?: EstiloTextoCard;
  estiloBotao?: EstiloTextoCard;
}

export interface SecaoTextoConfig {
  conteudo: string;
  estilo: 'normal' | 'destaque' | 'titulo';
}

export interface SecaoGridConfig {
  colunas: 2 | 3 | 4;
  itens: Array<{
    imagem_url: string;
    titulo?: string;
    link_url?: string;
  }>;
}

export type SecaoConfig = 
  | SecaoBannerConfig 
  | SecaoVideoConfig 
  | SecaoImagemConfig 
  | SecaoCardConfig 
  | SecaoTextoConfig 
  | SecaoGridConfig;

export interface SecaoNovidade {
  id: string;
  tipo: TipoSecao;
  ordem: number;
  config: SecaoConfig;
  estilo?: EstiloSecao;
}

export interface LayoutConfig {
  espacamento?: 'compacto' | 'normal' | 'espaçado';
  fundoCor?: string;
}

export interface Novidade {
  id: string;
  titulo: string;
  descricao?: string;
  conteudo: SecaoNovidade[];
  layout_config?: LayoutConfig;
  publico_alvo: string[];
  ativo: boolean;
  data_inicio: string;
  data_fim?: string;
  prioridade: number;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface NovidadeInsert {
  titulo: string;
  descricao?: string;
  conteudo: SecaoNovidade[];
  layout_config?: LayoutConfig;
  publico_alvo: string[];
  ativo?: boolean;
  data_inicio?: string;
  data_fim?: string;
  prioridade?: number;
  thumbnail_url?: string;
}

export interface NovidadeUpdate extends Partial<NovidadeInsert> {
  id: string;
}

export const PUBLICO_ALVO_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'basico_mensal', label: 'Básico Mensal' },
  { value: 'basico_anual', label: 'Básico Anual' },
  { value: 'intermediario_mensal', label: 'Intermediário Mensal' },
  { value: 'intermediario_anual', label: 'Intermediário Anual' },
  { value: 'profissional_mensal', label: 'Profissional Mensal' },
  { value: 'profissional_anual', label: 'Profissional Anual' },
  { value: 'admin', label: 'Admin' },
];
