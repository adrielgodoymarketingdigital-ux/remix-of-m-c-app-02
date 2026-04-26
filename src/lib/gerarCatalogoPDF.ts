import jsPDF from "jspdf";
import { Dispositivo } from "@/types/dispositivo";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { formatCurrency } from "./formatters";
import { 
  ConfiguracaoCatalogo, 
  TEMPLATES_PADRAO, 
  CONFIG_PADRAO 
} from "@/types/catalogo";

interface CatalogoOptions {
  dispositivos: Dispositivo[];
  configuracaoLoja: ConfiguracaoLoja | null;
  config?: ConfiguracaoCatalogo;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function formatarGarantia(tempoMeses: number): string {
  if (tempoMeses >= 12) {
    const anos = Math.floor(tempoMeses / 12);
    const mesesRestantes = tempoMeses % 12;
    if (mesesRestantes === 0) {
      return anos === 1 ? "1 ano" : `${anos} anos`;
    }
    return `${anos} ano${anos > 1 ? 's' : ''} e ${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`;
  }
  return tempoMeses === 1 ? "1 mês" : `${tempoMeses} meses`;
}

export async function gerarCatalogoPDF(options: CatalogoOptions): Promise<void> {
  const { 
    dispositivos, 
    configuracaoLoja, 
    config = CONFIG_PADRAO,
  } = options;

  const template = TEMPLATES_PADRAO.find(t => t.id === config.templateId) || TEMPLATES_PADRAO[0];
  const textos = config.textos;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Cores do template
  const primaryColor = hexToRgb(template.cores.primaria);
  const secondaryColor = hexToRgb(template.cores.secundaria);
  const bgColor = hexToRgb(template.cores.fundo);
  const textColor = hexToRgb(template.cores.texto);
  const accentColor = hexToRgb(template.cores.destaque);
  const white: [number, number, number] = [255, 255, 255];
  const lightGray: [number, number, number] = [243, 244, 246];

  // Carregar logo
  let logoDataUrl: string | null = null;
  if (configuracaoLoja?.logo_url) {
    try {
      const response = await fetch(configuracaoLoja.logo_url);
      const blob = await response.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Erro ao carregar logo:", error);
    }
  }

  // ==================== CAPA ====================
  // Fundo da capa
  const isDarkTemplate = template.id === 'escuro';
  doc.setFillColor(...(isDarkTemplate ? secondaryColor : secondaryColor));
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Linha decorativa superior
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 8, "F");

  // Logo centralizado
  if (logoDataUrl) {
    const logoWidth = 60;
    const logoHeight = 60;
    doc.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, 50, logoWidth, logoHeight);
  }

  // Título principal
  doc.setTextColor(...white);
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text(textos.tituloCapa.toUpperCase(), pageWidth / 2, 140, { align: "center" });

  // Subtítulo
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(textos.subtituloCapa, pageWidth / 2, 155, { align: "center" });

  // Linha decorativa
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 40, 170, pageWidth / 2 + 40, 170);

  // Nome da loja
  if (configuracaoLoja?.nome_loja) {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(configuracaoLoja.nome_loja, pageWidth / 2, 195, { align: "center" });
  }

  // Data (rodapé da capa)
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const dataAtual = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const textoRodape = textos.rodape.replace("{data}", dataAtual);
  doc.text(textoRodape, pageWidth / 2, 220, { align: "center" });

  // Contato na capa
  const contatos: string[] = [];
  if (configuracaoLoja?.telefone) contatos.push(`Tel: ${configuracaoLoja.telefone}`);
  if (configuracaoLoja?.whatsapp) contatos.push(`WhatsApp: ${configuracaoLoja.whatsapp}`);
  if (configuracaoLoja?.email) contatos.push(configuracaoLoja.email);

  if (contatos.length > 0) {
    doc.setFontSize(9);
    doc.text(contatos.join(" | "), pageWidth / 2, pageHeight - 30, { align: "center" });
  }

  // Linha decorativa inferior
  doc.setFillColor(...primaryColor);
  doc.rect(0, pageHeight - 8, pageWidth, 8, "F");

  // ==================== PÁGINAS DE PRODUTOS ====================
  const itemsPerPage = config.itensPerPage;
  const columns = 2;
  const rows = Math.ceil(itemsPerPage / columns);
  
  // Cálculos de layout otimizados
  const headerHeight = 30;
  const footerHeight = 18;
  const availableHeight = pageHeight - headerHeight - footerHeight - margin;
  const gapX = 8;
  const gapY = 8;
  
  const cardWidth = (contentWidth - gapX) / columns;
  const cardHeight = (availableHeight - (gapY * (rows - 1))) / rows;

  for (let pageIndex = 0; pageIndex < Math.ceil(dispositivos.length / itemsPerPage); pageIndex++) {
    doc.addPage();

    // Fundo da página
    doc.setFillColor(...bgColor);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Barra superior (header)
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, headerHeight, "F");

    // Logo pequeno no header
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, 6, 18, 18);
    }

    // Nome da loja no header
    doc.setTextColor(...white);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(configuracaoLoja?.nome_loja || "Catálogo", logoDataUrl ? margin + 22 : margin, 17);

    // Número da página
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${pageIndex + 1}`, pageWidth - margin, 17, { align: "right" });

    // Dispositivos da página atual
    const startIndex = pageIndex * itemsPerPage;
    const pageDevices = dispositivos.slice(startIndex, startIndex + itemsPerPage);

    for (let i = 0; i < pageDevices.length; i++) {
      const device = pageDevices[i];
      const col = i % columns;
      const row = Math.floor(i / columns);

      const x = margin + col * (cardWidth + gapX);
      const y = headerHeight + 5 + row * (cardHeight + gapY);

      // Card background com sombra simulada
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(x + 1, y + 1, cardWidth, cardHeight, 4, 4, "F");
      doc.setFillColor(...white);
      doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "F");

      // Badge de condição
      const condicaoColors: Record<string, [number, number, number]> = {
        novo: [34, 197, 94],
        semi_novo: [59, 130, 246],
        usado: [249, 115, 22],
      };
      const badgeColor = condicaoColors[device.condicao] || primaryColor;
      doc.setFillColor(...badgeColor);
      doc.roundedRect(x + 6, y + 6, 28, 9, 2, 2, "F");
      doc.setTextColor(...white);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      const condicaoLabel = device.condicao === "semi_novo" ? "Semi-novo" : device.condicao.charAt(0).toUpperCase() + device.condicao.slice(1);
      doc.text(condicaoLabel, x + 20, y + 12, { align: "center" });

      // Foto do dispositivo (lado direito)
      const fotoSize = 32;
      const fotoUrl = device.foto_url || device.fotos?.[0];
      if (fotoUrl) {
        try {
          const response = await fetch(fotoUrl);
          const blob = await response.blob();
          const fotoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          doc.addImage(fotoDataUrl, "JPEG", x + cardWidth - fotoSize - 6, y + 6, fotoSize, fotoSize);
        } catch (error) {
          // Sem foto
        }
      }

      // Informações do dispositivo
      const textX = x + 6;
      let textY = y + 24;

      // Modelo
      doc.setTextColor(...textColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const maxModeloWidth = cardWidth - fotoSize - 18;
      const modelo = device.modelo.length > 18 ? device.modelo.substring(0, 18) + "..." : device.modelo;
      doc.text(modelo, textX, textY);

      // Marca
      textY += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(device.marca, textX, textY);

      // Especificações
      textY += 6;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const specs: string[] = [];
      if (device.capacidade_gb) specs.push(`${device.capacidade_gb}GB`);
      if (device.cor) specs.push(device.cor);
      if (config.mostrarBateria && device.saude_bateria) specs.push(`Bat: ${device.saude_bateria}%`);
      if (specs.length > 0) {
        doc.text(specs.join(" | "), textX, textY);
      }

      // Tipo do dispositivo
      textY += 5;
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text(device.tipo, textX, textY);

      // Garantia - posicionada abaixo das specs
      if (config.mostrarGarantia && device.garantia) {
        textY += 6;
        const tempoGarantia = device.tempo_garantia || 0;
        doc.setFillColor(...accentColor);
        doc.roundedRect(textX, textY - 4, 38, 7, 2, 2, "F");
        doc.setTextColor(...white);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        const textoGarantiaFormatado = tempoGarantia > 0 
          ? textos.textoGarantia.replace("{tempo}", formatarGarantia(tempoGarantia))
          : "Com garantia";
        doc.text(textoGarantiaFormatado, textX + 19, textY, { align: "center" });
      }

      // Quantidade disponível
      if (config.mostrarQuantidade && device.quantidade > 1) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`${device.quantidade} unidades`, x + cardWidth - 6, y + cardHeight - 24, { align: "right" });
      }

      // Preço - barra inferior do card
      if (config.mostrarPrecos && device.preco) {
        const priceBarHeight = 18;
        const priceBarY = y + cardHeight - priceBarHeight;
        
        doc.setFillColor(...primaryColor);
        doc.roundedRect(x + 4, priceBarY, cardWidth - 8, priceBarHeight - 4, 3, 3, "F");
        
        // Texto "A partir de"
        doc.setTextColor(...white);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(textos.textoPreco, x + cardWidth / 2, priceBarY + 5, { align: "center" });
        
        // Valor do preço
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(device.preco), x + cardWidth / 2, priceBarY + 12, { align: "center" });
      }
    }

    // Footer
    doc.setFillColor(...secondaryColor);
    doc.rect(0, pageHeight - 15, pageWidth, 15, "F");

    doc.setTextColor(...white);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const footerText: string[] = [];
    if (configuracaoLoja?.telefone) footerText.push(configuracaoLoja.telefone);
    if (configuracaoLoja?.whatsapp) footerText.push(configuracaoLoja.whatsapp);
    if (configuracaoLoja?.email) footerText.push(configuracaoLoja.email);

    doc.text(footerText.join(" • "), pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  // Salvar PDF
  const nomeArquivo = `catalogo-${configuracaoLoja?.nome_loja?.toLowerCase().replace(/\s+/g, "-") || "dispositivos"}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(nomeArquivo);
}
