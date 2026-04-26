import jsPDF from 'jspdf';
import { CompraDispositivo, OrigemPessoa } from '@/types/origem';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface DadosLoja {
  nome_loja: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
}

interface DadosDispositivo {
  marca: string;
  modelo: string;
  cor?: string;
  imei?: string;
  numero_serie?: string;
  capacidade_gb?: number;
}

export async function gerarTermoCompraPDF(
  compra: Partial<CompraDispositivo>,
  pessoa: OrigemPessoa,
  dadosLoja: DadosLoja,
  dispositivo: DadosDispositivo
) {
  const doc = new jsPDF();
  const margemEsquerda = 20;
  const margemDireita = 190;
  const larguraUtil = margemDireita - margemEsquerda;
  let yPos = 20;

  // ===== CABEÇALHO =====
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMO DE COMPRA DE DISPOSITIVO ELETRÔNICO', 105, yPos, { align: 'center' });
  yPos += 10;

  // ===== DADOS DA LOJA =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO ESTABELECIMENTO', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${dadosLoja.nome_loja}`, margemEsquerda, yPos);
  yPos += 5;
  if (dadosLoja.cnpj) {
    doc.text(`CNPJ: ${dadosLoja.cnpj}`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (dadosLoja.endereco) {
    doc.text(`Endereço: ${dadosLoja.endereco}`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (dadosLoja.telefone) {
    doc.text(`Telefone: ${dadosLoja.telefone}`, margemEsquerda, yPos);
    yPos += 5;
  }
  yPos += 5;

  // ===== DADOS DO VENDEDOR =====
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO VENDEDOR', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${pessoa.nome}`, margemEsquerda, yPos);
  yPos += 5;
  if (pessoa.cpf_cnpj) {
    doc.text(`${pessoa.tipo === 'fisica' ? 'CPF' : 'CNPJ'}: ${pessoa.cpf_cnpj}`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (pessoa.rg) {
    doc.text(`RG: ${pessoa.rg}`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (pessoa.telefone) {
    doc.text(`Telefone: ${pessoa.telefone}`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (pessoa.endereco) {
    doc.text(`Endereço: ${pessoa.endereco}`, margemEsquerda, yPos);
    yPos += 5;
  }
  yPos += 5;

  // ===== DADOS DO DISPOSITIVO =====
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIÇÃO DO DISPOSITIVO', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Marca: ${dispositivo.marca}`, margemEsquerda, yPos);
  yPos += 5;
  doc.text(`Modelo: ${dispositivo.modelo}`, margemEsquerda, yPos);
  yPos += 5;
  if (dispositivo.cor) {
    doc.text(`Cor: ${dispositivo.cor}`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (dispositivo.capacidade_gb) {
    doc.text(`Capacidade: ${dispositivo.capacidade_gb}GB`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (dispositivo.imei) {
    doc.text(`IMEI: ${dispositivo.imei}`, margemEsquerda, yPos);
    yPos += 5;
  }
  if (dispositivo.numero_serie) {
    doc.text(`Número de Série: ${dispositivo.numero_serie}`, margemEsquerda, yPos);
    yPos += 5;
  }
  yPos += 5;

  // ===== DADOS DA COMPRA =====
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMAÇÕES DA TRANSAÇÃO', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  const dataCompra = compra.data_compra 
    ? format(parseISO(compra.data_compra), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) 
    : format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Data da Compra: ${dataCompra}`, margemEsquerda, yPos);
  yPos += 5;
  doc.text(`Valor Pago: R$ ${(compra.valor_pago || 0).toFixed(2)}`, margemEsquerda, yPos);
  yPos += 5;
  if (compra.forma_pagamento) {
    doc.text(`Forma de Pagamento: ${formatarFormaPagamento(compra.forma_pagamento)}`, margemEsquerda, yPos);
    yPos += 5;
  }
  doc.text(`Condição do Aparelho: ${compra.condicao_aparelho || 'usado'}`, margemEsquerda, yPos);
  yPos += 5;
  if (compra.situacao_conta) {
    doc.text(`Situação de Conta: ${compra.situacao_conta}`, margemEsquerda, yPos);
    yPos += 5;
  }
  yPos += 10;

  // ===== DECLARAÇÃO LEGAL =====
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARAÇÃO', margemEsquerda, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  const declaracao = [
    `Eu, ${pessoa.nome}, portador(a) do ${pessoa.tipo === 'fisica' ? 'CPF' : 'CNPJ'} ${pessoa.cpf_cnpj || '[não informado]'}, declaro para os devidos fins que:`,
    '',
    '1. Sou o(a) legítimo(a) proprietário(a) do dispositivo eletrônico descrito acima;',
    '',
    '2. O referido dispositivo não foi adquirido através de roubo, furto ou receptação;',
    '',
    '3. O dispositivo não possui nenhuma restrição judicial, não está financiado e não possui pendências junto a operadoras;',
    '',
    '4. Não existe qualquer impedimento legal para a comercialização do referido bem;',
    '',
    '5. Declaro ciência de que a falsidade desta declaração pode acarretar responsabilização civil e criminal.',
  ];

  doc.setFontSize(9);
  declaracao.forEach(linha => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    const linhasQuebradas = doc.splitTextToSize(linha, larguraUtil);
    doc.text(linhasQuebradas, margemEsquerda, yPos);
    yPos += 5 * linhasQuebradas.length;
  });

  yPos += 10;

  // ===== ASSINATURAS =====
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(10);
  const cidade = pessoa.cidade || pessoa.endereco?.split(',')[0] || '[Cidade]';
  doc.text(`${cidade}, ${dataCompra}`, margemEsquerda, yPos);
  yPos += 20;

  // Linha de assinatura do vendedor
  doc.line(margemEsquerda, yPos, margemEsquerda + 70, yPos);
  yPos += 5;
  doc.setFontSize(9);
  doc.text(pessoa.nome, margemEsquerda, yPos);
  yPos += 4;
  doc.text(`${pessoa.tipo === 'fisica' ? 'CPF' : 'CNPJ'}: ${pessoa.cpf_cnpj || '[não informado]'}`, margemEsquerda, yPos);

  // Linha de assinatura da loja (à direita)
  yPos -= 9;
  doc.setFontSize(10);
  doc.line(margemDireita - 70, yPos, margemDireita, yPos);
  yPos += 5;
  doc.setFontSize(9);
  doc.text(dadosLoja.nome_loja, margemDireita - 70, yPos);
  yPos += 4;
  if (dadosLoja.cnpj) {
    doc.text(`CNPJ: ${dadosLoja.cnpj}`, margemDireita - 70, yPos);
  }

  return doc;
}

function formatarFormaPagamento(forma: string): string {
  const formas: Record<string, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    cartao_debito: 'Cartão de Débito',
    cartao_credito: 'Cartão de Crédito',
    transferencia: 'Transferência Bancária',
    boleto: 'Boleto'
  };
  return formas[forma] || forma;
}

export async function salvarTermoStorage(pdf: jsPDF, compraId: string): Promise<string> {
  const pdfBlob = pdf.output('blob');
  const fileName = `termo-compra-${compraId}-${Date.now()}.pdf`;
  
  // Upload para Supabase Storage
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const filePath = `${user.id}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('termos-compra')
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Generate signed URL (bucket is now private)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('termos-compra')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  if (urlError || !urlData?.signedUrl) {
    throw new Error('Erro ao gerar URL do termo');
  }

  return urlData.signedUrl;
}
