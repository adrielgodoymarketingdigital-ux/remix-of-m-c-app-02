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

export type FormatoPDFReciboVenda = "a4" | "80mm" | "58mm";

export interface DadosReciboVendaPDF {
  modo: "recibo" | "garantia";
  formato: FormatoPDFReciboVenda;
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

const LARGURA_PAGINA_MM: Record<FormatoPDFReciboVenda, number> = {
  a4: 210,
  "80mm": 80,
  "58mm": 58,
};

interface OpcoesDesenho {
  margin: number;
  isThermal: boolean;
}

/**
 * Desenha o documento inteiro num jsPDF já criado com a largura/altura
 * certas, e devolve o Y final (posição logo depois do último elemento
 * desenhado) — usado tanto pra medir a altura real do papel térmico (doc
 * descartável, sem página final) quanto pro desenho definitivo (A4 e
 * térmico).
 */
function desenharDocumento(doc: jsPDF, dados: DadosReciboVendaPDF, opts: OpcoesDesenho): number {
  const { margin, isThermal } = opts;
  const pageWidth = doc.internal.pageSize.getWidth();
  const larguraUtil = pageWidth - margin * 2;
  let y = margin;

  // Térmico é bobina contínua — a página já foi dimensionada pra caber tudo
  // (ver gerarReciboVendaPDF), então nunca quebra página aqui.
  const verificarNovaPagina = (espaco = 20) => {
    if (isThermal) return;
    if (y + espaco > 280) {
      doc.addPage();
      y = margin;
    }
  };

  const cnpjLinha = dados.configLoja?.cnpj ? `CNPJ: ${dados.configLoja.cnpj}` : "";
  const telLinha = dados.configLoja?.telefone ? `Tel: ${dados.configLoja.telefone}` : "";
  const infoLoja = [cnpjLinha, telLinha].filter(Boolean).join("   ");
  const titulo = dados.modo === "garantia" ? "TERMO DE GARANTIA" : "RECIBO DE VENDA";

  // ===== CABEÇALHO =====
  if (isThermal) {
    // Mesma caixa escura de marca do A4 — só que empilhada (logo, nome,
    // CNPJ/tel cada um numa linha, título) em vez de lado a lado, porque a
    // largura útil (52-76mm) não cabe duas colunas. Cabeçalho "achatado" pra
    // texto simples sem essa caixa lia como versão simplificada demais.
    const padding = 3;

    let logoLargura = 0;
    let logoAltura = 0;
    if (dados.logoBase64) {
      try {
        const props = doc.getImageProperties(dados.logoBase64);
        const proporcao = props.width / props.height;
        logoLargura = Math.min(larguraUtil * 0.45, 22);
        logoAltura = logoLargura / proporcao;
        const logoAlturaMax = 11;
        if (logoAltura > logoAlturaMax) {
          logoAltura = logoAlturaMax;
          logoLargura = logoAltura * proporcao;
        }
      } catch {
        logoLargura = 0;
        logoAltura = 0;
      }
    }

    // CNPJ e telefone em linhas separadas no térmico — juntos numa linha só
    // estourariam a largura em papel de 58mm.
    const linhasInfoLoja = [cnpjLinha, telLinha].filter(Boolean);

    const headerAltura =
      padding * 2 +
      (logoAltura > 0 ? logoAltura + 3 : 0) +
      5 + // nome da loja
      linhasInfoLoja.length * 3.2 +
      5.5; // título

    doc.setFillColor(...COR_HEADER);
    doc.roundedRect(margin, y, larguraUtil, headerAltura, 2, 2, "F");

    let contentY = y + padding;
    if (logoAltura > 0 && dados.logoBase64) {
      try {
        const chipPad = 1.2;
        const chipX = margin + (larguraUtil - logoLargura) / 2 - chipPad;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(chipX, contentY - chipPad, logoLargura + chipPad * 2, logoAltura + chipPad * 2, 1, 1, "F");
        doc.addImage(dados.logoBase64, margin + (larguraUtil - logoLargura) / 2, contentY, logoLargura, logoAltura);
      } catch {
        // segue sem logo
      }
      contentY += logoAltura + 3;
    }

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(dados.configLoja?.nome_loja || "", pageWidth / 2, contentY, { align: "center" });
    contentY += 5;

    if (linhasInfoLoja.length > 0) {
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COR_HEADER_TEXTO_SEC);
      linhasInfoLoja.forEach((linha) => {
        doc.text(linha, pageWidth / 2, contentY, { align: "center" });
        contentY += 3.2;
      });
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COR_TITULO);
    doc.text(titulo, pageWidth / 2, contentY, { align: "center" });

    y += headerAltura + 5;
  } else {
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
        // segue sem logo
      }
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(dados.configLoja?.nome_loja || "", textoX, y + 10);

    if (infoLoja) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COR_HEADER_TEXTO_SEC);
      doc.text(infoLoja, textoX, y + 16);
    }

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
  }

  // ===== FAIXA DE DADOS (data / pagamento / total) =====
  if (isThermal) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`Data: ${dados.dataVenda}`, margin, y);
    y += 4;
    doc.text(`Pagamento: ${dados.formaPagamentoLabel}`, margin, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${formatCurrencyPDF(dados.valorTotal)}`, margin, y);
    y += 6;
  } else {
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
  }

  // ===== helpers de seção =====
  const tituloSecao = (texto: string) => {
    doc.setDrawColor(...COR_BORDA);
    doc.setLineWidth(0.2);
    doc.setFillColor(...COR_CARD_HEADER_BG);
    doc.rect(margin, y, larguraUtil, 6, "FD");
    doc.setFontSize(isThermal ? 6.5 : 7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COR_LABEL);
    doc.text(texto.toUpperCase(), margin + 3, y + 4.2);
    y += 9;
  };

  // Sempre com wrap — em papel térmico (52-76mm úteis) uma linha de campo
  // "Cor / Capacidade / Condição: ..." estoura a largura fácil.
  const linhaTexto = (texto: string) => {
    doc.setFontSize(isThermal ? 7.5 : 9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const linhas = doc.splitTextToSize(texto, larguraUtil - 6);
    linhas.forEach((linha: string) => {
      doc.text(linha, margin + 3, y);
      y += isThermal ? 4 : 5;
    });
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
    doc.setFillColor(...COR_HEADER);
    doc.rect(margin, y, larguraUtil, 6, "F");
    doc.setFontSize(isThermal ? 6.5 : 7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(
      (multiplos ? `TERMO — ${[disp.marca, disp.modelo].filter(Boolean).join(" ")}` : "TERMO DE GARANTIA").toUpperCase(),
      margin + 3,
      y + 4.2
    );
    y += 9;

    doc.setFontSize(isThermal ? 6.5 : 8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const linhas = doc.splitTextToSize(disp.textoTermo, larguraUtil - 4);
    linhas.forEach((linha: string) => {
      verificarNovaPagina(5);
      doc.text(linha, margin + 2, y);
      y += isThermal ? 3.4 : 4;
    });
    y += 6;
  });

  if (dados.modo !== "garantia") {
    verificarNovaPagina(15);
    doc.setFontSize(isThermal ? 9 : 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COR_HEADER);
    doc.text(`VALOR TOTAL: ${formatCurrencyPDF(dados.valorTotal)}`, margin, y);
    y += isThermal ? 7 : 10;
  }

  // ===== ASSINATURAS =====
  verificarNovaPagina(isThermal ? 20 : 30);
  y += isThermal ? 4 : 10;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.3);
  if (isThermal) {
    doc.line(margin, y, pageWidth - margin, y);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Assinatura do Vendedor", margin, y + 4);
    y += 12;
    doc.line(margin, y, pageWidth - margin, y);
    doc.text("Assinatura do Comprador", margin, y + 4);
    y += 8;
  } else {
    doc.line(margin, y, margin + 80, y);
    doc.line(pageWidth - margin - 80, y, pageWidth - margin, y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Assinatura do Vendedor", margin, y + 5);
    doc.text("Assinatura do Comprador", pageWidth - margin - 80, y + 5);
    y += 12;
  }

  // ===== RODAPÉ =====
  if (isThermal) {
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    const dataGerado = `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    doc.text(dataGerado, pageWidth / 2, y, { align: "center" });
    y += 4;
  } else {
    adicionarRodapePDF(doc, dados.configLoja);
  }

  return y;
}

/**
 * Gera o Recibo de Venda / Termo de Garantia de dispositivo como PDF —
 * caminho usado no iOS standalone, onde window.print() é bloqueado pela
 * plataforma (confirmado: funciona em aba comum do Safari, falha só no PWA
 * instalado). O cabeçalho é desenhado manualmente replicando o mesmo visual
 * (fundo escuro, chip de logo, título em destaque) do template HTML em tela.
 *
 * Papel térmico (80mm/58mm) é bobina contínua, não página fixa — mede a
 * altura real do conteúdo numa passada de um doc descartável (mesma
 * largura/margem), depois desenha o doc definitivo já com essa altura
 * exata. Mesmo raciocínio de duas fases já usado pro cupom 80mm da OS em
 * ImpressaoOrdemServico.tsx (medir antes de gerar o definitivo), só que
 * medindo no próprio jsPDF em vez de um iframe de prova.
 */
export async function gerarReciboVendaPDF(dados: DadosReciboVendaPDF): Promise<Blob> {
  const isThermal = dados.formato !== "a4";
  const larguraPagina = LARGURA_PAGINA_MM[dados.formato];
  const margin = isThermal ? 3 : 15;

  if (!isThermal) {
    const doc = new jsPDF();
    desenharDocumento(doc, dados, { margin, isThermal: false });
    return doc.output("blob");
  }

  const docMedicao = new jsPDF({ unit: "mm", format: [larguraPagina, 1000] });
  const alturaConteudo = desenharDocumento(docMedicao, dados, { margin, isThermal: true });
  const alturaFinal = Math.max(alturaConteudo + margin, 40);

  const doc = new jsPDF({ unit: "mm", format: [larguraPagina, alturaFinal] });
  desenharDocumento(doc, dados, { margin, isThermal: true });
  return doc.output("blob");
}
