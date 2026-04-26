export interface PassoOnboarding {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  rota: string;
  botao_texto: string;
  ordem: number;
  ativo: boolean;
}

export interface ConfigPassos {
  assistencia: PassoOnboarding[];
  vendas: PassoOnboarding[];
}

export interface TextosPersonalizados {
  titulo_boas_vindas: string;
  subtitulo_boas_vindas: string;
  titulo_selecao_tipo: string;
  descricao_assistencia: string;
  descricao_vendas: string;
  botao_primeiros_passos: string;
  botao_pular: string;
  mensagem_aha_moment: string;
  titulo_assistencia: string;
  titulo_vendas: string;
  destino_ao_pular?: string;
}

export interface OnboardingConfig {
  id?: string;
  ativo: boolean;
  publico_alvo: string[];
  mostrar_para_usuarios_ativos: boolean;
  config_passos: ConfigPassos;
  textos_personalizados: TextosPersonalizados;
  updated_at?: string;
  updated_by?: string;
}

export const TEXTOS_PADRAO: TextosPersonalizados = {
  titulo_boas_vindas: "Bem-vindo ao MEC App!",
  subtitulo_boas_vindas: "Vamos configurar o sistema para você em poucos minutos.",
  titulo_selecao_tipo: "Qual é o seu foco principal?",
  descricao_assistencia: "Conserto de celulares, tablets, notebooks e outros dispositivos eletrônicos.",
  descricao_vendas: "Venda de celulares, tablets, notebooks e acessórios usados ou novos.",
  botao_primeiros_passos: "Primeiros Passos",
  botao_pular: "Já sei como usar",
  mensagem_aha_moment: "Parabéns! Você completou o onboarding e está pronto para usar o sistema!",
  titulo_assistencia: "Assistência Técnica",
  titulo_vendas: "Venda de Dispositivos",
  destino_ao_pular: "/dashboard"
};

export const CONFIG_PASSOS_PADRAO: ConfigPassos = {
  assistencia: [
    {
      id: "cliente",
      titulo: "Cadastre seu primeiro cliente",
      descricao: "Organize todos os seus clientes em um só lugar. Adicione nome, telefone e endereço para facilitar o atendimento.",
      icone: "user",
      rota: "/clientes",
      botao_texto: "Cadastrar Cliente",
      ordem: 1,
      ativo: true
    },
    {
      id: "peca",
      titulo: "Adicione suas peças/produtos",
      descricao: "Cadastre as peças e produtos que você usa nos serviços. Isso facilita o controle de estoque e custos.",
      icone: "package",
      rota: "/produtos",
      botao_texto: "Cadastrar Peça",
      ordem: 2,
      ativo: true
    },
    {
      id: "os",
      titulo: "Crie sua primeira Ordem de Serviço",
      descricao: "Registre o serviço do cliente com todos os detalhes: dispositivo, defeito, peças usadas e valor.",
      icone: "clipboard-list",
      rota: "/ordem-servico",
      botao_texto: "Criar OS",
      ordem: 3,
      ativo: true
    },
    {
      id: "lucro",
      titulo: "Visualize seu lucro",
      descricao: "Acompanhe seus ganhos em tempo real no dashboard financeiro.",
      icone: "trending-up",
      rota: "/financeiro",
      botao_texto: "Ver Lucros",
      ordem: 4,
      ativo: true
    }
  ],
  vendas: [
    {
      id: "cliente",
      titulo: "Cadastre seu primeiro cliente",
      descricao: "Organize todos os seus clientes em um só lugar. Adicione nome, telefone e endereço para facilitar as vendas.",
      icone: "user",
      rota: "/clientes",
      botao_texto: "Cadastrar Cliente",
      ordem: 1,
      ativo: true
    },
    {
      id: "dispositivo",
      titulo: "Cadastre seu primeiro aparelho",
      descricao: "Adicione os dispositivos que você tem para vender: celulares, tablets, notebooks e mais.",
      icone: "smartphone",
      rota: "/dispositivos",
      botao_texto: "Cadastrar Aparelho",
      ordem: 2,
      ativo: true
    },
    {
      id: "lucro",
      titulo: "Visualize seu lucro",
      descricao: "Acompanhe seus ganhos em tempo real no dashboard financeiro.",
      icone: "trending-up",
      rota: "/financeiro",
      botao_texto: "Ver Lucros",
      ordem: 3,
      ativo: true
    }
  ]
};

export const PLANOS_DISPONIVEIS = [
  { value: 'trial', label: 'Trial' },
  { value: 'basico_mensal', label: 'Básico Mensal' },
  { value: 'basico_anual', label: 'Básico Anual' },
  { value: 'intermediario_mensal', label: 'Intermediário Mensal' },
  { value: 'intermediario_anual', label: 'Intermediário Anual' },
  { value: 'profissional_mensal', label: 'Profissional Mensal' },
  { value: 'profissional_anual', label: 'Profissional Anual' },
];

export const ICONES_DISPONIVEIS = [
  'user',
  'users',
  'smartphone',
  'tablet',
  'laptop',
  'package',
  'clipboard-list',
  'trending-up',
  'dollar-sign',
  'settings',
  'wrench',
  'tool',
  'check-circle',
  'star',
  'heart',
  'home',
  'shopping-cart',
  'credit-card',
  'file-text',
  'calendar'
];

export const ROTAS_DISPONIVEIS = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/clientes', label: 'Clientes' },
  { value: '/dispositivos', label: 'Dispositivos' },
  { value: '/produtos', label: 'Produtos/Peças' },
  { value: '/ordem-servico', label: 'Ordem de Serviço' },
  { value: '/vendas', label: 'Vendas' },
  { value: '/financeiro', label: 'Financeiro' },
  { value: '/pdv', label: 'PDV' },
  { value: '/configuracoes', label: 'Configurações' },
  { value: '/novidades', label: 'Novidades' },
  { value: '/suporte', label: 'Suporte' },
];
