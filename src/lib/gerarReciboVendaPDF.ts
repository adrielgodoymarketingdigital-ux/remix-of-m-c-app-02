import jsPDF from "jspdf";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { adicionarRodapePDF, formatCurrencyPDF } from "@/lib/pdfHelpers";

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
  /** Já pré-buscado pelo chamador (mesmo logoBase64 usado no caminho de impressão) — evita um fetch redundante aqui. */
  logoBase64?: string | null;
  dataVenda: string;
  formaPagamentoLabel: string;
  valorTotal: number;
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  dispositivos: DispositivoPDFReciboVenda[];
}

// Mesma paleta do template HTML (DialogReimprimirReciboVenda.tsx) — o PDF
// precisa ser reconhecível como o mesmo documento da loja, não um relatório
// genérico do sistema.
const COR_HEADER: [number, number, number] = [26, 26, 46]; // #1a1a2e
const COR_TITULO: [number, number, number] = [76, 201, 240]; // #4cc9f0
const COR_HEADER_TEXTO_SEC: [number, number, number] = [173, 181, 189]; // #adb5bd
const COR_FAIXA_BG: [number, number, number] = [240, 244, 255]; // #f0f4ff
const COR_FAIXA_BORDA: [number, number, number] = [208, 217, 240]; // #d0d9f0
const COR_CARD_HEADER_BG: [number, number, number] = [248, 249, 250]; // #f8f9fa
const COR_BORDA: [number, number, number] = [222, 226, 230]; // #dee2e6
const COR_LABEL: [number, number, number] = [108, 117, 125]; // #6c757d

/**
 * Gera o Recibo de Venda / Termo de Garantia de dispositivo como PDF —
 * caminho usado no iOS standalone, onde window.print() é bloqueado pela
 * plataforma (confirmado: funciona em aba comum do Safari, falha só no PWA
 * instalado). O cabeçalho é desenhado manualmente replicando o mesmo visual
 * (fundo escuro, chip de logo, título em destaque) do template HTML em tela
 * — o cabeçalho genérico de pdfHelpers.ts (usado em relatórios) achatava
 * essa identidade visual da loja.
 */
export async function gerarReciboVendaPDF(dados: DadosReciboVendaPDF): Promise<Blob> {
  const doc = new jsPDF();
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const larguraUtil = pageWidth - margin * 2;
  let y = margin;

  const verificarNovaPagina = (espaco = 20) => {
    if (y + espaco > 280) {
      doc.addPage();
      y = margin;
    }
  };

  // ===== CABEÇALHO (fundo escuro, igual ao recibo em tela) =====
  const headerAltura = 24;
  doc.setFillColor(...COR_HEADER);
  doc.roundedRect(margin, y, larguraUtil, headerAltura, 2, 2, "F");

  let textoX = margin + 5;
  if (dados.logoBase64) {
    try {
      const chipLargura = 26;
      const chipAltura = headerAltura - 6;
      const chipX = margin + 4;
      const chipY = y + 3;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(chipX, chipY, chipLargura, chipAltura, 1.5, 1.5, "F");

      const props = doc.getImageProperties(dados.logoBase64);
      const proporcao = props.width / props.height;
      const padding = 2;
      let larguraImg = chipLargura - padding * 2;
      let alturaImg = larguraImg / proporcao;
      if (alturaImg > chipAltura - padding * 2) {
        alturaImg = chipAltura - padding * 2;
        larguraImg = alturaImg * proporcao;
      }
      const imgX = chipX + (chipLargura - larguraImg) / 2;
      const imgY = chipY + (chipAltura - alturaImg) / 2;
      doc.addImage(dados.logoBase64, imgX, imgY, larguraImg, alturaImg);
      textoX = chipX + chipLargura + 5;
    } catch {
      // segue sem logo — não interrompe a geração do PDF por causa disso
    }
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(dados.configLoja?.nome_loja || "", textoX, y + 10);

  const infoLoja = [
    dados.configLoja?.cnpj ? `CNPJ: ${dados.configLoja.cnpj}` : "",
    dados.configLoja?.telefone ? `Tel: ${dados.configLoja.telefone}` : "",
  ]
    .filter(Boolean)
    .join("   ");
  if (infoLoja) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COR_HEADER_TEXTO_SEC);
    doc.text(infoLoja, textoX, y + 16);
  }

  const titulo = dados.modo === "garantia" ? "TERMO DE GARANTIA" : "RECIBO DE VENDA";
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COR_TITULO);
  doc.text(titulo, pageWidth - margin - 4, y + 10, { align: "right" });

  if (dados.configLoja?.endereco) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COR_HEADER_TEXTO_SEC);
    doc.text(dados.configLoja.endereco, pageWidth - margin - 4, y + 16, { align: "right" });
  }

  y += headerAltura;

  // ===== FAIXA DE DADOS (data / pagamento / total) =====
  const faixaAltura = 8;
  doc.setFillColor(...COR_FAIXA_BG);
  doc.setDrawColor(...COR_FAIXA_BORDA);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, larguraUtil, faixaAltura, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const faixaTextoY = y + faixaAltura / 2 + 1.5;
  doc.text(`Data da venda: ${dados.dataVenda}`, margin + 3, faixaTextoY);
  doc.text(`Pagamento: ${dados.formaPagamentoLabel}`, pageWidth / 2, faixaTextoY, { align: "center" });
  doc.text(`Total: ${formatCurrencyPDF(dados.valorTotal)}`, pageWidth - margin - 3, faixaTextoY, { align: "right" });
  y += faixaAltura + 6;

  // ===== helpers de seção estilo "card" (header cinza + label) =====
  const tituloSecao = (titulo: string) => {
    doc.setDrawColor(...COR_BORDA);
    doc.setLineWidth(0.2);
    doc.setFillColor(...COR_CARD_HEADER_BG);
    doc.rect(margin, y, larguraUtil, 6, "FD");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COR_LABEL);
    doc.text(titulo.toUpperCase(), margin + 3, y + 4.2);
    y += 9;
  };

  const linhaTexto = (texto: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(texto, margin + 3, y);
    y += 5;
  };

  tituloSecao("COMPRADOR");
  linhaTexto(`Nome: ${dados.clienteNome || "—"}`);
  if (dados.clienteCpf) linhaTexto(`CPF: ${dados.clienteCpf}`);
  if (dados.clienteTelefone) linhaTexto(`Telefone: ${dados.clienteTelefone}`);
  y += 3;

  const multiplos = dados.dispositivos.length > 1;

  dados.dispositivos.forEach((disp, i) => {
    verificarNovaPagina(35);
    tituloSecao(multiplos ? `PRODUTO ${i + 1}` : "PRODUTO");
    linhaTexto(`Aparelho: ${[disp.marca, disp.modelo].filter(Boolean).join(" ") || "—"}`);
    if (disp.imei) linhaTexto(`IMEI: ${disp.imei}`);
    const detalhes = [disp.cor, disp.capacidadeGb ? `${disp.capacidadeGb} GB` : "", disp.condicaoLabel]
      .filter(Boolean)
      .join(" • ");
    if (detalhes) linhaTexto(`Cor / Capacidade / Condição: ${detalhes}`);
    linhaTexto(`Valor: ${formatCurrencyPDF(disp.total)}`);
    if (disp.garantiaLabel) linhaTexto(`Garantia: ${disp.garantiaLabel}`);
    y += 3;

    verificarNovaPagina(20);
    // Cabeçalho do termo em navy (igual .termo-header no HTML), não o cinza
    // padrão das outras seções — é o bloco mais "de marca" do documento.
    doc.setDrawColor(...COR_BORDA);
    doc.setLineWidth(0.2);
    doc.setFillColor(...COR_HEADER);
    doc.rect(margin, y, larguraUtil, 6, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(
      (multiplos ? `TERMO — ${[disp.marca, disp.modelo].filter(Boolean).join(" ")}` : "TERMO DE GARANTIA").toUpperCase(),
      margin + 3,
      y + 4.2
    );
    y += 9;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const linhas = doc.splitTextToSize(disp.textoTermo, larguraUtil - 4);
    linhas.forEach((linha: string) => {
      verificarNovaPagina(5);
      doc.text(linha, margin + 2, y);
      y += 4;
    });
    y += 6;
  });

  if (dados.modo !== "garantia") {
    verificarNovaPagina(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COR_HEADER);
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
