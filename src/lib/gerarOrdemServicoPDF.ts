import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfiguracaoLoja, LayoutOSConfig } from '@/types/configuracao-loja';
import { OrdemServico } from '@/hooks/useOrdensServico';
import { decryptSenhaDesbloqueio } from './password-encryption';
import { obterTermoGarantia, LAYOUT_PADRAO } from './termo-garantia-utils';

// Formatar data/hora Brasil
const formatarDataHoraBrasil = (dataISO: string): string => {
  try {
    const data = parseISO(dataISO);
    return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  }
};

// Formatar moeda
const formatarMoeda = (valor: number) => {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Formatar telefone
const formatarTelefone = (tel?: string) => {
  if (!tel) return 'N/A';
  const numeros = tel.replace(/\D/g, '');
  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }
  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }
  return tel;
};

// Formatar CPF/CNPJ
const formatarCPFCNPJ = (doc?: string) => {
  if (!doc) return 'N/A';
  const numeros = doc.replace(/\D/g, '');
  if (numeros.length === 11) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
  }
  if (numeros.length === 14) {
    return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(5, 8)}/${numeros.slice(8, 12)}-${numeros.slice(12)}`;
  }
  return doc;
};

// Compartilhado entre o desenho de avarias do A4 (gerarOrdemServicoPDF) e do
// cupom 80mm (gerarOrdemServicoCupom80mmPDF) — mesmas cores/labels usadas na
// tela (SilhuetaComAvarias).
const TIPO_AVARIA_LABELS: Record<string, string> = {
  riscos: 'Riscos',
  trinca: 'Trinca',
  amassado: 'Amassado',
  quebrado: 'Quebrado',
  outro: 'Outro',
};

const TIPO_AVARIA_CORES: Record<string, [number, number, number]> = {
  riscos: [239, 68, 68], // red
  trinca: [249, 115, 22], // orange
  amassado: [234, 179, 8], // yellow
  quebrado: [168, 85, 247], // purple
  outro: [59, 130, 246], // blue
};

export type TipoPDFOS = 'completo' | 'primeira_parte' | 'termo_garantia';

export async function gerarOrdemServicoPDF(
  ordem: OrdemServico,
  loja?: ConfiguracaoLoja,
  tipo: TipoPDFOS = 'completo'
): Promise<Blob> {
  const doc = new jsPDF();
  const margemEsquerda = 15;
  const margemDireita = 195;
  const larguraUtil = margemDireita - margemEsquerda;
  let yPos = 20;

  // Obter configurações de layout
  const layoutConfig: LayoutOSConfig = {
    ...LAYOUT_PADRAO,
    ...loja?.layout_os_config,
  };

  const verificarNovaPagina = (espacoNecessario: number = 20) => {
    if (yPos + espacoNecessario > 280) {
      doc.addPage();
      yPos = 20;
    }
  };

  const avariasData = (ordem.avarias || {}) as any;
  const checklistEntrada = avariasData?.checklist?.entrada || {};
  const checklistSaida = avariasData?.checklist?.saida || {};
  const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);

  // Status
  const statusMap: Record<string, string> = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
    aguardando_aprovacao: 'Aguardando Aprovação',
    finalizado: 'Finalizado',
    entregue: 'Entregue',
    aguardando_retirada: 'Aguardando Retirada',
    cancelada: 'Cancelada',
  };

  // ===== CABEÇALHO (fundo escuro, mesma identidade visual do Recibo de
  // Venda/Termo de Garantia de dispositivo — ver gerarReciboVendaPDF.ts) =====
  const headerAltura = 26;
  doc.setFillColor(26, 26, 46); // #1a1a2e
  doc.roundedRect(margemEsquerda, yPos, larguraUtil, headerAltura, 2, 2, 'F');

  let textoX = margemEsquerda + 5;
  if (layoutConfig.mostrar_logo_whatsapp && loja?.logo_url) {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      const dataUrl = await new Promise<string | null>((resolve) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            console.error('Erro ao processar logo:', e);
            resolve(null);
          }
        };
        img.onerror = () => {
          console.error('Erro ao carregar logo');
          resolve(null);
        };
        img.src = loja.logo_url!;
      });
      if (dataUrl) {
        const chipLargura = 26;
        const chipAltura = headerAltura - 6;
        const chipX = margemEsquerda + 4;
        const chipY = yPos + 3;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(chipX, chipY, chipLargura, chipAltura, 1.5, 1.5, 'F');
        const props = doc.getImageProperties(dataUrl);
        const proporcao = props.width / props.height;
        const padding = 2;
        let larguraImg = chipLargura - padding * 2;
        let alturaImg = larguraImg / proporcao;
        if (alturaImg > chipAltura - padding * 2) {
          alturaImg = chipAltura - padding * 2;
          larguraImg = alturaImg * proporcao;
        }
        doc.addImage(
          dataUrl,
          chipX + (chipLargura - larguraImg) / 2,
          chipY + (chipAltura - alturaImg) / 2,
          larguraImg,
          alturaImg
        );
        textoX = chipX + chipLargura + 5;
      }
    } catch (e) {
      console.error('Erro ao adicionar logo:', e);
    }
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(loja?.nome_loja || '', textoX, yPos + 10);

  const infoLojaHeader = [loja?.cnpj ? `CNPJ: ${loja.cnpj}` : '', loja?.telefone ? `Tel: ${loja.telefone}` : '']
    .filter(Boolean)
    .join('   ');
  if (infoLojaHeader) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(173, 181, 189);
    doc.text(infoLojaHeader, textoX, yPos + 16);
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(76, 201, 240);
  doc.text(`OS #${ordem.numero_os}`, margemDireita, yPos + 10, { align: 'right' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(173, 181, 189);
  doc.text(statusMap[ordem.status || ''] || ordem.status || '', margemDireita, yPos + 16, { align: 'right' });

  yPos += headerAltura + 6;
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`Data de abertura: ${formatarDataHoraBrasil(ordem.created_at)}`, margemEsquerda, yPos);
  yPos += 7;

  // ===== ENDEREÇO DA LOJA (info restante do estabelecimento, fora da caixa) =====
  if (loja) {
    let endereco = '';
    if (loja.logradouro && loja.numero) {
      endereco = `${loja.logradouro}, ${loja.numero}`;
      if (loja.complemento) endereco += ` - ${loja.complemento}`;
      if (loja.bairro) endereco += `, ${loja.bairro}`;
      if (loja.cidade && loja.estado) endereco += ` - ${loja.cidade}/${loja.estado}`;
    } else if (loja.endereco) {
      endereco = loja.endereco;
    }
    if (loja.whatsapp) {
      doc.text(`WhatsApp: ${loja.whatsapp}`, margemEsquerda, yPos);
      yPos += 4;
    }
    if (endereco) {
      const linhas = doc.splitTextToSize(`Endereço: ${endereco}`, larguraUtil);
      linhas.forEach((linha: string) => {
        doc.text(linha, margemEsquerda, yPos);
        yPos += 4;
      });
    }
    yPos += 2;
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 8;

  // ===== DADOS DO CLIENTE =====
  verificarNovaPagina(30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', margemEsquerda, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nome: ${ordem.cliente?.nome || 'N/A'}`, margemEsquerda, yPos);
  yPos += 5;
  doc.text(`Telefone: ${formatarTelefone(ordem.cliente?.telefone)}`, margemEsquerda, yPos);
  const cpfCnpjValue = ordem.cliente?.cpf || '';
  const cpfCnpjLabel = cpfCnpjValue.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF';
  doc.text(`${cpfCnpjLabel}: ${formatarCPFCNPJ(ordem.cliente?.cpf)}`, 100, yPos);
  yPos += 5;
  if (ordem.cliente?.endereco) {
    doc.text(`Endereço: ${ordem.cliente.endereco}`, margemEsquerda, yPos);
    yPos += 5;
  }

  yPos += 4;
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 8;

  // ===== DADOS DO DISPOSITIVO =====
  verificarNovaPagina(35);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DISPOSITIVO', margemEsquerda, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Tipo: ${ordem.dispositivo_tipo}`, margemEsquerda, yPos);
  doc.text(`Marca: ${ordem.dispositivo_marca}`, 80, yPos);
  doc.text(`Modelo: ${ordem.dispositivo_modelo}`, 130, yPos);
  yPos += 5;

  if (ordem.dispositivo_cor || ordem.dispositivo_imei) {
    if (ordem.dispositivo_cor) doc.text(`Cor: ${ordem.dispositivo_cor}`, margemEsquerda, yPos);
    if (ordem.dispositivo_imei) doc.text(`IMEI: ${ordem.dispositivo_imei}`, 80, yPos);
    yPos += 5;
  }

  if (ordem.dispositivo_numero_serie) {
    doc.text(`Nº Série: ${ordem.dispositivo_numero_serie}`, margemEsquerda, yPos);
    yPos += 5;
  }

  // Senha de desbloqueio
  if (senhaDesbloqueio) {
    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Senha de Desbloqueio:', margemEsquerda, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;

    if (senhaDesbloqueio.tipo === 'padrao' && senhaDesbloqueio.padrao) {
      doc.text(`Tipo: Padrão Android | Sequência: ${senhaDesbloqueio.padrao.join(' → ')}`, margemEsquerda, yPos);
    } else {
      const tipoSenha = senhaDesbloqueio.tipo === 'numero' ? 'PIN Numérico' : 'Senha Texto';
      doc.text(`Tipo: ${tipoSenha} | Senha: ${senhaDesbloqueio.valor || 'N/A'}`, margemEsquerda, yPos);
    }
    yPos += 5;
  }

  yPos += 4;
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 8;

  // ===== DEFEITO RELATADO =====
  verificarNovaPagina(30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DEFEITO RELATADO', margemEsquerda, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const linhasDefeito = doc.splitTextToSize(ordem.defeito_relatado, larguraUtil);
  linhasDefeito.forEach((linha: string) => {
    doc.text(linha, margemEsquerda, yPos);
    yPos += 5;
  });

  yPos += 4;
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 8;

  // ===== SEM TESTE - ENTRADA =====
  const semTeste = avariasData?.checklist?.sem_teste === true;
  if (semTeste) {
    verificarNovaPagina(30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CHECKLIST DE ENTRADA', margemEsquerda, yPos);
    yPos += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(180, 100, 0);
    doc.text('Sem teste: Não foi possível realizar os testes porque o aparelho chegou desligado.', margemEsquerda, yPos);
    doc.setTextColor(0);
    yPos += 8;
  }

  // ===== CHECKLIST DE ENTRADA =====
  if (Object.keys(checklistEntrada).length > 0) {
    verificarNovaPagina(50);
    if (!semTeste) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CHECKLIST DE ENTRADA', margemEsquerda, yPos);
      yPos += 8;
    }

    doc.setFontSize(9);

    const items = Object.entries(checklistEntrada);
    const metade = Math.ceil(items.length / 2);
    const checkboxSize = 3.5;

    for (let i = 0; i < metade; i++) {
      verificarNovaPagina(8);
      const item1 = items[i];
      const item2 = items[i + metade];

      if (item1) {
        const [nome, status] = item1;
        const nomeFormatado = nome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        // Desenhar checkbox preenchido
        doc.setLineWidth(0.4);
        if (status) {
          // Funcionando - checkbox verde com ✓
          doc.setDrawColor(0, 150, 0);
          doc.setFillColor(220, 255, 220);
          doc.rect(margemEsquerda, yPos - 3, checkboxSize, checkboxSize, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 130, 0);
          doc.text('✓', margemEsquerda + 0.6, yPos);
        } else {
          // Com defeito - checkbox vermelho com ✗
          doc.setDrawColor(200, 0, 0);
          doc.setFillColor(255, 220, 220);
          doc.rect(margemEsquerda, yPos - 3, checkboxSize, checkboxSize, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 0, 0);
          doc.text('✗', margemEsquerda + 0.6, yPos);
        }
        
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        const statusText = status ? ' (OK)' : ' (Defeito)';
        doc.text(nomeFormatado + statusText, margemEsquerda + checkboxSize + 2, yPos);
      }

      if (item2) {
        const [nome, status] = item2;
        const nomeFormatado = nome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        doc.setLineWidth(0.4);
        if (status) {
          doc.setDrawColor(0, 150, 0);
          doc.setFillColor(220, 255, 220);
          doc.rect(105, yPos - 3, checkboxSize, checkboxSize, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 130, 0);
          doc.text('✓', 105 + 0.6, yPos);
        } else {
          doc.setDrawColor(200, 0, 0);
          doc.setFillColor(255, 220, 220);
          doc.rect(105, yPos - 3, checkboxSize, checkboxSize, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 0, 0);
          doc.text('✗', 105 + 0.6, yPos);
        }
        
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        const statusText = status ? ' (OK)' : ' (Defeito)';
        doc.text(nomeFormatado + statusText, 105 + checkboxSize + 2, yPos);
      }

      yPos += 6;
    }

    yPos += 4;
    doc.setDrawColor(200);
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  }

  // ===== CHECKLIST DE SAÍDA =====
  if (Object.keys(checklistSaida).length > 0) {
    verificarNovaPagina(50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CHECKLIST DE SAÍDA', margemEsquerda, yPos);
    yPos += 8;

    doc.setFontSize(9);

    const itemsSaida = Object.entries(checklistSaida);
    const metadeSaida = Math.ceil(itemsSaida.length / 2);
    const checkboxSize2 = 3.5;

    for (let i = 0; i < metadeSaida; i++) {
      verificarNovaPagina(8);
      const item1 = itemsSaida[i];
      const item2 = itemsSaida[i + metadeSaida];

      if (item1) {
        const [nome, status] = item1;
        const nomeFormatado = nome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        doc.setLineWidth(0.4);
        if (status) {
          doc.setDrawColor(0, 150, 0);
          doc.setFillColor(220, 255, 220);
          doc.rect(margemEsquerda, yPos - 3, checkboxSize2, checkboxSize2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 130, 0);
          doc.text('✓', margemEsquerda + 0.6, yPos);
        } else {
          doc.setDrawColor(200, 0, 0);
          doc.setFillColor(255, 220, 220);
          doc.rect(margemEsquerda, yPos - 3, checkboxSize2, checkboxSize2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 0, 0);
          doc.text('✗', margemEsquerda + 0.6, yPos);
        }
        
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        const statusText = status ? ' (OK)' : ' (Defeito)';
        doc.text(nomeFormatado + statusText, margemEsquerda + checkboxSize2 + 2, yPos);
      }

      if (item2) {
        const [nome, status] = item2;
        const nomeFormatado = nome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        doc.setLineWidth(0.4);
        if (status) {
          doc.setDrawColor(0, 150, 0);
          doc.setFillColor(220, 255, 220);
          doc.rect(105, yPos - 3, checkboxSize2, checkboxSize2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 130, 0);
          doc.text('✓', 105 + 0.6, yPos);
        } else {
          doc.setDrawColor(200, 0, 0);
          doc.setFillColor(255, 220, 220);
          doc.rect(105, yPos - 3, checkboxSize2, checkboxSize2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 0, 0);
          doc.text('✗', 105 + 0.6, yPos);
        }
        
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        const statusText = status ? ' (OK)' : ' (Defeito)';
        doc.text(nomeFormatado + statusText, 105 + checkboxSize2 + 2, yPos);
      }

      yPos += 6;
    }

    yPos += 4;
    doc.setDrawColor(200);
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  }

  // ===== AVARIAS VISUAIS COM DESENHO =====
  const avariasVisuais = avariasData?.avarias_visuais || [];
  if (avariasVisuais.length > 0) {
    verificarNovaPagina(100);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('AVARIAS DO DISPOSITIVO', margemEsquerda, yPos);
    yPos += 8;

    const tipoAvariaLabels = TIPO_AVARIA_LABELS;
    const tipoAvariaCores = TIPO_AVARIA_CORES;

    // Dimensões do desenho do dispositivo
    const larguraSilhueta = 35;
    const alturaSilhueta = 60;
    const espacoEntreSilhuetas = 20;
    
    // Separar avarias por lado
    const avariasFrente = avariasVisuais.filter((a: any) => a.lado === 'frente');
    const avariasTraseira = avariasVisuais.filter((a: any) => a.lado === 'traseira');
    
    // Posições dos desenhos
    const xFrente = margemEsquerda + 15;
    const xTraseira = xFrente + larguraSilhueta + espacoEntreSilhuetas + 15;
    const yDesenho = yPos;

    // Função para desenhar silhueta de celular simplificada
    const desenharSilhueta = (x: number, y: number, titulo: string) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(titulo, x + larguraSilhueta / 2, y - 2, { align: 'center' });
      
      // Contorno do dispositivo
      doc.setDrawColor(100);
      doc.setLineWidth(0.5);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(x, y, larguraSilhueta, alturaSilhueta, 3, 3, 'FD');
      
      // Tela (área interna)
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(x + 2, y + 5, larguraSilhueta - 4, alturaSilhueta - 10, 1, 1, 'F');
    };

    // Desenhar silhueta frente
    desenharSilhueta(xFrente, yDesenho, 'FRENTE');
    
    // Marcar avarias na frente
    avariasFrente.forEach((avaria: any, index: number) => {
      const markerX = xFrente + (avaria.x / 100) * larguraSilhueta;
      const markerY = yDesenho + (avaria.y / 100) * alturaSilhueta;
      const cor = tipoAvariaCores[avaria.tipo] || [100, 100, 100];
      
      doc.setFillColor(cor[0], cor[1], cor[2]);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.8);
      doc.circle(markerX, markerY, 2.5, 'FD');
      
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(index + 1), markerX, markerY + 0.7, { align: 'center' });
      doc.setTextColor(0);
    });

    // Desenhar silhueta traseira
    desenharSilhueta(xTraseira, yDesenho, 'TRASEIRA');
    
    // Marcar avarias na traseira
    avariasTraseira.forEach((avaria: any, index: number) => {
      const markerX = xTraseira + (avaria.x / 100) * larguraSilhueta;
      const markerY = yDesenho + (avaria.y / 100) * alturaSilhueta;
      const cor = tipoAvariaCores[avaria.tipo] || [100, 100, 100];
      
      doc.setFillColor(cor[0], cor[1], cor[2]);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.8);
      doc.circle(markerX, markerY, 2.5, 'FD');
      
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(avariasFrente.length + index + 1), markerX, markerY + 0.7, { align: 'center' });
      doc.setTextColor(0);
    });

    // Legenda das avarias (à direita dos desenhos)
    const xLegenda = xTraseira + larguraSilhueta + 15;
    let yLegenda = yDesenho + 5;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Legenda:', xLegenda, yLegenda);
    yLegenda += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    // Listar todas as avarias com números
    avariasVisuais.forEach((avaria: any, index: number) => {
      const cor = tipoAvariaCores[avaria.tipo] || [100, 100, 100];
      const tipo = tipoAvariaLabels[avaria.tipo] || avaria.tipo;
      const lado = avaria.lado === 'frente' ? 'F' : 'T';
      
      // Marcador colorido
      doc.setFillColor(cor[0], cor[1], cor[2]);
      doc.circle(xLegenda + 2, yLegenda - 1, 1.5, 'F');
      
      doc.text(`${index + 1}. ${tipo} (${lado})`, xLegenda + 5, yLegenda);
      yLegenda += 5;
    });

    yPos = Math.max(yDesenho + alturaSilhueta + 8, yLegenda + 5);
    
    doc.setDrawColor(200);
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  }

  // ===== SERVIÇOS E PRODUTOS =====
  // Suportar ambos os formatos: servicos_realizados (novo) e servicos_inline (onboarding)
  let servicosRealizados = avariasData?.servicos_realizados || [];
  if (servicosRealizados.length === 0 && avariasData?.servicos_inline?.length > 0) {
    servicosRealizados = avariasData.servicos_inline.map((s: any, i: number) => ({
      id: `inline-${i}`,
      nome: s.nome,
      preco: s.valor || 0,
      custo: 0,
      lucro: s.valor || 0,
    }));
  }
  const produtosUtilizados = avariasData?.produtos_utilizados || [];
  const desconto = avariasData?.dados_pagamento?.desconto || 0;
  const subtotalPagamento = avariasData?.dados_pagamento?.subtotal ?? (desconto > 0 ? (ordem.total || 0) + desconto : undefined);

  if (servicosRealizados.length > 0 || produtosUtilizados.length > 0 || ordem.total) {
    verificarNovaPagina(40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ITENS DO SERVIÇO', margemEsquerda, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Listar serviços
    if (servicosRealizados.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Serviços:', margemEsquerda, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      
      servicosRealizados.forEach((servico: any) => {
        verificarNovaPagina(8);
        doc.text(`• ${servico.nome}`, margemEsquerda + 3, yPos);
        doc.text(formatarMoeda(servico.preco), margemDireita, yPos, { align: 'right' });
        yPos += 5;
      });
      yPos += 2;
    }

    // Listar produtos
    if (produtosUtilizados.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Produtos/Peças:', margemEsquerda, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      
      produtosUtilizados.forEach((produto: any) => {
        verificarNovaPagina(8);
        doc.text(`• ${produto.quantidade}x ${produto.nome}`, margemEsquerda + 3, yPos);
        doc.text(formatarMoeda(produto.preco_total), margemDireita, yPos, { align: 'right' });
        yPos += 5;
      });
      yPos += 2;
    }

    // Desconto e Total
    yPos += 3;
    doc.setFontSize(9);

    if (desconto > 0 && subtotalPagamento !== undefined) {
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', margemEsquerda, yPos);
      doc.text(formatarMoeda(subtotalPagamento), margemDireita, yPos, { align: 'right' });
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 0, 0);
      doc.text('Desconto:', margemEsquerda, yPos);
      doc.text(`- ${formatarMoeda(desconto)}`, margemDireita, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      yPos += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL:', margemEsquerda, yPos);
    doc.text(formatarMoeda(ordem.total || 0), margemDireita, yPos, { align: 'right' });
    yPos += 5;

    yPos += 4;
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  }

  // Se só a primeira parte, finalizar aqui
  if (tipo === 'primeira_parte') {
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Documento gerado em: ${formatarDataHoraBrasil(new Date().toISOString())}`, 105, yPos, { align: 'center' });
    return doc.output('blob');
  }

  // ===== TERMO DE GARANTIA =====
  if (tipo === 'termo_garantia') {
    // Reiniciar página limpa para o termo
    const docTermo = new jsPDF();
    let yT = 20;
    const mE = 15;
    const mD = 195;
    const lU = mD - mE;

    docTermo.setFontSize(16);
    docTermo.setFont('helvetica', 'bold');
    docTermo.text('TERMO DE GARANTIA DO SERVIÇO', 105, yT, { align: 'center' });
    yT += 8;
    docTermo.setFontSize(10);
    docTermo.setFont('helvetica', 'normal');
    docTermo.text(`OS #${ordem.numero_os} — ${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`, 105, yT, { align: 'center' });
    yT += 4;
    if (ordem.cliente?.nome) {
      docTermo.text(`Cliente: ${ordem.cliente.nome}`, 105, yT, { align: 'center' });
      yT += 4;
    }
    yT += 4;
    docTermo.setDrawColor(200);
    docTermo.setLineWidth(0.3);
    docTermo.line(mE, yT, mD, yT);
    yT += 8;

    const verificarNovaPaginaTermo = (esp: number = 20) => {
      if (yT + esp > 280) { docTermo.addPage(); yT = 20; }
    };

    docTermo.setFontSize(9);
    docTermo.setFont('helvetica', 'normal');

    const termoGarantiaSolo = obterTermoGarantia({
      tempoGarantia: ordem.tempo_garantia,
      termoConfig: loja?.termo_garantia_config,
      nomeLoja: loja?.nome_loja,
      nomeCliente: ordem.cliente?.nome,
      dispositivo: `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`,
    });

    const linhasTermoSolo = docTermo.splitTextToSize(termoGarantiaSolo, lU);
    linhasTermoSolo.forEach((linha: string) => {
      verificarNovaPaginaTermo(5);
      docTermo.text(linha, mE, yT);
      yT += 4;
    });

    yT += 6;
    docTermo.setFont('helvetica', 'bold');
    docTermo.text('TERMOS GERAIS:', mE, yT);
    yT += 5;
    docTermo.setFont('helvetica', 'normal');

    const termosGeraisSolo = [
      '• O cliente é responsável por realizar backup de seus dados antes da entrega do dispositivo.',
      '• A assistência técnica não se responsabiliza por perda de dados durante o processo de reparo.',
      '• O cliente deve retirar o dispositivo em até 30 dias após a conclusão do serviço.',
      '• Dispositivos não retirados em até 90 dias serão considerados abandonados.',
    ];
    termosGeraisSolo.forEach(t => {
      verificarNovaPaginaTermo(8);
      const ls = docTermo.splitTextToSize(t, lU - 5);
      ls.forEach((l: string) => { docTermo.text(l, mE, yT); yT += 4; });
    });

    yT += 10;
    verificarNovaPaginaTermo(40);
    docTermo.setFontSize(9);
    docTermo.line(mE, yT, 90, yT);
    docTermo.text('Assinatura do Cliente', mE + 15, yT + 5);
    docTermo.line(110, yT, mD, yT);
    docTermo.text('Assinatura do Responsável', 130, yT + 5);
    yT += 20;

    docTermo.setFontSize(8);
    docTermo.setTextColor(100);
    docTermo.text(`Documento gerado em: ${formatarDataHoraBrasil(new Date().toISOString())}`, 105, yT, { align: 'center' });

    return docTermo.output('blob');
  }

  if (layoutConfig.mostrar_termos_condicoes) {
    verificarNovaPagina(50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMO DE GARANTIA DO SERVIÇO', margemEsquerda, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // Obter termo de garantia personalizado
    const termoGarantia = obterTermoGarantia({
      tempoGarantia: ordem.tempo_garantia,
      termoConfig: loja?.termo_garantia_config,
      nomeLoja: loja?.nome_loja,
      nomeCliente: ordem.cliente?.nome,
      dispositivo: `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`,
    });

    const linhasTermo = doc.splitTextToSize(termoGarantia, larguraUtil);
    linhasTermo.forEach((linha: string) => {
      verificarNovaPagina(5);
      doc.text(linha, margemEsquerda, yPos);
      yPos += 4;
    });

    yPos += 6;

    // Termos gerais adicionais
    doc.setFont('helvetica', 'bold');
    doc.text('TERMOS GERAIS:', margemEsquerda, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');

    const termosGerais = [
      '• O cliente é responsável por realizar backup de seus dados antes da entrega do dispositivo.',
      '• A assistência técnica não se responsabiliza por perda de dados durante o processo de reparo.',
      '• O cliente deve retirar o dispositivo em até 30 dias após a conclusão do serviço.',
      '• Dispositivos não retirados em até 90 dias serão considerados abandonados.',
    ];

    termosGerais.forEach(termo => {
      verificarNovaPagina(8);
      const linhas = doc.splitTextToSize(termo, larguraUtil - 5);
      linhas.forEach((linha: string) => {
        doc.text(linha, margemEsquerda, yPos);
        yPos += 4;
      });
    });

    yPos += 10;
  }

  // ===== ASSINATURAS DIGITAIS =====
  const assinaturas = avariasData?.assinaturas || {};
  const temAssinaturaEntrada = assinaturas?.cliente_entrada;
  const temAssinaturaSaida = assinaturas?.cliente_saida;

  if (temAssinaturaEntrada || temAssinaturaSaida) {
    verificarNovaPagina(70);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURAS DIGITAIS', margemEsquerda, yPos);
    yPos += 8;

    const larguraAssinatura = 70;
    const alturaAssinatura = 30;

    // Assinatura de entrada
    if (temAssinaturaEntrada) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Assinatura na Entrada:', margemEsquerda, yPos);
      yPos += 3;

      // Caixa para assinatura
      doc.setDrawColor(180);
      doc.setLineWidth(0.3);
      doc.rect(margemEsquerda, yPos, larguraAssinatura, alturaAssinatura);
      
      try {
        // Adicionar imagem da assinatura
        doc.addImage(
          assinaturas.cliente_entrada,
          'PNG',
          margemEsquerda + 2,
          yPos + 2,
          larguraAssinatura - 4,
          alturaAssinatura - 4
        );
      } catch (e) {
        console.error('Erro ao adicionar assinatura entrada:', e);
      }

      // Data da assinatura
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      if (assinaturas.data_assinatura_entrada) {
        doc.text(`Data: ${formatarDataHoraBrasil(assinaturas.data_assinatura_entrada)}`, margemEsquerda, yPos + alturaAssinatura + 4);
      }

      yPos += alturaAssinatura + 10;
    }

    // Assinatura de saída
    if (temAssinaturaSaida) {
      verificarNovaPagina(45);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Assinatura na Saída/Entrega:', margemEsquerda, yPos);
      yPos += 3;

      // Caixa para assinatura
      doc.setDrawColor(180);
      doc.setLineWidth(0.3);
      doc.rect(margemEsquerda, yPos, larguraAssinatura, alturaAssinatura);
      
      try {
        doc.addImage(
          assinaturas.cliente_saida,
          'PNG',
          margemEsquerda + 2,
          yPos + 2,
          larguraAssinatura - 4,
          alturaAssinatura - 4
        );
      } catch (e) {
        console.error('Erro ao adicionar assinatura saída:', e);
      }

      // Data da assinatura
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      if (assinaturas.data_assinatura_saida) {
        doc.text(`Data: ${formatarDataHoraBrasil(assinaturas.data_assinatura_saida)}`, margemEsquerda, yPos + alturaAssinatura + 4);
      }

      yPos += alturaAssinatura + 10;
    }

    doc.setDrawColor(200);
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  } else {
    // Área para assinaturas manuais (caso não tenha digital)
    verificarNovaPagina(40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURAS', margemEsquerda, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Linha de assinatura cliente
    doc.line(margemEsquerda, yPos, 90, yPos);
    doc.text('Assinatura do Cliente', margemEsquerda + 15, yPos + 5);

    // Linha de assinatura loja
    doc.line(110, yPos, margemDireita, yPos);
    doc.text('Assinatura do Responsável', 130, yPos + 5);

    yPos += 15;
  }

  // Rodapé
  verificarNovaPagina(15);
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Documento gerado em: ${formatarDataHoraBrasil(new Date().toISOString())}`, 105, yPos, { align: 'center' });

  // Retornar como Blob
  return doc.output('blob');
}

/**
 * Gera a Ordem de Serviço em formato de cupom térmico 80mm como PDF —
 * caminho usado no iOS standalone quando o formato 80mm é escolhido, onde
 * window.print()/iframe (print80mm() em ImpressaoOrdemServico.tsx) é
 * bloqueado pela plataforma (mesmo motivo já corrigido no caminho A4 desta
 * função e no Recibo de Venda/Termo de Garantia — ver gerarReciboVendaPDF.ts).
 *
 * Cobre o conteúdo mais usado do cupom 80mm em tela
 * (ImpressaoCupom80mm.tsx): cabeçalho, dados da loja/cliente/dispositivo,
 * defeito relatado, checklist (texto, sem os ícones/duas colunas da tela),
 * senha (texto, sem o desenho do padrão de desbloqueio), avarias visuais
 * (mesmo desenho de silhueta com marcadores do caminho A4, em escala
 * reduzida — silhuetas lado a lado, legenda embaixo em vez de ao lado por
 * falta de largura), itens do serviço, custos adicionais, forma de
 * pagamento, desconto/total, observações internas, termo de garantia e
 * assinaturas (usa a imagem da assinatura digital se houver, como no
 * caminho A4).
 *
 * Papel térmico é bobina contínua, não página fixa — mesma técnica de
 * medição em duas passadas usada em gerarReciboVendaPDF.ts: um doc
 * descartável desenha o conteúdo inteiro numa altura provisória generosa só
 * pra descobrir a altura real, depois o doc definitivo já nasce com essa
 * altura exata.
 */
export async function gerarOrdemServicoCupom80mmPDF(ordem: OrdemServico, loja?: ConfiguracaoLoja): Promise<Blob> {
  const larguraPagina = 80;
  const margin = 3;

  const avariasData = (ordem.avarias || {}) as any;
  const config80 = ((loja?.layout_os_config as any)?.config_80mm || {}) as Record<string, boolean | undefined>;
  const mostrar = (flag: string, padrao: boolean) => (config80[flag] === undefined ? padrao : !!config80[flag]);

  const statusMap: Record<string, string> = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
    aguardando_aprovacao: 'Aguardando Aprovação',
    finalizado: 'Finalizado',
    entregue: 'Entregue',
    aguardando_retirada: 'Aguardando Retirada',
    cancelada: 'Cancelada',
  };

  const desenharConteudo = async (doc: jsPDF): Promise<number> => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const larguraUtil = pageWidth - margin * 2;
    let y = margin;

    // ===== CABEÇALHO (caixa escura empilhada — mesma identidade visual do
    // cabeçalho térmico do Recibo de Venda, ver gerarReciboVendaPDF.ts) =====
    const padding = 3;
    let logoLargura = 0;
    let logoAltura = 0;
    let logoDataUrl: string | null = null;
    if (mostrar('mostrar_logo', true) && loja?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        logoDataUrl = await new Promise<string | null>((resolve) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = img.width;
              canvas.height = img.height;
              ctx?.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = loja.logo_url!;
        });
        if (logoDataUrl) {
          const props = doc.getImageProperties(logoDataUrl);
          const proporcao = props.width / props.height;
          logoLargura = Math.min(larguraUtil * 0.45, 22);
          logoAltura = logoLargura / proporcao;
          const logoAlturaMax = 11;
          if (logoAltura > logoAlturaMax) {
            logoAltura = logoAlturaMax;
            logoLargura = logoAltura * proporcao;
          }
        }
      } catch {
        logoDataUrl = null;
      }
    }

    const mostrarDadosLoja = mostrar('mostrar_dados_loja', true) && !!loja;
    const cnpjLinha = mostrarDadosLoja && loja?.cnpj ? `CNPJ: ${loja.cnpj}` : '';
    const telLinha = mostrarDadosLoja && loja?.telefone ? `Tel: ${loja.telefone}` : '';
    const linhasInfoLoja = [cnpjLinha, telLinha].filter(Boolean);

    const headerAltura =
      padding * 2 + (logoAltura > 0 ? logoAltura + 3 : 0) + 5 + linhasInfoLoja.length * 3.2 + 5.5;

    doc.setFillColor(26, 26, 46);
    doc.roundedRect(margin, y, larguraUtil, headerAltura, 2, 2, 'F');

    let contentY = y + padding;
    if (logoDataUrl && logoAltura > 0) {
      try {
        const chipPad = 1.2;
        const chipX = margin + (larguraUtil - logoLargura) / 2 - chipPad;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(chipX, contentY - chipPad, logoLargura + chipPad * 2, logoAltura + chipPad * 2, 1, 1, 'F');
        doc.addImage(logoDataUrl, margin + (larguraUtil - logoLargura) / 2, contentY, logoLargura, logoAltura);
      } catch {
        // segue sem logo
      }
      contentY += logoAltura + 3;
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(mostrarDadosLoja ? loja?.nome_loja || '' : '', pageWidth / 2, contentY, { align: 'center' });
    contentY += 5;

    if (linhasInfoLoja.length > 0) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(173, 181, 189);
      linhasInfoLoja.forEach((linha) => {
        doc.text(linha, pageWidth / 2, contentY, { align: 'center' });
        contentY += 3.2;
      });
    }

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(76, 201, 240);
    doc.text('ORDEM DE SERVIÇO', pageWidth / 2, contentY, { align: 'center' });

    y += headerAltura + 4;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`OS #${ordem.numero_os} — ${statusMap[ordem.status || ''] || ordem.status || ''}`, pageWidth / 2, y, {
      align: 'center',
    });
    y += 4;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(formatarDataHoraBrasil(ordem.created_at), pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setDrawColor(...([222, 226, 230] as [number, number, number]));
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // ===== helpers de seção =====
    const tituloSecao = (texto: string) => {
      doc.setDrawColor(222, 226, 230);
      doc.setLineWidth(0.2);
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, y, larguraUtil, 5.5, 'FD');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(108, 117, 125);
      doc.text(texto.toUpperCase(), margin + 2, y + 3.9);
      y += 8;
    };

    const linhaTexto = (texto: string, opts: { bold?: boolean } = {}) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setTextColor(35, 35, 35);
      const linhas = doc.splitTextToSize(texto, larguraUtil - 4);
      linhas.forEach((linha: string) => {
        doc.text(linha, margin + 2, y);
        y += 3.6;
      });
    };

    const linhaComValor = (label: string, valor: string, opts: { bold?: boolean; corValor?: [number, number, number] } = {}) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setTextColor(35, 35, 35);
      doc.text(label, margin + 2, y);
      doc.setTextColor(...(opts.corValor ?? [35, 35, 35]));
      doc.text(valor, pageWidth - margin - 2, y, { align: 'right' });
      y += 4;
    };

    // ===== CLIENTE =====
    if (mostrar('mostrar_dados_cliente', true)) {
      tituloSecao('Cliente');
      linhaTexto(`Nome: ${ordem.cliente?.nome || 'N/A'}`);
      linhaTexto(`Tel: ${formatarTelefone(ordem.cliente?.telefone)}`);
      if (ordem.cliente?.cpf) linhaTexto(`CPF: ${formatarCPFCNPJ(ordem.cliente.cpf)}`);
      y += 2;
    }

    // ===== DISPOSITIVO =====
    if (mostrar('mostrar_dados_dispositivo', true)) {
      tituloSecao('Dispositivo');
      linhaTexto(`${ordem.dispositivo_tipo || ''} ${ordem.dispositivo_marca || ''} ${ordem.dispositivo_modelo || ''}`.trim());
      if (ordem.dispositivo_cor) linhaTexto(`Cor: ${ordem.dispositivo_cor}`);
      const imeiSerie = ordem.dispositivo_imei || ordem.dispositivo_numero_serie;
      if (imeiSerie) linhaTexto(`IMEI/Série: ${imeiSerie}`);
      y += 2;
    }

    // ===== DEFEITO =====
    if (mostrar('mostrar_defeito', true) && ordem.defeito_relatado) {
      tituloSecao('Defeito Relatado');
      linhaTexto(ordem.defeito_relatado);
      y += 2;
    }

    // ===== CHECKLIST (texto — sem os ícones/duas colunas da tela) =====
    if (mostrar('mostrar_checklist', false)) {
      const semTeste = avariasData?.checklist?.sem_teste === true;
      const checklistEntrada = avariasData?.checklist?.entrada || {};
      const checklistSaida = avariasData?.checklist?.saida || {};

      if (semTeste) {
        tituloSecao('Checklist Entrada');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(180, 100, 0);
        doc.text('Sem teste: aparelho chegou desligado.', margin + 2, y);
        y += 4;
      }

      if (Object.keys(checklistEntrada).length > 0) {
        if (!semTeste) tituloSecao('Checklist Entrada');
        Object.entries(checklistEntrada).forEach(([nome, status]) => {
          const nomeFormatado = nome.replace(/_/g, ' ');
          linhaTexto(`${status ? '✓' : '✗'} ${nomeFormatado}`);
        });
        y += 2;
      }

      if (Object.keys(checklistSaida).length > 0) {
        tituloSecao('Checklist Saída');
        Object.entries(checklistSaida).forEach(([nome, status]) => {
          const nomeFormatado = nome.replace(/_/g, ' ');
          linhaTexto(`${status ? '✓' : '✗'} ${nomeFormatado}`);
        });
        y += 2;
      }
    }

    // ===== AVARIAS (mesmo desenho de silhueta do A4 — ver mais acima nesta
    // função gerarOrdemServicoPDF — só em escala reduzida, silhuetas lado a
    // lado mas legenda embaixo em vez de ao lado, largura não cabe as duas
    // coisas juntas) =====
    if (mostrar('mostrar_avarias', false) && (avariasData?.avarias_visuais || []).length > 0) {
      tituloSecao('Avarias');

      const avariasVisuais = avariasData.avarias_visuais as any[];
      const avariasFrente = avariasVisuais.filter((a: any) => a.lado === 'frente');
      const avariasTraseira = avariasVisuais.filter((a: any) => a.lado === 'traseira');

      const larguraSilhueta = 20;
      const alturaSilhueta = 34;
      const gapSilhuetas = 8;
      const larguraTotalSilhuetas = larguraSilhueta * 2 + gapSilhuetas;
      const xFrente = margin + (larguraUtil - larguraTotalSilhuetas) / 2;
      const xTraseira = xFrente + larguraSilhueta + gapSilhuetas;
      const yDesenho = y + 3;

      const desenharSilhueta = (x: number, yTop: number, titulo: string) => {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(35, 35, 35);
        doc.text(titulo, x + larguraSilhueta / 2, yTop - 1.5, { align: 'center' });
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.4);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, yTop, larguraSilhueta, alturaSilhueta, 2, 2, 'FD');
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(x + 1.2, yTop + 3, larguraSilhueta - 2.4, alturaSilhueta - 6, 1, 1, 'F');
      };

      const marcarAvarias = (lista: any[], x: number, yTop: number, offsetNumero: number) => {
        lista.forEach((avaria: any, index: number) => {
          const markerX = x + (avaria.x / 100) * larguraSilhueta;
          const markerY = yTop + (avaria.y / 100) * alturaSilhueta;
          const cor = TIPO_AVARIA_CORES[avaria.tipo] || [100, 100, 100];
          doc.setFillColor(cor[0], cor[1], cor[2]);
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.4);
          doc.circle(markerX, markerY, 1.6, 'FD');
          doc.setFontSize(4);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(String(offsetNumero + index + 1), markerX, markerY + 0.5, { align: 'center' });
        });
      };

      desenharSilhueta(xFrente, yDesenho, 'FRENTE');
      marcarAvarias(avariasFrente, xFrente, yDesenho, 0);
      desenharSilhueta(xTraseira, yDesenho, 'TRASEIRA');
      marcarAvarias(avariasTraseira, xTraseira, yDesenho, avariasFrente.length);

      y = yDesenho + alturaSilhueta + 5;

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      avariasVisuais.forEach((avaria: any, index: number) => {
        const cor = TIPO_AVARIA_CORES[avaria.tipo] || [100, 100, 100];
        const tipo = TIPO_AVARIA_LABELS[avaria.tipo] || avaria.tipo;
        const lado = avaria.lado === 'frente' ? 'F' : 'T';
        doc.setFillColor(cor[0], cor[1], cor[2]);
        doc.circle(margin + 3, y - 1, 1.2, 'F');
        doc.setTextColor(35, 35, 35);
        doc.text(`${index + 1}. ${tipo} (${lado})`, margin + 6, y);
        y += 3.6;
      });
      y += 2;
    }

    // ===== SENHA =====
    const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);
    if (mostrar('mostrar_senha', true) && senhaDesbloqueio) {
      tituloSecao('Senha de Desbloqueio');
      if (senhaDesbloqueio.nao_informada) {
        linhaTexto('Cliente não quis passar a senha.');
      } else if (senhaDesbloqueio.tipo === 'padrao' && senhaDesbloqueio.padrao) {
        linhaTexto(`Sequência: ${senhaDesbloqueio.padrao.join(' → ')}`);
      } else {
        const tipoSenha = senhaDesbloqueio.tipo === 'numero' ? 'PIN' : 'Texto';
        linhaTexto(`${tipoSenha}: ${senhaDesbloqueio.valor || 'N/A'}`);
      }
      y += 2;
    }

    // ===== SERVIÇOS E PRODUTOS =====
    let servicosRealizados = avariasData?.servicos_realizados || [];
    if (servicosRealizados.length === 0 && avariasData?.servicos_inline?.length > 0) {
      servicosRealizados = avariasData.servicos_inline.map((s: any, i: number) => ({
        id: `inline-${i}`,
        nome: s.nome,
        preco: s.valor || 0,
      }));
    }
    const produtosUtilizados = avariasData?.produtos_utilizados || [];

    if (mostrar('mostrar_servicos', true) && (servicosRealizados.length > 0 || produtosUtilizados.length > 0)) {
      if (servicosRealizados.length > 0) {
        tituloSecao('Serviços');
        servicosRealizados.forEach((servico: any) => {
          linhaComValor(servico.nome, formatarMoeda(servico.preco));
        });
        y += 2;
      }
      if (produtosUtilizados.length > 0) {
        tituloSecao('Peças');
        produtosUtilizados.forEach((produto: any) => {
          linhaComValor(`${produto.quantidade}x ${produto.nome}`, formatarMoeda(produto.preco_total));
        });
        y += 2;
      }
    }

    // ===== CUSTOS ADICIONAIS =====
    const custosAdicionais = avariasData?.custos_adicionais || [];
    if (mostrar('mostrar_custos_adicionais', true) && custosAdicionais.length > 0) {
      tituloSecao('Custos Adicionais');
      custosAdicionais.forEach((custo: any) => {
        const label =
          custo.tipo === 'frete' ? 'Frete' : custo.tipo === 'brinde' ? 'Brinde' : custo.descricao || 'Outro';
        linhaComValor(`${label} (${custo.repassar_cliente ? 'Cliente' : 'Loja'})`, formatarMoeda(custo.valor || 0));
      });
      y += 2;
    }

    // ===== FORMA DE PAGAMENTO =====
    const formaPagamento = (ordem as any).forma_pagamento;
    if (mostrar('mostrar_forma_pagamento', true) && formaPagamento) {
      tituloSecao('Pagamento');
      linhaTexto(String(formaPagamento));
      y += 2;
    }

    // ===== DESCONTO E TOTAL =====
    if (mostrar('mostrar_valor', true)) {
      const desconto = avariasData?.dados_pagamento?.desconto || 0;
      const subtotal = avariasData?.dados_pagamento?.subtotal ?? (desconto > 0 ? (ordem.total || 0) + desconto : undefined);
      if (desconto > 0 && subtotal !== undefined) {
        linhaComValor('Subtotal', formatarMoeda(subtotal));
        linhaComValor('Desconto', `- ${formatarMoeda(desconto)}`, { bold: true, corValor: [180, 0, 0] });
      }
      y += 1;
      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      doc.text('TOTAL', margin + 2, y);
      doc.text(formatarMoeda(ordem.total || 0), pageWidth - margin - 2, y, { align: 'right' });
      y += 4;
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }

    // ===== OBSERVAÇÕES INTERNAS =====
    if (avariasData?.observacoes_internas && avariasData?.mostrar_obs_internas_impressao) {
      tituloSecao('Observações Internas');
      linhaTexto(avariasData.observacoes_internas);
      y += 2;
    }

    // ===== TERMO DE GARANTIA =====
    if (mostrar('mostrar_termos_condicoes', false)) {
      tituloSecao('Termo de Garantia');
      const termoGarantia = obterTermoGarantia({
        tempoGarantia: ordem.tempo_garantia,
        termoConfig: loja?.termo_garantia_config,
        nomeLoja: loja?.nome_loja,
        nomeCliente: ordem.cliente?.nome,
        dispositivo: `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`,
      });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const linhasTermo = doc.splitTextToSize(termoGarantia, larguraUtil - 4);
      linhasTermo.forEach((linha: string) => {
        doc.text(linha, margin + 2, y);
        y += 3.2;
      });
      y += 3;
    }

    // ===== ASSINATURAS =====
    if (mostrar('mostrar_assinaturas', true)) {
      const assinaturas = avariasData?.assinaturas || {};
      const larguraAssinatura = larguraUtil - 4;
      const alturaAssinatura = 16;

      const blocoAssinatura = (titulo: string, imagemBase64: string | undefined, dataISO: string | undefined) => {
        y += 3;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(35, 35, 35);
        doc.text(titulo, margin + 2, y);
        y += 2;
        if (imagemBase64) {
          try {
            doc.addImage(imagemBase64, margin + 2, y, larguraAssinatura, alturaAssinatura);
          } catch {
            // segue sem a imagem
          }
          y += alturaAssinatura + 1;
          if (dataISO) {
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Data: ${formatarDataHoraBrasil(dataISO)}`, margin + 2, y);
            y += 4;
          }
        } else {
          y += 6;
          doc.setDrawColor(120, 120, 120);
          doc.setLineWidth(0.2);
          doc.line(margin + 2, y, pageWidth - margin - 2, y);
          y += 4;
        }
      };

      tituloSecao('Assinaturas');
      blocoAssinatura(
        'Cliente (Entrada)',
        assinaturas.cliente_entrada,
        assinaturas.data_assinatura_entrada
      );
      blocoAssinatura('Cliente (Saída)', assinaturas.cliente_saida, assinaturas.data_assinatura_saida);
      y += 2;
    }

    // ===== RODAPÉ =====
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    const dataGerado = `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(dataGerado, pageWidth / 2, y, { align: 'center' });
    y += 4;

    return y;
  };

  const docMedicao = new jsPDF({ unit: 'mm', format: [larguraPagina, 1000] });
  const alturaConteudo = await desenharConteudo(docMedicao);
  const alturaFinal = Math.max(alturaConteudo + margin, 60);

  const doc = new jsPDF({ unit: 'mm', format: [larguraPagina, alturaFinal] });
  await desenharConteudo(doc);
  return doc.output('blob');
}

// Função para fazer download do PDF
export async function downloadOrdemServicoPDF(
  ordem: OrdemServico,
  loja?: ConfiguracaoLoja
): Promise<void> {
  const blob = await gerarOrdemServicoPDF(ordem, loja);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `OS-${ordem.numero_os}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

// Dados exibidos na página pública de acompanhamento (/acompanhar/:token via
// get_os_tracking RPC) — mesmo conjunto de campos, sem CPF/IMEI/nº série/senha.
export interface DadosPublicosOS {
  numeroOS: string;
  status: string | null;
  statusLabel?: string;
  defeitoRelatado: string | null;
  total: number | null;
  createdAt: string;
  dataSaida: string | null;
  dispositivoMarca: string | null;
  dispositivoModelo: string | null;
  clienteNome: string | null;
  nomeLoja: string | null;
}

// PDF simplificado para download público na página de acompanhamento — usa
// só os campos já expostos nessa página, sem dados sensíveis (CPF, IMEI,
// nº de série, senha de desbloqueio), que só existem no PDF completo interno.
export async function gerarPDFAcompanhamentoPublico(dados: DadosPublicosOS): Promise<Blob> {
  const doc = new jsPDF();
  const margemEsquerda = 15;
  const margemDireita = 195;
  const larguraUtil = margemDireita - margemEsquerda;
  let yPos = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', 105, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(12);
  doc.text(`#${dados.numeroOS}`, 105, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Status: ${dados.statusLabel || dados.status || 'N/A'}`, margemEsquerda, yPos);
  doc.text(`Data: ${formatarDataHoraBrasil(dados.createdAt)}`, 120, yPos);
  yPos += 10;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 8;

  if (dados.nomeLoja) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTABELECIMENTO', margemEsquerda, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(dados.nomeLoja, margemEsquerda, yPos);
    yPos += 9;
    doc.line(margemEsquerda, yPos - 4, margemDireita, yPos - 4);
  }

  if (dados.clienteNome) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', margemEsquerda, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nome: ${dados.clienteNome}`, margemEsquerda, yPos);
    yPos += 9;
    doc.line(margemEsquerda, yPos - 4, margemDireita, yPos - 4);
  }

  const dispositivo = `${dados.dispositivoMarca || ''} ${dados.dispositivoModelo || ''}`.trim();
  if (dispositivo) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DISPOSITIVO', margemEsquerda, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(dispositivo, margemEsquerda, yPos);
    yPos += 9;
    doc.line(margemEsquerda, yPos - 4, margemDireita, yPos - 4);
  }

  if (dados.defeitoRelatado) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PROBLEMA RELATADO', margemEsquerda, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(dados.defeitoRelatado, larguraUtil);
    linhas.forEach((linha: string) => {
      doc.text(linha, margemEsquerda, yPos);
      yPos += 5;
    });
    yPos += 4;
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  }

  if (dados.total != null && dados.total > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR DO SERVIÇO', margemEsquerda, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(formatarMoeda(dados.total), margemEsquerda, yPos);
    yPos += 9;
    doc.line(margemEsquerda, yPos - 4, margemDireita, yPos - 4);
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DATAS', margemEsquerda, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Entrada: ${formatarDataHoraBrasil(dados.createdAt)}`, margemEsquerda, yPos);
  if (dados.dataSaida) {
    doc.text(`Previsão de entrega: ${formatarDataHoraBrasil(dados.dataSaida)}`, margemEsquerda, yPos + 5);
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Documento gerado a partir do acompanhamento público da OS.', 105, 285, { align: 'center' });

  return doc.output('blob');
}

// Faz o download do PDF simplificado da página pública de acompanhamento.
export async function downloadPDFAcompanhamentoPublico(dados: DadosPublicosOS): Promise<void> {
  const blob = await gerarPDFAcompanhamentoPublico(dados);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `OS-${dados.numeroOS}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
