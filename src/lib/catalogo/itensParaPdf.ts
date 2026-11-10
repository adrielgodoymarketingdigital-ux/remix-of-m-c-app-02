/**
 * Lógica pura do PDF do Catálogo (botão "Gerar PDF" do menu Catálogo).
 * Sem React, navegador, jsPDF nem banco; testada com Deno em
 * scripts/testes-catalogo-pdf/.
 *
 * Regras (as mesmas da prévia online, CatalogoOnline/CardCatalogo):
 * - entram dispositivos, produtos e peças (ItemCatalogo);
 * - nada selecionado = todos; com seleção, só os marcados;
 * - item com exibir_no_catalogo === false ou dispositivo vendido nunca entra;
 * - ordem da prévia: menor preço primeiro (ordenação padrão "preco_asc");
 * - preço promocional só vale se > 0 e menor que o preço; sem preço = "Consulte".
 *
 * Nunca acrescente custo, lucro, margem ou dado interno aqui: o PDF é
 * entregue ao cliente final.
 */
import type { ItemCatalogo } from "@/types/catalogo-item";
import type { CategoriaCatalogo, ConfiguracaoCatalogo, TemplatesCatalogo } from "@/types/catalogo";

// ===================== Seleção =====================

/** Item que pode aparecer no PDF: visível no catálogo e, se dispositivo, não vendido. */
export function itemPodeIrParaPdf(item: ItemCatalogo): boolean {
  if (item.exibir_no_catalogo === false) return false;
  if (item.tipo_item === "dispositivo" && item.vendido === true) return false;
  return true;
}

/**
 * Lista final de itens do PDF, na ordem da prévia online.
 * `selecionadosIds` vazio (ou ausente) = todos os itens válidos.
 */
export function itensParaPdf(
  itens: ItemCatalogo[],
  selecionadosIds: string[] | undefined,
): ItemCatalogo[] {
  const selecao = new Set(selecionadosIds || []);
  const vistos = new Set<string>();
  const resultado: ItemCatalogo[] = [];

  for (const item of itens) {
    if (vistos.has(item.id)) continue;
    if (!itemPodeIrParaPdf(item)) continue;
    if (selecao.size > 0 && !selecao.has(item.id)) continue;
    vistos.add(item.id);
    resultado.push(item);
  }

  // Mesma ordenação padrão da prévia (CatalogoOnline, "preco_asc"); sort é estável.
  return resultado.sort((a, b) => (a.preco || 0) - (b.preco || 0));
}

// ===================== Preço =====================

export type PrecoPdf =
  | { tipo: "consulte" }
  | { tipo: "normal"; valor: number }
  | { tipo: "promocional"; valor: number; original: number; descontoPercentual: number };

const numeroPositivo = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/** Promoção válida: promocional > 0, preço > 0 e promocional menor que o preço. */
export function promocaoValida(
  preco: number | null | undefined,
  promocional: number | null | undefined,
): boolean {
  return numeroPositivo(preco) && numeroPositivo(promocional) && promocional < preco;
}

export function precoParaPdf(
  item: Pick<ItemCatalogo, "preco" | "preco_promocional">,
  mostrarPrecos: boolean,
): PrecoPdf {
  if (!mostrarPrecos || !numeroPositivo(item.preco)) return { tipo: "consulte" };
  if (promocaoValida(item.preco, item.preco_promocional)) {
    const promo = item.preco_promocional as number;
    return {
      tipo: "promocional",
      valor: promo,
      original: item.preco,
      descontoPercentual: Math.round(((item.preco - promo) / item.preco) * 100),
    };
  }
  return { tipo: "normal", valor: item.preco };
}

// ===================== Agrupamento =====================

export interface GrupoPdf {
  /** null = lista sem grupos (sem categorias configuradas). */
  nome: string | null;
  cor?: string;
  itens: ItemCatalogo[];
}

export const NOME_GRUPO_OUTROS = "Outros";

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Agrupa pelos categoriasCatalogo, na ordem configurada, mantendo a ordem dos
 * itens dentro de cada grupo. Itens sem categoria (e os de uma categoria
 * chamada "Outros") vão para "Outros", sempre por último. Cada item aparece
 * uma vez só (fica na primeira categoria que o contém).
 * Sem categorias configuradas, ou nenhuma com itens: um grupo só, sem nome.
 */
export function agruparItensParaPdf(
  itens: ItemCatalogo[],
  categorias: CategoriaCatalogo[] | undefined,
): GrupoPdf[] {
  if (itens.length === 0) return [];
  const semGrupos: GrupoPdf[] = [{ nome: null, itens }];
  if (!categorias || categorias.length === 0) return semGrupos;

  const usados = new Set<string>();
  const idsOutros = new Set<string>();
  const grupos: GrupoPdf[] = [];

  for (const cat of categorias) {
    const ids = new Set(cat.itemIds || []);
    const doGrupo = itens.filter((i) => ids.has(i.id) && !usados.has(i.id));
    doGrupo.forEach((i) => usados.add(i.id));
    if (normalizar(cat.nome || "") === normalizar(NOME_GRUPO_OUTROS)) {
      doGrupo.forEach((i) => idsOutros.add(i.id));
      continue;
    }
    if (doGrupo.length > 0) {
      grupos.push({ nome: (cat.nome || "").trim() || "Categoria", cor: cat.cor, itens: doGrupo });
    }
  }

  if (grupos.length === 0) return semGrupos;

  const outros = itens.filter((i) => !usados.has(i.id) || idsOutros.has(i.id));
  if (outros.length > 0) grupos.push({ nome: NOME_GRUPO_OUTROS, itens: outros });
  return grupos;
}

export function totalItensGrupos(grupos: GrupoPdf[]): number {
  return grupos.reduce((soma, g) => soma + g.itens.length, 0);
}

// ===================== Cores =====================

export type Rgb = [number, number, number];

export interface CoresCatalogoPdf {
  primaria: string;
  header: string;
  fundo: string;
  texto: string;
  destaque: string;
}

/** Mesmas regras de cor da prévia online (CatalogoOnline). */
export function coresCatalogoPdf(
  config: Pick<
    ConfiguracaoCatalogo,
    "corPrimariaPersonalizada" | "corHeaderPersonalizada" | "corFundoPersonalizada" | "corTextoPersonalizada"
  >,
  template: TemplatesCatalogo,
): CoresCatalogoPdf {
  return {
    primaria: config.corPrimariaPersonalizada || template.cores.primaria,
    header: config.corHeaderPersonalizada || config.corPrimariaPersonalizada || template.cores.primaria,
    fundo: config.corFundoPersonalizada || template.cores.fundo,
    texto: config.corTextoPersonalizada || template.cores.texto,
    destaque: template.cores.destaque,
  };
}

/** "#abc", "#aabbcc" (com ou sem #). Cor inválida devolve `padrao`. */
export function hexParaRgb(hex: string | undefined | null, padrao: Rgb = [0, 0, 0]): Rgb {
  if (!hex) return padrao;
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return padrao;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function luminancia([r, g, b]: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Texto legível sobre um fundo: branco em fundo escuro, quase preto em fundo claro. */
export function corTextoSobre(fundo: Rgb): Rgb {
  return luminancia(fundo) > 0.62 ? [17, 24, 39] : [255, 255, 255];
}

/** Mistura a → b na proporção t (0 = a, 1 = b). */
export function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
}

// ===================== Layout =====================

/** Encaixa uma imagem numa caixa sem distorcer (object-fit: contain). */
export function encaixarProporcional(
  largura: number,
  altura: number,
  maxLargura: number,
  maxAltura: number,
): { largura: number; altura: number } {
  if (!(largura > 0) || !(altura > 0)) return { largura: 0, altura: 0 };
  const escala = Math.min(maxLargura / largura, maxAltura / altura);
  return { largura: largura * escala, altura: altura * escala };
}

export function gradePdf(layoutGrid: ConfiguracaoCatalogo["layoutGrid"] | undefined): {
  colunas: number;
  linhas: number;
} {
  switch (layoutGrid) {
    case "1x1": return { colunas: 1, linhas: 1 };
    case "2x2": return { colunas: 2, linhas: 2 };
    case "3x3": return { colunas: 3, linhas: 3 };
    case "2x3":
    default: return { colunas: 2, linhas: 3 };
  }
}

// ===================== Texto =====================

// Caracteres do WinAnsi (fontes padrão do jsPDF) fora do Latin-1.
const EXTRAS_WINANSI = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/**
 * Deixa o texto imprimível pelas fontes padrão do jsPDF: espaço especial vira
 * espaço comum e caracteres fora do WinAnsi (emoji etc.) são removidos.
 */
export function textoSeguroPdf(texto: string | null | undefined): string {
  if (!texto) return "";
  return Array.from(texto.replace(/[   ]/g, " "))
    .filter((c) => {
      const code = c.codePointAt(0) as number;
      return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || EXTRAS_WINANSI.includes(c);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatarGarantia(tempoMeses: number): string {
  if (tempoMeses >= 12) {
    const anos = Math.floor(tempoMeses / 12);
    const resto = tempoMeses % 12;
    if (resto === 0) return anos === 1 ? "1 ano" : `${anos} anos`;
    return `${anos} ano${anos > 1 ? "s" : ""} e ${resto} ${resto === 1 ? "mês" : "meses"}`;
  }
  return tempoMeses === 1 ? "1 mês" : `${tempoMeses} meses`;
}
