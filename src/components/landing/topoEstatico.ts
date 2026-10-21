import { useLayoutEffect } from "react";

/**
 * id do bloco com o menu e o topo da landing em HTML puro, fora do #root. É gerado no
 * build (scripts/prerender/pluginTopoEstatico.ts) só nos HTMLs de /, /lp1, /lp2 e /es,
 * para o título aparecer antes do JavaScript.
 */
export const ID_TOPO_ESTATICO = "topo-estatico";

/**
 * Remove o topo estático quando a página da landing monta. Roda antes de o navegador
 * desenhar, e o topo do React fica exatamente no mesmo lugar: não pisca nem desloca.
 */
export function useRemoverTopoEstatico() {
  useLayoutEffect(() => {
    document.getElementById(ID_TOPO_ESTATICO)?.remove();
  }, []);
}
