// Excel do "Exportar relatório por categoria": aba "Resumo" + uma aba por categoria.
// As linhas vêm de montarPlanilhas (exportarPorCategoria.ts); aqui só vira .xlsx.
// Download pelo XLSX.writeFile, o mesmo da exportação de dados (ExportacaoDados.tsx).
import * as XLSX from "xlsx";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { montarPlanilhas, type AbaPlanilha, type GrupoCategoria } from "./exportarPorCategoria";

const FORMATO_MOEDA = '"R$" #,##0.00;-"R$" #,##0.00';

function montarAba(aba: AbaPlanilha): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aba.linhas);

  // Formato R$ nas colunas de dinheiro (abaixo do cabeçalho).
  for (let r = aba.linhaCabecalho + 1; r < aba.linhas.length; r++) {
    for (const c of aba.colunasMoeda) {
      const celula = ws[XLSX.utils.encode_cell({ r, c })];
      if (celula && celula.t === "n") celula.z = FORMATO_MOEDA;
    }
  }

  // Largura das colunas pelo maior texto da tabela (o topo com nome da loja não conta).
  const tabela = aba.linhas.slice(aba.linhaCabecalho);
  const nColunas = Math.max(...tabela.map((l) => l.length));
  ws["!cols"] = Array.from({ length: nColunas }, (_, c) => ({
    wch: Math.min(50, Math.max(10, ...tabela.map((l) => String(l[c] ?? "").length + 2))),
  }));
  return ws;
}

export function gerarCategoriasWorkbook(
  grupos: GrupoCategoria[],
  lojaNome: string,
  dataGerado: string,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const aba of montarPlanilhas(grupos, lojaNome, dataGerado)) {
    XLSX.utils.book_append_sheet(wb, montarAba(aba), aba.nome);
  }
  return wb;
}

export function exportarCategoriasExcel(grupos: GrupoCategoria[], lojaNome: string) {
  const wb = gerarCategoriasWorkbook(grupos, lojaNome, new Date().toLocaleDateString("pt-BR"));
  const dataAtual = dataBrasiliaISO();
  XLSX.writeFile(wb, `estoque-por-categoria-${dataAtual}.xlsx`);
}
