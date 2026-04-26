import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Orcamento } from "@/types/orcamento";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  expirado: "Expirado",
  convertido: "Convertido",
};

export async function gerarOrcamentoPDF(
  orcamento: Orcamento,
  config: ConfiguracaoLoja | null
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // --- Cabeçalho ---
  // Logo (se existir)
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
        doc.addImage(img, "PNG", margin, y, 30, 15, undefined, "FAST");
      }
    } catch {}
  }

  // Nome da loja
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(config?.nome_loja || "Minha Loja", pageWidth - margin, y + 5, { align: "right" });

  if (config?.cnpj) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - margin, y + 11, { align: "right" });
  }

  if (config?.telefone || config?.whatsapp) {
    doc.setFontSize(9);
    doc.text(
      `Tel: ${config.whatsapp || config.telefone}`,
      pageWidth - margin,
      y + 16,
      { align: "right" }
    );
  }

  y += 25;

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Título
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("ORÇAMENTO", margin, y);

  // Número e status
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Nº ${orcamento.numero_orcamento}`, pageWidth - margin, y, { align: "right" });
  y += 6;

  const statusLabel = STATUS_LABELS[orcamento.status] || orcamento.status;
  doc.setFontSize(9);
  doc.text(`Status: ${statusLabel}`, pageWidth - margin, y, { align: "right" });

  if (orcamento.data_validade) {
    y += 5;
    doc.text(`Válido até: ${formatDate(orcamento.data_validade)}`, pageWidth - margin, y, {
      align: "right",
    });
  }

  doc.text(`Data: ${formatDate(orcamento.created_at)}`, margin, y);
  y += 10;

  // --- Dados do Cliente ---
  if (orcamento.cliente_nome || orcamento.cliente_telefone || orcamento.cliente_email) {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("CLIENTE", margin + 4, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);

    let clienteY = y + 12;
    if (orcamento.cliente_nome) {
      doc.text(`Nome: ${orcamento.cliente_nome}`, margin + 4, clienteY);
      clienteY += 5;
    }
    const clienteExtra: string[] = [];
    if (orcamento.cliente_telefone) clienteExtra.push(`Tel: ${orcamento.cliente_telefone}`);
    if (orcamento.cliente_email) clienteExtra.push(`Email: ${orcamento.cliente_email}`);
    if (clienteExtra.length > 0) {
      doc.text(clienteExtra.join("   |   "), margin + 4, clienteY);
    }

    y += 28;
  }

  // --- Tabela de Itens ---
  const tableRows = (orcamento.itens || []).map((item) => [
    item.descricao,
    item.tipo,
    item.quantidade.toString(),
    formatCurrency(item.valor_unitario),
    formatCurrency(item.valor_total),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Tipo", "Qtd", "Valor Unit.", "Total"]],
    body: tableRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // --- Totais ---
  const totaisX = pageWidth - margin - 70;
  const totaisW = 70;

  doc.setFillColor(248, 248, 248);
  const totaisH = orcamento.desconto > 0 ? 24 : 18;
  doc.roundedRect(totaisX, y, totaisW, totaisH, 2, 2, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);

  let ty = y + 7;
  doc.text("Subtotal:", totaisX + 4, ty);
  doc.text(formatCurrency(orcamento.subtotal), totaisX + totaisW - 4, ty, { align: "right" });

  if (orcamento.desconto > 0) {
    ty += 5;
    doc.setTextColor(180, 30, 30);
    doc.text("Desconto:", totaisX + 4, ty);
    doc.text(`- ${formatCurrency(orcamento.desconto)}`, totaisX + totaisW - 4, ty, {
      align: "right",
    });
    doc.setTextColor(80, 80, 80);
  }

  ty += 6;
  doc.setDrawColor(180, 180, 180);
  doc.line(totaisX + 4, ty - 1, totaisX + totaisW - 4, ty - 1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("TOTAL:", totaisX + 4, ty + 5);
  doc.text(formatCurrency(orcamento.valor_total), totaisX + totaisW - 4, ty + 5, {
    align: "right",
  });

  y += totaisH + 10;

  // --- Observações ---
  if (orcamento.observacoes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("Observações:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const obsLines = doc.splitTextToSize(orcamento.observacoes, pageWidth - margin * 2);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 5 + 5;
  }

  // --- Termos e Condições ---
  if (orcamento.termos_condicoes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("Termos e Condições:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const termosLines = doc.splitTextToSize(orcamento.termos_condicoes, pageWidth - margin * 2);
    doc.text(termosLines, margin, y);
    y += termosLines.length * 5 + 5;
  }

  // --- Rodapé ---
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pageWidth / 2,
    pageHeight - 9,
    { align: "center" }
  );

  doc.save(`orcamento-${orcamento.numero_orcamento}.pdf`);
}
