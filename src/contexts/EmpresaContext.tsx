import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmpresaContextType {
  empresaAtiva: string | null;
  setEmpresaAtiva: (id: string | null) => void;
  isProprietario: boolean;
  empresas: { id: string; nome: string }[];
  carregarEmpresas: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresaAtiva: null,
  setEmpresaAtiva: () => {},
  isProprietario: false,
  empresas: [],
  carregarEmpresas: async () => {},
});

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaAtiva, setEmpresaAtivaState] = useState<string | null>(
    localStorage.getItem('empresa_ativa')
  );
  const [isProprietario, setIsProprietario] = useState(false);
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);

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

    const { data } = await supabase
      .from('empresas')
      .select('id, nome')
      .eq('proprietario_id', user.id)
      .eq('ativa', true)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      setIsProprietario(true);
      setEmpresas(data);
    }
  };

  useEffect(() => { carregarEmpresas(); }, []);

  return (
    <EmpresaContext.Provider value={{
      empresaAtiva,
      setEmpresaAtiva,
      isProprietario,
      empresas,
      carregarEmpresas,
    }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export const useEmpresa = () => useContext(EmpresaContext);
