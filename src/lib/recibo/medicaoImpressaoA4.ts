/**
 * Medição SÍNCRONA (sem await) de documentos de impressão A4 num iframe
 * escondido, para escolher a compactação do recibo / termo de garantia de
 * dispositivo (lib/recibo/compactacaoReciboVendaA4). Síncrona de propósito:
 * no iOS pelo Safari o window.print() tem de sair no mesmo toque do usuário.
 *
 * O iframe tem a largura útil da folha; o documento é escrito com
 * document.write (sem script) e medido na hora. Imagem ainda não carregada
 * mede pela altura máxima do logo (para cima, nunca para baixo).
 * Qualquer erro = null (o chamador imprime o documento de sempre).
 */
import {
  LIMITE_UMA_FOLHA_HTML_MM,
  NIVEL_MAXIMO_COMPACTACAO,
  aplicarCompactacaoReciboDispositivoA4,
  decidirCompactacao,
  type NivelCompactacao,
} from "@/lib/recibo/compactacaoReciboVendaA4";

export interface DocumentoMedicao {
  css: string;
  body: string;
}

export interface MedidaDocumento {
  /** Altura do conteúdo (mm). */
  alturaMm: number;
  /** Do topo do último `inicioFinal` ao fim do último `fimFinal` (mm); null = não há. */
  finalMm: number | null;
}

const MM_POR_PX = 25.4 / 96;

export function medirDocumentosA4(
  docs: readonly DocumentoMedicao[],
  opcoes: { larguraMm: number; inicioFinal: string; fimFinal: string; cssExtra?: string },
): MedidaDocumento[] | null {
  if (typeof document === "undefined" || !document.body) return null;
  let iframe: HTMLIFrameElement | null = null;
  try {
    iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${opcoes.larguraMm}mm;height:50px;border:0;visibility:hidden;pointer-events:none;`;
    document.body.appendChild(iframe);
    const d = iframe.contentDocument;
    if (!d) return null;
    const medidas: MedidaDocumento[] = [];
    for (const doc of docs) {
      d.open();
      d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${doc.css}</style><style>${opcoes.cssExtra ?? ""}</style></head><body>${doc.body}</body></html>`);
      d.close();
      const corpo = d.body;
      if (!corpo) return null;
      const topo = corpo.getBoundingClientRect().top;
      let fundo = topo;
      for (const el of Array.from(corpo.children)) fundo = Math.max(fundo, el.getBoundingClientRect().bottom);
      const inicios = d.querySelectorAll(opcoes.inicioFinal);
      const fins = d.querySelectorAll(opcoes.fimFinal);
      const finalPx = inicios.length && fins.length
        ? fins[fins.length - 1].getBoundingClientRect().bottom - inicios[inicios.length - 1].getBoundingClientRect().top
        : null;
      medidas.push({ alturaMm: (fundo - topo) * MM_POR_PX, finalMm: finalPx === null ? null : finalPx * MM_POR_PX });
    }
    return medidas;
  } catch {
    return null;
  } finally {
    iframe?.remove();
  }
}

/**
 * HTML A4 antigo do recibo / termo de garantia de dispositivo
 * (DialogReimprimirReciboVenda): mede nos níveis 0 a 2 e devolve o CSS e o
 * corpo do primeiro que cabe numa folha; nem o 2 cabe = nível 0 com o último
 * termo + assinaturas num bloco só. Cabe sem compactar ou medição falhou =
 * o MESMO objeto recebido (HTML e CSS de sempre).
 */
export function compactarReciboDispositivoA4(doc: DocumentoMedicao): DocumentoMedicao {
  const niveis = Array.from({ length: NIVEL_MAXIMO_COMPACTACAO + 1 }, (_, n) =>
    aplicarCompactacaoReciboDispositivoA4(doc, { nivel: n as NivelCompactacao, agruparFinal: false, motivo: "compactado" }),
  );
  const medidas = medirDocumentosA4(niveis, {
    larguraMm: 186, // @page A4 com margem de 12 mm dos lados
    inicioFinal: ".recibo-print-termo-box",
    fimFinal: ".recibo-print-assinaturas",
    cssExtra: ".recibo-print-logo-chip img { height: 44px; }",
  });
  const decisao = decidirCompactacao(medidas ? { alturasPorNivel: medidas.map((m) => m.alturaMm), alturaFinalMm: medidas[0].finalMm } : null, LIMITE_UMA_FOLHA_HTML_MM);
  return aplicarCompactacaoReciboDispositivoA4(doc, decisao);
}

