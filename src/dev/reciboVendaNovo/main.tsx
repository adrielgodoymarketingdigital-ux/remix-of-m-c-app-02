/**
 * Página de teste do recibo novo — SÓ desenvolvimento. Aberta por
 * dev/recibo-venda-novo.html no `npm run dev`; o build usa apenas index.html,
 * então nada daqui vai para produção.
 *
 *   /dev/recibo-venda-novo.html                       todos os cenários
 *   ?cenario=com-troca                                um cenário
 *   ?cenario=com-troca&impressao=1                    com o CSS de impressão (@page A4)
 *   ?cenario=a-receber-4x&fonte=supabase              lê por carregarReciboVenda
 *                                                     (o Playwright simula o Supabase)
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PaginaReciboDev } from "./PaginaReciboDev";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PaginaReciboDev />
  </StrictMode>,
);
