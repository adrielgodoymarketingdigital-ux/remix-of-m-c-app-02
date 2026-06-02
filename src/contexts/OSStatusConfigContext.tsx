import { createContext, useContext, ReactNode } from "react";
import { useOSStatusConfig, OSStatusConfig } from "@/hooks/useOSStatusConfig";

interface OSStatusConfigContextValue {
  statusList: OSStatusConfig[];
  activeStatusList: OSStatusConfig[];
  loading: boolean;
  carregarStatus: () => Promise<void>;
  criarStatus: (dados: { nome: string; cor: string; gera_conta: boolean; tipo_conta: string; pedir_data_vencimento: boolean }) => Promise<boolean>;
  atualizarStatusConfig: (id: string, dados: Partial<OSStatusConfig>) => Promise<boolean>;
  excluirStatus: (id: string) => Promise<boolean>;
  getStatusBySlug: (slug: string) => OSStatusConfig | undefined;
  getStatusColors: () => Record<string, string>;
  getStatusLabels: () => Record<string, string>;
}

const OSStatusConfigContext = createContext<OSStatusConfigContextValue | null>(null);

export function OSStatusConfigProvider({ children }: { children: ReactNode }) {
  const value = useOSStatusConfig();
  return (
    <OSStatusConfigContext.Provider value={value}>
      {children}
    </OSStatusConfigContext.Provider>
  );
}

// Hook que usa o context se disponível, senão instancia direto (fallback seguro)
export function useOSStatusConfigContext(): OSStatusConfigContextValue {
  const ctx = useContext(OSStatusConfigContext);
  if (ctx) return ctx;
  // Componentes fora do provider ainda funcionam, mas sem cache compartilhado
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useOSStatusConfig();
}
