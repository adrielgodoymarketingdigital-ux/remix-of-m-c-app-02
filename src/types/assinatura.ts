// NOTA: "demonstracao" mantido por compatibilidade com enum do banco, mas será tratado como "trial"
export type PlanoTipo =
  | "demonstracao"
  | "trial"
  | "free"
  | "admin"
  | "basico_mensal"
  | "intermediario_mensal"
  | "profissional_mensal"
  | "basico_anual"
  | "intermediario_anual"
  | "profissional_anual";

export type StatusAssinatura =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid";

export interface Assinatura {
  id: string;
  user_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  payment_provider?: string | null;
  ticto_order_id?: string | null;
  plano_tipo: PlanoTipo;
  status: StatusAssinatura;
  data_inicio: string;
  data_fim?: string;
  data_proxima_cobranca?: string;
  created_at: string;
  updated_at: string;
}

export const STRIPE_PRICE_IDS: Record<PlanoTipo, string> = {
  demonstracao: "", // Deprecated - tratado como trial
  trial: "",
  free: "", // Plano gratuito, não tem price ID
  basico_mensal: "price_1TCTqfFu8jWFILvSyfTI73ff",
  intermediario_mensal: "price_1TCTrRFu8jWFILvSl50ZKqpy",
  profissional_mensal: "price_1TCTrnFu8jWFILvS4hBfmUiz",
  basico_anual: "price_1TCTszFu8jWFILvSLajvpW8A",
  intermediario_anual: "price_1TCTtTFu8jWFILvSwTuoRvm8",
  profissional_anual: "price_1TCTtxFu8jWFILvSZgjoxpX6",
  admin: "",
};

export interface LimitesPlano {
  dispositivos: number; // -1 para ilimitado
  ordens_servico_mes: number; // -1 para ilimitado
  produtos_mes: number; // -1 para ilimitado
  dispositivos_catalogo: number; // -1 para ilimitado, 0 para sem acesso
  servicos_avulsos_mes: number; // -1 para ilimitado, 0 para sem acesso
  armazenamento_mb: number;
  modulos: {
    dashboard: boolean;
    pdv: boolean;
    produtos_pecas: boolean;
    dispositivos: boolean;
    vendas: boolean;
    ordem_servico: boolean;
    fornecedores: boolean;
    clientes: boolean;
    contas: boolean;
    financeiro: boolean;
    configuracoes: boolean;
    servicos: boolean;
    orcamentos: boolean;
    catalogo: boolean;
    landing_page: boolean; // Função em desenvolvimento - apenas admin
  };
  recursos_premium: {
    consulta_imei: boolean;
    verificacao_garantia_apple: boolean;
    suporte_prioritario: boolean;
    assinatura_digital: boolean;
  };
}

// Data de corte para novos limites do plano Free
// Usuários criados antes dessa data mantêm os limites antigos (5 OS/mês, 10 produtos/mês)
// Usuários criados após essa data seguem os novos limites (3 OS total, 10 produtos total)
export const FREE_PLAN_CUTOFF_DATE = "2026-02-16T00:00:00Z";

// Limites do plano Free LEGADO (usuários antigos - antes de 2026-02-16)
const LIMITES_FREE_LEGADO: LimitesPlano = {
  dispositivos: 5,
  ordens_servico_mes: 5,
  produtos_mes: 10,
  dispositivos_catalogo: 0,
  servicos_avulsos_mes: 0,
  armazenamento_mb: 100,
  modulos: {
    dashboard: true,
    pdv: true,
    produtos_pecas: true,
    dispositivos: true,
    vendas: true,
    ordem_servico: true,
    fornecedores: false,
    clientes: false,
    contas: false,
    financeiro: false,
    configuracoes: true,
    servicos: true,
    orcamentos: false,
    catalogo: false,
    landing_page: false,
  },
  recursos_premium: {
    consulta_imei: false,
    verificacao_garantia_apple: false,
    suporte_prioritario: false,
    assinatura_digital: false,
  },
};

// Limites do plano Free NOVO (usuários novos - a partir de 2026-02-16)
const LIMITES_FREE: LimitesPlano = {
  dispositivos: 3,
  ordens_servico_mes: 3,
  produtos_mes: 3,
  dispositivos_catalogo: 0,
  servicos_avulsos_mes: 0,
  armazenamento_mb: 50,
  modulos: {
    dashboard: true,
    pdv: true,
    produtos_pecas: true,
    dispositivos: true,
    vendas: false,
    ordem_servico: true,
    fornecedores: false,
    clientes: false,
    contas: false,
    financeiro: false,
    configuracoes: true,
    servicos: true,
    orcamentos: false,
    catalogo: false,
    landing_page: false,
  },
  recursos_premium: {
    consulta_imei: false,
    verificacao_garantia_apple: false,
    suporte_prioritario: false,
    assinatura_digital: false,
  },
};

// Limites do trial (acesso completo por 7 dias)
const LIMITES_TRIAL: LimitesPlano = {
  dispositivos: -1,
  ordens_servico_mes: -1,
  produtos_mes: -1,
  dispositivos_catalogo: -1,
  servicos_avulsos_mes: -1,
  armazenamento_mb: 50000,
  modulos: {
    dashboard: true,
    pdv: true,
    produtos_pecas: true,
    dispositivos: true,
    vendas: true,
    ordem_servico: true,
    fornecedores: true,
    clientes: true,
    contas: true,
    financeiro: true,
    configuracoes: true,
    servicos: true,
    orcamentos: true,
    catalogo: true,
    landing_page: false, // Em desenvolvimento
  },
  recursos_premium: {
    consulta_imei: true,
    verificacao_garantia_apple: true,
    suporte_prioritario: false,
    assinatura_digital: true,
  },
};

// Limites do plano admin (acesso total)
const LIMITES_ADMIN: LimitesPlano = {
  dispositivos: -1,
  ordens_servico_mes: -1,
  produtos_mes: -1,
  dispositivos_catalogo: -1,
  servicos_avulsos_mes: -1,
  armazenamento_mb: -1,
  modulos: {
    dashboard: true,
    pdv: true,
    produtos_pecas: true,
    dispositivos: true,
    vendas: true,
    ordem_servico: true,
    fornecedores: true,
    clientes: true,
    contas: true,
    financeiro: true,
    configuracoes: true,
    servicos: true,
    orcamentos: true,
    catalogo: true,
    landing_page: true, // Admin tem acesso para testar
  },
  recursos_premium: {
    consulta_imei: true,
    verificacao_garantia_apple: true,
    suporte_prioritario: true,
    assinatura_digital: true,
  },
};

// Limites do plano básico
const LIMITES_BASICO: LimitesPlano = {
  dispositivos: 50,
  ordens_servico_mes: 20,
  produtos_mes: -1, // Ilimitado para planos pagos
  dispositivos_catalogo: 0, // Sem acesso ao catálogo
  servicos_avulsos_mes: 0, // Não disponível no básico
  armazenamento_mb: 500,
  modulos: {
    dashboard: true,
    pdv: true,
    produtos_pecas: true,
    dispositivos: true,
    vendas: true,
    ordem_servico: true, // Agora tem acesso (limitado a 20/mês)
    fornecedores: false,
    clientes: false,
    contas: false,
    financeiro: false,
    configuracoes: true,
    servicos: true,
    orcamentos: true,
    catalogo: false,
    landing_page: false,
  },
  recursos_premium: {
    consulta_imei: false,
    verificacao_garantia_apple: false,
    suporte_prioritario: false,
    assinatura_digital: false,
  },
};

// Limites do plano intermediário
const LIMITES_INTERMEDIARIO: LimitesPlano = {
  dispositivos: 500,
  ordens_servico_mes: 60,
  produtos_mes: -1, // Ilimitado para planos pagos
  dispositivos_catalogo: 10,
  servicos_avulsos_mes: 20,
  armazenamento_mb: 5000,
  modulos: {
    dashboard: true,
    pdv: true,
    produtos_pecas: true,
    dispositivos: true,
    vendas: true,
    ordem_servico: true,
    fornecedores: true,
    clientes: true,
    contas: true,
    financeiro: true,
    configuracoes: true,
    servicos: true,
    orcamentos: true,
    catalogo: true,
    landing_page: false,
  },
  recursos_premium: {
    consulta_imei: false,
    verificacao_garantia_apple: false,
    suporte_prioritario: false,
    assinatura_digital: true, // Acesso à assinatura digital
  },
};

// Limites do plano profissional
const LIMITES_PROFISSIONAL: LimitesPlano = {
  dispositivos: -1,
  ordens_servico_mes: -1,
  produtos_mes: -1, // Ilimitado
  dispositivos_catalogo: -1,
  servicos_avulsos_mes: -1, // Ilimitado
  armazenamento_mb: 50000,
  modulos: {
    dashboard: true,
    pdv: true,
    produtos_pecas: true,
    dispositivos: true,
    vendas: true,
    ordem_servico: true,
    fornecedores: true,
    clientes: true,
    contas: true,
    financeiro: true,
    configuracoes: true,
    servicos: true,
    orcamentos: true,
    catalogo: true,
    landing_page: false,
  },
  recursos_premium: {
    consulta_imei: true,
    verificacao_garantia_apple: true,
    suporte_prioritario: true,
    assinatura_digital: true,
  },
};

export const LIMITES_POR_PLANO: Record<PlanoTipo, LimitesPlano> = {
  // "demonstracao" agora usa limites Free (não mais trial - corrigido)
  demonstracao: LIMITES_FREE,
  trial: LIMITES_TRIAL,
  free: LIMITES_FREE,
  admin: LIMITES_ADMIN,
  basico_mensal: LIMITES_BASICO,
  basico_anual: LIMITES_BASICO,
  intermediario_mensal: LIMITES_INTERMEDIARIO,
  intermediario_anual: LIMITES_INTERMEDIARIO,
  profissional_mensal: LIMITES_PROFISSIONAL,
  profissional_anual: LIMITES_PROFISSIONAL,
};

/**
 * Retorna os limites corretos do plano Free baseado na data de criação da assinatura.
 * Usuários antigos (antes de 2026-02-16) mantêm limites legados (5 OS/mês).
 * Usuários novos recebem limites reduzidos (3 OS total).
 */
export function getLimitesFree(createdAt?: string | null): LimitesPlano {
  if (!createdAt) return LIMITES_FREE;
  const dataCriacao = new Date(createdAt);
  const dataCutoff = new Date(FREE_PLAN_CUTOFF_DATE);
  return dataCriacao < dataCutoff ? LIMITES_FREE_LEGADO : LIMITES_FREE;
}
