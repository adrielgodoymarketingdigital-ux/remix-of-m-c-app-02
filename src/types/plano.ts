// Versão: 2026-01-19-v1 - Atualização de recursos dos planos
export interface PlanoInfo {
  nome: string;
  preco: number;
  periodo: string;
  descricao?: string;
  recursos: string[];
  limites: {
    dispositivos: number | string;
    vendas_mes: number | string;
    armazenamento: string;
  };
  popular?: boolean;
  novo?: boolean;
}

export const PLANOS: Record<string, PlanoInfo> = {
  free: {
    nome: "Plano Free",
    preco: 0,
    periodo: "/mês",
    recursos: [
      "Até 3 dispositivos cadastrados",
      "3 Ordens de Serviço cadastradas",
      "3 Produtos/Peças cadastradas",
      "Dashboard",
      "PDV",
      "Dispositivos",
      "Produtos e Peças",
      "Ordem de Serviço",
      "Serviços",
      "50MB de armazenamento",
      "Suporte por email",
    ],
    limites: {
      dispositivos: 3,
      vendas_mes: "Ilimitado",
      armazenamento: "50MB",
    },
  },
  basico_mensal: {
    nome: "Plano Básico",
    preco: 19.90,
    periodo: "/mês",
    recursos: [
      "Até 50 dispositivos",
      "Dashboard",
      "PDV",
      "Até 20 Ordens de Serviço p/ mês",
      "Produtos e Peças ilimitados",
      "Dispositivos",
      "Vendas",
      "❌ Acompanhamento de OS (indisponível)",
      "500MB de armazenamento",
      "Suporte por email",
    ],
    limites: {
      dispositivos: 50,
      vendas_mes: "Ilimitado",
      armazenamento: "500MB",
    },
  },
  intermediario_mensal: {
    nome: "Plano Intermediário",
    preco: 39.90,
    periodo: "/mês",
    recursos: [
      "Tudo do plano básico",
      "Até 500 dispositivos",
      "60 Ordens de Serviço p/ mês",
      "10 Dispositivos no Catálogo",
      "Assinatura Digital do Cliente na O.S",
      "1 Funcionário com Comissão",
      "Fornecedores",
      "Clientes",
      "Contas",
      "Financeiro",
      "📡 Acompanhamento de OS (10/mês)",
      "5GB de armazenamento",
      "Suporte via WhatsApp",
    ],
    limites: {
      dispositivos: 500,
      vendas_mes: "Ilimitado",
      armazenamento: "5GB",
    },
    popular: true,
  },
  profissional_mensal: {
    nome: "Plano Profissional",
    preco: 79.90,
    periodo: "/mês",
    recursos: [
      "Tudo do plano intermediário",
      "Dispositivos ilimitados",
      "Ordens de Serviço ilimitadas",
      "Catálogo ilimitado",
      "Funcionários e Comissões ilimitados",
      "Notificações Automáticas no Celular",
      "Aniversariantes do Mês com WhatsApp",
      "Consulta de IMEI pela Anatel",
      "Verificação de garantia Apple",
      "📡 Acompanhamento de OS (50/mês)",
      "50GB de armazenamento",
      "Suporte prioritário por WhatsApp",
    ],
    limites: {
      dispositivos: "Ilimitado",
      vendas_mes: "Ilimitado",
      armazenamento: "50GB",
    },
  },
  basico_anual: {
    nome: "Plano Básico",
    preco: 190.80,
    periodo: "/ano",
    recursos: [
      "Até 50 dispositivos",
      "Dashboard",
      "PDV",
      "Até 20 Ordens de Serviço p/ mês",
      "Produtos e Peças",
      "Dispositivos",
      "Vendas",
      "❌ Acompanhamento de OS (indisponível)",
      "500MB de armazenamento",
      "Suporte por email",
    ],
    limites: {
      dispositivos: 50,
      vendas_mes: "Ilimitado",
      armazenamento: "500MB",
    },
  },
  intermediario_anual: {
    nome: "Plano Intermediário",
    preco: 382.80,
    periodo: "/ano",
    recursos: [
      "Tudo do plano básico",
      "Até 500 dispositivos",
      "60 Ordens de Serviço p/ mês",
      "10 Dispositivos no Catálogo",
      "Assinatura Digital do Cliente na O.S",
      "1 Funcionário com Comissão",
      "Fornecedores",
      "Clientes",
      "Contas",
      "Financeiro",
      "📡 Acompanhamento de OS (10/mês)",
      "5GB de armazenamento",
      "Suporte via WhatsApp",
    ],
    limites: {
      dispositivos: 500,
      vendas_mes: "Ilimitado",
      armazenamento: "5GB",
    },
    popular: true,
  },
  profissional_anual: {
    nome: "Plano Profissional",
    preco: 898.80,
    periodo: "/ano",
    recursos: [
      "Tudo do plano intermediário",
      "Dispositivos ilimitados",
      "Ordens de Serviço ilimitadas",
      "Catálogo ilimitado",
      "Funcionários e Comissões ilimitados",
      "Notificações Automáticas no Celular",
      "Aniversariantes do Mês com WhatsApp",
      "Consulta de IMEI pela Anatel",
      "Verificação de garantia Apple",
      "📡 Acompanhamento de OS (50/mês)",
      "50GB de armazenamento",
      "Suporte prioritário por WhatsApp",
    ],
    limites: {
      dispositivos: "Ilimitado",
      vendas_mes: "Ilimitado",
      armazenamento: "50GB",
    },
  },
  profissional_ultra_mensal: {
    nome: "Plano Ultra",
    preco: 129.90,
    periodo: "/mês",
    descricao: "Para redes e múltiplas filiais",
    novo: true,
    recursos: [
      "✅ Tudo do plano Profissional",
      "✅ Multi Empresas (até 3 filiais)",
      "📡 Acompanhamento de OS (Ilimitado)",
      "🔜 Avaliador de Preço de Dispositivo (Em breve)",
    ],
    limites: {
      dispositivos: "Ilimitado",
      vendas_mes: "Ilimitado",
      armazenamento: "50GB",
    },
  },
  profissional_ultra_anual: {
    nome: "Plano Ultra",
    preco: 1318.80,
    periodo: "/ano",
    descricao: "Para redes e múltiplas filiais",
    novo: true,
    recursos: [
      "✅ Tudo do plano Profissional",
      "✅ Multi Empresas (até 3 filiais)",
      "📡 Acompanhamento de OS (Ilimitado)",
      "🔜 Avaliador de Preço de Dispositivo (Em breve)",
    ],
    limites: {
      dispositivos: "Ilimitado",
      vendas_mes: "Ilimitado",
      armazenamento: "50GB",
    },
  },
};
