export interface TutorialStep {
  id: string;
  target: string; // data-tutorial attribute value
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  route?: string; // navigate to this route before showing step
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: "dashboard",
    target: "dashboard-title",
    title: "📊 Dashboard",
    description: "Aqui você tem uma visão geral do seu negócio: faturamento, serviços, vendas e muito mais. Use o filtro de mês para ver dados de períodos anteriores.",
    position: "bottom",
    route: "/dashboard",
  },
  {
    id: "sidebar-menu",
    target: "sidebar-menu",
    title: "📋 Menu Principal",
    description: "Navegue por todas as funcionalidades do sistema pelo menu lateral. Clique nos itens para acessar cada módulo.",
    position: "right",
    route: "/dashboard",
  },
  {
    id: "os",
    target: "sidebar-os",
    title: "🔧 Ordens de Serviço",
    description: "Crie e gerencie ordens de serviço para seus clientes. Controle status, serviços realizados, peças utilizadas e muito mais.",
    position: "right",
  },
  {
    id: "dispositivos",
    target: "sidebar-dispositivos",
    title: "📱 Dispositivos",
    description: "Cadastre e controle seu estoque de dispositivos. Registre marca, modelo, IMEI, condição e preço de cada aparelho.",
    position: "right",
  },
  {
    id: "vendas",
    target: "sidebar-vendas",
    title: "💰 Vendas",
    description: "Registre suas vendas de dispositivos e produtos. Acompanhe o faturamento e o lucro de cada venda.",
    position: "right",
  },
  {
    id: "pdv",
    target: "sidebar-pdv",
    title: "🛒 PDV",
    description: "Ponto de Venda rápido para vender produtos e dispositivos. Adicione itens ao carrinho, aplique cupons e gere recibos.",
    position: "right",
  },
  {
    id: "financeiro",
    target: "sidebar-financeiro",
    title: "📈 Financeiro",
    description: "Acompanhe a saúde financeira do seu negócio com gráficos de evolução, lucros e despesas detalhadas.",
    position: "right",
  },
  {
    id: "clientes",
    target: "sidebar-clientes",
    title: "👥 Clientes",
    description: "Cadastre seus clientes com nome, telefone, CPF e endereço. Acompanhe o histórico de serviços e compras de cada um.",
    position: "right",
  },
  {
    id: "configuracoes",
    target: "sidebar-configuracoes",
    title: "⚙️ Configurações",
    description: "Personalize o sistema com o nome da sua loja, logo, cores, modelos de recibo e muito mais.",
    position: "right",
  },
  {
    id: "tema",
    target: "theme-toggle",
    title: "🌙 Tema Claro/Escuro",
    description: "Alterne entre tema claro e escuro conforme sua preferência. O sistema salva sua escolha automaticamente.",
    position: "bottom",
    route: "/dashboard",
  },
];
