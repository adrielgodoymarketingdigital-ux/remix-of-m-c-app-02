import jsPDF from "jspdf";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { adicionarCabecalhoPDF, adicionarRodapePDF, adicionarTituloSecao, formatCurrencyPDF } from "@/lib/pdfHelpers";

export interface DispositivoPDFReciboVenda {
  marca?: string;
  modelo?: string;
  imei?: string;
  cor?: string;
  capacidadeGb?: number;
  condicaoLabel?: string;
  garantiaLabel?: string;
  total: number;
  textoTermo: string;
}

export interface DadosReciboVendaPDF {
  modo: "recibo" | "garantia";
  configLoja: ConfiguracaoLoja | null | undefined;
  dataVenda: string;
  formaPagamentoLabel: string;
  valorTotal: number;
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  dispositivos: DispositivoPDFReciboVenda[];
}

/**
 * Gera o Recibo de Venda / Termo de Garantia de dispositivo como PDF —
 * caminho usado no iOS standalone, onde window.print() é bloqueado pela
 * plataforma (confirmado: funciona em aba comum do Safari, falha só no PWA
 * instalado). Reaproveita os mesmos helpers de cabeçalho/rodapé já usados em
 * gerarOrdemServicoPDF.ts, pra manter a mesma identidade visual dos outros
 * PDFs do app.
 */
export async function gerarReciboVendaPDF(dados: DadosReciboVendaPDF): Promise<Blob> {
  const doc = new jsPDF();
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const larguraUtil = pageWidth - margin * 2;

  const titulo = dados.modo === "garantia" ? "Termo de Garantia" : "Recibo de Venda";
  let y = await adicionarCabecalhoPDF(doc, dados.configLoja ?? null, titulo, `Data da venda: ${dados.dataVenda}`);

  const verificarNovaPagina = (espaco = 20) => {
    if (y + espaco > 280) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Forma de pagamento: ${dados.formaPagamentoLabel}`, margin, y);
  y += 8;

  y = adicionarTituloSecao(doc, y, "COMPRADOR");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.text(`Nome: ${dados.clienteNome || "—"}`, margin, y);
  y += 5;
  if (dados.clienteCpf) {
    doc.text(`CPF: ${dados.clienteCpf}`, margin, y);
    y += 5;
  }
  if (dados.clienteTelefone) {
    doc.text(`Telefone: ${dados.clienteTelefone}`, margin, y);
    y += 5;
  }
  y += 3;

  const multiplos = dados.dispositivos.length > 1;

  dados.dispositivos.forEach((disp, i) => {
    verificarNovaPagina(30);
    y = adicionarTituloSecao(doc, y, multiplos ? `PRODUTO ${i + 1}` : "PRODUTO");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(`Aparelho: ${[disp.marca, disp.modelo].filter(Boolean).join(" ") || "—"}`, margin, y);
    y += 5;
    if (disp.imei) {
      doc.text(`IMEI: ${disp.imei}`, margin, y);
      y += 5;
    }
    const detalhes = [disp.cor, disp.capacidadeGb ? `${disp.capacidadeGb} GB` : "", disp.condicaoLabel]
      .filter(Boolean)
      .join(" • ");
    if (detalhes) {
      doc.text(`Cor / Capacidade / Condição: ${detalhes}`, margin, y);
      y += 5;
    }
    doc.text(`Valor: ${formatCurrencyPDF(disp.total)}`, margin, y);
    y += 5;
    if (disp.garantiaLabel) {
      doc.text(`Garantia: ${disp.garantiaLabel}`, margin, y);
      y += 5;
    }
    y += 3;

    verificarNovaPagina(20);
    y = adicionarTituloSecao(
      doc,
      y,
      multiplos ? `TERMO — ${[disp.marca, disp.modelo].filter(Boolean).join(" ")}` : "TERMO DE GARANTIA"
    );
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const linhas = doc.splitTextToSize(disp.textoTermo, larguraUtil);
    linhas.forEach((linha: string) => {
      verificarNovaPagina(5);
      doc.text(linha, margin, y);
      y += 4;
    });
    y += 6;
  });

  if (dados.modo !== "garantia") {
    verificarNovaPagina(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 25, 25);
    doc.text(`VALOR TOTAL: ${formatCurrencyPDF(dados.valorTotal)}`, margin, y);
    y += 10;
  }

  verificarNovaPagina(30);
  y += 10;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 80, y);
  doc.line(pageWidth - margin - 80, y, pageWidth - margin, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Assinatura do Vendedor", margin, y + 5);
  doc.text("Assinatura do Comprador", pageWidth - margin - 80, y + 5);

  adicionarRodapePDF(doc, dados.configLoja);

  return doc.output("blob");
}
