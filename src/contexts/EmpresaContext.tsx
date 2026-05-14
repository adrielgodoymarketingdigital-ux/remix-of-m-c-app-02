import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmpresaContextType {
  empresaAtiva: string | null;
  setEmpresaAtiva: (id: string | null) => void;
  isProprietario: boolean;
  empresas: { id: string; nome: string }[];
  nomeMatriz: string;
  // user_id efetivo para queries: gerente da filial selecionada ou o próprio proprietário
  userIdAtivo: string | null;
  carregarEmpresas: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresaAtiva: null,
  setEmpresaAtiva: () => {},
  isProprietario: false,
  empresas: [],
  nomeMatriz: "Minha Empresa",
  userIdAtivo: null,
  carregarEmpresas: async () => {},
});

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaAtiva, setEmpresaAtivaState] = useState<string | null>(
    localStorage.getItem('empresa_ativa')
  );
  const [isProprietario, setIsProprietario] = useState(false);
  const [proprietarioId, setProprietarioId] = useState<string | null>(null);
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

    const [filiais, configLoja] = await Promise.all([
      // Busca filiais com o gerente_id de cada uma
      supabase
        .from('empresas')
        .select('id, nome, empresa_usuarios(gerente_id)')
        .eq('proprietario_id', user.id)
        .eq('ativa', true)
        .order('created_at', { ascending: true }),
      supabase
        .from('configuracoes_loja')
        .select('nome_loja')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (filiais.data && filiais.data.length > 0) {
      setIsProprietario(true);
      setEmpresas(
        filiais.data.map((e: any) => ({
          id: e.id,
          nome: e.nome,
          gerente_id: e.empresa_usuarios?.[0]?.gerente_id ?? null,
        }))
      );
    }

    if (configLoja.data?.nome_loja) {
      setNomeMatriz(configLoja.data.nome_loja);
    }
  };

  useEffect(() => { carregarEmpresas(); }, []);

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
      carregarEmpresas,
    }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export const useEmpresa = () => useContext(EmpresaContext);
