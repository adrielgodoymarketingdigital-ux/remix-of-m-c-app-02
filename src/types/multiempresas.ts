export interface Empresa {
  id: string;
  proprietario_id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  logo_url: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmpresaUsuario {
  id: string;
  empresa_id: string;
  proprietario_id: string;
  gerente_id: string;
  permissoes: {
    pdv: boolean;
    os: boolean;
    clientes: boolean;
    produtos: boolean;
    financeiro: boolean;
    relatorios: boolean;
    funcionarios: boolean;
    configuracoes: boolean;
    metas: boolean;
  };
  ativa: boolean;
  created_at: string;
  gerente?: {
    email: string;
    nome: string;
  };
}

export interface EmpresaMeta {
  id: string;
  empresa_id: string;
  proprietario_id: string;
  tipo: 'faturamento' | 'os' | 'vendas' | 'clientes';
  valor: number;
  periodo: 'mensal' | 'semanal';
  mes: number | null;
  ano: number | null;
}

export interface EmpresaDashboard extends Empresa {
  gerentes: EmpresaUsuario[];
  metas: EmpresaMeta[];
  metricas: {
    faturamento_mes: number;
    os_mes: number;
    vendas_mes: number;
    clientes_ativos: number;
  };
}
