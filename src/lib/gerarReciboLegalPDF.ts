import jsPDF from 'jspdf';
import { CompraDispositivo, OrigemPessoa } from '@/types/origem';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface DadosLoja {
  nome_loja: string;
  razao_social?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  site?: string;
}

interface DadosDispositivo {
  tipo: string;
  marca: string;
  modelo: string;
  cor?: string;
  imei?: string;
  numero_serie?: string;
  capacidade_gb?: number;
  condicao: string;
  checklist?: Record<string, boolean>;
}

interface DadosReciboCompleto {
  loja: DadosLoja;
  vendedor: Partial<OrigemPessoa> & { nome: string };
  dispositivo: DadosDispositivo;
  compra: Partial<CompraDispositivo>;
}

// Função para formatar data/hora no horário de Brasília
const formatarDataHoraBrasil = (dataISO: string, incluirSegundos = false): string => {
  try {
    const data = parseISO(dataISO);
    const formatoHora = incluirSegundos ? "dd/MM/yyyy 'às' HH:mm:ss" : "dd/MM/yyyy 'às' HH:mm";
    return format(data, formatoHora, { locale: ptBR });
  } catch {
    return format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  }
};

export async function gerarReciboLegalPDF(dados: DadosReciboCompleto) {
  const doc = new jsPDF();
  const margemEsquerda = 15;
  const margemDireita = 195;
  const larguraUtil = margemDireita - margemEsquerda;
  let yPos = 20;

  // Função para verificar nova página
  const verificarNovaPagina = (espacoNecessario: number = 20) => {
    if (yPos + espacoNecessario > 280) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Formatar data com hora (usando horário local do navegador)
  const agora = new Date();
  const dataCompra = dados.compra.data_compra 
    ? formatarDataHoraBrasil(dados.compra.data_compra)
    : format(agora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // Formatar valor monetário
  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // ===== CABEÇALHO =====
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE COMPRA E VENDA DE DISPOSITIVO ELETRÔNICO', 105, yPos, { align: 'center' });
  yPos += 12;

  // ===== SEÇÃO 1: DADOS DO ESTABELECIMENTO =====
  verificarNovaPagina(40);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. ESTABELECIMENTO COMPRADOR', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Linha 1: Nome e CNPJ
  doc.text(`Nome: ${dados.loja.nome_loja}`, margemEsquerda, yPos);
  if (dados.loja.cnpj) {
    doc.text(`CNPJ: ${dados.loja.cnpj}`, 120, yPos);
  }
  yPos += 5;
  
  // Linha 2: Telefone
  if (dados.loja.telefone) {
    doc.text(`Telefone: ${dados.loja.telefone}`, margemEsquerda, yPos);
    yPos += 5;
  }
  
  // Endereço completo
  let enderecoLoja = '';
  if (dados.loja.logradouro && dados.loja.numero) {
    enderecoLoja = `${dados.loja.logradouro}, ${dados.loja.numero}`;
    if (dados.loja.complemento) enderecoLoja += ` - ${dados.loja.complemento}`;
    if (dados.loja.bairro) enderecoLoja += `, ${dados.loja.bairro}`;
    if (dados.loja.cidade && dados.loja.estado) enderecoLoja += ` - ${dados.loja.cidade}/${dados.loja.estado}`;
    if (dados.loja.cep) enderecoLoja += ` - CEP: ${dados.loja.cep}`;
  } else if (dados.loja.endereco) {
    enderecoLoja = dados.loja.endereco;
  }
  
  if (enderecoLoja) {
    const linhasEndereco = doc.splitTextToSize(`Endereço: ${enderecoLoja}`, larguraUtil - 5);
    linhasEndereco.forEach((linha: string) => {
      doc.text(linha, margemEsquerda, yPos);
      yPos += 4;
    });
  }
  
  yPos += 4;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 6;

  // ===== SEÇÃO 2: DADOS DO VENDEDOR =====
  verificarNovaPagina(40);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('2. VENDEDOR DO DISPOSITIVO', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Linha 1: Nome e CPF/CNPJ
  doc.text(`Nome: ${dados.vendedor.nome}`, margemEsquerda, yPos);
  if (dados.vendedor.cpf_cnpj) {
    doc.text(`${dados.vendedor.tipo === 'fisica' ? 'CPF' : 'CNPJ'}: ${dados.vendedor.cpf_cnpj}`, 120, yPos);
  }
  yPos += 5;
  
  // Linha 2: RG e Telefone
  if (dados.vendedor.rg || dados.vendedor.telefone) {
    if (dados.vendedor.rg) {
      doc.text(`RG: ${dados.vendedor.rg}`, margemEsquerda, yPos);
    }
    if (dados.vendedor.telefone) {
      doc.text(`Telefone: ${dados.vendedor.telefone}`, 120, yPos);
    }
    yPos += 5;
  }
  
  // Endereço do vendedor
  if (dados.vendedor.endereco) {
    const linhasEndVendedor = doc.splitTextToSize(`Endereço: ${dados.vendedor.endereco}`, larguraUtil - 5);
    linhasEndVendedor.forEach((linha: string) => {
      doc.text(linha, margemEsquerda, yPos);
      yPos += 4;
    });
  }
  
  yPos += 4;
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 6;

  // ===== SEÇÃO 3: DESCRIÇÃO DO DISPOSITIVO =====
  verificarNovaPagina(30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('3. DESCRIÇÃO DO DISPOSITIVO', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Linha 1: Marca e Modelo
  doc.text(`Marca: ${dados.dispositivo.marca}`, margemEsquerda, yPos);
  doc.text(`Modelo: ${dados.dispositivo.modelo}`, 120, yPos);
  yPos += 5;
  
  // Linha 2: Cor e Capacidade
  if (dados.dispositivo.cor || dados.dispositivo.capacidade_gb) {
    if (dados.dispositivo.cor) {
      doc.text(`Cor: ${dados.dispositivo.cor}`, margemEsquerda, yPos);
    }
    if (dados.dispositivo.capacidade_gb) {
      doc.text(`Capacidade: ${dados.dispositivo.capacidade_gb}GB`, 120, yPos);
    }
    yPos += 5;
  }
  
  // Linha 3: IMEI
  if (dados.dispositivo.imei) {
    doc.text(`IMEI: ${dados.dispositivo.imei}`, margemEsquerda, yPos);
    yPos += 5;
  }
  
  // Linha 4: Número de Série
  if (dados.dispositivo.numero_serie) {
    doc.text(`Número de Série: ${dados.dispositivo.numero_serie}`, margemEsquerda, yPos);
    yPos += 5;
  }
  
  yPos += 4;
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 6;

  // ===== SEÇÃO 4: DADOS DA TRANSAÇÃO =====
  verificarNovaPagina(30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('4. DADOS DA TRANSAÇÃO', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Linha 1: Data e Valor
  doc.text(`Data: ${dataCompra}`, margemEsquerda, yPos);
  doc.text(`Valor: ${formatarMoeda(dados.compra.valor_pago || 0)}`, 120, yPos);
  yPos += 5;
  
  // Linha 2: Forma de Pagamento e Condição
  if (dados.compra.forma_pagamento || dados.compra.condicao_aparelho) {
    const formasPagamento: Record<string, string> = {
      'pix': 'PIX',
      'dinheiro': 'Dinheiro',
      'cartao_debito': 'Cartão de Débito',
      'cartao_credito': 'Cartão de Crédito',
      'transferencia': 'Transferência Bancária',
      'boleto': 'Boleto Bancário'
    };
    
    if (dados.compra.forma_pagamento) {
      doc.text(`Pagamento: ${formasPagamento[dados.compra.forma_pagamento] || dados.compra.forma_pagamento}`, margemEsquerda, yPos);
    }
    if (dados.compra.condicao_aparelho) {
      doc.text(`Condição: ${dados.compra.condicao_aparelho}`, 120, yPos);
    }
    yPos += 5;
  }
  
  // Linha 3: Situação da conta
  if (dados.compra.situacao_conta) {
    doc.text(`Situação da Conta: ${dados.compra.situacao_conta}`, margemEsquerda, yPos);
    yPos += 5;
  }
  
  yPos += 4;
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 6;

  // ===== SEÇÃO 5: DECLARAÇÃO DO VENDEDOR =====
  verificarNovaPagina(50);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('5. DECLARAÇÃO DO VENDEDOR', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const declaracaoIntro = `Eu, ${dados.vendedor.nome}, ${dados.vendedor.tipo === 'fisica' ? 'CPF' : 'CNPJ'} ${dados.vendedor.cpf_cnpj || 'não informado'}, declaro sob penas da lei que:`;
  const linhasIntro = doc.splitTextToSize(declaracaoIntro, larguraUtil - 5);
  linhasIntro.forEach((linha: string) => {
    doc.text(linha, margemEsquerda, yPos);
    yPos += 5;
  });
  
  yPos += 2;
  
  const declaracoes = [
    '• Sou legítimo proprietário do dispositivo descrito;',
    '• O dispositivo não foi adquirido por meios ilícitos (roubo, furto ou receptação);',
    '• Não possui restrições judiciais, financiamento pendente ou débitos com operadoras;',
    '• Não há impedimentos legais para sua comercialização;',
    '• Estou ciente de que falsidade ideológica implica em responsabilização civil e criminal.'
  ];
  
  declaracoes.forEach(texto => {
    verificarNovaPagina(10);
    const linhas = doc.splitTextToSize(texto, larguraUtil - 10);
    linhas.forEach((linha: string) => {
      doc.text(linha, margemEsquerda + 3, yPos);
      yPos += 5;
    });
  });
  
  yPos += 4;
  doc.line(margemEsquerda, yPos, margemDireita, yPos);
  yPos += 6;

  // ===== SEÇÃO 6: DOCUMENTOS DO VENDEDOR (se houver) =====
  let secaoAtual = 6;
  const documentoFrente = dados.compra.documento_vendedor_frente;
  const documentoVerso = dados.compra.documento_vendedor_verso;
  
  if (documentoFrente || documentoVerso) {
    verificarNovaPagina(60);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${secaoAtual}. DOCUMENTO DO VENDEDOR`, margemEsquerda, yPos);
    yPos += 8;
    
    const larguraDoc = 75;
    const alturaDoc = 50;
    
    // Documento frente
    if (documentoFrente && !documentoFrente.toLowerCase().endsWith('.pdf')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Frente:', margemEsquerda, yPos);
      yPos += 3;
      
      try {
        doc.addImage(documentoFrente, 'JPEG', margemEsquerda, yPos, larguraDoc, alturaDoc);
      } catch (error) {
        console.warn('Erro ao adicionar documento frente:', error);
        doc.setDrawColor(200);
        doc.setFillColor(245, 245, 245);
        doc.rect(margemEsquerda, yPos, larguraDoc, alturaDoc, 'FD');
        doc.setFontSize(7);
        doc.text('Documento Frente', margemEsquerda + larguraDoc/2, yPos + alturaDoc/2, { align: 'center' });
      }
      yPos += alturaDoc + 5;
    } else if (documentoFrente && documentoFrente.toLowerCase().endsWith('.pdf')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Frente: [Arquivo PDF - Ver anexo]', margemEsquerda, yPos);
      yPos += 5;
    }
    
    // Documento verso
    if (documentoVerso && !documentoVerso.toLowerCase().endsWith('.pdf')) {
      verificarNovaPagina(60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Verso:', margemEsquerda, yPos);
      yPos += 3;
      
      try {
        doc.addImage(documentoVerso, 'JPEG', margemEsquerda, yPos, larguraDoc, alturaDoc);
      } catch (error) {
        console.warn('Erro ao adicionar documento verso:', error);
        doc.setDrawColor(200);
        doc.setFillColor(245, 245, 245);
        doc.rect(margemEsquerda, yPos, larguraDoc, alturaDoc, 'FD');
        doc.setFontSize(7);
        doc.text('Documento Verso', margemEsquerda + larguraDoc/2, yPos + alturaDoc/2, { align: 'center' });
      }
      yPos += alturaDoc + 5;
    } else if (documentoVerso && documentoVerso.toLowerCase().endsWith('.pdf')) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Verso: [Arquivo PDF - Ver anexo]', margemEsquerda, yPos);
      yPos += 5;
    }
    
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 6;
    
    secaoAtual++;
  }

  // ===== SEÇÃO: FOTOS DO DISPOSITIVO (se houver) =====
  const fotos = dados.compra.fotos as string[] | undefined;
  
  if (fotos && fotos.length > 0) {
    verificarNovaPagina(80);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${secaoAtual}. FOTOS DO DISPOSITIVO`, margemEsquerda, yPos);
    yPos += 8;
    
    const fotosPorLinha = 3;
    const larguraFoto = 55;
    const alturaFoto = 45;
    const espacoEntre = 5;
    
    for (let i = 0; i < fotos.length; i++) {
      const coluna = i % fotosPorLinha;
      const novaLinha = coluna === 0 && i > 0;
      
      if (novaLinha) {
        yPos += alturaFoto + espacoEntre;
        verificarNovaPagina(alturaFoto + 10);
      }
      
      const xFoto = margemEsquerda + (coluna * (larguraFoto + espacoEntre));
      
      try {
        // Adiciona a imagem ao PDF
        doc.addImage(fotos[i], 'JPEG', xFoto, yPos, larguraFoto, alturaFoto);
      } catch (error) {
        console.warn(`Erro ao adicionar foto ${i + 1}:`, error);
        // Se falhar, desenha um placeholder
        doc.setDrawColor(200);
        doc.setFillColor(245, 245, 245);
        doc.rect(xFoto, yPos, larguraFoto, alturaFoto, 'FD');
        doc.setFontSize(7);
        doc.text(`Foto ${i + 1}`, xFoto + larguraFoto/2, yPos + alturaFoto/2, { align: 'center' });
      }
    }
    
    // Ajusta yPos após as fotos
    const linhasFotos = Math.ceil(fotos.length / fotosPorLinha);
    yPos += (linhasFotos > 0 ? alturaFoto : 0) + 8;
    
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 6;
    
    secaoAtual++;
  }

  // ===== SEÇÃO: OBSERVAÇÕES (se houver) =====
  if (dados.compra.observacoes) {
    verificarNovaPagina(25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${secaoAtual}. OBSERVAÇÕES`, margemEsquerda, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    const linhasObs = doc.splitTextToSize(dados.compra.observacoes, larguraUtil - 5);
    linhasObs.forEach((linha: string) => {
      verificarNovaPagina(8);
      doc.text(linha, margemEsquerda, yPos);
      yPos += 5;
    });
    
    yPos += 4;
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 6;
    
    secaoAtual++;
  }

  // ===== SEÇÃO: ASSINATURAS DIGITAIS =====
  const temAssinaturaDigital = dados.compra.assinatura_vendedor || dados.compra.assinatura_cliente;
  
  if (temAssinaturaDigital) {
    verificarNovaPagina(70);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${secaoAtual}. ASSINATURAS DIGITAIS`, margemEsquerda, yPos);
    yPos += 8;
    
    const larguraAssinatura = 70;
    const alturaAssinatura = 35;
    
    // Assinatura do Funcionário/Vendedor da loja
    if (dados.compra.assinatura_vendedor) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Funcionário Responsável:', margemEsquerda, yPos);
      yPos += 4;
      
      try {
        doc.addImage(dados.compra.assinatura_vendedor, 'PNG', margemEsquerda, yPos, larguraAssinatura, alturaAssinatura);
      } catch (error) {
        console.warn('Erro ao adicionar assinatura do funcionário:', error);
      }
      
      yPos += alturaAssinatura + 2;
      doc.setFontSize(7);
      doc.setTextColor(100);
      if (dados.compra.assinatura_vendedor_ip) {
        doc.text(`IP: ${dados.compra.assinatura_vendedor_ip}`, margemEsquerda, yPos);
      }
      if (dados.compra.assinatura_vendedor_data) {
        const dataAssinatura = formatarDataHoraBrasil(dados.compra.assinatura_vendedor_data, true);
        doc.text(`Data: ${dataAssinatura}`, margemEsquerda + 50, yPos);
      } else {
        // Se não tiver data salva, usa a data/hora atual
        const dataAssinatura = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
        doc.text(`Data: ${dataAssinatura}`, margemEsquerda + 50, yPos);
      }
      doc.setTextColor(0);
      yPos += 8;
    }
    
    // Assinatura do Vendedor/Cliente
    if (dados.compra.assinatura_cliente) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Vendedor do Dispositivo (${dados.vendedor.nome}):`, margemEsquerda, yPos);
      yPos += 4;
      
      try {
        doc.addImage(dados.compra.assinatura_cliente, 'PNG', margemEsquerda, yPos, larguraAssinatura, alturaAssinatura);
      } catch (error) {
        console.warn('Erro ao adicionar assinatura do cliente:', error);
      }
      
      yPos += alturaAssinatura + 2;
      doc.setFontSize(7);
      doc.setTextColor(100);
      if (dados.compra.assinatura_cliente_ip) {
        doc.text(`IP: ${dados.compra.assinatura_cliente_ip}`, margemEsquerda, yPos);
      }
      if (dados.compra.assinatura_cliente_data) {
        const dataAssinatura = formatarDataHoraBrasil(dados.compra.assinatura_cliente_data, true);
        doc.text(`Data: ${dataAssinatura}`, margemEsquerda + 50, yPos);
      } else {
        // Se não tiver data salva, usa a data/hora atual
        const dataAssinatura = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
        doc.text(`Data: ${dataAssinatura}`, margemEsquerda + 50, yPos);
      }
      doc.setTextColor(0);
      yPos += 8;
    }
    
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margemEsquerda, yPos, margemDireita, yPos);
    yPos += 6;
    
    secaoAtual++;
  }

  // ===== SEÇÃO FINAL: ASSINATURAS FÍSICAS =====
  verificarNovaPagina(50);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${secaoAtual}. ASSINATURAS`, margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Local e data
  const cidadeAssinatura = dados.loja.cidade || dados.vendedor.cidade || 'Local não informado';
  doc.text(`${cidadeAssinatura}, ${dataCompra}`, margemEsquerda, yPos);
  yPos += 18;
  
  // Posições das assinaturas
  const xVendedor = margemEsquerda;
  const xComprador = 115;
  const larguraLinha = 75;
  
  // Linhas de assinatura
  doc.setLineWidth(0.5);
  doc.line(xVendedor, yPos, xVendedor + larguraLinha, yPos);
  doc.line(xComprador, yPos, xComprador + larguraLinha, yPos);
  
  yPos += 5;
  doc.setFontSize(8);
  
  // Info vendedor
  doc.text(dados.vendedor.nome, xVendedor, yPos);
  doc.text(dados.loja.nome_loja, xComprador, yPos);
  yPos += 4;
  
  doc.text(`${dados.vendedor.tipo === 'fisica' ? 'CPF' : 'CNPJ'}: ${dados.vendedor.cpf_cnpj || 'Não informado'}`, xVendedor, yPos);
  if (dados.loja.cnpj) {
    doc.text(`CNPJ: ${dados.loja.cnpj}`, xComprador, yPos);
  }
  yPos += 4;
  
  doc.setFont('helvetica', 'bold');
  doc.text('VENDEDOR', xVendedor, yPos);
  doc.text('COMPRADOR', xComprador, yPos);
  
  yPos += 10;

  // ===== RODAPÉ =====
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado eletronicamente com validade legal. Partes cientes de direitos e obrigações.', 105, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  return doc;
}

export async function salvarReciboStorage(pdf: jsPDF, compraId: string): Promise<string> {
  const pdfBlob = pdf.output('blob');
  const fileName = `recibo-legal-${compraId}-${Date.now()}.pdf`;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const filePath = `${user.id}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('termos-compra')
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false,
      // Força o download ao invés de abrir no navegador
      duplex: 'half'
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('termos-compra')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
