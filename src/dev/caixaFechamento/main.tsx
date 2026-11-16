/**
 * Página de teste da PRÉVIA do fechamento de caixa — SÓ desenvolvimento
 * (dev/caixa-fechamento.html, fora do build). O Playwright simula o Supabase
 * (sessão e tabelas fictícias, rede bloqueada) e captura o HTML da prévia e o
 * PATCH que o fechamento enviaria, para comparar origin/main × branch.
 *
 *   ?cenario=sem-desconto|com-desconto&lang=pt-BR|es&tema=claro|escuro
 */
import "@/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { aplicarIdioma } from "@/lib/i18n/instancia";
import { PaginaFechamentoCaixa } from "./PaginaFechamentoCaixa";

const params = new URLSearchParams(window.location.search);
if (params.get("tema") === "escuro") document.documentElement.classList.add("dark");

void aplicarIdioma(params.get("lang") === "es" ? "es" : "pt-BR").then(() => {
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <PaginaFechamentoCaixa />
    </StrictMode>,
  );
});
