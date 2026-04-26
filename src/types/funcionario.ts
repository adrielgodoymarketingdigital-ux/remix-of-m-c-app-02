export type ComissaoTipo = "porcentagem" | "valor_fixo";

export type ComissaoEscopo = 
  | "vendas_produtos" 
  | "vendas_dispositivos" 
  | "vendas_todos" 
  | "servicos_os" 
  | "tudo";

export const CARGOS_PADRAO = ["Vendedor", "Técnico", "Estoque"];

export const ESCOPOS_POR_CARGO: Record<string, { value: ComissaoEscopo; label: string; descricao: string }[]> = {
  Vendedor: [
    { value: "vendas_produtos", label: "Produtos/Peças", descricao: "Comissão sobre vendas de produtos e peças" },
    { value: "vendas_dispositivos", label: "Dispositivos", descricao: "Comissão sobre vendas de dispositivos" },
    { value: "vendas_todos", label: "Todas as Vendas", descricao: "Comissão sobre todas as vendas (produtos + dispositivos)" },
  ],
  "Técnico": [
    { value: "servicos_os", label: "Serviços (OS)", descricao: "Comissão sobre o valor dos serviços realizados nas OS" },
  ],
  Estoque: [
    { value: "vendas_produtos", label: "Produtos/Peças", descricao: "Comissão sobre vendas de produtos e peças" },
  ],
  _default: [
    { value: "vendas_produtos", label: "Produtos/Peças", descricao: "Comissão sobre vendas de produtos e peças" },
    { value: "vendas_dispositivos", label: "Dispositivos", descricao: "Comissão sobre vendas de dispositivos" },
    { value: "vendas_todos", label: "Todas as Vendas", descricao: "Comissão sobre todas as vendas" },
    { value: "servicos_os", label: "Serviços (OS)", descricao: "Comissão sobre o valor dos serviços realizados" },
    { value: "tudo", label: "Tudo", descricao: "Comissão sobre vendas e serviços" },
  ],
};

export interface PermissoesModulos {
  dashboard: boolean;
  pdv: boolean;
  ordem_servico: boolean;
  produtos_pecas: boolean;
  servicos: boolean;
  dispositivos: boolean;
  catalogo: boolean;
  origem_dispositivos: boolean;
  fornecedores: boolean;
  clientes: boolean;
  orcamentos: boolean;
  contas: boolean;
  vendas: boolean;
  relatorios: boolean;
  financeiro: boolean;
  configuracoes: boolean;
  equipe: boolean;
  plano: boolean;
  suporte: boolean;
  novidades: boolean;
  tutoriais: boolean;
}

export interface PermissoesRecursos {
  ver_custos: boolean;
  ver_lucros: boolean;
  criar_servico_os: boolean;
  editar_produtos: boolean;
  ver_tecnicos_os: boolean;
  ver_inventario: boolean;
  ver_todas_os: boolean;
}

export interface PermissoesDados {
  produtos_pecas: boolean;
  ordens_servico: boolean;
  dispositivos: boolean;
  servicos: boolean;
  clientes: boolean;
}

export interface Permissoes {
  modulos: PermissoesModulos;
  recursos: PermissoesRecursos;
  dados?: PermissoesDados;
}

export interface ComissaoCargo {
  tipo: ComissaoTipo;
  valor: number;
  escopo: ComissaoEscopo;
}

export interface Funcionario {
  id: string;
  loja_user_id: string;
  funcionario_user_id: string | null;
  nome: string;
  email: string;
  ativo: boolean;
  permissoes: Permissoes;
  cargo: string | null;
  comissao_tipo: ComissaoTipo | null;
  comissao_valor: number;
  comissao_escopo: ComissaoEscopo | null;
  comissoes_por_cargo: Record<string, ComissaoCargo> | null;
  convite_token: string | null;
  convite_expira_em: string | null;
  convite_aceito_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface FuncionarioFormData {
  nome: string;
  email: string;
  permissoes: Permissoes;
  cargo?: string | null;
  comissao_tipo?: ComissaoTipo | null;
  comissao_valor?: number;
  comissao_escopo?: ComissaoEscopo | null;
  comissoes_por_cargo?: Record<string, ComissaoCargo> | null;
}

export const PERMISSOES_DEFAULT: Permissoes = {
  modulos: {
    dashboard: true,
    pdv: false,
    ordem_servico: false,
    produtos_pecas: false,
    servicos: false,
    dispositivos: false,
    catalogo: false,
    origem_dispositivos: false,
    fornecedores: false,
    clientes: false,
    orcamentos: false,
    contas: false,
    vendas: false,
    relatorios: false,
    financeiro: false,
    configuracoes: false,
    equipe: false,
    plano: false,
    suporte: true,
    novidades: true,
    tutoriais: true,
  },
  recursos: {
    ver_custos: false,
    ver_lucros: false,
    criar_servico_os: false,
    editar_produtos: false,
    ver_tecnicos_os: false,
    ver_inventario: false,
    ver_todas_os: false,
  },
  dados: {
    produtos_pecas: false,
    ordens_servico: false,
    dispositivos: false,
    servicos: false,
    clientes: false,
  },
};

export const MODULOS_LABELS: Record<keyof PermissoesModulos, string> = {
  dashboard: "Dashboard",
  pdv: "PDV",
  ordem_servico: "Ordem de Serviço",
  produtos_pecas: "Produtos e Peças",
  servicos: "Serviços",
  dispositivos: "Dispositivos",
  catalogo: "Catálogo",
  origem_dispositivos: "Origem de Dispositivos",
  fornecedores: "Fornecedores",
  clientes: "Clientes",
  orcamentos: "Orçamentos",
  contas: "Contas",
  vendas: "Vendas",
  relatorios: "Relatórios",
  financeiro: "Financeiro",
  configuracoes: "Configurações",
  equipe: "Equipe",
  plano: "Plano",
  suporte: "Suporte",
  novidades: "Novidades",
  tutoriais: "Tutoriais",
};

export const RECURSOS_LABELS: Record<keyof PermissoesRecursos, string> = {
  ver_custos: "Ver custos dos produtos",
  ver_lucros: "Ver lucros das vendas",
  criar_servico_os: "Criar serviço novo na OS",
  editar_produtos: "Editar quantidade e preço de produtos/peças",
  ver_tecnicos_os: "Ver lista de técnicos na Ordem de Serviço",
  ver_inventario: "Ver cards de inventário (estoque valorizado)",
  ver_todas_os: "Ver todas as ordens de serviço (desativado = apenas as próprias)",
};

export const DADOS_LABELS: Record<keyof PermissoesDados, string> = {
  produtos_pecas: "Acessar produtos e peças cadastrados",
  ordens_servico: "Acessar ordens de serviço cadastradas",
  dispositivos: "Acessar dispositivos cadastrados",
  servicos: "Acessar serviços cadastrados",
  clientes: "Acessar clientes cadastrados",
};

export const ROTA_PARA_MODULO: Record<string, keyof PermissoesModulos> = {
  "/dashboard": "dashboard",
  "/pdv": "pdv",
  "/os": "ordem_servico",
  "/produtos": "produtos_pecas",
  "/servicos": "servicos",
  "/dispositivos": "dispositivos",
  "/catalogo": "catalogo",
  "/origem-dispositivos": "origem_dispositivos",
  "/fornecedores": "fornecedores",
  "/clientes": "clientes",
  "/orcamentos": "orcamentos",
  "/contas": "contas",
  "/vendas": "vendas",
  "/relatorios": "relatorios",
  "/financeiro": "financeiro",
  "/configuracoes": "configuracoes",
  "/equipe": "equipe",
  "/plano": "plano",
  "/suporte": "suporte",
  "/novidades": "novidades",
  "/tutoriais": "tutoriais",
};
