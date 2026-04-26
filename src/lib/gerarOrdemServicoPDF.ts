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

export async function gerarOrdemServicoPDF(
  ordem: OrdemServico,
  loja?: ConfiguracaoLoja
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

  // ===== LOGO DA LOJA =====
  if (layoutConfig.mostrar_logo_whatsapp && loja?.logo_url) {
    try {
      // Tentar adicionar a logo
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            
            // Calcular proporção da logo
            const maxWidth = 40;
            const maxHeight = 20;
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
            
            doc.addImage(dataUrl, 'PNG', margemEsquerda, yPos - 5, width, height);
            resolve();
          } catch (e) {
            console.error('Erro ao processar logo:', e);
            resolve();
          }
        };
        img.onerror = () => {
          console.error('Erro ao carregar logo');
          resolve();
        };
        img.src = loja.logo_url!;
      });
    } catch (e) {
      console.error('Erro ao adicionar logo:', e);
    }
  }

  // ===== CABEÇALHO =====
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', 105, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${ordem.numero_os}`, 105, yPos, { align: 'center' });
  yPos += 10;

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

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Status: ${statusMap[ordem.status || ''] || ordem.status}`, margemEsquerda, yPos);
  doc.text(`Data: ${formatarDataHoraBrasil(ordem.created_at)}`, 120, yPos);
  yPos += 10;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 8;

  // ===== DADOS DA LOJA =====
  if (loja) {
    verificarNovaPagina(35);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTABELECIMENTO', margemEsquerda, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(loja.nome_loja, margemEsquerda, yPos);
    if (loja.cnpj) doc.text(`CNPJ: ${loja.cnpj}`, 120, yPos);
    yPos += 5;

    if (loja.telefone || loja.whatsapp) {
      if (loja.telefone) doc.text(`Tel: ${loja.telefone}`, margemEsquerda, yPos);
      if (loja.whatsapp) doc.text(`WhatsApp: ${loja.whatsapp}`, 100, yPos);
      yPos += 5;
    }

    let endereco = '';
    if (loja.logradouro && loja.numero) {
      endereco = `${loja.logradouro}, ${loja.numero}`;
      if (loja.complemento) endereco += ` - ${loja.complemento}`;
      if (loja.bairro) endereco += `, ${loja.bairro}`;
      if (loja.cidade && loja.estado) endereco += ` - ${loja.cidade}/${loja.estado}`;
    } else if (loja.endereco) {
      endereco = loja.endereco;
    }
    if (endereco) {
      const linhas = doc.splitTextToSize(`Endereço: ${endereco}`, larguraUtil);
      linhas.forEach((linha: string) => {
        doc.text(linha, margemEsquerda, yPos);
        yPos += 4;
      });
    }

    yPos += 4;
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  }

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

    const tipoAvariaLabels: Record<string, string> = {
      riscos: 'Riscos',
      trinca: 'Trinca',
      amassado: 'Amassado',
      quebrado: 'Quebrado',
      outro: 'Outro'
    };

    const tipoAvariaCores: Record<string, [number, number, number]> = {
      riscos: [239, 68, 68],      // red
      trinca: [249, 115, 22],     // orange
      amassado: [234, 179, 8],    // yellow
      quebrado: [168, 85, 247],   // purple
      outro: [59, 130, 246]       // blue
    };

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

    // Total
    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL:', margemEsquerda, yPos);
    doc.text(formatarMoeda(ordem.total || 0), margemDireita, yPos, { align: 'right' });
    yPos += 5;

    yPos += 4;
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 8;
  }

  // ===== TERMO DE GARANTIA =====
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
