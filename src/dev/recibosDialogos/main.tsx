/**
 * Página de teste dos diálogos REAIS de recibo de venda — SÓ desenvolvimento
 * (dev/recibos-dialogos.html, fora do build). O Playwright simula o Supabase
 * (sessão fictícia, user_roles decide admin ou não) e compara main × branch.
 *
 *   ?lugar=pdv|vendas|dispositivos&cenario=simples[&modo=garantia]
 */
import "@/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PaginaDialogosRecibo } from "./PaginaDialogosRecibo";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PaginaDialogosRecibo />
  </StrictMode>,
);
