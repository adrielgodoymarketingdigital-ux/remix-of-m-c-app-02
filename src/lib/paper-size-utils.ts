/**
 * Utility to resolve paper size for thermal/custom printing.
 * Returns the CSS @page size string and the body width.
 */

export interface PaperSizeResult {
  isThermal: boolean;
  pageSize: string;      // e.g. "80mm auto"
  bodyWidth: string;     // e.g. "76mm"
  bodyMaxWidth: string;  // e.g. "76mm"
}

export function resolvePaperSize(
  formato: string | undefined,
  larguraMm?: number,
  alturaMm?: number
): PaperSizeResult {
  switch (formato) {
    case "58mm":
      return {
        isThermal: true,
        pageSize: "58mm auto",
        bodyWidth: "54mm",
        bodyMaxWidth: "54mm",
      };
    case "80mm":
      return {
        isThermal: true,
        pageSize: "80mm auto",
        bodyWidth: "76mm",
        bodyMaxWidth: "76mm",
      };
    case "personalizado": {
      const w = larguraMm || 80;
      const h = alturaMm && alturaMm > 0 ? `${alturaMm}mm` : "auto";
      const bw = Math.max(w - 4, 30);
      return {
        isThermal: true,
        pageSize: `${w}mm ${h}`,
        bodyWidth: `${bw}mm`,
        bodyMaxWidth: `${bw}mm`,
      };
    }
    default:
      return {
        isThermal: false,
        pageSize: "A4",
        bodyWidth: "auto",
        bodyMaxWidth: "800px",
      };
  }
}

/**
 * Generates thermal print CSS styles.
 */
export function getThermalPrintCSS(paper: PaperSizeResult): string {
  if (!paper.isThermal) return "";
  return `
    @page { size: ${paper.pageSize}; margin: 2mm; }
    body {
      width: ${paper.bodyWidth} !important;
      max-width: ${paper.bodyMaxWidth} !important;
      padding: 2mm !important;
      font-size: 9pt !important;
      line-height: 1.4 !important;
      margin: 0 !important;
    }
    .logo-loja { max-width: 30mm !important; }
    .recibo-header h1 { font-size: 11pt !important; }
    .recibo-header h2 { font-size: 10pt !important; }
    .recibo-checklist { grid-template-columns: 1fr !important; }
    .recibo-info { font-size: 9pt !important; }
    .recibo-total { font-size: 13pt !important; }
    .dados-loja { font-size: 9pt !important; }
    .termos-garantia { font-size: 7pt !important; }
    .resumo-linha.total { font-size: 13pt !important; }
  `;
}