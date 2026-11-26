// Página de teste local: Dashboard real (AppLayout: barra lateral + barra inferior) ou a aba Cores
// dentro do AppLayout, sem login; mock.ts responde tudo com dados fictícios. ?tela=dashboard|cores
// mock.ts precisa ser o primeiro import: troca fetch e Date antes de o cliente do Supabase existir.
import "./mock";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "@/index.css";
import "@/fontes.css";
import "@/lib/i18n/instancia";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { OSStatusConfigProvider } from "@/contexts/OSStatusConfigContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import { PersonalizacaoCores } from "@/components/configuracoes/PersonalizacaoCores";

// Igual ao main.tsx da branch; na cópia da main o arquivo não existe e nada é aplicado.
const lib = import.meta.glob("/src/lib/menu/aplicarCorMenu.ts", { eager: true }) as Record<string, { aplicarCorMenuLembrada?: () => void }>;
Object.values(lib)[0]?.aplicarCorMenuLembrada?.();

const tela = new URLSearchParams(location.search).get("tela") ?? "dashboard";
const Destino = () => { const l = useLocation(); return <div id="destino">{l.pathname + l.search}</div>; };
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 300000, gcTime: 1800000, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 0 } } });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <EmpresaProvider>
          <OSStatusConfigProvider>
            <Toaster />
            <MemoryRouter initialEntries={[tela === "cores" ? "/configuracoes" : "/dashboard"]}>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/configuracoes" element={<AppLayout><div className="p-4 sm:p-6"><PersonalizacaoCores /></div></AppLayout>} />
                <Route path="*" element={<Destino />} />
              </Routes>
            </MemoryRouter>
          </OSStatusConfigProvider>
        </EmpresaProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
