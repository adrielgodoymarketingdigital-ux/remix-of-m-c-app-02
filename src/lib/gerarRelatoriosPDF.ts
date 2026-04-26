import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import {
  RelatorioDispositivo,
  RelatorioProduto,
  RelatorioServico,
} from "@/types/relatorio-vendas";
import {
  formatCurrencyPDF,
  adicionarCabecalhoPDF,
  adicionarRodapePDF,
  adicionarCardsPDF,
  adicionarTituloSecao,
} from "./pdfHelpers";

// ==================== DISPOSITIVOS ====================

export async function gerarRelatorioDispositivosPDF(
  dispositivos: RelatorioDispositivo[],
  config: ConfiguracaoLoja | null,
  periodo: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;

  let y = await adicionarCabecalhoPDF(doc, config, "Relatório de Dispositivos Vendidos", `Período: ${periodo}`);

  const totalVendido = dispositivos.reduce((acc, d) => acc + d.quantidadeVendida, 0);
  const receitaTotal = dispositivos.reduce((acc, d) => acc + d.receitaTotal, 0);
  const ticketMedio = totalVendido > 0 ? receitaTotal / totalVendido : 0;
  const lucroTotal = dispositivos.reduce((acc, d) => acc + d.lucroTotal, 0);

  y = adicionarCardsPDF(doc, y, [
    { label: "Total Vendido", value: totalVendido.toString(), sub: "Dispositivos", color: [50, 50, 50] },
    { label: "Receita Total", value: formatCurrencyPDF(receitaTotal), sub: "Em vendas", color: [40, 100, 210] },
    { label: "Lucro Total", value: formatCurrencyPDF(lucroTotal), sub: "Lucro bruto", color: [30, 160, 80] },
    { label: "Ticket Médio", value: formatCurrencyPDF(ticketMedio), sub: "Por dispositivo", color: [140, 80, 200] },
  ]);

  y = adicionarTituloSecao(doc, y, "Detalhamento por Dispositivo");

  const rows = dispositivos.map((d) => [
    d.tipo,
    d.marca,
    d.modelo,
    d.quantidadeVendida.toString(),
    formatCurrencyPDF(d.receitaTotal),
    formatCurrencyPDF(d.lucroTotal),
    formatCurrencyPDF(d.ticketMedio),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Tipo", "Marca", "Modelo", "Qtd.", "Receita", "Lucro", "Ticket Médio"]],
    body: rows.length > 0 ? rows : [["Nenhum dispositivo vendido no período", "", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 30, halign: "right" },
    },
  });

  adicionarRodapePDF(doc, config);
  doc.save(`relatorio-dispositivos-${new Date().toISOString().split("T")[0]}.pdf`);
}

// ==================== PRODUTOS ====================

export async function gerarRelatorioProdutosPDF(
  produtos: RelatorioProduto[],
  config: ConfiguracaoLoja | null,
  periodo: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;

  let y = await adicionarCabecalhoPDF(doc, config, "Relatório de Produtos Vendidos", `Período: ${periodo}`);

  const totalVendido = produtos.reduce((acc, p) => acc + p.quantidadeVendida, 0);
  const receitaTotal = produtos.reduce((acc, p) => acc + p.receitaTotal, 0);
  const lucroTotal = produtos.reduce((acc, p) => acc + p.lucroTotal, 0);
  const ticketMedio = totalVendido > 0 ? receitaTotal / totalVendido : 0;

  y = adicionarCardsPDF(doc, y, [
    { label: "Total Vendido", value: totalVendido.toString(), sub: "Produtos", color: [50, 50, 50] },
    { label: "Receita Total", value: formatCurrencyPDF(receitaTotal), sub: "Em vendas", color: [40, 100, 210] },
    { label: "Lucro Total", value: formatCurrencyPDF(lucroTotal), sub: "Lucro bruto", color: [30, 160, 80] },
    { label: "Ticket Médio", value: formatCurrencyPDF(ticketMedio), sub: "Por produto", color: [140, 80, 200] },
  ]);

  y = adicionarTituloSecao(doc, y, "Detalhamento por Produto");

  const rows = produtos.map((p) => [
    p.nome,
    p.sku || "-",
    p.quantidadeVendida.toString(),
    p.estoqueAtual.toString(),
    formatCurrencyPDF(p.receitaTotal),
    formatCurrencyPDF(p.lucroTotal),
    formatCurrencyPDF(p.ticketMedio),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Nome", "SKU", "Vendidos", "Estoque", "Receita", "Lucro", "Ticket Médio"]],
    body: rows.length > 0 ? rows : [["Nenhum produto vendido no período", "", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
    },
  });

  adicionarRodapePDF(doc, config);
  doc.save(`relatorio-produtos-${new Date().toISOString().split("T")[0]}.pdf`);
}

// ==================== SERVIÇOS ====================

export async function gerarRelatorioServicosPDF(
  servicos: RelatorioServico[],
  config: ConfiguracaoLoja | null,
  periodo: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;

  let y = await adicionarCabecalhoPDF(doc, config, "Relatório de Serviços Realizados", `Período: ${periodo}`);

  const totalRealizado = servicos.reduce((acc, s) => acc + s.quantidadeRealizada, 0);
  const receitaTotal = servicos.reduce((acc, s) => acc + s.receitaTotal, 0);
  const ticketMedio = totalRealizado > 0 ? receitaTotal / totalRealizado : 0;
  const tempoMedio =
    servicos.length > 0
      ? servicos.reduce((acc, s) => acc + s.tempoMedioConclusao, 0) / servicos.length
      : 0;

  y = adicionarCardsPDF(doc, y, [
    { label: "Total Realizados", value: totalRealizado.toString(), sub: "Serviços", color: [50, 50, 50] },
    { label: "Receita Total", value: formatCurrencyPDF(receitaTotal), sub: "Em serviços", color: [40, 100, 210] },
    { label: "Ticket Médio", value: formatCurrencyPDF(ticketMedio), sub: "Por serviço", color: [140, 80, 200] },
    { label: "Tempo Médio", value: `${tempoMedio.toFixed(1)} dias`, sub: "Para conclusão", color: [200, 140, 30] },
  ]);

  y = adicionarTituloSecao(doc, y, "Detalhamento por Serviço");

  const rows = servicos.map((s) => [
    s.nomeServico,
    s.quantidadeRealizada.toString(),
    formatCurrencyPDF(s.receitaTotal),
    s.statusDistribuicao.pendente.toString(),
    s.statusDistribuicao.em_andamento.toString(),
    s.statusDistribuicao.concluido.toString(),
    `${s.tempoMedioConclusao.toFixed(1)} dias`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Serviço", "Realizados", "Receita", "Pendente", "Em Andamento", "Concluído", "Tempo Médio"]],
    body: rows.length > 0 ? rows : [["Nenhum serviço realizado no período", "", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 24, halign: "right" },
    },
  });

  adicionarRodapePDF(doc, config);
  doc.save(`relatorio-servicos-${new Date().toISOString().split("T")[0]}.pdf`);
}
