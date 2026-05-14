import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmpresaContextType {
  empresaAtiva: string | null;
  setEmpresaAtiva: (id: string | null) => void;
  isProprietario: boolean;
  empresas: { id: string; nome: string }[];
  nomeMatriz: string;
  carregarEmpresas: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresaAtiva: null,
  setEmpresaAtiva: () => {},
  isProprietario: false,
  empresas: [],
  nomeMatriz: "Minha Empresa",
  carregarEmpresas: async () => {},
});

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaAtiva, setEmpresaAtivaState] = useState<string | null>(
    localStorage.getItem('empresa_ativa')
  );
  const [isProprietario, setIsProprietario] = useState(false);
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
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

    const [filiais, configLoja] = await Promise.all([
      supabase
        .from('empresas')
        .select('id, nome')
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
      setEmpresas(filiais.data);
    }

    if (configLoja.data?.nome_loja) {
      setNomeMatriz(configLoja.data.nome_loja);
    }
  };

  useEffect(() => { carregarEmpresas(); }, []);

  return (
    <EmpresaContext.Provider value={{
      empresaAtiva,
      setEmpresaAtiva,
      isProprietario,
      empresas,
      nomeMatriz,
      carregarEmpresas,
    }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export const useEmpresa = () => useContext(EmpresaContext);
