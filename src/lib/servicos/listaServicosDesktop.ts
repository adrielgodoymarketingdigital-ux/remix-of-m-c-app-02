/**
 * Regras puras da tela Serviços no computador (≥1024px): indicadores do topo,
 * lucro por serviço, filtros (inclusive preço mínimo/máximo) e paginação. Tudo em memória sobre a lista que
 * useServicos já carrega inteira (sem paginação no banco); nenhuma consulta.
 * Sem dependências (testado com Deno em scripts/testes-servicos-layout/).
 */

/** Só os campos de `servicos` que estas regras leem. custo/preco são nullable no banco. */
export interface ServicoDaLista {
  id: string;
  nome: string;
  codigo?: string | null;
  custo: number | null;
  preco: number | null;
  peca_id?: string | null;
  tipo_servico_id?: string | null;
}

const centavos = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100);

// ---------- Lucro ----------

/**
 * Lucro do serviço = preço − custo, a mesma conta da coluna gerada
 * `servicos.lucro` (GENERATED ALWAYS AS (preco - custo)). Custo ou preço vazio
 * contam 0, como a tabela já mostra ("R$ 0,00"). Pode ser negativo.
 */
export function lucroDoServico(s: Pick<ServicoDaLista, "custo" | "preco">): number {
  return (centavos(s.preco) - centavos(s.custo)) / 100;
}

// ---------- Indicadores ----------

export const temPecaVinculada = (s: Pick<ServicoDaLista, "peca_id">) => !!s.peca_id;
export const temTipoVinculado = (s: Pick<ServicoDaLista, "tipo_servico_id">) => !!s.tipo_servico_id;

export interface ResumoServicos {
  total: number;
  comPeca: number;
  semPeca: number;
  /** % inteiros de comPeca/semPeca sobre o total (lista vazia = 0 e 0). */
  percentualComPeca: number;
  percentualSemPeca: number;
  /** Soma de lucroDoServico de todos (negativos entram), somada em centavos. */
  lucroTotal: number;
}

/** Indicadores do topo sobre o catálogo inteiro (não seguem a busca nem os filtros). */
export function resumoServicos(servicos: readonly ServicoDaLista[]): ResumoServicos {
  let comPeca = 0;
  let lucroCentavos = 0;
  for (const s of servicos) {
    if (temPecaVinculada(s)) comPeca++;
    lucroCentavos += centavos(s.preco) - centavos(s.custo);
  }
  const total = servicos.length;
  const semPeca = total - comPeca;
  const percentualComPeca = total ? Math.round((comPeca / total) * 100) : 0;
  return {
    total,
    comPeca,
    semPeca,
    percentualComPeca,
    percentualSemPeca: total ? 100 - percentualComPeca : 0,
    lucroTotal: lucroCentavos / 100,
  };
}

/** O "(N)" do "Somente sem tipo vinculado": tipo de serviço (comissão), não peça. Sobre o catálogo inteiro, como hoje. */
export function contarSemTipo(servicos: readonly ServicoDaLista[]): number {
  return servicos.filter((s) => !temTipoVinculado(s)).length;
}

// ---------- Filtros ----------

/** Sem acentos, minúsculas, espaços colapsados. */
export function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface FiltrosServicos {
  /** Trecho do nome ou do código (sem acento/maiúscula); vazio = sem filtro. */
  busca?: string;
  /** Só os sem tipo de serviço vinculado (o switch que já existe). */
  soSemTipo?: boolean;
  /** id do tipo de serviço; null/vazio = todos. Hoje o app NÃO tem este filtro (só o mockup). */
  tipoServicoId?: string | null;
  /** Preço mínimo e máximo (inclusivos; null = sem limite). Preço vazio conta 0, como no lucro. */
  precoMinimo?: number | null;
  precoMaximo?: number | null;
}

/**
 * Lê o valor digitado no filtro de preço. Aceita "1234,56", "1.234,56", "1234.56"
 * e "R$ 1.234,56". Vazio, inválido ou negativo devolve null (= sem limite):
 * nenhum preço é negativo, então um limite negativo não teria sentido.
 */
export function lerValorFiltro(texto: string | null | undefined): number | null {
  let t = (texto ?? "").replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Aplica os filtros juntos (E). Mantém a ordem recebida (o hook já ordena por nome). */
export function filtrarServicos<T extends ServicoDaLista>(servicos: readonly T[], f: FiltrosServicos): T[] {
  const termo = normalizarTexto(f.busca);
  const minimo = f.precoMinimo == null ? null : Math.round(f.precoMinimo * 100);
  const maximo = f.precoMaximo == null ? null : Math.round(f.precoMaximo * 100);
  return servicos.filter((s) => {
    // Mínimo maior que o máximo não é invertido: o resultado fica vazio.
    if (minimo != null && centavos(s.preco) < minimo) return false;
    if (maximo != null && centavos(s.preco) > maximo) return false;
    if (f.soSemTipo && temTipoVinculado(s)) return false;
    if (f.tipoServicoId && s.tipo_servico_id !== f.tipoServicoId) return false;
    if (termo && !normalizarTexto(s.nome).includes(termo) && !normalizarTexto(s.codigo).includes(termo)) return false;
    return true;
  });
}

// ---------- Paginação ----------

export const OPCOES_POR_PAGINA = [10, 20, 50] as const;

export interface PaginaServicos<T> {
  itens: T[];
  /** Página efetiva (1..totalPaginas), corrigida se a pedida passou do fim (ex.: filtro reduziu a lista). */
  pagina: number;
  totalPaginas: number;
  /** "Exibindo {inicio} a {fim} de {total}"; lista vazia = 0 a 0 de 0. */
  inicio: number;
  fim: number;
  total: number;
}

export function paginar<T>(lista: readonly T[], paginaPedida: number, porPagina: number): PaginaServicos<T> {
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
