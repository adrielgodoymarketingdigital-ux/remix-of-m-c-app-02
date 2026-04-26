export interface TemplatesCatalogo {
  id: string;
  nome: string;
  descricao: string;
  cores: {
    primaria: string;
    secundaria: string;
    fundo: string;
    texto: string;
    destaque: string;
  };
  layout: 'moderno' | 'classico' | 'minimalista' | 'tecnologico';
}

export interface TextosCatalogo {
  tituloCapa: string;
  subtituloCapa: string;
  textoGarantia: string;
  textoPreco: string;
  textoContato: string;
  rodape: string;
}

export interface ConfiguracaoCatalogo {
  templateId: string;
  textos: TextosCatalogo;
  mostrarPrecos: boolean;
  mostrarGarantia: boolean;
  mostrarBateria: boolean;
  mostrarQuantidade: boolean;
  mostrarCondicao: boolean;
  mostrarCapacidade: boolean;
  mostrarCor: boolean;
  mostrarIMEI: boolean;
  mostrarNumeroSerie: boolean;
  mostrarLogo: boolean;
  mostrarContato: boolean;
  mostrarRodape: boolean;
  layoutGrid: '2x2' | '2x3' | '3x3' | '1x1';
  itensPerPage: number;
  // Novas opções de personalização
  imagemFundoUrl?: string;
  logoPersonalizadoUrl?: string;
  corFundoPersonalizada?: string;
  corHeaderPersonalizada?: string;
  corTextoPersonalizada?: string;
  corPrimariaPersonalizada?: string;
  mostrarSubtitulo: boolean;
  estiloHeader: 'simples' | 'gradiente' | 'imagem' | 'minimalista';
  bordaCards: 'arredondada' | 'quadrada' | 'sutil';
  sombraCards: 'nenhuma' | 'leve' | 'media' | 'forte';
  espacamentoCards: 'compacto' | 'normal' | 'amplo';
  mostrarBotaoWhatsApp: boolean;
  itensSelecionadosIds?: string[]; // IDs dos itens selecionados para exibir no catálogo público
  tamanhoFonte?: 'pequeno' | 'medio' | 'grande';
  mostrarMarca?: boolean;
  corBotaoWhatsApp?: string;
  textoBotaoWhatsApp?: string;
  mostrarDesconto?: boolean;
  categoriasCatalogo?: CategoriaCatalogo[];
}

export interface CategoriaCatalogo {
  id: string;
  nome: string;
  cor?: string;
  itemIds: string[];
}

export const TEMPLATES_PADRAO: TemplatesCatalogo[] = [
  {
    id: 'tecnologico',
    nome: 'Tecnológico',
    descricao: 'Azul e cinza escuro, visual moderno',
    cores: {
      primaria: '#3B82F6',
      secundaria: '#1F2937',
      fundo: '#FFFFFF',
      texto: '#1F2937',
      destaque: '#10B981',
    },
    layout: 'tecnologico',
  },
  {
    id: 'minimalista',
    nome: 'Minimalista',
    descricao: 'Preto e branco, clean e elegante',
    cores: {
      primaria: '#000000',
      secundaria: '#6B7280',
      fundo: '#FFFFFF',
      texto: '#111827',
      destaque: '#000000',
    },
    layout: 'minimalista',
  },
  {
    id: 'vibrante',
    nome: 'Vibrante',
    descricao: 'Roxo e rosa, jovem e moderno',
    cores: {
      primaria: '#8B5CF6',
      secundaria: '#EC4899',
      fundo: '#FAFAFA',
      texto: '#1F2937',
      destaque: '#8B5CF6',
    },
    layout: 'moderno',
  },
  {
    id: 'natureza',
    nome: 'Natureza',
    descricao: 'Verde e tons terrosos',
    cores: {
      primaria: '#059669',
      secundaria: '#065F46',
      fundo: '#F0FDF4',
      texto: '#064E3B',
      destaque: '#10B981',
    },
    layout: 'classico',
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    descricao: 'Azul marinho e dourado',
    cores: {
      primaria: '#1E3A8A',
      secundaria: '#D97706',
      fundo: '#FFFFFF',
      texto: '#1E293B',
      destaque: '#D97706',
    },
    layout: 'classico',
  },
  {
    id: 'escuro',
    nome: 'Escuro',
    descricao: 'Dark mode elegante',
    cores: {
      primaria: '#6366F1',
      secundaria: '#A855F7',
      fundo: '#18181B',
      texto: '#FAFAFA',
      destaque: '#6366F1',
    },
    layout: 'tecnologico',
  },
];

export const TEXTOS_PADRAO: TextosCatalogo = {
  tituloCapa: 'Catálogo de Dispositivos',
  subtituloCapa: 'Celulares, Tablets e Eletrônicos',
  textoGarantia: 'Garantia de {tempo}',
  textoPreco: 'A partir de',
  textoContato: 'Entre em contato para mais informações',
  rodape: 'Atualizado em {data}',
};

export const CONFIG_PADRAO: ConfiguracaoCatalogo = {
  templateId: 'tecnologico',
  textos: TEXTOS_PADRAO,
  mostrarPrecos: true,
  mostrarGarantia: true,
  mostrarBateria: true,
  mostrarQuantidade: true,
  mostrarCondicao: true,
  mostrarCapacidade: true,
  mostrarCor: true,
  mostrarIMEI: false,
  mostrarNumeroSerie: false,
  mostrarLogo: true,
  mostrarContato: true,
  mostrarRodape: true,
  layoutGrid: '2x3',
  itensPerPage: 6,
  // Novas opções de personalização
  imagemFundoUrl: undefined,
  logoPersonalizadoUrl: undefined,
  corFundoPersonalizada: undefined,
  corHeaderPersonalizada: undefined,
  corTextoPersonalizada: undefined,
  corPrimariaPersonalizada: undefined,
  mostrarSubtitulo: true,
  estiloHeader: 'gradiente',
  bordaCards: 'arredondada',
  sombraCards: 'media',
  espacamentoCards: 'normal',
  mostrarBotaoWhatsApp: true,
  itensSelecionadosIds: undefined,
  tamanhoFonte: 'medio',
  mostrarMarca: true,
  corBotaoWhatsApp: undefined,
  textoBotaoWhatsApp: 'WhatsApp',
  mostrarDesconto: true,
};

// ===== LANDING PAGE =====

export interface ConfiguracaoLandingPage {
  // Hero
  heroTitulo: string;
  heroSubtitulo: string;
  heroCTA: string;
  heroImagemFundo?: string;
  heroEstilo: 'gradiente' | 'imagem' | 'simples';
  
  // Destaques
  dispositivosDestaque: string[]; // IDs dos dispositivos em destaque (até 3)
  mostrarDestaques: boolean;
  tituloDestaques: string;
  
  // Seções
  mostrarHero: boolean;
  mostrarGrid: boolean;
  mostrarContato: boolean;
  mostrarFooter: boolean;
  
  // Contato
  mostrarEndereco: boolean;
  mostrarHorario: boolean;
  horarioFuncionamento?: string;
  mostrarRedesSociais: boolean;
  linkInstagram?: string;
  linkFacebook?: string;
  
  // Estilo
  templateBase: string; // ID do template de cores
  corPrimaria?: string;
  corSecundaria?: string;

  // === PREMIUM ===
  // Tipografia
  fonteTitulo?: 'inter' | 'poppins' | 'playfair' | 'montserrat' | 'raleway' | 'oswald';
  fonteCorpo?: 'inter' | 'poppins' | 'open-sans' | 'roboto' | 'lato' | 'nunito';
  
  // Cores customizadas
  corFundoCustom?: string;
  corTextoCustom?: string;
  corBotaoCustom?: string;
  corBotaoTextoCustom?: string;
  
  // Layout Grid
  gridColunas?: 2 | 3 | 4;
  gridEstilo?: 'cards' | 'lista' | 'magazine';
  
  // Badge/Selo
  mostrarBadge?: boolean;
  textoBadge?: string;
  corBadge?: string;
  
  // Animações
  animacaoHero?: 'nenhuma' | 'fade' | 'slide-up' | 'zoom';
  
  // Rodapé custom
  textoRodape?: string;
  
  // Header
  headerEstilo?: 'fixo' | 'transparente' | 'colorido';
  
  // WhatsApp flutuante
  posicaoWhatsApp?: 'direita' | 'esquerda';
  textoWhatsApp?: string;
  
  // Título do grid
  tituloGrid?: string;
  subtituloGrid?: string;
  
  // Contato título
  tituloContato?: string;

  // Responsividade independente
  gridColunasMobile?: 1 | 2;
  gridColunasDesktop?: 2 | 3 | 4;

  // Logo customizado da LP
  logoLandingPageUrl?: string;

  // Personalização por seção
  secaoHero?: {
    corFundo?: string;
    corTexto?: string;
    corTitulo?: string;
    corBotao?: string;
    corBotaoTexto?: string;
  };
  secaoDestaques?: {
    corFundo?: string;
    corTexto?: string;
    corTitulo?: string;
    corBorda?: string;
  };
  secaoGrid?: {
    corFundo?: string;
    corTexto?: string;
    corTitulo?: string;
    corBordaCard?: string;
    sombraCard?: 'nenhuma' | 'leve' | 'media' | 'forte';
    borderRadiusCard?: 'nenhum' | 'pequeno' | 'medio' | 'grande';
  };
  secaoContato?: {
    corFundo?: string;
    corTexto?: string;
    corTitulo?: string;
    corIcones?: string;
    mostrarBotaoExtra?: boolean;
    textoBotaoExtra?: string;
    linkBotaoExtra?: string;
  };
  secaoFooter?: {
    corFundo?: string;
    corTexto?: string;
  };
}

export const LANDING_PAGE_PADRAO: ConfiguracaoLandingPage = {
  // Hero
  heroTitulo: 'Os Melhores Dispositivos',
  heroSubtitulo: 'Celulares, tablets e eletrônicos com garantia e qualidade',
  heroCTA: 'Ver Catálogo',
  heroEstilo: 'gradiente',
  
  // Destaques
  dispositivosDestaque: [],
  mostrarDestaques: true,
  tituloDestaques: 'Destaques',
  
  // Seções
  mostrarHero: true,
  mostrarGrid: true,
  mostrarContato: true,
  mostrarFooter: true,
  
  // Contato
  mostrarEndereco: true,
  mostrarHorario: true,
  horarioFuncionamento: 'Seg a Sex: 9h às 18h | Sáb: 9h às 13h',
  mostrarRedesSociais: true,
  
  // Estilo
  templateBase: 'tecnologico',

  // Premium defaults
  fonteTitulo: 'inter',
  fonteCorpo: 'inter',
  gridColunas: 3,
  gridEstilo: 'cards',
  animacaoHero: 'nenhuma',
  headerEstilo: 'fixo',
  posicaoWhatsApp: 'direita',
  mostrarBadge: false,
  tituloGrid: 'Todos os Dispositivos',
  tituloContato: 'Entre em Contato',

  // Responsividade
  gridColunasMobile: 1,
  gridColunasDesktop: 3,
};
