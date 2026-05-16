import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmpresaContextType {
  empresaAtiva: string | null;
  setEmpresaAtiva: (id: string | null) => void;
  isProprietario: boolean;
  empresas: { id: string; nome: string; gerente_id: string | null }[];
  nomeMatriz: string;
  // user_id efetivo para queries: gerente da filial selecionada ou o próprio proprietário
  userIdAtivo: string | null;
  // ID da empresa matriz do proprietário logado (nunca é null quando isProprietario=true)
  matrizId: string | null;
  carregarEmpresas: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresaAtiva: null,
  setEmpresaAtiva: () => {},
  isProprietario: false,
  empresas: [] as { id: string; nome: string; gerente_id: string | null }[],
  nomeMatriz: "Minha Empresa",
  userIdAtivo: null,
  matrizId: null,
  carregarEmpresas: async () => {},
});

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaAtiva, setEmpresaAtivaState] = useState<string | null>(
    localStorage.getItem('empresa_ativa')
  );
  const [isProprietario, setIsProprietario] = useState(false);
  const [proprietarioId, setProprietarioId] = useState<string | null>(null);
  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; gerente_id: string | null }[]>([]);
  const [nomeMatriz, setNomeMatriz] = useState("Minha Empresa");

  const setEmpresaAtiva = (id: string | null) => {
    setEmpresaAtivaState(id);
    if (id) {
      localStorage.setItem('empresa_ativa', id);
    } else {
      localStorage.removeItem('empresa_ativa');
    }
  };

  const carregarEmpresas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setProprietarioId(user.id);

    // Busca paralela: empresas do proprietário + config da loja
    // A query de empresas filtra explicitamente por proprietario_id = user.id
    // para evitar que gerentes de filiais vejam empresas alheias via RLS
    const [filiaisRes, configLoja] = await Promise.all([
      supabase
        .from('empresas')
        .select('id, nome')
        .eq('proprietario_id', user.id)
        .eq('ativa', true)
        .eq('tipo', 'filial')
        .order('created_at', { ascending: true }),
      supabase
        .from('configuracoes_loja')
        .select('nome_loja')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const filiaisData = filiaisRes.data ?? [];

    // Verifica se o usuário tem uma empresa matriz (é proprietário de fato)
    const { data: matrizData } = await supabase
      .from('empresas')
      .select('id')
      .eq('proprietario_id', user.id)
      .eq('tipo', 'matriz')
      .eq('ativa', true)
      .maybeSingle();

    if (matrizData) {
      setIsProprietario(true);
      setMatrizId(matrizData.id);

      // Busca gerentes somente das filiais deste proprietário
      const ids = filiaisData.map((e: { id: string }) => e.id);
      const gerentesMap: Record<string, string | null> = {};

      if (ids.length > 0) {
        const { data: gerentesData } = await (supabase
          .from('empresa_usuarios' as never)
          .select('empresa_id, gerente_id')
          .in('empresa_id' as never, ids as never) as any);

        if (gerentesData) {
          for (const g of gerentesData as { empresa_id: string; gerente_id: string | null }[]) {
            gerentesMap[g.empresa_id] = g.gerente_id;
          }
        }
      }

      const lista = filiaisData.map((e: { id: string; nome: string }) => ({
        id: e.id,
        nome: e.nome,
        gerente_id: gerentesMap[e.id] ?? null,
      }));
      setEmpresas(lista);

      // Limpar empresa ativa do localStorage se o ID não pertence a este proprietário
      const empresaAtivaLocal = localStorage.getItem('empresa_ativa');
      if (empresaAtivaLocal && !lista.some(e => e.id === empresaAtivaLocal)) {
        localStorage.removeItem('empresa_ativa');
        setEmpresaAtivaState(null);
      }
    } else {
      // Usuário sem empresas próprias — limpar qualquer empresa_ativa residual
      setIsProprietario(false);
      setMatrizId(null);
      setEmpresas([]);
      localStorage.removeItem('empresa_ativa');
      setEmpresaAtivaState(null);
    }

    if (configLoja.data?.nome_loja) {
      setNomeMatriz(configLoja.data.nome_loja);
    }
  };

  useEffect(() => {
    carregarEmpresas();

    // Ao trocar de usuário ou fazer logout, limpar estado de empresa
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        localStorage.removeItem('empresa_ativa');
        setEmpresaAtivaState(null);
        setIsProprietario(false);
        setMatrizId(null);
        setEmpresas([]);
        setProprietarioId(null);
        setNomeMatriz("Minha Empresa");
      }
      if (event === 'SIGNED_IN') {
        carregarEmpresas();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Resolve o user_id efetivo: gerente da filial ou o próprio proprietário
  const empresaSelecionada = empresas.find(e => e.id === empresaAtiva);
  const userIdAtivo = empresaAtiva
    ? (empresaSelecionada?.gerente_id ?? proprietarioId)
    : proprietarioId;

  return (
    <EmpresaContext.Provider value={{
      empresaAtiva,
      setEmpresaAtiva,
      isProprietario,
      empresas,
      nomeMatriz,
      userIdAtivo,
      matrizId,
      carregarEmpresas,
    }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export const useEmpresa = () => useContext(EmpresaContext);
