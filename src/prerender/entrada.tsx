// Entrada do build SSR que gera o topo estático das landings (só roda no build, em Node).
// Renderiza as próprias páginas do app: o HTML puro sai idêntico ao que o React monta depois.
// Ver scripts/prerender/pluginTopoEstatico.ts.
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Landing from "@/pages/Landing";
import LandingLP1 from "@/pages/LandingLP1";
import LandingLP2 from "@/pages/LandingLP2";
import LandingES from "@/pages/LandingES";

const PAGINAS: Record<string, ComponentType> = {
  "/": Landing,
  "/lp1": LandingLP1,
  "/lp2": LandingLP2,
  "/es": LandingES,
};

export function renderizarLanding(rota: string): string {
  const Pagina = PAGINAS[rota];
  if (!Pagina) throw new Error(`[topo-estatico] rota sem landing: ${rota}`);
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[rota]}>
      <Pagina />
    </MemoryRouter>,
  );
}
