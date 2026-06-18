import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardCheck,
  Package,
  WrenchIcon,
  Tablet,
  BookOpen,
  ShoppingBag,
  Truck,
  Users,
  FileSpreadsheet,
  ClipboardList,
  BarChart3,
  FileText,
  CreditCard,
  Settings,
  Building2,
  Calculator,
  Gift,
  type LucideIcon,
} from "lucide-react";

export interface AjudaModulo {
  slug: string;
  title: string;
  icon: LucideIcon;
  resumo: string;
  conteudo: string[];
}

export const ajudaModulos: AjudaModulo[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    resumo: "Visão geral do seu negócio em um só lugar.",
    conteudo: [
      "O Dashboard reúne os principais indicadores da sua loja: vendas do período, ordens de serviço em andamento, contas a pagar/receber e atalhos rápidos para as funções mais usadas.",
      "Use os filtros de período no topo da página para comparar dias, semanas ou meses diferentes.",
      "Os cards de resumo são clicáveis e levam direto para a tela detalhada daquele indicador.",
    ],
  },
  {
    slug: "pdv",
    title: "PDV (Ponto de Venda)",
    icon: ShoppingCart,
    resumo: "Venda produtos e peças rapidamente no balcão.",
    conteudo: [
      "O PDV é a tela de venda rápida para produtos e peças do seu estoque.",
      "Busque o produto pelo nome ou código de barras, ajuste a quantidade e finalize a venda escolhendo a forma de pagamento.",
      "Vendas feitas pelo PDV já baixam automaticamente o estoque e aparecem no relatório de Vendas e no Financeiro.",
    ],
  },
  {
    slug: "ordem-servico",
    title: "Ordem de Serviço (OS)",
    icon: ClipboardCheck,
    resumo: "Controle conserto de aparelhos do recebimento à entrega.",
    conteudo: [
      "Cadastre uma nova OS vinculando um cliente e um dispositivo (ou cadastre-os na hora).",
      "Acompanhe o status da OS (aguardando, em análise, em conserto, pronto, entregue) e adicione peças e serviços usados no reparo.",
      "É possível gerar um link de acompanhamento para o cliente acompanhar o andamento da OS sem precisar ligar para a loja.",
      "Ao finalizar, a OS pode gerar automaticamente o lançamento financeiro e a venda dos itens utilizados.",
    ],
  },
  {
    slug: "produtos-pecas",
    title: "Produtos e Peças",
    icon: Package,
    resumo: "Gerencie seu estoque de produtos e peças.",
    conteudo: [
      "Cadastre produtos e peças com preço de custo, preço de venda, quantidade em estoque e fornecedor.",
      "O sistema avisa quando o estoque está baixo, ajudando a planejar reposição.",
      "Produtos cadastrados aqui aparecem automaticamente no PDV, nas OS e nos orçamentos.",
    ],
  },
  {
    slug: "servicos",
    title: "Serviços",
    icon: WrenchIcon,
    resumo: "Cadastre os tipos de serviço oferecidos pela loja.",
    conteudo: [
      "Cadastre os serviços que sua loja realiza (ex: troca de tela, formatação, limpeza) com seus respectivos valores.",
      "Esses serviços ficam disponíveis para serem adicionados dentro de uma Ordem de Serviço ou Orçamento.",
    ],
  },
  {
    slug: "dispositivos",
    title: "Dispositivos",
    icon: Tablet,
    resumo: "Histórico de aparelhos atendidos na loja.",
    conteudo: [
      "Todo aparelho vinculado a uma OS fica registrado aqui, com o histórico de atendimentos anteriores.",
      "Facilita identificar clientes recorrentes e aparelhos com problemas repetidos.",
    ],
  },
  {
    slug: "catalogo",
    title: "Catálogo",
    icon: BookOpen,
    resumo: "Página pública com seus produtos para divulgação.",
    conteudo: [
      "O Catálogo gera uma página pública (link compartilhável) com os produtos da sua loja, para você enviar a clientes ou divulgar nas redes sociais.",
    ],
  },
  {
    slug: "origem-dispositivos",
    title: "Origem de Dispositivos",
    icon: ShoppingBag,
    resumo: "Controle de onde vieram os aparelhos em estoque.",
    conteudo: [
      "Registre a origem dos dispositivos que entram para revenda ou troca (compra, troca com cliente, consignado, etc).",
    ],
  },
  {
    slug: "fornecedores",
    title: "Fornecedores",
    icon: Truck,
    resumo: "Cadastro de fornecedores de produtos e peças.",
    conteudo: [
      "Cadastre seus fornecedores e vincule produtos/peças a eles para saber rapidamente onde comprar cada item.",
    ],
  },
  {
    slug: "clientes",
    title: "Clientes",
    icon: Users,
    resumo: "Cadastro e histórico completo de clientes.",
    conteudo: [
      "Cadastre clientes com dados de contato e acompanhe o histórico de OS, vendas e orçamentos de cada um.",
      "A sub-seção Fidelidade permite acumular pontos ou benefícios para clientes recorrentes.",
    ],
  },
  {
    slug: "orcamentos",
    title: "Orçamentos",
    icon: FileSpreadsheet,
    resumo: "Monte propostas antes de abrir uma OS ou venda.",
    conteudo: [
      "Crie orçamentos com produtos e serviços para enviar ao cliente antes de fechar o negócio.",
      "Um orçamento aprovado pode ser convertido diretamente em Ordem de Serviço ou Venda, sem precisar redigitar os itens.",
    ],
  },
  {
    slug: "pedidos",
    title: "Pedidos/Encomendas",
    icon: ClipboardList,
    resumo: "Controle produtos encomendados para clientes.",
    conteudo: [
      "Registre encomendas de produtos que ainda não estão em estoque, controlando status até a chegada e entrega ao cliente.",
    ],
  },
  {
    slug: "vendas",
    title: "Vendas",
    icon: BarChart3,
    resumo: "Histórico e relatório de todas as vendas realizadas.",
    conteudo: [
      "Veja todas as vendas feitas pelo PDV, OS e orçamentos convertidos, com filtros por período, vendedor e forma de pagamento.",
    ],
  },
  {
    slug: "financeiro",
    title: "Financeiro",
    icon: FileText,
    resumo: "Contas a pagar/receber e relatórios financeiros.",
    conteudo: [
      "Controle contas a pagar e a receber, com vencimentos e status de pagamento.",
      "A sub-seção Relatórios mostra a análise de lucros, custos e total vendido no período.",
    ],
  },
  {
    slug: "equipe",
    title: "Equipe",
    icon: Users,
    resumo: "Cadastre funcionários e defina permissões de acesso.",
    conteudo: [
      "Adicione funcionários à sua loja e configure exatamente quais módulos e dados cada um pode acessar.",
      "Defina comissões por cargo (vendedor, técnico, estoque) sobre vendas e serviços realizados.",
    ],
  },
  {
    slug: "configuracoes",
    title: "Configurações",
    icon: Settings,
    resumo: "Personalize dados da loja e comportamento do sistema.",
    conteudo: [
      "Ajuste dados da sua loja (nome, logo, endereço), formas de pagamento aceitas e comportamento de telas como a Ordem de Serviço.",
    ],
  },
  {
    slug: "plano",
    title: "Plano e Assinatura",
    icon: CreditCard,
    resumo: "Gerencie sua assinatura do sistema.",
    conteudo: [
      "Veja seu plano atual, faça upgrade/downgrade e acompanhe a cobrança da sua assinatura.",
    ],
  },
  {
    slug: "multi-empresas",
    title: "Multi Empresas",
    icon: Building2,
    resumo: "Gerencie mais de uma loja/filial na mesma conta.",
    conteudo: [
      "Disponível em planos Ultra: permite alternar entre diferentes empresas/filiais cadastradas na mesma conta.",
    ],
  },
  {
    slug: "precificador",
    title: "Precificador",
    icon: Calculator,
    resumo: "Calcule o preço de venda ideal de um produto ou serviço.",
    conteudo: [
      "Informe o custo e a margem desejada para calcular automaticamente o preço de venda sugerido.",
    ],
  },
  {
    slug: "fidelidade",
    title: "Fidelidade de Clientes",
    icon: Gift,
    resumo: "Programa de pontos e benefícios para clientes fiéis.",
    conteudo: [
      "Acumule pontos ou benefícios para clientes recorrentes com base nas compras e serviços realizados.",
    ],
  },
];
