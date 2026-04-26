import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LucroPorItem, ResumoFinanceiro } from "@/types/relatorio";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import {
  formatCurrencyPDF,
  adicionarCabecalhoPDF,
  adicionarRodapePDF,
  adicionarCardsPDF,
  adicionarTituloSecao,
} from "./pdfHelpers";

export const exportarRelatorioPDF = async (
  resumo: ResumoFinanceiro,
  lucros: LucroPorItem[],
  dataInicio: string,
  dataFim: string,
  config?: ConfiguracaoLoja | null
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;

  let y = await adicionarCabecalhoPDF(
    doc,
    config || null,
    "Relatório Financeiro",
    `Período: ${dataInicio} a ${dataFim}`
  );

  // Cards de resumo
  y = adicionarCardsPDF(doc, y, [
    {
      label: "Receita Total",
      value: formatCurrencyPDF(resumo.receitaTotal),
      sub: "Faturamento bruto",
      color: [40, 100, 210],
    },
    {
      label: "Custo Total",
      value: formatCurrencyPDF(resumo.custoTotal),
      sub: `Taxas: ${formatCurrencyPDF(resumo.taxasCartao)}`,
      color: [220, 80, 60],
    },
    {
      label: "Lucro Bruto",
      value: formatCurrencyPDF(resumo.lucroTotal),
      sub: `Margem: ${resumo.margemLucroMedia.toFixed(1)}%`,
      color: [30, 160, 80],
    },
    {
      label: "Lucro Líquido",
      value: formatCurrencyPDF(resumo.lucroLiquido),
      sub: `Op.: ${formatCurrencyPDF(resumo.custoOperacional)}`,
      color: [20, 130, 60],
    },
  ]);

  // Tabela de resumo detalhado
  y = adicionarTituloSecao(doc, y, "Detalhamento Financeiro");

  const resumoData = [
    ["Receita Total", formatCurrencyPDF(resumo.receitaTotal)],
    ["Custo Total (Produtos/Serviços)", formatCurrencyPDF(resumo.custoTotal)],
    ["Taxas de Cartão", formatCurrencyPDF(resumo.taxasCartao)],
    ["Lucro Bruto", formatCurrencyPDF(resumo.lucroTotal)],
    ["Margem de Lucro Média", `${resumo.margemLucroMedia.toFixed(2)}%`],
    ["Custo Operacional (Despesas)", formatCurrencyPDF(resumo.custoOperacional)],
    ["Lucro Líquido", formatCurrencyPDF(resumo.lucroLiquido)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: resumoData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Lucro por Item
  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 20;
  }

  y = adicionarTituloSecao(doc, y, "Lucro por Item");

  const lucrosData = lucros.map((item) => [
    item.nome,
    item.tipo === "dispositivo" ? "Dispositivo" : "Produto",
    item.quantidadeVendida.toString(),
    formatCurrencyPDF(item.receitaTotal),
    formatCurrencyPDF(item.custoTotal),
    formatCurrencyPDF(item.lucroTotal),
    `${item.margemLucro.toFixed(1)}%`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Item", "Tipo", "Qtd", "Receita", "Custo", "Lucro", "Margem"]],
    body: lucrosData.length > 0 ? lucrosData : [["Nenhum item no período", "", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 18, halign: "center" },
    },
  });

  adicionarRodapePDF(doc, config);

  const nomeArquivo = `relatorio-financeiro-${dataInicio}-${dataFim}.pdf`;
  doc.save(nomeArquivo);
};
