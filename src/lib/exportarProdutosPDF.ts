import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ItemEstoque } from "@/types/produto";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { descricaoFaixaBaixoPDF, LIMITE_PADRAO_PDF_MENOR_ESTOQUE, situacaoEstoque } from "@/lib/estoque/situacaoEstoque";
import { algumItemComMinimo, limiteDoItem } from "@/lib/estoque/estoqueMinimoItem";
import {
  formatCurrencyPDF,
  adicionarCabecalhoPDF,
  adicionarRodapePDF,
  adicionarCardsPDF,
  adicionarTituloSecao,
} from "./pdfHelpers";
import {
  codigoDoItem,
  mostraCustoELucro,
  totaisGerais,
  type GrupoCategoria,
  type OpcoesCustoLucro,
} from "./produtos/exportarPorCategoria";
import { dataBrasiliaISO } from "./dataBrasilia";

interface CategoriaAgrupada {
  nome: string;
  cor: string;
  items: ItemEstoque[];
  quantidade: number;
  custo: number;
  venda: number;
  lucro: number;
}

function agruparPorCategoria(items: ItemEstoque[]): CategoriaAgrupada[] {
  const map = new Map<string, CategoriaAgrupada>();

  items.forEach((item) => {
    const key = item.categoria_id || "__sem_categoria__";
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      existing.quantidade += item.quantidade;
      existing.custo += item.custo * item.quantidade;
      existing.venda += item.preco * item.quantidade;
      existing.lucro += (item.preco - item.custo) * item.quantidade;
    } else {
      map.set(key, {
        nome: item.categoria_nome || "Sem categoria",
        cor: item.categoria_cor || "#888888",
        items: [item],
        quantidade: item.quantidade,
        custo: item.custo * item.quantidade,
        venda: item.preco * item.quantidade,
        lucro: (item.preco - item.custo) * item.quantidade,
      });
    }
  });

  // Sort: named categories first, then "sem categoria"
  return Array.from(map.values()).sort((a, b) => {
    if (a.nome === "Sem categoria") return 1;
    if (b.nome === "Sem categoria") return -1;
    return a.nome.localeCompare(b.nome);
  });
}

export const exportarMenosEstoquePDF = async (
  items: ItemEstoque[],
  config?: ConfiguracaoLoja | null,
  /** Limite da loja (null/omitido = padrão do PDF: baixo de 1 a 3). */
  limiteBaixo?: number | null
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  const dataGerado = new Date().toLocaleDateString("pt-BR");

  const ordenados = [...items].sort((a, b) => a.quantidade - b.quantidade);
  // Limite de cada linha: mínimo do item > limite da loja > padrão do PDF (1 a 3).
  const situacaoPdf = (quantidade: number, item?: ItemEstoque) =>
    situacaoEstoque(quantidade, limiteDoItem(item?.estoque_minimo, limiteBaixo), LIMITE_PADRAO_PDF_MENOR_ESTOQUE);
  const semEstoque = ordenados.filter((i) => situacaoPdf(i.quantidade, i) === "sem_estoque").length;
  const estoquebaixo = ordenados.filter((i) => situacaoPdf(i.quantidade, i) === "baixo").length;
  // Com mínimo por item, a faixa muda de item para item.
  const subtituloBaixo = algumItemComMinimo(ordenados) ? "pelo mínimo de cada item" : descricaoFaixaBaixoPDF(limiteBaixo);

  let y = await adicionarCabecalhoPDF(
    doc,
    config || null,
    "Produtos com Menor Estoque",
    `Gerado em ${dataGerado} • ${ordenados.length} itens ordenados por quantidade`
  );

  y = adicionarCardsPDF(doc, y, [
    { label: "Total de Itens", value: ordenados.length.toString(), sub: "analisados", color: [50, 50, 50] },
    { label: "Sem Estoque", value: semEstoque.toString(), sub: "quantidade = 0", color: [200, 50, 50] },
    { label: "Estoque Baixo", value: estoquebaixo.toString(), sub: subtituloBaixo, color: [210, 120, 30] },
    {
      label: "Qtd Média",
      value: ordenados.length > 0 ? (ordenados.reduce((s, i) => s + i.quantidade, 0) / ordenados.length).toFixed(1) : "0",
      sub: "unidades",
      color: [40, 100, 210],
    },
  ]);

  y = adicionarTituloSecao(doc, y, "Itens em ordem crescente de estoque");

  const rows = ordenados.map((item, idx) => [
    (idx + 1).toString(),
    item.nome,
    item.tipo === "produto" ? "Produto" : "Peça",
    item.categoria_nome || "—",
    item.quantidade.toString(),
    formatCurrencyPDF(item.preco),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Nome", "Tipo", "Categoria", "Qtd em Estoque", "Preço Unit."]],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [180, 50, 30], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [255, 248, 246] },
    bodyStyles: { textColor: [30, 30, 30] },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 4) {
        const qtd = parseInt(data.cell.text[0] ?? "0", 10);
        if (Number.isNaN(qtd)) return;
        const situacao = situacaoPdf(qtd, ordenados[data.row.index]);
        // Negativo sai em laranja, como "baixo" (igual a antes da regra única).
        if (situacao === "sem_estoque") data.cell.styles.textColor = [200, 30, 30];
        else if (situacao === "baixo" || situacao === "negativo") data.cell.styles.textColor = [180, 100, 0];
      }
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 35 },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 28, halign: "right" },
    },
  });

  adicionarRodapePDF(doc, config);
  const dataAtual = new Date().toISOString().split("T")[0];
  doc.save(`menos-estoque-${dataAtual}.pdf`);
};

export const exportarMaisVendidosPDF = async (
  items: ItemEstoque[],
  contagemVendas: Record<string, number>,
  config?: ConfiguracaoLoja | null
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  const dataGerado = new Date().toLocaleDateString("pt-BR");

  const ordenados = [...items]
    .sort((a, b) => (contagemVendas[b.id] ?? 0) - (contagemVendas[a.id] ?? 0))
    .filter((i) => (contagemVendas[i.id] ?? 0) > 0);

  const semVendas = items.length - ordenados.length;
  const totalVendas = Object.values(contagemVendas).reduce((s, v) => s + v, 0);
  const maisVendido = ordenados[0];

  let y = await adicionarCabecalhoPDF(
    doc,
    config || null,
    "Produtos Mais Vendidos",
    `Gerado em ${dataGerado} • ${ordenados.length} itens com histórico de vendas`
  );

  y = adicionarCardsPDF(doc, y, [
    { label: "Com Vendas", value: ordenados.length.toString(), sub: "itens vendidos", color: [30, 150, 80] },
    { label: "Sem Vendas", value: semVendas.toString(), sub: "nenhuma venda", color: [130, 130, 130] },
    { label: "Total de Vendas", value: totalVendas.toString(), sub: "registros no histórico", color: [40, 100, 210] },
    {
      label: "1° Lugar",
      value: maisVendido ? (contagemVendas[maisVendido.id] ?? 0).toString() : "—",
      sub: maisVendido ? maisVendido.nome.slice(0, 18) : "nenhum",
      color: [180, 130, 20],
    },
  ]);

  y = adicionarTituloSecao(doc, y, "Itens em ordem decrescente de vendas");

  const rows = ordenados.map((item, idx) => [
    (idx + 1).toString(),
    item.nome,
    item.tipo === "produto" ? "Produto" : "Peça",
    item.categoria_nome || "—",
    (contagemVendas[item.id] ?? 0).toString(),
    item.quantidade.toString(),
    formatCurrencyPDF(item.preco),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Nome", "Tipo", "Categoria", "Qtd Vendida", "Estoque Atual", "Preço Unit."]],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 120, 60], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 255, 248] },
    bodyStyles: { textColor: [30, 30, 30] },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 0) {
        const rank = parseInt(data.cell.text[0] ?? "0", 10);
        if (rank === 1) data.cell.styles.fontStyle = "bold";
      }
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 30 },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 24, halign: "center" },
      6: { cellWidth: 26, halign: "right" },
    },
  });

  adicionarRodapePDF(doc, config);
  const dataAtual = new Date().toISOString().split("T")[0];
  doc.save(`mais-vendidos-${dataAtual}.pdf`);
};

export const exportarProdutosPDF = async (
  items: ItemEstoque[],
  config?: ConfiguracaoLoja | null,
  /** Desligado: sem custo, lucro e margem (cards e tabela). Padrão: ligado. */
  opcoes: OpcoesCustoLucro = {}
) => {
  const comCusto = mostraCustoELucro(opcoes);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;

  const produtos = items.filter((i) => i.tipo === "produto");
  const pecas = items.filter((i) => i.tipo === "peca");

  const totalQtd = items.reduce((s, i) => s + i.quantidade, 0);
  const totalCusto = items.reduce((s, i) => s + i.custo * i.quantidade, 0);
  const totalVenda = items.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const totalLucro = totalVenda - totalCusto;

  const dataGerado = new Date().toLocaleDateString("pt-BR");

  let y = await adicionarCabecalhoPDF(
    doc,
    config || null,
    "Relatório de Estoque",
    `Gerado em ${dataGerado} • ${items.length} itens cadastrados`
  );

  // Cards de resumo geral
  const cardTotalEstoque = {
    label: "Total em Estoque",
    value: totalQtd.toString(),
    sub: `${produtos.length} produtos • ${pecas.length} peças`,
    color: [50, 50, 50] as [number, number, number],
  };
  const cardVendaTotal = {
    label: "Venda Total",
    value: formatCurrencyPDF(totalVenda),
    sub: "Valor potencial",
    color: [40, 100, 210] as [number, number, number],
  };
  y = adicionarCardsPDF(doc, y, comCusto ? [
    cardTotalEstoque,
    {
      label: "Custo Total",
      value: formatCurrencyPDF(totalCusto),
      sub: "Valor investido",
      color: [220, 80, 60],
    },
    cardVendaTotal,
    {
      label: "Lucro Potencial",
      value: formatCurrencyPDF(totalLucro),
      sub: totalVenda > 0 ? `Margem: ${((totalLucro / totalVenda) * 100).toFixed(1)}%` : "",
      color: [30, 160, 80],
    },
  ] : [cardTotalEstoque, cardVendaTotal]);

  // Agrupar por categoria
  const categorias = agruparPorCategoria(items);

  categorias.forEach((cat) => {
    // Check if we need a new page (at least 50mm needed for header + a few rows)
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }

    // Category section header
    y = adicionarTituloSecao(doc, y, cat.nome);

    // Mini cards for category
    y = adicionarCardsPDF(doc, y, comCusto ? [
      { label: "Itens", value: cat.quantidade.toString(), color: [80, 80, 80] },
      { label: "Custo", value: formatCurrencyPDF(cat.custo), color: [220, 80, 60] },
      { label: "Venda", value: formatCurrencyPDF(cat.venda), color: [40, 100, 210] },
      { label: "Lucro", value: formatCurrencyPDF(cat.lucro), color: [30, 160, 80] },
    ] : [
      { label: "Itens", value: cat.quantidade.toString(), color: [80, 80, 80] },
      { label: "Venda", value: formatCurrencyPDF(cat.venda), color: [40, 100, 210] },
    ]);

    // Items table
    const rows = cat.items.map((item) => comCusto ? [
      item.nome,
      item.tipo === "produto" ? "Produto" : "Peça",
      item.quantidade.toString(),
      formatCurrencyPDF(item.custo),
      formatCurrencyPDF(item.preco),
      formatCurrencyPDF((item.preco - item.custo) * item.quantidade),
    ] : [
      item.nome,
      item.tipo === "produto" ? "Produto" : "Peça",
      item.quantidade.toString(),
      formatCurrencyPDF(item.preco),
    ]);

    autoTable(doc, {
      startY: y,
      head: comCusto
        ? [["Nome", "Tipo", "Qtd", "Custo Unit.", "Preço Unit.", "Lucro Total"]]
        : [["Nome", "Tipo", "Qtd", "Preço Unit."]],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: {
        fillColor: [40, 40, 40],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      // Sem custo/lucro, o Nome ("auto") fica com a largura das colunas que saíram.
      columnStyles: comCusto ? {
        0: { cellWidth: "auto" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 26, halign: "right" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
      } : {
        0: { cellWidth: "auto" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 26, halign: "right" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  });

  adicionarRodapePDF(doc, config);

  const dataAtual = new Date().toISOString().split("T")[0];
  doc.save(`estoque-produtos-pecas-${dataAtual}.pdf`);
};

// ── Relatório por categoria (categorias escolhidas pelo usuário) ──────────
// Não muda os relatórios acima. Grupos e totais vêm prontos de
// src/lib/produtos/exportarPorCategoria.ts (mesmas contas do relatório completo).

export interface OpcoesPDFCategorias extends OpcoesCustoLucro {
  /** Ex.: "Somente itens com estoque". */
  observacao?: string;
}

/** Monta o PDF sem salvar (usado pela tela e pelo script de exemplo). */
export const gerarCategoriasPDF = async (
  grupos: GrupoCategoria<ItemEstoque>[],
  config?: ConfiguracaoLoja | null,
  opcoes: OpcoesPDFCategorias = {}
): Promise<jsPDF> => {
  const comCusto = mostraCustoELucro(opcoes);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  const total = totaisGerais(grupos);
  const dataGerado = new Date().toLocaleDateString("pt-BR");
  const partes = [
    `Gerado em ${dataGerado}`,
    `${total.itens} ${total.itens === 1 ? "item" : "itens"} em ${grupos.length} ${grupos.length === 1 ? "categoria" : "categorias"}`,
  ];
  if (opcoes.observacao) partes.push(opcoes.observacao);

  let y = await adicionarCabecalhoPDF(doc, config || null, "Relatório por Categoria", partes.join(" • "));

  y = adicionarCardsPDF(doc, y, comCusto ? [
    { label: "Total em Estoque", value: total.quantidade.toString(), sub: `${total.itens} itens`, color: [50, 50, 50] },
    { label: "Custo Total", value: formatCurrencyPDF(total.custo), sub: "Valor investido", color: [220, 80, 60] },
    { label: "Venda Total", value: formatCurrencyPDF(total.venda), sub: "Valor potencial", color: [40, 100, 210] },
    {
      label: "Lucro Potencial",
      value: formatCurrencyPDF(total.lucro),
      sub: total.venda > 0 ? `Margem: ${((total.lucro / total.venda) * 100).toFixed(1)}%` : "",
      color: [30, 160, 80],
    },
  ] : [
    { label: "Total em Estoque", value: total.quantidade.toString(), sub: `${total.itens} itens`, color: [50, 50, 50] },
    { label: "Venda Total", value: formatCurrencyPDF(total.venda), sub: "Valor potencial", color: [40, 100, 210] },
  ]);

  grupos.forEach((cat) => {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }

    y = adicionarTituloSecao(doc, y, cat.nome.replace(/›/g, ">"));

    const cardQuantidade = {
      label: "Quantidade",
      value: cat.quantidade.toString(),
      sub: `${cat.itens.length} ${cat.itens.length === 1 ? "item" : "itens"}`,
      color: [80, 80, 80] as [number, number, number],
    };
    y = adicionarCardsPDF(doc, y, comCusto ? [
      cardQuantidade,
      { label: "Custo Total", value: formatCurrencyPDF(cat.custo), color: [220, 80, 60] },
      { label: "Venda Total", value: formatCurrencyPDF(cat.venda), color: [40, 100, 210] },
      { label: "Lucro Total", value: formatCurrencyPDF(cat.lucro), color: [30, 160, 80] },
    ] : [
      cardQuantidade,
      { label: "Venda Total", value: formatCurrencyPDF(cat.venda), color: [40, 100, 210] },
    ]);

    if (!comCusto) {
      tabelaCategoriaSemCusto(doc, y, margin, cat);
      const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
      y = finalY + 10;
      return;
    }

    const rows = cat.itens.map((item) => [
      codigoDoItem(item) || "—",
      item.nome,
      item.tipo === "produto" ? "Produto" : "Peça",
      item.quantidade.toString(),
      formatCurrencyPDF(item.custo),
      formatCurrencyPDF(item.preco),
      formatCurrencyPDF(item.preco - item.custo),
      formatCurrencyPDF((item.preco - item.custo) * item.quantidade),
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Código", "Nome", "Tipo", "Qtd", "Custo Unit.", "Preço Unit.", "Lucro Unit.", "Lucro Total"]],
      body: rows,
      foot: [[
        "",
        "Total da categoria",
        "",
        { content: cat.quantidade.toString(), styles: { halign: "center" } },
        { content: formatCurrencyPDF(cat.custo), styles: { halign: "right" } },
        { content: formatCurrencyPDF(cat.venda), styles: { halign: "right" } },
        "",
        { content: formatCurrencyPDF(cat.lucro), styles: { halign: "right" } },
      ]],
      showFoot: "lastPage",
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      footStyles: { fillColor: [235, 237, 240], textColor: [25, 25, 25], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 11, halign: "center" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 24, halign: "right" },
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y = finalY + 10;
  });

  adicionarRodapePDF(doc, config);
  return doc;
};

/** Tabela da categoria sem Custo/Lucro: Código, Nome, Tipo, Qtd, Preço Unit. (rodapé com a venda total). */
function tabelaCategoriaSemCusto(doc: jsPDF, y: number, margin: number, cat: GrupoCategoria<ItemEstoque>) {
  autoTable(doc, {
    startY: y,
    head: [["Código", "Nome", "Tipo", "Qtd", "Preço Unit."]],
    body: cat.itens.map((item) => [
      codigoDoItem(item) || "—",
      item.nome,
      item.tipo === "produto" ? "Produto" : "Peça",
      item.quantidade.toString(),
      formatCurrencyPDF(item.preco),
    ]),
    foot: [[
      "",
      "Total da categoria",
      "",
      { content: cat.quantidade.toString(), styles: { halign: "center" } },
      { content: formatCurrencyPDF(cat.venda), styles: { halign: "right" } },
    ]],
    showFoot: "lastPage",
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: [235, 237, 240], textColor: [25, 25, 25], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    // Nome ("auto") fica com a largura das 3 colunas que saíram.
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 11, halign: "center" },
      4: { cellWidth: 24, halign: "right" },
    },
  });
}

export const exportarCategoriasPDF = async (
  grupos: GrupoCategoria<ItemEstoque>[],
  config?: ConfiguracaoLoja | null,
  opcoes: OpcoesPDFCategorias = {}
) => {
  const doc = await gerarCategoriasPDF(grupos, config, opcoes);
  const dataAtual = dataBrasiliaISO();
  doc.save(`estoque-por-categoria-${dataAtual}.pdf`);
};
