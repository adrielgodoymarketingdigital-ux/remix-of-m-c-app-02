/**
 * Destino único da impressão dos recibos de venda (PDV, Vendas, Dispositivos).
 * Devolve algo com a mesma cara de window.open() — document.write/close —
 * para os diálogos seguirem montando o documento como sempre:
 *  - janela: É o window.open("", "_blank") de sempre (computador, Android e
 *    iOS pelo Safari em PDV/Vendas);
 *  - iframe: guarda o documento e, no close(), chama printViaIframe;
 *  - camada-ios: guarda o documento e, no close(), abre a camada do iOS com
 *    app instalado (nunca window.open lá).
 * #print-root e o PDF de Dispositivos não passam por aqui (precisam de outras
 * peças); a decisão de caminho é a mesma (decidirCaminhoImpressaoRecibo).
 */
import { detectarContextoImpressaoMobile, printViaIframe } from "@/lib/printMobile";
import { abrirCamadaImpressaoIOS } from "./camadaImpressaoIOS";
import {
  type CaminhoImpressaoRecibo,
  decidirCaminhoImpressaoRecibo,
  type FormatoPapelRecibo,
  type LugarReciboVenda,
} from "./caminhoImpressaoRecibo";

export interface DestinoImpressaoRecibo {
  document: { write(html: string): void; close(): void };
}

/** Caminho de impressão deste aparelho para o lugar do recibo. */
export function caminhoImpressaoRecibo(lugar: LugarReciboVenda): CaminhoImpressaoRecibo {
  return decidirCaminhoImpressaoRecibo(detectarContextoImpressaoMobile(), lugar);
}

/** Chamar no mesmo tick do clique (como window.open). null = popup bloqueado. */
export function abrirDestinoImpressaoRecibo(
  caminho: Extract<CaminhoImpressaoRecibo, "janela" | "iframe" | "camada-ios">,
  p: { titulo: string; formato: FormatoPapelRecibo; isIOS?: boolean },
): DestinoImpressaoRecibo | null {
  if (caminho === "janela") return window.open("", "_blank");
  let html = "";
  return {
    document: {
      write: (trecho: string) => {
        html += trecho;
      },
      close: () => {
        if (caminho === "iframe") printViaIframe(html, p.isIOS ?? false);
        else abrirCamadaImpressaoIOS(html, { titulo: p.titulo, formato: p.formato });
      },
    },
  };
}
