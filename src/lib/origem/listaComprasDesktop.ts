/**
 * Regras puras da lista de compras no computador (Origem de Dispositivos, ≥1024px):
 * indicadores, filtro de valor mínimo/máximo, ordenação, paginação e o CSV
 * exportado. Tudo em memória sobre a lista que o hook já carrega; nenhuma
 * consulta ao banco. Sem dependências (testado com Deno em
 * scripts/testes-origem-dispositivos-layout/).
 */

/** Só os campos de compras_dispositivos (e joins) que estas regras leem. */
export interface CompraDaLista {
  id: string;
  dispositivo_id: string;
  data_compra: string;
  valor_pago: number | null;
  forma_pagamento: string;
  termo_pdf_url?: string | null;
  created_at?: string | null;
  origem_pessoas?: { nome?: string | null; cpf_cnpj?: string | null } | null;
  fornecedores?: { nome?: string | null } | null;
  dispositivos?: { marca?: string | null; modelo?: string | null; cor?: string | null; imei?: string | null } | null;
  aparelhos?: { id: string }[] | null;
}

// ---------- Indicadores ----------

/** Aparelhos da compra: os ligados por compra_id mais o principal, sem repetir (compra antiga sem vínculo conta 1). */
export function quantidadeAparelhosDaCompra(compra: Pick<CompraDaLista, "dispositivo_id" | "aparelhos">): number {
  const ids = new Set((compra.aparelhos ?? []).map((a) => a.id));
  if (compra.dispositivo_id) ids.add(compra.dispositivo_id);
  return ids.size;
}

export interface ResumoCompras {
  totalCompras: number;
  /** Soma de valor_pago, somada em centavos para não acumular erro de ponto flutuante. */
  valorTotal: number;
  dispositivos: number;
  /** Pessoas de origem cadastradas (o mesmo "Total de origens" do celular); não depende dos filtros. */
  fornecedores: number;
}

/** Indicadores do topo. `compras` é a lista JÁ filtrada (os indicadores seguem os filtros). */
export function resumoCompras(compras: readonly CompraDaLista[], totalPessoasCadastradas: number): ResumoCompras {
  let centavos = 0;
  let dispositivos = 0;
  for (const c of compras) {
    centavos += Math.round((Number(c.valor_pago) || 0) * 100);
    dispositivos += quantidadeAparelhosDaCompra(c);
  }
  return { totalCompras: compras.length, valorTotal: centavos / 100, dispositivos, fornecedores: totalPessoasCadastradas };
}

// ---------- Filtro de valor ----------

/**
 * Lê o valor digitado no filtro. Aceita "1234,56", "1.234,56", "1234.56" e "R$ 1.234,56".
 * Vazio ou inválido devolve null (= sem limite).
 */
export function lerValorFiltro(texto: string | null | undefined): number | null {
  let t = (texto ?? "").replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.234" = mil e duzentos
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Mantém as compras com mínimo ≤ valor_pago ≤ máximo (limites inclusivos; null = sem limite). Não inverte min/max. */
export function filtrarPorValor<T extends Pick<CompraDaLista, "valor_pago">>(
  compras: readonly T[],
  minimo: number | null,
  maximo: number | null,
): T[] {
  if (minimo == null && maximo == null) return compras as T[];
  return compras.filter((c) => {
    const v = Math.round((Number(c.valor_pago) || 0) * 100);
    if (minimo != null && v < Math.round(minimo * 100)) return false;
    if (maximo != null && v > Math.round(maximo * 100)) return false;
    return true;
  });
}

// ---------- Ordenação ----------

export type CampoOrdenacao = "data" | "dispositivo" | "valor";
/** null = ordem do hook (data da compra, mais nova primeiro), exatamente como hoje. */
export type OrdenacaoCompras = { campo: CampoOrdenacao; direcao: "asc" | "desc" } | null;

/** Clique no cabeçalho: outro campo → crescente; mesmo campo → crescente → decrescente → padrão. */
export function proximaOrdenacao(atual: OrdenacaoCompras, campo: CampoOrdenacao): OrdenacaoCompras {
  if (!atual || atual.campo !== campo) return { campo, direcao: "asc" };
  if (atual.direcao === "asc") return { campo, direcao: "desc" };
  return null;
}

const comparador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function nomeDoDispositivo(compra: Pick<CompraDaLista, "dispositivos">): string {
  return [compra.dispositivos?.marca, compra.dispositivos?.modelo].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
}

export function ordenarCompras<T extends CompraDaLista>(compras: readonly T[], ordem: OrdenacaoCompras): T[] {
  if (!ordem) return compras as T[];
  const sinal = ordem.direcao === "asc" ? 1 : -1;
  const comparar = (a: T, b: T): number => {
    switch (ordem.campo) {
      // data_compra é "AAAA-MM-DD": comparar como texto evita o fuso (ver compraNoPeriodo). Empate: hora do cadastro.
      case "data":
        return a.data_compra.localeCompare(b.data_compra) || (a.created_at ?? "").localeCompare(b.created_at ?? "");
      case "dispositivo":
        return comparador.compare(nomeDoDispositivo(a), nomeDoDispositivo(b));
      case "valor":
        return (Number(a.valor_pago) || 0) - (Number(b.valor_pago) || 0);
    }
  };
  // sort é estável: empates mantêm a ordem que veio do hook.
  return [...compras].sort((a, b) => sinal * comparar(a, b));
}

// ---------- Paginação ----------

export interface PaginaCompras<T> {
  itens: T[];
  /** Página efetiva (1..totalPaginas), corrigida se a pedida passou do fim (ex.: filtro reduziu a lista). */
  pagina: number;
  totalPaginas: number;
  /** "Exibindo {inicio} a {fim} de {total}"; lista vazia = 0 a 0 de 0. */
  inicio: number;
  fim: number;
  total: number;
}

export function paginar<T>(lista: readonly T[], paginaPedida: number, porPagina: number): PaginaCompras<T> {
  const tamanho = Math.max(1, Math.floor(porPagina) || 1);
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(Math.max(1, Math.floor(paginaPedida) || 1), totalPaginas);
  const desde = (pagina - 1) * tamanho;
  const itens = lista.slice(desde, desde + tamanho);
  return { itens, pagina, totalPaginas, inicio: total ? desde + 1 : 0, fim: desde + itens.length, total };
}

/** Botões numerados: primeira, última e vizinhas da atual; "…" nos buracos. Ex.: 1 … 4 5 6 … 12. */
export function paginasVisiveis(pagina: number, totalPaginas: number, vizinhas = 1): (number | "…")[] {
  const saida: (number | "…")[] = [];
  for (let p = 1; p <= totalPaginas; p++) {
    if (p === 1 || p === totalPaginas || Math.abs(p - pagina) <= vizinhas) saida.push(p);
    else if (saida[saida.length - 1] !== "…") saida.push("…");
  }
  return saida;
}

// ---------- Exportar CSV ----------

export const ROTULO_PAGAMENTO: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_debito: "Débito",
  cartao_credito: "Crédito",
  transferencia: "Transferência",
  boleto: "Boleto",
};

/** O que exportar: as selecionadas que estão na lista filtrada (na ordem da tela); sem nenhuma, todas as filtradas. */
export function comprasParaExportar<T extends { id: string }>(filtradas: readonly T[], selecionadas: ReadonlySet<string>): T[] {
  if (selecionadas.size === 0) return filtradas as T[];
  return filtradas.filter((c) => selecionadas.has(c.id));
}

/**
 * Uma célula do CSV. Neutraliza injeção de planilha (OWASP): texto que começa com
 * = + - @ (ou tab/CR) ganha um apóstrofo na frente. Depois, se tiver ; " ou quebra
 * de linha, vai entre aspas com as aspas internas dobradas.
 */
export function celulaCsv(valor: string | number | null | undefined): string {
  let t = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  if (/[;"\r\n]/.test(t)) t = `"${t.replace(/"/g, '""')}"`;
  return t;
}

/** "AAAA-MM-DD" → "DD/MM/AAAA" sem passar por Date (sem fuso). Outro formato sai como veio. */
function dataBr(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data ?? "";
}

/** 1234.5 → "1234,50": vírgula decimal, sem separador de milhar, para a planilha ler como número. */
function valorBr(valor: number | null): string {
  const centavos = Math.round((Number(valor) || 0) * 100);
  const sinal = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${sinal}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

export const CABECALHO_CSV = [
  "Data", "Pessoa/Fornecedor", "CPF/CNPJ", "Dispositivo", "Cor", "IMEI",
  "Aparelhos na compra", "Valor pago", "Pagamento", "Termo",
] as const;

/**
 * CSV das compras: BOM UTF-8, separador ";", linhas com CRLF. Gerado no
 * navegador; quem chama só baixa o arquivo, nada é enviado.
 * O valor pago sai sem neutralização: é número gerado aqui (nunca texto do usuário).
 */
export function montarCsvCompras(compras: readonly CompraDaLista[]): string {
  const linhas = [CABECALHO_CSV.map(celulaCsv).join(";")];
  for (const c of compras) {
    linhas.push([
      celulaCsv(dataBr(c.data_compra)),
      celulaCsv(c.origem_pessoas?.nome || c.fornecedores?.nome || ""),
      celulaCsv(c.origem_pessoas?.cpf_cnpj ?? ""),
      celulaCsv(nomeDoDispositivo(c)),
      celulaCsv(c.dispositivos?.cor ?? ""),
      celulaCsv(c.dispositivos?.imei ?? ""),
      celulaCsv(quantidadeAparelhosDaCompra(c)),
      valorBr(c.valor_pago),
      celulaCsv(ROTULO_PAGAMENTO[c.forma_pagamento] ?? c.forma_pagamento),
      celulaCsv(c.termo_pdf_url ? "Sim" : "Não"),
    ].join(";"));
  }
  return "﻿" + linhas.join("\r\n") + "\r\n";
}

/**
 * Nome do arquivo com a data de hoje no Brasil. Recebe o "AAAA-MM-DD" já em
 * Brasília (dataBrasiliaISO()); não recorta timestamp, que daria o dia UTC.
 */
export function nomeArquivoCsvCompras(hojeBrasilia: string): string {
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(hojeBrasilia) ? hojeBrasilia : "sem-data";
  return `compras-dispositivos-${dia}.csv`;
}
