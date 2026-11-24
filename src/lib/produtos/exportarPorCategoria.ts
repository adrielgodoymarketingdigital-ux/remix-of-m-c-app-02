// Lógica pura do "Exportar relatório por categoria" (tela Produtos e Peças).
// Sem React, sem Supabase, sem jsPDF/xlsx: só dados. Testada em
// exportarPorCategoria.test.ts (deno test -A --no-check).
//
// Contas iguais às do PDF de estoque completo (exportarProdutosPDF.ts):
//   custo total = custo * quantidade
//   venda total = preco * quantidade
//   lucro total = (preco - custo) * quantidade

/** Chave da opção "Sem categoria" na seleção. */
export const SEM_CATEGORIA = "__sem_categoria__";

export interface CategoriaBasica {
  id: string;
  nome: string;
  cor?: string | null;
  categoria_pai_id?: string | null;
}

export interface ItemBasico {
  id: string;
  nome: string;
  tipo: "produto" | "peca";
  sku?: string | null;
  codigo_barras?: string | null;
  quantidade: number;
  custo: number;
  preco: number;
  categoria_id?: string | null;
}

/**
 * Opção "Mostrar custo e lucro" dos relatórios exportados. Padrão: ligado
 * (igual a antes da opção). Desligado, o arquivo não leva custo, lucro nem
 * margem em lugar nenhum: só nome, categoria, quantidade, preço e venda.
 */
export interface OpcoesCustoLucro {
  mostrarCustoELucro?: boolean;
}

/** Ligado, a não ser que venha false explícito (quem não passa nada fica igual a antes). */
export function mostraCustoELucro(opcoes?: OpcoesCustoLucro): boolean {
  return opcoes?.mostrarCustoELucro !== false;
}

export interface OpcoesFiltro {
  /** Só itens com quantidade > 0. Desligado por padrão. */
  somenteComEstoque?: boolean;
}

export interface GrupoCategoria<T extends ItemBasico = ItemBasico> {
  /** id da categoria ou SEM_CATEGORIA. */
  chave: string;
  /** Nome com o caminho: "Capas › iPhone". */
  nome: string;
  cor: string;
  itens: T[];
  quantidade: number;
  custo: number;
  venda: number;
  lucro: number;
}

export interface Totais {
  itens: number;
  quantidade: number;
  custo: number;
  venda: number;
  lucro: number;
}

const COR_PADRAO = "#888888";

/** Ids de todas as subcategorias (filhas, netas…) de uma categoria. */
export function descendentes(id: string, categorias: CategoriaBasica[]): string[] {
  const resultado: string[] = [];
  const visitados = new Set<string>([id]);
  const fila = [id];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    for (const c of categorias) {
      if (c.categoria_pai_id === atual && !visitados.has(c.id)) {
        visitados.add(c.id);
        resultado.push(c.id);
        fila.push(c.id);
      }
    }
  }
  return resultado;
}

/**
 * Marca/desmarca uma categoria. Marcar um PAI marca também todas as
 * subcategorias; desmarcar o pai desmarca todas. Depois a pessoa pode
 * desmarcar uma subcategoria sozinha (o pai fica "parcial").
 */
export function alternarCategoria(
  selecao: ReadonlySet<string>,
  id: string,
  categorias: CategoriaBasica[],
): Set<string> {
  const nova = new Set(selecao);
  const afetados = id === SEM_CATEGORIA ? [id] : [id, ...descendentes(id, categorias)];
  // Caixa parcial (pai com parte das subcategorias) vira "tudo marcado".
  const marcar = estadoCaixa(selecao, id, categorias) !== true;
  for (const a of afetados) {
    if (marcar) nova.add(a);
    else nova.delete(a);
  }
  return nova;
}

/** Estado da caixa: marcada, desmarcada ou "parcial" (pai com só parte das subcategorias). */
export function estadoCaixa(
  selecao: ReadonlySet<string>,
  id: string,
  categorias: CategoriaBasica[],
): boolean | "indeterminate" {
  const marcado = selecao.has(id);
  if (id === SEM_CATEGORIA) return marcado;
  const filhos = descendentes(id, categorias);
  if (filhos.length === 0) return marcado;
  const marcadosFilhos = filhos.filter((f) => selecao.has(f)).length;
  if (marcado && marcadosFilhos === filhos.length) return true;
  if (!marcado && marcadosFilhos === 0) return false;
  return "indeterminate";
}

/** Todas as chaves possíveis (todas as categorias + "Sem categoria"). */
export function selecionarTodas(categorias: CategoriaBasica[]): Set<string> {
  return new Set([...categorias.map((c) => c.id), SEM_CATEGORIA]);
}

/**
 * Chave de categoria do item. Item cuja categoria não existe mais na lista
 * conta como "Sem categoria" (não some do relatório).
 */
export function chaveDoItem(item: ItemBasico, idsValidos: ReadonlySet<string>): string {
  return item.categoria_id && idsValidos.has(item.categoria_id) ? item.categoria_id : SEM_CATEGORIA;
}

function aplicarFiltroEstoque<T extends ItemBasico>(itens: T[], opcoes?: OpcoesFiltro): T[] {
  return opcoes?.somenteComEstoque ? itens.filter((i) => i.quantidade > 0) : itens;
}

/** Itens diretamente em cada categoria (sem somar as subcategorias). */
export function contarItensPorCategoria(
  itens: ItemBasico[],
  categorias: CategoriaBasica[],
  opcoes?: OpcoesFiltro,
): Map<string, number> {
  const idsValidos = new Set(categorias.map((c) => c.id));
  const contagem = new Map<string, number>();
  for (const item of aplicarFiltroEstoque(itens, opcoes)) {
    const chave = chaveDoItem(item, idsValidos);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return contagem;
}

/** Itens da categoria somados aos de todas as subcategorias. */
export function contarComSubcategorias(
  id: string,
  contagem: ReadonlyMap<string, number>,
  categorias: CategoriaBasica[],
): number {
  return [id, ...descendentes(id, categorias)].reduce((s, c) => s + (contagem.get(c) ?? 0), 0);
}

/** Só os itens das categorias marcadas (a seleção já vem com as subcategorias). */
export function filtrarItens<T extends ItemBasico>(
  itens: T[],
  selecao: ReadonlySet<string>,
  categorias: CategoriaBasica[],
  opcoes?: OpcoesFiltro,
): T[] {
  const idsValidos = new Set(categorias.map((c) => c.id));
  return aplicarFiltroEstoque(itens, opcoes).filter((i) => selecao.has(chaveDoItem(i, idsValidos)));
}

/** Categorias na ordem da árvore: pai, depois as filhas (cada nível em ordem alfabética). */
export function ordemDaArvore<C extends CategoriaBasica>(categorias: C[]): { categoria: C; nivel: number; caminho: string }[] {
  const ids = new Set(categorias.map((c) => c.id));
  const porNome = (a: C, b: C) => a.nome.localeCompare(b.nome, "pt-BR");
  const resultado: { categoria: C; nivel: number; caminho: string }[] = [];
  const visitados = new Set<string>();
  const percorrer = (paiId: string | null, nivel: number, prefixo: string) => {
    categorias
      .filter((c) => (paiId === null ? !c.categoria_pai_id || !ids.has(c.categoria_pai_id) : c.categoria_pai_id === paiId))
      .sort(porNome)
      .forEach((c) => {
        if (visitados.has(c.id)) return;
        visitados.add(c.id);
        const caminho = prefixo ? `${prefixo} › ${c.nome}` : c.nome;
        resultado.push({ categoria: c, nivel, caminho });
        percorrer(c.id, nivel + 1, caminho);
      });
  };
  percorrer(null, 0, "");
  return resultado;
}

/** Agrupa pela categoria do próprio item, na ordem da árvore; "Sem categoria" por último. Grupos vazios não entram. */
export function agruparPorCategoria<T extends ItemBasico>(
  itens: T[],
  categorias: CategoriaBasica[],
): GrupoCategoria<T>[] {
  const idsValidos = new Set(categorias.map((c) => c.id));
  const porChave = new Map<string, T[]>();
  for (const item of itens) {
    const chave = chaveDoItem(item, idsValidos);
    const lista = porChave.get(chave);
    if (lista) lista.push(item);
    else porChave.set(chave, [item]);
  }

  const ordem = [
    ...ordemDaArvore(categorias).map(({ categoria, caminho }) => ({
      chave: categoria.id,
      nome: caminho,
      cor: categoria.cor || COR_PADRAO,
    })),
    { chave: SEM_CATEGORIA, nome: "Sem categoria", cor: COR_PADRAO },
  ];

  const grupos: GrupoCategoria<T>[] = [];
  for (const { chave, nome, cor } of ordem) {
    const lista = porChave.get(chave);
    if (!lista || lista.length === 0) continue;
    const ordenados = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    grupos.push({ chave, nome, cor, itens: ordenados, ...totalizar(ordenados) });
  }
  return grupos;
}

function totalizar(itens: ItemBasico[]): Omit<Totais, "itens"> {
  let quantidade = 0;
  let custo = 0;
  let venda = 0;
  let lucro = 0;
  for (const i of itens) {
    quantidade += i.quantidade;
    custo += i.custo * i.quantidade;
    venda += i.preco * i.quantidade;
    lucro += (i.preco - i.custo) * i.quantidade;
  }
  return { quantidade, custo, venda, lucro };
}

export function totaisGerais(grupos: GrupoCategoria[]): Totais {
  return grupos.reduce<Totais>(
    (t, g) => ({
      itens: t.itens + g.itens.length,
      quantidade: t.quantidade + g.quantidade,
      custo: t.custo + g.custo,
      venda: t.venda + g.venda,
      lucro: t.lucro + g.lucro,
    }),
    { itens: 0, quantidade: 0, custo: 0, venda: 0, lucro: 0 },
  );
}

/** Código do item: SKU (só produto tem) ou código de barras. */
export function codigoDoItem(item: ItemBasico): string {
  return (item.sku || item.codigo_barras || "").trim();
}

// ── Excel ──────────────────────────────────────────────────────────────

export type Celula = string | number;

export interface AbaPlanilha {
  nome: string;
  linhas: Celula[][];
  /** Índices (0-based) das colunas de dinheiro, para o formato R$. */
  colunasMoeda: number[];
  /** Linha (0-based) do cabeçalho da tabela. */
  linhaCabecalho: number;
}

export const CABECALHO_ITENS = [
  "Nome",
  "Código/SKU",
  "Tipo",
  "Categoria",
  "Quantidade",
  "Custo unit.",
  "Preço de venda",
  "Lucro unit.",
  "Custo total",
  "Venda total",
  "Lucro total",
];

export const CABECALHO_RESUMO = ["Categoria", "Itens", "Quantidade", "Custo total", "Venda total", "Lucro total"];

/** Colunas que revelam margem (índices em CABECALHO_ITENS / CABECALHO_RESUMO). */
const COLUNAS_CUSTO_LUCRO_ITENS = [5, 7, 8, 10]; // Custo unit., Lucro unit., Custo total, Lucro total
const COLUNAS_CUSTO_LUCRO_RESUMO = [3, 5]; // Custo total, Lucro total

/** Tira colunas da aba e reindexa as colunas de dinheiro que sobram. */
function semColunas(aba: AbaPlanilha, remover: number[]): AbaPlanilha {
  const fora = new Set(remover);
  const novoIndice = (c: number) => c - remover.filter((r) => r < c).length;
  return {
    ...aba,
    linhas: aba.linhas.map((linha, r) =>
      // Topo (loja, data, linha vazia) não é tabela: fica como está.
      r < aba.linhaCabecalho ? linha : linha.filter((_, c) => !fora.has(c)),
    ),
    colunasMoeda: aba.colunasMoeda.filter((c) => !fora.has(c)).map(novoIndice),
  };
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Nome de aba válido no Excel: até 31 caracteres, sem : \ / ? * [ ], sem repetir. */
export function nomeDeAba(nome: string, usados: Set<string>): string {
  const base = (nome.replace(/[:\\/?*[\]]/g, "-").replace(/›/g, "-").trim() || "Categoria").slice(0, 31);
  let candidato = base;
  let n = 2;
  while (usados.has(candidato.toLowerCase())) {
    const sufixo = ` (${n++})`;
    candidato = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

/** Abas do .xlsx: "Resumo" primeiro, depois uma aba por categoria. */
export function montarPlanilhas(
  grupos: GrupoCategoria[],
  lojaNome: string,
  dataGerado: string,
  opcoes: OpcoesCustoLucro = {},
): AbaPlanilha[] {
  const topo: Celula[][] = [[lojaNome], [`Gerado em ${dataGerado}`], []];
  const usados = new Set<string>(["resumo"]);
  const total = totaisGerais(grupos);

  const resumo: AbaPlanilha = {
    nome: "Resumo",
    linhaCabecalho: topo.length,
    colunasMoeda: [3, 4, 5],
    linhas: [
      ...topo,
      CABECALHO_RESUMO,
      ...grupos.map((g) => [g.nome, g.itens.length, g.quantidade, arred(g.custo), arred(g.venda), arred(g.lucro)]),
      ["TOTAL", total.itens, total.quantidade, arred(total.custo), arred(total.venda), arred(total.lucro)],
    ],
  };

  const abas = grupos.map<AbaPlanilha>((g) => ({
    nome: nomeDeAba(g.nome, usados),
    linhaCabecalho: topo.length,
    colunasMoeda: [5, 6, 7, 8, 9, 10],
    linhas: [
      ...topo,
      CABECALHO_ITENS,
      ...g.itens.map((i) => [
        i.nome,
        codigoDoItem(i),
        i.tipo === "produto" ? "Produto" : "Peça",
        g.nome,
        i.quantidade,
        arred(i.custo),
        arred(i.preco),
        arred(i.preco - i.custo),
        arred(i.custo * i.quantidade),
        arred(i.preco * i.quantidade),
        arred((i.preco - i.custo) * i.quantidade),
      ]),
      ["TOTAL", "", "", "", g.quantidade, "", "", "", arred(g.custo), arred(g.venda), arred(g.lucro)],
    ],
  }));

  if (mostraCustoELucro(opcoes)) return [resumo, ...abas];
  return [semColunas(resumo, COLUNAS_CUSTO_LUCRO_RESUMO), ...abas.map((a) => semColunas(a, COLUNAS_CUSTO_LUCRO_ITENS))];
}
