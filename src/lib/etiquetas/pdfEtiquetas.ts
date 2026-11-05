/**
 * PDF das etiquetas para o iPhone com app instalado (camada do iOS): uma
 * página por etiqueta térmica ou por folha, no tamanho exato configurado.
 * Sem DOM nem import (testável no Deno).
 */

const PX_POR_MM = 96 / 25.4;
/** Acima da térmica comum (203/300 dpi): barras nítidas depois da reamostragem. */
export const DPI_ALVO_PDF_ETIQUETAS = 400;
/** Abaixo do limite de área de canvas do Safari no iOS (16.777.216 px). */
export const MAX_PIXELS_CANVAS = 15_000_000;
/**
 * Tempo máximo para gerar o PDF: cresce com o número de páginas (cada etiqueta
 * diferente custa ~0,1 s no computador; no iPhone, folga de 4x), entre 1 e 5 min.
 */
export function tempoMaximoPdfEtiquetasMs(paginas: number): number {
  return Math.min(300000, Math.max(60000, 30000 + Math.max(0, paginas) * 400));
}

/** Fator do html2canvas (1 = 96 dpi) para uma página de larguraMm × alturaMm. */
export function escalaRenderizacaoPagina(larguraMm: number, alturaMm: number): number {
  const pixelsBase = larguraMm * PX_POR_MM * alturaMm * PX_POR_MM;
  const alvo = DPI_ALVO_PDF_ETIQUETAS / 96;
  if (!(pixelsBase > 0)) return 1;
  return Math.max(1, Math.min(alvo, Math.sqrt(MAX_PIXELS_CANVAS / pixelsBase)));
}

const mmTexto = (mm: number) => Number(mm.toFixed(1)).toString().replace(".", ",");

/** Ex.: "Etiquetas-40x25mm.pdf". */
export function nomeArquivoEtiquetas(titulo: string, larguraMm: number, alturaMm: number): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "Etiquetas"}-${mmTexto(larguraMm)}x${mmTexto(alturaMm)}mm.pdf`;
}

export interface PaginasPDFEtiquetas {
  larguraMm: number;
  alturaMm: number;
  /** Elemento de cada página no documento de impressão (etiquetasProduto.ts). */
  seletor: string;
  escala: number;
  nomeArquivo: string;
  tempoMaximoMs: number;
}

/**
 * Térmica: cada .etq-pagina-termica vira uma página do tamanho da etiqueta.
 * Folha/rolo em grade: cada .etq-folha vira uma página do tamanho da folha.
 */
export function paginasPDFEtiquetas(p: {
  formato: "termica" | "a4";
  termica: { larguraMm: number; alturaMm: number };
  folha: { larguraMm: number; alturaMm: number };
  titulo: string;
  /** Etiquetas (térmica) ou folhas (grade) que vão no PDF. */
  totalPaginas: number;
}): PaginasPDFEtiquetas {
  const { larguraMm, alturaMm } = p.formato === "termica" ? p.termica : p.folha;
  return {
    larguraMm,
    alturaMm,
    seletor: p.formato === "termica" ? ".etq-pagina-termica" : ".etq-folha",
    escala: escalaRenderizacaoPagina(larguraMm, alturaMm),
    nomeArquivo: nomeArquivoEtiquetas(p.titulo, larguraMm, alturaMm),
    tempoMaximoMs: tempoMaximoPdfEtiquetasMs(p.totalPaginas),
  };
}
