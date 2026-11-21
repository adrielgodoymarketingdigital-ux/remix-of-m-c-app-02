/**
 * Página de teste da cor do cabeçalho dos recibos — SÓ desenvolvimento
 * (dev/recibo-cor-cabecalho.html, fora do build). Componentes REAIS:
 *   ?tela=os&cores=<json>          ImpressaoA4Personalizado com a loja fictícia
 *   ?tela=venda&cores=<json>       ReciboVendaNovo (montarReciboVenda) com a loja fictícia
 *   ?tela=miniatura&cores=<json>   MiniaturaModeloRecibo (Layout da OS)
 *   ?tela=config                   PersonalizacaoCores (Configurações → Cores)
 *   ?tela=os-sessao                useConfiguracaoLoja() + ImpressaoA4Personalizado
 * `cores` = o valor de cores_personalizadas (ausente = loja que nunca escolheu).
 * O Supabase é simulado pelo Playwright (scripts/testes-recibo-cor-cabecalho/tela.playwright.mjs).
 * A mesma página roda numa cópia da origin/main para comparar o HTML sem cor.
 */
import "@/index.css";
import "@/lib/i18n/instancia";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { PaginaCorCabecalho } from "./PaginaCorCabecalho";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PaginaCorCabecalho />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
