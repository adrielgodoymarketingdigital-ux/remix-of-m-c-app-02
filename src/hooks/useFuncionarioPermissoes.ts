import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Permissoes, PermissoesModulos, PermissoesDados } from "@/types/funcionario";
import { PERMISSOES_DEFAULT } from "@/types/funcionario";
import { useOSBehaviorConfig } from "@/hooks/useOSBehaviorConfig";

interface FuncionarioPermissoesResult {
  isFuncionario: boolean;
  isDonoLoja: boolean;
  permissoes: Permissoes | null;
  lojaUserId: string | null;
  funcionarioId: string | null;
  funcionarioEmpresaId: string | null;
  carregando: boolean;
  temAcessoModulo: (modulo: keyof PermissoesModulos) => boolean;
  temAcessoRota: (rota: string) => boolean;
  temAcessoDados: (tipo: keyof PermissoesDados) => boolean;
  podeVerCustos: boolean;
  podeVerLucros: boolean;
  podeEditarProdutos: boolean;
  podeSincronizarProdutos: boolean;
  podeSincronizarOS: boolean;
  podeSincronizarDispositivos: boolean;
  podeSincronizarServicos: boolean;
  podeSincronizarClientes: boolean;
  podeVerContasPagarReceber: boolean;
  podeVerAnaliseLucros: boolean;
  podeVerTotalVendas: boolean;
  tecnicoObrigatorioOS: boolean;
  podeCompartilharLink: boolean;
}

const PERMISSOES_DONO: Permissoes = {
  modulos: {
    dashboard: true,
    pdv: true,
    ordem_servico: true,
    produtos_pecas: true,
    servicos: true,
    dispositivos: true,
    catalogo: true,
    origem_dispositivos: true,
    fornecedores: true,
    clientes: true,
    fidelidade: true,
    orcamentos: true,
    pedidos: true,
    contas: true,
    vendas: true,
    relatorios: true,
    financeiro: true,
    configuracoes: true,
    equipe: true,
    plano: true,
    suporte: true,
    novidades: true,
    tutoriais: true,
    precificador: true,
    remessas_corporativas: true,
  },
  recursos: {
    ver_custos: true,
    ver_lucros: true,
    criar_servico_os: true,
    editar_produtos: true,
    ver_tecnicos_os: true,
    ver_inventario: true,
    ver_todas_os: true,
    ver_contas_pagar_receber: true,
    ver_analise_lucros: true,
    ver_total_vendas: true,
    tecnico_obrigatorio_os: false,
    compartilhar_link_acompanhamento: true,
  },
  dados: {
    produtos_pecas: true,
    ordens_servico: true,
    dispositivos: true,
    servicos: true,
    clientes: true,
  },
};

// Mapeamento de rotas para módulos
const ROTA_MODULO_MAP: Record<string, keyof PermissoesModulos> = {
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
  "/fidelidade": "fidelidade",
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
};

export function useFuncionarioPermissoes(): FuncionarioPermissoesResult {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [usuarioResolvido, setUsuarioResolvido] = useState(false);

  // Busca o usuário atual ao montar (uma vez)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
      setUsuarioResolvido(true);
    });
  }, []);

  // Escuta mudanças de autenticação — só invalida se userId realmente mudou
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      setCurrentUserId(prev => {
        if (prev !== newUserId) {
          queryClient.invalidateQueries({ queryKey: ["funcionario-permissoes"] });
          return newUserId;
        }
        return prev;
      });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ["funcionario-permissoes", currentUserId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Verifica se o usuário é funcionário de alguma loja
      const { data: funcionarioData, error } = await supabase
        .from("loja_funcionarios")
        .select("*")
        .eq("funcionario_user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar permissões:", error);
        return null;
      }

      if (funcionarioData) {
        // É funcionário
        const raw = typeof funcionarioData.permissoes === 'string'
          ? JSON.parse(funcionarioData.permissoes)
          : funcionarioData.permissoes;

        // Merge com defaults garante que campos adicionados após o cadastro do funcionário existam
        const permissoes: Permissoes = {
          ...PERMISSOES_DEFAULT,
          ...raw,
          modulos: { ...PERMISSOES_DEFAULT.modulos, ...(raw?.modulos ?? {}) },
          recursos: { ...PERMISSOES_DEFAULT.recursos, ...(raw?.recursos ?? {}) },
          dados: { ...PERMISSOES_DEFAULT.dados, ...(raw?.dados ?? {}) },
        };

        return {
          isFuncionario: true,
          isDonoLoja: false,
          lojaUserId: funcionarioData.loja_user_id,
          funcionarioId: funcionarioData.id,
          funcionarioEmpresaId: funcionarioData.empresa_id ?? null,
          permissoes,
        };
      }

      // Não é funcionário, é dono da loja
      return {
        isFuncionario: false,
        isDonoLoja: true,
        lojaUserId: user.id,
        funcionarioId: null,
        funcionarioEmpresaId: null,
        permissoes: PERMISSOES_DONO,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    enabled: !!currentUserId, // Só executa quando há usuário
  });

  const temAcessoModulo = useCallback((modulo: keyof PermissoesModulos): boolean => {
    // Durante carregamento, não mostrar nada para evitar flash incorreto
    if (isLoading) return false;
    // Sem dados = não autenticado, negar acesso
    if (!data) return false;
    // Dono da loja tem acesso total
    if (data.isDonoLoja) return true;
    // Funcionário: verificar permissão específica
    return data.permissoes?.modulos?.[modulo] ?? false;
  }, [data, isLoading]);

  const temAcessoRota = useCallback((rota: string): boolean => {
    // Durante carregamento, negar acesso temporariamente
    if (isLoading) return false;
    // Sem dados = não autenticado
    if (!data) return false;
    // Dono da loja tem acesso total
    if (data.isDonoLoja) return true;
    
    const modulo = ROTA_MODULO_MAP[rota];
    if (!modulo) return true; // Rotas não mapeadas são permitidas
    
    return data.permissoes?.modulos?.[modulo] ?? false;
  }, [data, isLoading]);

  const temAcessoDados = useCallback((tipo: keyof PermissoesDados): boolean => {
    // Durante carregamento, não assumir acesso a dados
    if (isLoading) return false;
    if (!data) return false;
    // Dono sempre tem acesso a todos os dados
    if (data.isDonoLoja) return true;
    // Funcionário precisa ter permissão explícita
    return data.permissoes?.dados?.[tipo] ?? false;
  }, [data, isLoading]);

  // Flags de sincronização de dados
  const podeSincronizarProdutos = temAcessoDados('produtos_pecas');
  const podeSincronizarOS = temAcessoDados('ordens_servico');
  const podeSincronizarDispositivos = temAcessoDados('dispositivos');
  const podeSincronizarServicos = temAcessoDados('servicos');
  const podeSincronizarClientes = temAcessoDados('clientes');

  // Config global da loja (salva em configuracoes_loja.layout_os_config)
  const { tecnicoObrigatorioOS: tecnicoObrigatorioOSGlobal } = useOSBehaviorConfig();

  return {
    isFuncionario: data?.isFuncionario ?? false,
    isDonoLoja: data?.isDonoLoja ?? false,
    permissoes: data?.permissoes ?? null,
    lojaUserId: data?.lojaUserId ?? null,
    funcionarioId: data?.funcionarioId ?? null,
    funcionarioEmpresaId: data?.funcionarioEmpresaId ?? null,
    carregando: !usuarioResolvido || isLoading,
    temAcessoModulo,
    temAcessoRota,
    temAcessoDados,
    podeVerCustos: data?.isDonoLoja ? true : (data?.permissoes?.recursos?.ver_custos ?? false),
    podeVerLucros: data?.isDonoLoja ? true : (data?.permissoes?.recursos?.ver_lucros ?? false),
    podeEditarProdutos: data?.isDonoLoja ? true : (data?.permissoes?.recursos?.editar_produtos ?? false),
    podeSincronizarProdutos,
    podeSincronizarOS,
    podeSincronizarDispositivos,
    podeSincronizarServicos,
    podeSincronizarClientes,
    podeVerContasPagarReceber: data?.isDonoLoja ? true : (data?.permissoes?.recursos?.ver_contas_pagar_receber ?? false),
    podeVerAnaliseLucros: data?.isDonoLoja ? true : (data?.permissoes?.recursos?.ver_analise_lucros ?? false),
    podeVerTotalVendas: data?.isDonoLoja ? true : (data?.permissoes?.recursos?.ver_total_vendas ?? false),
    // Lê da config global da loja (configuracoes_loja.layout_os_config.tecnico_obrigatorio_os)
    tecnicoObrigatorioOS: tecnicoObrigatorioOSGlobal,
    podeCompartilharLink: data?.isDonoLoja ? true : (data?.permissoes?.recursos?.compartilhar_link_acompanhamento ?? false),
  };
}
