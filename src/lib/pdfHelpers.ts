import jsPDF from "jspdf";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";

export function formatCurrencyPDF(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export async function adicionarCabecalhoPDF(
  doc: jsPDF,
  config: ConfiguracaoLoja | null,
  titulo: string,
  subtitulo?: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Logo
  if (config?.logo_url) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = config.logo_url!;
      });
      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, "PNG", margin, y, 28, 14, undefined, "FAST");
      }
    } catch {}
  }

  // Nome da loja
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 25, 25);
  doc.text(config?.nome_loja || "Minha Loja", pageWidth - margin, y + 5, { align: "right" });

  // Dados da loja
  let infoY = y + 11;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);

  if (config?.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - margin, infoY, { align: "right" });
    infoY += 4;
  }
  if (config?.telefone || config?.whatsapp) {
    doc.text(`Tel: ${config?.whatsapp || config?.telefone}`, pageWidth - margin, infoY, { align: "right" });
    infoY += 4;
  }
  if (config?.email) {
    doc.text(config.email, pageWidth - margin, infoY, { align: "right" });
  }

  y += 24;

  // Linha decorativa com gradiente simulado
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 1.2, pageWidth - margin, y + 1.2);
  y += 7;

  // Título do relatório
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 25, 25);
  doc.text(titulo.toUpperCase(), margin, y);
  y += 5;

  // Subtítulo (período, data, etc.)
  if (subtitulo) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitulo, margin, y);
    y += 6;
  }

  return y + 2;
}

export function adicionarRodapePDF(doc: jsPDF, config?: ConfiguracaoLoja | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);

    const dataGerado = `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    doc.text(dataGerado, margin, pageHeight - 10);

    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });

    if (config?.nome_loja) {
      doc.text(config.nome_loja, pageWidth / 2, pageHeight - 10, { align: "center" });
    }
  }
}

interface CardResumo {
  label: string;
  value: string;
  sub?: string;
  color?: [number, number, number]; // RGB accent color
}

export function adicionarCardsPDF(
  doc: jsPDF,
  y: number,
  cards: CardResumo[]
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const gap = 4;
  const cardW = (pageWidth - margin * 2 - (cards.length - 1) * gap) / cards.length;
  const cardH = 24;

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + gap);

    // Card background
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");

    // Left accent bar
    const accent = card.color || [50, 50, 50];
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(x, y + 2, 1.5, cardH - 4, "F");

    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(card.label.toUpperCase(), x + 5, y + 7);

    // Value
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(card.value, x + 5, y + 15);

    // Sub
    if (card.sub) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(140, 140, 140);
      doc.text(card.sub, x + 5, y + 21);
    }
  });

  return y + cardH + 6;
}

export function adicionarTituloSecao(doc: jsPDF, y: number, titulo: string): number {
  const margin = 15;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(titulo, margin, y);

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 2, margin + doc.getTextWidth(titulo), y + 2);

  return y + 7;
}
