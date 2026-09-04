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
 * CSS base do cupom 80mm da OS (classes .cupom-*).
 * Fonte ÚNICA — usado tanto no preview em tela quanto no documento isolado de
 * impressão. Antes estava duplicado (index.css a 76mm + string inline em
 * ImpressaoOrdemServico a 72mm). Aqui fica 76mm.
 */
export function getCupom80mmOSBaseCSS(): string {
  return `
    .cupom-80mm-container {
      width: 76mm;
      max-width: 76mm;
      margin: 0 auto;
      padding: 2mm;
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 9pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-weight: 500;
    }
    .cupom-80mm-container .cupom-section { margin-bottom: 2mm; padding-bottom: 2mm; }
    .cupom-80mm-container .cupom-border-bottom { border-bottom: 1.5px dashed #000; }
    .cupom-80mm-container .cupom-center { text-align: center; }
    .cupom-80mm-container .cupom-logo { max-width: 28mm; max-height: 14mm; margin: 0 auto; display: block; }
    .cupom-80mm-container .cupom-loja-nome { font-weight: 900; font-size: 11pt; letter-spacing: 0.3px; }
    .cupom-80mm-container .cupom-small { font-size: 8.5pt; color: #000; font-weight: 600; }
    .cupom-80mm-container .cupom-os-numero { font-weight: 900; font-size: 12pt; }
    .cupom-80mm-container .cupom-section-title { font-weight: 900; font-size: 9pt; text-transform: uppercase; color: #000; margin-bottom: 1mm; letter-spacing: 0.5px; }
    .cupom-80mm-container .cupom-line-between { display: flex; justify-content: space-between; gap: 2mm; font-weight: 600; }
    .cupom-80mm-container .cupom-checklist-item { display: flex; align-items: center; gap: 1.5mm; font-weight: 500; }
    .cupom-80mm-container .cupom-total { text-align: center; font-weight: 900; font-size: 13pt; padding: 2.5mm 0; border-top: 2px dashed #000; border-bottom: 2px dashed #000; }
    .cupom-80mm-container .cupom-termo { font-size: 6.5pt; color: #000; text-align: center; font-weight: 500; }
    .cupom-80mm-container .cupom-assinaturas { display: flex; flex-direction: column; gap: 4mm; padding-top: 2mm; border-top: 1.5px dashed #000; }
    .cupom-80mm-container .cupom-assinatura-bloco { text-align: center; }
    .cupom-80mm-container .cupom-linha-assinatura { border-bottom: 1px solid #333; margin: 8mm 4mm 1mm; }
    .cupom-80mm-container .cupom-assinatura-img { max-width: 40mm; max-height: 15mm; margin: 0 auto; display: block; }
  `;
}

/**
 * CSS completo do DOCUMENTO ISOLADO de impressão 80mm da OS.
 * = page-level (@page 80mm auto, sem margem) + reset + base .cupom-* +
 *   fallback para as classes utilitárias que SilhuetaComAvarias usa
 *   (Tailwind não existe no documento isolado).
 * Nenhuma regra do index.css é herdada aqui — este é o único @page.
 */
export function getCupom80mmOSPrintDocCSS(): string {
  return `
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { width: 80mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #print-root { width: 76mm; margin: 0 auto; }
    svg { display: inline-block; vertical-align: middle; }
    .cupom-80mm-container { page-break-inside: avoid; break-inside: avoid; }
${getCupom80mmOSBaseCSS()}
    /* ---- SilhuetaComAvarias (printMode) — sem Tailwind no doc isolado ---- */
    .cupom-80mm-container .space-y-0\\.5 > * + * { margin-top: 2px; }
    .cupom-80mm-container .relative { position: relative; }
    .cupom-80mm-container .absolute { position: absolute; }
    .cupom-80mm-container .flex { display: flex; }
    .cupom-80mm-container .flex-wrap { flex-wrap: wrap; }
    .cupom-80mm-container .items-center { align-items: center; }
    .cupom-80mm-container .justify-center { justify-content: center; }
    .cupom-80mm-container .justify-between { justify-content: space-between; }
    .cupom-80mm-container .border { border: 1px solid #cbd5e1; }
    .cupom-80mm-container .border-2 { border-width: 2px; border-style: solid; }
    .cupom-80mm-container .border-white { border-color: #fff; }
    .cupom-80mm-container .rounded-lg { border-radius: 8px; }
    .cupom-80mm-container .rounded-full { border-radius: 9999px; }
    .cupom-80mm-container .bg-muted\\/20 { background: rgba(226, 232, 240, 0.4); }
    .cupom-80mm-container .p-2 { padding: 8px; }
    .cupom-80mm-container .opacity-80 { opacity: 0.8; }
    .cupom-80mm-container .w-2\\.5 { width: 10px; }
    .cupom-80mm-container .h-2\\.5 { height: 10px; }
    .cupom-80mm-container .w-1\\.5 { width: 6px; }
    .cupom-80mm-container .h-1\\.5 { height: 6px; }
    .cupom-80mm-container .w-full { width: 100%; }
    .cupom-80mm-container .h-full { height: auto; }
    .cupom-80mm-container .scale-\\[0\\.85\\] { transform: scale(0.85); }
    .cupom-80mm-container .origin-top-left { transform-origin: top left; }
    .cupom-80mm-container .gap-0\\.5 { gap: 2px; }
    .cupom-80mm-container .text-\\[6px\\] { font-size: 6px; }
    .cupom-80mm-container .mt-0\\.5 { margin-top: 2px; }
    .cupom-80mm-container .font-bold { font-weight: 700; }
    .cupom-80mm-container .text-white { color: #fff; }
    .cupom-80mm-container .leading-none { line-height: 1; }
    .cupom-80mm-container .bg-red-500 { background-color: #ef4444; }
    .cupom-80mm-container .bg-orange-500 { background-color: #f97316; }
    .cupom-80mm-container .bg-yellow-500 { background-color: #eab308; }
    .cupom-80mm-container .bg-purple-500 { background-color: #a855f7; }
    .cupom-80mm-container .bg-blue-500 { background-color: #3b82f6; }
    .cupom-80mm-container .relative.border { width: 44mm; max-width: 100%; margin: 0 auto; }
  `;
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