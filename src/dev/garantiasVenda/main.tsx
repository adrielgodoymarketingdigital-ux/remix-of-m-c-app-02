/**
 * Página de teste da FASE B de "Minhas garantias" — SÓ desenvolvimento
 * (dev/garantias-venda.html, fora do build). Componentes REAIS:
 *   ?tela=pdv    → DialogSelecionarItem (PDV), guarda o item que iria para o carrinho
 *   ?tela=cartao → CardDispositivo, guarda o state que iria para /pdv
 * O Supabase é simulado pelo Playwright (scripts/testes-garantias-venda/tela.playwright.mjs).
 * A mesma página roda numa cópia da origin/main para comparar o fluxo antigo.
 */
import "@/index.css";
import "@/lib/i18n/instancia";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PaginaGarantiasVenda } from "./PaginaGarantiasVenda";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PaginaGarantiasVenda />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
