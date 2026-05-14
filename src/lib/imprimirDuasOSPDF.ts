import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// A4 em pixels a 96dpi: 210mm × 297mm
const A4_W_PX = 794;
const A4_H_PX = 1123;

// Espaçamento interno do container (px)
const PADDING = 16;
const GAP = 8;

// Largura de cada coluna (px)
export const COLUNA_W_PX = Math.floor((A4_W_PX - PADDING * 2 - GAP) / 2); // ≈ 377px

/**
 * Cria um container invisível fora da tela, coloca o HTML de duas OS lado a lado,
 * captura com html2canvas e gera um PDF A4 que é aberto em nova aba.
 *
 * Retorna uma Promise que resolve após abrir a aba com o PDF.
 * Rejeita se o container não puder ser criado.
 */
export async function imprimirDuasOSPDF(containerEl: HTMLElement): Promise<void> {
  // Montar wrapper A4 fora da tela
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    `position:fixed`,
    `left:-9999px`,
    `top:0`,
    `width:${A4_W_PX}px`,
    `height:${A4_H_PX}px`,
    `background:#fff`,
    `overflow:hidden`,
    `display:flex`,
    `flex-direction:row`,
    `align-items:flex-start`,
    `padding:${PADDING}px`,
    `gap:${GAP}px`,
    `box-sizing:border-box`,
    `font-family:Arial,Helvetica,sans-serif`,
    `font-size:9px`,
    `color:#000`,
  ].join(";");

  // Clonar o conteúdo dos dois slots (cada slot tem um filho direto = OSPrintLayout)
  const slots = containerEl.querySelectorAll<HTMLElement>(".os-pdf-slot");
  if (slots.length < 2) {
    throw new Error("imprimirDuasOSPDF: esperado 2 .os-pdf-slot, encontrado " + slots.length);
  }

  for (const slot of Array.from(slots)) {
    const clone = slot.cloneNode(true) as HTMLElement;
    // Garantir largura fixa no clone
    clone.style.width = `${COLUNA_W_PX}px`;
    clone.style.flexShrink = "0";
    clone.style.overflow = "hidden";
    clone.style.height = `${A4_H_PX - PADDING * 2}px`;
    wrapper.appendChild(clone);
  }

  // Linha de corte central
  const corte = document.createElement("div");
  corte.style.cssText = `position:absolute;left:50%;top:${PADDING}px;bottom:${PADDING}px;width:0;border-left:1px dashed #aaa;`;
  wrapper.appendChild(corte);

  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: A4_W_PX,
      height: A4_H_PX,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, 210, 297);

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);

    const win = window.open(url, "_blank");
    // Libera o object URL após tempo suficiente para o browser carregar
    setTimeout(() => URL.revokeObjectURL(url), 60_000);

    if (!win) {
      // Pop-up bloqueado: fallback — baixa o PDF diretamente
      pdf.save(`OS-${Date.now()}.pdf`);
    }
  } finally {
    document.body.removeChild(wrapper);
  }
}
