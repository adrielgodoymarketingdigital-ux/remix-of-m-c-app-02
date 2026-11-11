/**
 * Regras puras da lista de itens do Catálogo no computador (≥1024px, passo "Itens"):
 * busca sem acento, filtros, ordem, paginação, categorias com contagem e lucro do dono.
 * Tudo em memória sobre a lista que useDispositivos/useProdutos já carregam; nenhuma consulta.
 * Sem dependências (testado com Deno: deno test -A --no-check src/lib/catalogo/).
 *
 * Custo e lucro NUNCA entram no item: ficam num mapa id → custo separado (MapaCustos),
 * que só a tela do dono lê. Prévia, link público e PDF não recebem esse mapa.
 */

// ---------- Tipos (só os campos que estas regras leem; ItemCatalogo encaixa) ----------

export type TipoItem = "dispositivo" | "produto" | "peca";
export type CondicaoItem = "novo" | "semi_novo" | "usado";

export interface ItemDaLista {
  id: string;
  tipo_item: TipoItem;
  nome: string;
  subtitulo?: string;
  marca?: string;
  modelo?: string;
  tipo_dispositivo?: string;
  sku?: string | null;
  codigo_barras?: string | null;
  preco?: number | null;
  preco_promocional?: number | null;
  quantidade: number;
  created_at: string;
  condicao?: CondicaoItem;
  /** false = oculto do link público (grava direto no estoque). undefined/true = visível. */
  exibir_no_catalogo?: boolean;
  /** Categoria do estoque (categorias_produtos), só produtos e peças. */
  categoria_id?: string | null;
  categoria_nome?: string | null;
  categoria_cor?: string | null;
}

/** Categoria manual do catálogo (catalogo_config.categoriasCatalogo). */
export interface CategoriaManual {
  id: string;
  nome: string;
  cor?: string;
  icone?: string;
  itemIds: string[];
}

// ---------- Texto ----------

/** Sem acentos, minúsculas, espaços colapsados. */
export function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Tipo do item (filtro "Tipo") ----------

/**
 * Chave estável do tipo, para o filtro: "produto", "peca" ou "dispositivo:<tipo>"
 * (ex.: "dispositivo:Celular"). O rótulo traduzido fica na tela.
 * Dispositivo sem tipo vira "dispositivo:".
 */
export function chaveTipo(item: Pick<ItemDaLista, "tipo_item" | "tipo_dispositivo">): string {
  if (item.tipo_item === "produto") return "produto";
  if (item.tipo_item === "peca") return "peca";
  return `dispositivo:${item.tipo_dispositivo ?? ""}`;
}

/** Chaves de tipo presentes na lista: produto, peça e depois dispositivos em ordem alfabética. */
export function tiposDisponiveis(itens: readonly ItemDaLista[]): string[] {
  const chaves = new Set(itens.map(chaveTipo));
  const fixos = ["produto", "peca"].filter((c) => chaves.has(c));
  const dispositivos = [...chaves]
    .filter((c) => c.startsWith("dispositivo:"))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...fixos, ...dispositivos];
}

// ---------- Entrada no catálogo (regra que já existe, sem mudança) ----------

/**
 * Seleção do lojista (itensSelecionadosIds). Lista vazia = TODOS entram (regra atual:
 * "tudo entra por padrão e o lojista seleciona").
 */
export function estaSelecionado(id: string, selecionados: readonly string[]): boolean {
  return selecionados.length === 0 || selecionados.includes(id);
}

/** Oculto pelo olho (exibir_no_catalogo = false). Só false oculta; undefined conta como visível. */
export function estaOculto(item: Pick<ItemDaLista, "exibir_no_catalogo">): boolean {
  return item.exibir_no_catalogo === false;
}

/** Aparece no link público: selecionado E não oculto (as views já tiram vendidos). */
export function apareceNoPublico(item: Pick<ItemDaLista, "id" | "exibir_no_catalogo">, selecionados: readonly string[]): boolean {
  return estaSelecionado(item.id, selecionados) && !estaOculto(item);
}

// ---------- Categorias ----------

/** Id do grupo "Outros" (itens sem categoria). Não colide com uuid. */
export const ID_SEM_CATEGORIA = "__sem_categoria__";

export interface GrupoCategoria {
  id: string;
  nome: string;
  cor?: string;
  icone?: string;
  /** "manual" = catalogo_config; "estoque" = categorias_produtos (usada quando não há manual). */
  origem: "manual" | "estoque";
  itemIds: ReadonlySet<string>;
}

/**
 * Mesma regra do agrupamento do catálogo público (CatalogoOnline/ItensAgrupados):
 * havendo categorias manuais, valem só elas (na ordem salva); senão, agrupa pelo
 * categoria_id dos produtos/peças, em ordem alfabética. Um item pode estar em mais de
 * uma categoria manual. Categorias manuais vazias continuam na lista (o lojista as vê).
 */
export function gruposDeCategoria(itens: readonly ItemDaLista[], manuais: readonly CategoriaManual[] | undefined): GrupoCategoria[] {
  if (manuais && manuais.length > 0) {
    return manuais.map((c) => ({
      id: c.id,
      nome: c.nome,
      cor: c.cor,
      icone: c.icone,
      origem: "manual" as const,
      itemIds: new Set(c.itemIds),
    }));
  }
  const mapa = new Map<string, { nome: string; cor?: string; ids: Set<string> }>();
  for (const item of itens) {
    if (!item.categoria_id || !item.categoria_nome) continue;
    const g = mapa.get(item.categoria_id);
    if (g) g.ids.add(item.id);
    else mapa.set(item.categoria_id, { nome: item.categoria_nome, cor: item.categoria_cor ?? undefined, ids: new Set([item.id]) });
  }
  return [...mapa.entries()]
    .map(([id, g]) => ({ id, nome: g.nome, cor: g.cor, origem: "estoque" as const, itemIds: g.ids }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
}

/** Item sem nenhuma categoria (vai para "Outros"). */
export function semCategoria(id: string, grupos: readonly GrupoCategoria[]): boolean {
  return !grupos.some((g) => g.itemIds.has(id));
}

export interface ContagemCategorias {
  /** Todos os itens da lista recebida (cartão "Todos"). */
  total: number;
  /** id do grupo → quantos itens DA LISTA estão nele (ids de itens vendidos/apagados não contam). */
  porCategoria: Map<string, number>;
  /** Itens sem categoria. */
  semCategoria: number;
}

export function contarPorCategoria(itens: readonly ItemDaLista[], grupos: readonly GrupoCategoria[]): ContagemCategorias {
  const porCategoria = new Map<string, number>(grupos.map((g) => [g.id, 0]));
  let semCat = 0;
  for (const item of itens) {
    let achou = false;
    for (const g of grupos) {
      if (g.itemIds.has(item.id)) {
        porCategoria.set(g.id, (porCategoria.get(g.id) ?? 0) + 1);
        achou = true;
      }
    }
    if (!achou) semCat++;
  }
  return { total: itens.length, porCategoria, semCategoria: semCat };
}

// ---------- Filtros ----------

/** "todos" | "no_catalogo" (aparece no público) | "fora" (não selecionado) | "ocultos" (olho fechado). */
export type FiltroSituacao = "todos" | "no_catalogo" | "fora" | "ocultos";

export interface FiltrosItens {
  /** Trecho do nome, marca/modelo, subtítulo, sku, código de barras ou categoria; vazio = sem filtro. */
  busca?: string;
  /** Chave de chaveTipo(); vazio/"todos" = todos. */
  tipo?: string | null;
  /** id de GrupoCategoria, ID_SEM_CATEGORIA, ou vazio/"todos" = todas. */
  categoriaId?: string | null;
  /** Só vale para dispositivos (produto/peça não têm condição e saem do resultado). */
  condicao?: CondicaoItem | "todos" | null;
  situacao?: FiltroSituacao;
}

function textoDeBusca(item: ItemDaLista, grupos: readonly GrupoCategoria[]): string {
  const nomesCategoria = grupos.filter((g) => g.itemIds.has(item.id)).map((g) => g.nome);
  return normalizarTexto(
    [item.nome, item.marca, item.modelo, item.subtitulo, item.tipo_dispositivo, item.sku, item.codigo_barras, item.categoria_nome, ...nomesCategoria]
      .filter(Boolean)
      .join(" | "),
  );
}

/**
 * Aplica os filtros juntos (E). Mantém a ordem recebida.
 * A busca aceita várias palavras em qualquer ordem ("128 iphone" acha "iPhone 13 128GB").
 */
export function filtrarItens<T extends ItemDaLista>(
  itens: readonly T[],
  f: FiltrosItens,
  grupos: readonly GrupoCategoria[] = [],
  selecionados: readonly string[] = [],
): T[] {
  const palavras = normalizarTexto(f.busca).split(" ").filter(Boolean);
  const tipo = f.tipo && f.tipo !== "todos" ? f.tipo : null;
  const categoriaId = f.categoriaId && f.categoriaId !== "todos" ? f.categoriaId : null;
  const grupoFiltro = categoriaId && categoriaId !== ID_SEM_CATEGORIA ? grupos.find((g) => g.id === categoriaId) : undefined;
  const condicao = f.condicao && f.condicao !== "todos" ? f.condicao : null;
  const situacao = f.situacao ?? "todos";

  return itens.filter((item) => {
    if (tipo && chaveTipo(item) !== tipo) return false;
    if (categoriaId === ID_SEM_CATEGORIA && !semCategoria(item.id, grupos)) return false;
    if (categoriaId && categoriaId !== ID_SEM_CATEGORIA && !grupoFiltro?.itemIds.has(item.id)) return false;
    if (condicao && item.condicao !== condicao) return false;
    if (situacao === "no_catalogo" && !apareceNoPublico(item, selecionados)) return false;
    if (situacao === "fora" && estaSelecionado(item.id, selecionados)) return false;
    if (situacao === "ocultos" && !estaOculto(item)) return false;
    if (palavras.length > 0) {
      const texto = textoDeBusca(item, grupos);
      if (!palavras.every((p) => texto.includes(p))) return false;
    }
    return true;
  });
}

// ---------- Ordem ----------

export type OrdemItens = "nome_asc" | "preco_asc" | "preco_desc" | "recente" | "estoque_desc";
export const ORDEM_PADRAO: OrdemItens = "nome_asc";

/**
 * Ordena sem alterar a lista recebida. Preço vazio conta 0 (como no catálogo atual);
 * o preço usado é o efetivo (promocional válido, se houver). Empate sempre desfeito por
 * nome e depois id, para a página não "pular" itens entre renderizações.
 */
export function ordenarItens<T extends ItemDaLista>(itens: readonly T[], ordem: OrdemItens = ORDEM_PADRAO): T[] {
  const porNome = (a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id);
  const preco = (i: T) => precoEfetivo(i) ?? 0;
  const copia = [...itens];
  switch (ordem) {
    case "preco_asc":
      return copia.sort((a, b) => preco(a) - preco(b) || porNome(a, b));
    case "preco_desc":
      return copia.sort((a, b) => preco(b) - preco(a) || porNome(a, b));
    case "recente":
      return copia.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || porNome(a, b));
    case "estoque_desc":
      return copia.sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0) || porNome(a, b));
    case "nome_asc":
    default:
      return copia.sort(porNome);
  }
}

// ---------- Paginação ----------

export const OPCOES_POR_PAGINA = [10, 20, 50] as const;
/** Tamanho ao abrir a tela; não é guardado (volta a 20 a cada visita), como em Serviços. */
export const POR_PAGINA_PADRAO = 20;

export interface PaginaItens<T> {
  itens: T[];
  /** Página efetiva (1..totalPaginas), corrigida se a pedida passou do fim. */
  pagina: number;
  totalPaginas: number;
  porPagina: number;
  total: number;
  /** "Exibindo {inicio} a {fim} de {total}"; lista vazia = 0 a 0 de 0. */
  inicio: number;
  fim: number;
}

/** Tamanho fora de 10/20/50 vira 20. Página fora do intervalo é corrigida (mínimo 1, máximo a última). */
export function paginar<T>(lista: readonly T[], paginaPedida: number, porPaginaPedido: number = POR_PAGINA_PADRAO): PaginaItens<T> {
  const porPagina = (OPCOES_POR_PAGINA as readonly number[]).includes(porPaginaPedido) ? porPaginaPedido : POR_PAGINA_PADRAO;
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pedida = Number.isFinite(paginaPedida) ? Math.floor(paginaPedida) : 1;
  const pagina = Math.min(Math.max(1, pedida), totalPaginas);
  const ini = (pagina - 1) * porPagina;
  const itens = lista.slice(ini, ini + porPagina);
  return {
    itens,
    pagina,
    totalPaginas,
    porPagina,
    total,
    inicio: total === 0 ? 0 : ini + 1,
    fim: ini + itens.length,
  };
}

// ---------- Preço, custo e lucro (só tela do dono) ----------

const centavos = (v: number) => Math.round(v * 100);

/**
 * Preço que o cliente paga: o promocional, se for > 0 e menor que o preço; senão o preço.
 * Mesma condição do selo de desconto do CardCatalogo. Sem preço (null/0) = null ("Consulte").
 */
export function precoEfetivo(item: Pick<ItemDaLista, "preco" | "preco_promocional">): number | null {
  const preco = item.preco;
  if (preco == null || !(preco > 0)) return null;
  const promo = item.preco_promocional;
  if (promo != null && promo > 0 && promo < preco) return promo;
  return preco;
}

/** id → custo. Montado à parte, nunca dentro do ItemCatalogo. */
export type MapaCustos = ReadonlyMap<string, number | null | undefined>;

/**
 * `zeroEhDesconhecido`: produto e peça vêm do useProdutos com `Number(p.custo || 0)`, então custo
 * vazio chega como 0 e não dá para separar de "custo zero". Nesses, 0 vale como DESCONHECIDO
 * ("—" no Custo e no Lucro, nunca lucro igual ao preço). Dispositivo traz o custo como está no banco.
 */
export function montarMapaCustos(
  linhas: ReadonlyArray<{ id: string; custo?: number | null; zeroEhDesconhecido?: boolean }>,
): Map<string, number | null> {
  const mapa = new Map<string, number | null>();
  for (const l of linhas) {
    const c = l.custo;
    const invalido = c == null || !Number.isFinite(c) || (l.zeroEhDesconhecido === true && c === 0);
    mapa.set(l.id, invalido ? null : c);
  }
  return mapa;
}

/**
 * Lucro = preço efetivo − custo, em centavos para não acumular erro de ponto flutuante.
 * null quando não dá para calcular: sem preço, ou custo desconhecido (null/undefined/fora do mapa).
 * Custo 0 é válido (lucro = preço). Pode ser negativo (vendendo abaixo do custo).
 */
export function lucroDoItem(item: Pick<ItemDaLista, "preco" | "preco_promocional">, custo: number | null | undefined): number | null {
  const preco = precoEfetivo(item);
  if (preco == null || custo == null || !Number.isFinite(custo)) return null;
  return (centavos(preco) - centavos(custo)) / 100;
}

export interface PermissoesCustoLucro {
  /** Dono da loja (não é funcionário): vê sempre. */
  ehDono: boolean;
  ver_custos?: boolean;
  ver_lucros?: boolean;
}

/**
 * O que a tela do dono pode mostrar no cartão. Dono vê tudo; funcionário só com a permissão
 * de cada um (ver_custos → Custo, ver_lucros → Lucro), conforme decidido.
 */
export function visibilidadeCustoLucro(p: PermissoesCustoLucro): { custo: boolean; lucro: boolean } {
  if (p.ehDono) return { custo: true, lucro: true };
  return { custo: p.ver_custos === true, lucro: p.ver_lucros === true };
}

// ---------- Seleção ("Entra no catálogo") ----------
// Só mexem na lista itensSelecionadosIds (rascunho: grava com o Salvar do topo).
// Regra de sempre: lista vazia = todos entram.

/** Marca/desmarca um item. Mantém a ordem dos já marcados; o novo vai para o fim. */
export function alternarItem(selecionados: readonly string[], id: string): string[] {
  return selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id];
}

/** "Marcar todos" do filtro atual: soma os ids do filtro aos já marcados (sem repetir). */
export function marcarTodos(selecionados: readonly string[], idsDoFiltro: readonly string[]): string[] {
  const ja = new Set(selecionados);
  return [...selecionados, ...idsDoFiltro.filter((id, i) => !ja.has(id) && idsDoFiltro.indexOf(id) === i)];
}

/** "Desmarcar todos" do filtro atual: tira só os ids do filtro; os marcados fora dele ficam. */
export function desmarcarTodos(selecionados: readonly string[], idsDoFiltro: readonly string[]): string[] {
  const tirar = new Set(idsDoFiltro);
  return selecionados.filter((id) => !tirar.has(id));
}

/** Quantos itens DO FILTRO estão marcados: decide entre "Marcar todos" e "Desmarcar todos". */
export function marcadosNoFiltro(selecionados: readonly string[], idsDoFiltro: readonly string[]): "nenhum" | "alguns" | "todos" {
  if (idsDoFiltro.length === 0) return "nenhum";
  const sel = new Set(selecionados);
  const n = idsDoFiltro.filter((id) => sel.has(id)).length;
  return n === 0 ? "nenhum" : n === idsDoFiltro.length ? "todos" : "alguns";
}

export interface ResumoSelecao {
  /** Nada marcado = todos entram (regra de sempre). */
  todosEntram: boolean;
  /** Marcados que existem na lista (ids de itens que sumiram não contam). */
  marcados: number;
  /** Itens que aparecem no link público (selecionados e não ocultos). */
  noPublico: number;
  total: number;
}

export function resumoSelecao(itens: readonly ItemDaLista[], selecionados: readonly string[]): ResumoSelecao {
  const sel = new Set(selecionados);
  return {
    todosEntram: selecionados.length === 0,
    marcados: itens.filter((i) => sel.has(i.id)).length,
    noPublico: itens.filter((i) => apareceNoPublico(i, selecionados)).length,
    total: itens.length,
  };
}

// ---------- Cartão do item ----------

/** "Em estoque" com quantidade > 0; 0, negativa ou vazia = "Sem estoque". */
export function seloEstoque(item: Pick<ItemDaLista, "quantidade">): "em_estoque" | "sem_estoque" {
  return (item.quantidade ?? 0) > 0 ? "em_estoque" : "sem_estoque";
}

/** Código a mostrar: SKU, senão código de barras. Dispositivo não mostra IMEI aqui. */
export function codigoDoItem(item: Pick<ItemDaLista, "tipo_item" | "sku" | "codigo_barras">): string | null {
  if (item.tipo_item === "dispositivo") return null;
  const sku = item.sku?.trim();
  if (sku) return sku;
  const barras = item.codigo_barras?.trim();
  return barras || null;
}

/** Categorias (do agrupamento atual) em que o item está, na ordem dos grupos. */
export function categoriasDoItem(id: string, grupos: readonly GrupoCategoria[]): GrupoCategoria[] {
  return grupos.filter((g) => g.itemIds.has(id));
}
