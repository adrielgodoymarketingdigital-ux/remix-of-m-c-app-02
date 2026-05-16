import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import {
  formatCurrencyPDF,
  adicionarCabecalhoPDF,
  adicionarRodapePDF,
  adicionarCardsPDF,
  adicionarTituloSecao,
} from "./pdfHelpers";

const DATA_HOJE = () => new Date().toISOString().split("T")[0];
const fmtData = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
};

// ==================== OS ====================

export interface OSExportItem {
  numero_os: string;
  cliente: string;
  servico: string;
  status: string;
  total: number;
  data_entrada: string;
  data_saida?: string | null;
}

export async function gerarRelatorioOSPDF(
  ordens: OSExportItem[],
  config: ConfiguracaoLoja | null,
  periodo: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 15;

  let y = await adicionarCabecalhoPDF(doc, config, "Relatório de Ordens de Serviço", `Período: ${periodo}`);

  const total = ordens.reduce((a, o) => a + o.total, 0);
  const concluidas = ordens.filter(o => ["finalizado", "entregue"].includes(o.status)).length;
  const abertas = ordens.filter(o => !["finalizado", "entregue", "cancelado"].includes(o.status)).length;
  const canceladas = ordens.filter(o => o.status === "cancelado").length;

  y = adicionarCardsPDF(doc, y, [
    { label: "Total de OS", value: ordens.length.toString(), sub: "No período", color: [50, 50, 50] },
    { label: "Concluídas", value: concluidas.toString(), sub: "Finalizadas/Entregues", color: [30, 160, 80] },
    { label: "Abertas", value: abertas.toString(), sub: "Em andamento", color: [40, 100, 210] },
    { label: "Receita Total", value: formatCurrencyPDF(total), sub: "Em OS", color: [140, 80, 200] },
  ]);

  if (canceladas > 0) {
    doc.setFontSize(8);
    doc.setTextColor(180, 40, 40);
    doc.text(`* ${canceladas} OS cancelada(s) não incluída(s) no total de receita`, margin, y);
    y += 5;
  }

  y = adicionarTituloSecao(doc, y, "Listagem de Ordens de Serviço");

  const statusLabel: Record<string, string> = {
    aguardando: "Aguardando",
    em_andamento: "Em Andamento",
    finalizado: "Finalizado",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };

  const rows = ordens.map((o) => [
    o.numero_os,
    o.cliente,
    o.servico,
    statusLabel[o.status] ?? o.status,
    fmtData(o.data_entrada),
    o.data_saida ? fmtData(o.data_saida) : "-",
    formatCurrencyPDF(o.total),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["OS", "Cliente", "Serviço", "Status", "Entrada", "Saída", "Total"]],
    body: rows.length > 0 ? rows : [["Nenhuma OS no período", "", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: "auto" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
      6: { cellWidth: 28, halign: "right" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const status = ordens[data.row.index]?.status;
        const cores: Record<string, [number, number, number]> = {
          entregue: [30, 160, 80],
          finalizado: [40, 160, 100],
          cancelado: [180, 40, 40],
          em_andamento: [40, 100, 210],
          aguardando: [160, 120, 30],
        };
        if (cores[status]) {
          doc.setTextColor(...cores[status]);
        }
      }
    },
  });

  adicionarRodapePDF(doc, config);
  doc.save(`relatorio-os-${DATA_HOJE()}.pdf`);
}

// ==================== VENDAS COMPLETAS ====================

export interface VendaExportItem {
  tipo: string;
  descricao: string;
  cliente?: string;
  formaPagamento: string;
  valor: number;
  data: string;
}

export async function gerarRelatorioVendasCompletoPDF(
  vendas: VendaExportItem[],
  config: ConfiguracaoLoja | null,
  periodo: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 15;

  let y = await adicionarCabecalhoPDF(doc, config, "Relatório de Vendas Completo", `Período: ${periodo}`);

  const receitaTotal = vendas.reduce((a, v) => a + v.valor, 0);
  const porTipo = vendas.reduce<Record<string, number>>((acc, v) => {
    acc[v.tipo] = (acc[v.tipo] ?? 0) + v.valor;
    return acc;
  }, {});

  y = adicionarCardsPDF(doc, y, [
    { label: "Total de Vendas", value: vendas.length.toString(), sub: "No período", color: [50, 50, 50] },
    { label: "Receita Total", value: formatCurrencyPDF(receitaTotal), sub: "Todas as vendas", color: [40, 100, 210] },
    { label: "Ticket Médio", value: formatCurrencyPDF(vendas.length > 0 ? receitaTotal / vendas.length : 0), sub: "Por venda", color: [140, 80, 200] },
    { label: "Tipos Distintos", value: Object.keys(porTipo).length.toString(), sub: "Categorias", color: [30, 160, 80] },
  ]);

  // Mini breakdown por tipo
  if (Object.keys(porTipo).length > 0) {
    y = adicionarTituloSecao(doc, y, "Receita por Tipo");
    const tipoLabels: Record<string, string> = {
      dispositivo: "Dispositivos",
      produto: "Produtos",
      servico: "Serviços",
      avulsa: "Vendas Avulsas",
    };
    const tipoRows = Object.entries(porTipo).map(([tipo, valor]) => [
      tipoLabels[tipo] ?? tipo,
      formatCurrencyPDF(valor),
      `${((valor / receitaTotal) * 100).toFixed(1)}%`,
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Receita", "% do Total"]],
      body: tipoRows,
      margin: { left: margin, right: margin },
      tableWidth: 100,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  y = adicionarTituloSecao(doc, y, "Detalhamento de Vendas");

  const formaLabel: Record<string, string> = {
    dinheiro: "Dinheiro", pix: "PIX", cartao_credito: "Cartão Crédito",
    cartao_debito: "Cartão Débito", a_receber: "A Receber", a_prazo: "A Prazo",
  };
  const tipoLabelMap: Record<string, string> = {
    dispositivo: "Dispositivo", produto: "Produto",
    servico: "Serviço", avulsa: "Avulsa",
  };

  const rows = vendas.map((v) => [
    tipoLabelMap[v.tipo] ?? v.tipo,
    v.descricao,
    v.cliente ?? "-",
    formaLabel[v.formaPagamento] ?? v.formaPagamento,
    fmtData(v.data),
    formatCurrencyPDF(v.valor),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Tipo", "Descrição", "Cliente", "Pagamento", "Data", "Valor"]],
    body: rows.length > 0 ? rows : [["Nenhuma venda no período", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 28, halign: "right" },
    },
  });

  adicionarRodapePDF(doc, config);
  doc.save(`relatorio-vendas-completo-${DATA_HOJE()}.pdf`);
}

// ==================== FINANCEIRO (DRE) ====================

export interface DREExportData {
  receitaTotal: number;
  custoTotal: number;
  lucroTotal: number;
  custoOperacional: number;
  lucroLiquido: number;
  taxasCartao: number;
  margemLucroMedia: number;
  evolucaoMensal: Array<{ mes: string; receita: number; custo: number; lucro: number }>;
}

export async function gerarRelatorioFinanceiroPDF(
  dados: DREExportData,
  config: ConfiguracaoLoja | null,
  periodo: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = await adicionarCabecalhoPDF(doc, config, "Relatório Financeiro — DRE", `Período: ${periodo}`);

  y = adicionarCardsPDF(doc, y, [
    { label: "Receita Total", value: formatCurrencyPDF(dados.receitaTotal), sub: "Vendas + OS + Receitas", color: [40, 100, 210] },
    { label: "Lucro Bruto", value: formatCurrencyPDF(dados.lucroTotal), sub: "Receita - Custo Direto", color: [30, 160, 80] },
    { label: "Lucro Líquido", value: formatCurrencyPDF(dados.lucroLiquido), sub: "Bruto - Operacional", color: dados.lucroLiquido >= 0 ? [20, 140, 60] : [180, 40, 40] },
    { label: "Margem", value: `${dados.margemLucroMedia.toFixed(1)}%`, sub: "Margem bruta", color: [140, 80, 200] },
  ]);

  // DRE em formato de demonstração
  y = adicionarTituloSecao(doc, y, "Demonstração de Resultado (DRE)");

  const dreRows = [
    ["(+) Receita Total", formatCurrencyPDF(dados.receitaTotal), ""],
    ["(-) Custo de Produtos/Serviços", formatCurrencyPDF(dados.custoTotal), ""],
    ["(-) Taxas de Cartão", formatCurrencyPDF(dados.taxasCartao), ""],
    ["(=) Lucro Bruto", formatCurrencyPDF(dados.lucroTotal), `${dados.margemLucroMedia.toFixed(1)}%`],
    ["(-) Custos Operacionais", formatCurrencyPDF(dados.custoOperacional), ""],
    ["(=) Lucro Líquido", formatCurrencyPDF(dados.lucroLiquido), dados.receitaTotal > 0 ? `${((dados.lucroLiquido / dados.receitaTotal) * 100).toFixed(1)}%` : "-"],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Valor (R$)", "Margem"]],
    body: dreRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "right" },
      2: { cellWidth: 25, halign: "right" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && (data.row.index === 3 || data.row.index === 5)) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  if (dados.evolucaoMensal.length > 0) {
    y = adicionarTituloSecao(doc, y, "Evolução Mensal");

    const mesesLabel: Record<string, string> = {
      "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
      "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
    };

    const evolRows = dados.evolucaoMensal.map((m) => {
      const [ano, mes] = m.mes.split("-");
      return [
        `${mesesLabel[mes] ?? mes}/${ano}`,
        formatCurrencyPDF(m.receita),
        formatCurrencyPDF(m.custo),
        formatCurrencyPDF(m.lucro),
        m.receita > 0 ? `${((m.lucro / m.receita) * 100).toFixed(1)}%` : "-",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Mês", "Receita", "Custo Total", "Lucro", "Margem"]],
      body: evolRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 38, halign: "right" },
        2: { cellWidth: 38, halign: "right" },
        3: { cellWidth: 38, halign: "right" },
        4: { cellWidth: 22, halign: "right" },
      },
    });
  }

  // Linha de total da evolução no rodapé do gráfico
  const totalEvolReceita = dados.evolucaoMensal.reduce((a, m) => a + m.receita, 0);
  if (totalEvolReceita > 0) {
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`* Totais da evolução mensal podem diferir dos cards acima devido a arredondamentos por competência.`, margin, y);
  }

  adicionarRodapePDF(doc, config);
  doc.save(`relatorio-financeiro-${DATA_HOJE()}.pdf`);
}

// ==================== CLIENTES ====================

export interface ClienteExportItem {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  totalOS: number;
  totalGasto: number;
  ultimaVisita?: string | null;
}

export async function gerarRelatorioClientesPDF(
  clientes: ClienteExportItem[],
  config: ConfiguracaoLoja | null,
  periodo: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 15;

  let y = await adicionarCabecalhoPDF(doc, config, "Relatório de Clientes", `Período: ${periodo}`);

  const totalGasto = clientes.reduce((a, c) => a + c.totalGasto, 0);
  const comCompra = clientes.filter(c => c.totalOS > 0).length;
  const ticketMedio = comCompra > 0 ? totalGasto / comCompra : 0;

  y = adicionarCardsPDF(doc, y, [
    { label: "Total de Clientes", value: clientes.length.toString(), sub: "Cadastrados", color: [50, 50, 50] },
    { label: "Com Compras", value: comCompra.toString(), sub: "No período", color: [40, 100, 210] },
    { label: "Receita de Clientes", value: formatCurrencyPDF(totalGasto), sub: "Total gasto", color: [30, 160, 80] },
    { label: "Ticket Médio", value: formatCurrencyPDF(ticketMedio), sub: "Por cliente ativo", color: [140, 80, 200] },
  ]);

  y = adicionarTituloSecao(doc, y, "Listagem de Clientes");

  const rows = clientes.map((c) => [
    c.nome,
    c.telefone ?? "-",
    c.email ?? "-",
    c.cidade ?? "-",
    c.totalOS.toString(),
    formatCurrencyPDF(c.totalGasto),
    c.ultimaVisita ? fmtData(c.ultimaVisita) : "-",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Nome", "Telefone", "E-mail", "Cidade", "OS/Compras", "Total Gasto", "Última Visita"]],
    body: rows.length > 0 ? rows : [["Nenhum cliente no período", "", "", "", "", "", ""]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30 },
      2: { cellWidth: 40 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 26, halign: "center" },
    },
  });

  adicionarRodapePDF(doc, config);
  doc.save(`relatorio-clientes-${DATA_HOJE()}.pdf`);
}
