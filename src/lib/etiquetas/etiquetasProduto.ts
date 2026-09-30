/**
 * Etiquetas de produtos/peças: escolha do código de barras, montagem do HTML
 * de cada etiqueta e do documento de impressão (térmica avulsa ou folha A4 em
 * grade). Tudo em string HTML/CSS para funcionar nos mesmos caminhos de
 * impressão dos recibos (popup no desktop, iframe no Android, #print-root no
 * iOS — ver lib/printMobile.ts). A prévia do diálogo usa exatamente o mesmo HTML.
 *
 * Todas as classes CSS têm prefixo "etq-": no iOS o CSS é injetado na página
 * viva (#print-root) e não pode vazar para o resto do app.
 */
import JsBarcode from "jsbarcode";
import { ItemEstoque } from "@/types/produto";
import { formatCurrency } from "@/lib/formatters";
import { getPrintScript } from "@/lib/print-utils";

// ── Configuração ────────────────────────────────────────────────────────────

export type CampoEtiqueta =
  | "nome_loja"
  | "nome"
  | "variacao"
  | "preco"
  | "preco_atacado"
  | "sku"
  | "codigo_barras"
  | "categoria"
  | "fornecedor";

export const CAMPOS_ETIQUETA: { id: CampoEtiqueta; label: string; dica?: string }[] = [
  { id: "nome_loja", label: "Nome da loja" },
  { id: "nome", label: "Nome do produto" },
  { id: "variacao", label: "Variação", dica: "Ex: modelo compatível da variação" },
  { id: "preco", label: "Preço de venda" },
  { id: "preco_atacado", label: "Preço de atacado" },
  { id: "sku", label: "Código/SKU", dica: "Só produtos têm SKU" },
  { id: "codigo_barras", label: "Código de barras", dica: "Do código de barras cadastrado ou, se não houver, do SKU" },
  { id: "categoria", label: "Categoria" },
  { id: "fornecedor", label: "Fornecedor" },
];

export type FormatoEtiqueta = "termica" | "a4";
export type TamanhoFonteEtiqueta = "pequeno" | "normal" | "grande";

/**
 * Folha de etiquetas medida pelo próprio usuário (ou uma das sugestões).
 * Medidas guardadas em mm; a tela mostra em cm. Salva em
 * configuracoes_loja.etiquetas_padroes (lista JSON) — ver usePadroesEtiqueta.
 */
export interface PadraoEtiqueta {
  id: string;
  nome: string;
  larguraFolhaMm: number;
  larguraMm: number;
  alturaMm: number;
  colunas: number;
  /** null = linhas calculadas pela quantidade de etiquetas na hora da impressão. */
  linhas: number | null;
}

/** Paginação sempre em papel A4 (29,7cm de altura). */
export const ALTURA_FOLHA_MM = 297;

// Pontos de partida — margens saem da mesma conta dos padrões do usuário, então
// o ideal continua sendo medir a folha e salvar um padrão próprio.
export const SUGESTOES_PIMACO: PadraoEtiqueta[] = [
  { id: "pimaco-A4351", nome: "Pimaco A4351 — 3,81×2,12cm (5×13)", larguraFolhaMm: 210, larguraMm: 38.1, alturaMm: 21.2, colunas: 5, linhas: 13 },
  { id: "pimaco-A4356", nome: "Pimaco A4356 — 6,35×2,54cm (3×11)", larguraFolhaMm: 210, larguraMm: 63.5, alturaMm: 25.4, colunas: 3, linhas: 11 },
  { id: "pimaco-A4360", nome: "Pimaco A4360 — 6,35×3,81cm (3×7)", larguraFolhaMm: 210, larguraMm: 63.5, alturaMm: 38.1, colunas: 3, linhas: 7 },
];

/** Id do padrão "Personalizado" preenchido na hora, sem salvar. */
export const PADRAO_AVULSO_ID = "personalizado";

export const PADRAO_AVULSO_INICIAL: PadraoEtiqueta = {
  id: PADRAO_AVULSO_ID,
  nome: "Personalizado",
  larguraFolhaMm: 210,
  larguraMm: 63.5,
  alturaMm: 25.4,
  colunas: 3,
  linhas: null,
};

export const LIMITES_PADRAO = {
  larguraFolhaMm: { min: 20, max: 300 },
  larguraMm: { min: 10, max: 300 },
  alturaMm: { min: 10, max: ALTURA_FOLHA_MM },
  colunas: { min: 1, max: 20 },
  linhas: { min: 1, max: 50 },
} as const;

function numeroNoIntervalo(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/** Valida um padrão vindo do banco/localStorage; null se estiver incompleto. */
export function normalizarPadrao(bruto: unknown): PadraoEtiqueta | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const L = LIMITES_PADRAO;
  if (typeof p.id !== "string" || !p.id || typeof p.nome !== "string") return null;
  if (!numeroNoIntervalo(p.larguraFolhaMm, L.larguraFolhaMm.min, L.larguraFolhaMm.max)) return null;
  if (!numeroNoIntervalo(p.larguraMm, L.larguraMm.min, L.larguraMm.max)) return null;
  if (!numeroNoIntervalo(p.alturaMm, L.alturaMm.min, L.alturaMm.max)) return null;
  if (!numeroNoIntervalo(p.colunas, L.colunas.min, L.colunas.max)) return null;
  let linhas: number | null = null;
  if (p.linhas != null) {
    if (!numeroNoIntervalo(p.linhas, L.linhas.min, L.linhas.max)) return null;
    linhas = p.linhas;
  }
  return {
    id: p.id,
    nome: p.nome,
    larguraFolhaMm: p.larguraFolhaMm,
    larguraMm: p.larguraMm,
    alturaMm: p.alturaMm,
    colunas: Math.round(p.colunas),
    linhas: linhas === null ? null : Math.round(linhas),
  };
}

export function normalizarPadroes(bruto: unknown): PadraoEtiqueta[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.map(normalizarPadrao).filter((p): p is PadraoEtiqueta => p !== null);
}

export interface LayoutFolha {
  /** Margem esquerda/direita e espaço entre colunas (iguais). */
  margemLateralMm: number;
  margemSuperiorMm: number;
  espacoLinhasMm: number;
  linhasPorFolha: number;
  etiquetasPorFolha: number;
  /** Motivo quando as medidas não cabem na folha — nada deve ser impresso. */
  erro: string | null;
}

const cm = (mm: number) => `${Number((mm / 10).toFixed(2)).toString().replace(".", ",")}cm`;

/**
 * Layout da grade a partir das medidas do padrão.
 *
 * Horizontal: o que sobra da largura da folha é dividido igualmente entre as
 * duas margens e os espaços entre colunas: (folha − colunas × etiqueta) ÷ (colunas + 1).
 *
 * Vertical: com linhas informadas (folha pré-cortada) o bloco fica centralizado
 * na altura do A4, sem espaço entre linhas; sem linhas (folha corrida) as
 * etiquetas começam do topo com o mesmo espaçamento da horizontal e cabem
 * quantas linhas couberem por página.
 */
export function calcularLayoutFolha(padrao: PadraoEtiqueta): LayoutFolha {
  const { larguraFolhaMm, larguraMm, alturaMm, colunas, linhas } = padrao;
  const invalido = (erro: string): LayoutFolha =>
    ({ margemLateralMm: 0, margemSuperiorMm: 0, espacoLinhasMm: 0, linhasPorFolha: 0, etiquetasPorFolha: 0, erro });

  const sobraHorizontal = larguraFolhaMm - colunas * larguraMm;
  if (sobraHorizontal < 0) {
    return invalido(`${colunas} etiquetas de ${cm(larguraMm)} (${cm(colunas * larguraMm)}) não cabem na largura da folha (${cm(larguraFolhaMm)}).`);
  }
  const margemLateralMm = sobraHorizontal / (colunas + 1);

  if (linhas !== null) {
    const sobraVertical = ALTURA_FOLHA_MM - linhas * alturaMm;
    if (sobraVertical < 0) {
      return invalido(`${linhas} linhas de ${cm(alturaMm)} (${cm(linhas * alturaMm)}) não cabem na altura do A4 (29,7cm).`);
    }
    return { margemLateralMm, margemSuperiorMm: sobraVertical / 2, espacoLinhasMm: 0, linhasPorFolha: linhas, etiquetasPorFolha: linhas * colunas, erro: null };
  }

  // Margem em cima e embaixo iguais ao espaço entre linhas: m + n·altura + (n−1)·m + m ≤ 297.
  const linhasPorFolha = Math.floor((ALTURA_FOLHA_MM - margemLateralMm) / (alturaMm + margemLateralMm));
  if (linhasPorFolha < 1) {
    return invalido(`A etiqueta de ${cm(alturaMm)} de altura não cabe na altura do A4 (29,7cm).`);
  }
  return { margemLateralMm, margemSuperiorMm: margemLateralMm, espacoLinhasMm: margemLateralMm, linhasPorFolha, etiquetasPorFolha: linhasPorFolha * colunas, erro: null };
}

export interface ConfigEtiquetas {
  campos: Record<CampoEtiqueta, boolean>;
  formato: FormatoEtiqueta;
  tamanhoFonte: TamanhoFonteEtiqueta;
  termica: { larguraMm: number; alturaMm: number };
  a4: PadraoEtiqueta;
  /** Posição (1-based) da primeira etiqueta na primeira folha A4 — reaproveita folha usada pela metade. */
  posicaoInicial: number;
}

export const CONFIG_ETIQUETAS_PADRAO: ConfigEtiquetas = {
  campos: {
    nome_loja: false,
    nome: true,
    variacao: true,
    preco: true,
    preco_atacado: false,
    sku: false,
    codigo_barras: true,
    categoria: false,
    fornecedor: false,
  },
  formato: "termica",
  tamanhoFonte: "normal",
  termica: { larguraMm: 40, alturaMm: 25 },
  a4: PADRAO_AVULSO_INICIAL,
  posicaoInicial: 1,
};

const CHAVE_STORAGE = "etiquetas_produto_config";

/** Última configuração usada (por navegador), mesclada sobre o padrão. */
export function carregarConfigEtiquetas(): ConfigEtiquetas {
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE);
    if (!salvo) return CONFIG_ETIQUETAS_PADRAO;
    const parcial = JSON.parse(salvo) as Partial<ConfigEtiquetas>;
    return {
      ...CONFIG_ETIQUETAS_PADRAO,
      ...parcial,
      campos: { ...CONFIG_ETIQUETAS_PADRAO.campos, ...(parcial.campos ?? {}) },
      termica: { ...CONFIG_ETIQUETAS_PADRAO.termica, ...(parcial.termica ?? {}) },
      // Configs antigas (modelo com margens fixas) não passam na validação e voltam ao padrão.
      a4: normalizarPadrao(parcial.a4) ?? CONFIG_ETIQUETAS_PADRAO.a4,
      posicaoInicial: 1,
    };
  } catch {
    return CONFIG_ETIQUETAS_PADRAO;
  }
}

export function salvarConfigEtiquetas(config: ConfigEtiquetas): void {
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(config));
  } catch {
    // storage indisponível (aba anônima etc.) — só não lembra a escolha
  }
}

export function dimensoesEtiqueta(config: ConfigEtiquetas): { larguraMm: number; alturaMm: number } {
  return config.formato === "termica"
    ? config.termica
    : { larguraMm: config.a4.larguraMm, alturaMm: config.a4.alturaMm };
}

// ── Código de barras ────────────────────────────────────────────────────────

export interface CodigoBarrasItem {
  valor: string;
  formato: "EAN13" | "CODE128";
  origem: "codigo_barras" | "sku";
}

function eanValido(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false;
  const digitos = codigo.split("").map(Number);
  const soma = digitos.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (soma % 10)) % 10 === digitos[12];
}

/** Código cadastrado (EAN-13 quando válido, senão Code128) ou, na falta, o SKU do produto. */
export function escolherCodigoBarras(item: ItemEstoque): CodigoBarrasItem | null {
  const cadastrado = item.codigo_barras?.trim();
  if (cadastrado) {
    return { valor: cadastrado, formato: eanValido(cadastrado) ? "EAN13" : "CODE128", origem: "codigo_barras" };
  }
  const sku = item.tipo === "produto" ? item.sku?.trim() : "";
  if (sku) return { valor: sku, formato: "CODE128", origem: "sku" };
  return null;
}

// Barra mais fina que leitores comuns leem com folga numa impressão térmica de 203dpi.
const MODULO_MINIMO_MM = 0.19;
// Zona de silêncio (em módulos) de cada lado exigida pelos leitores.
const ZONA_SILENCIO_MODULOS = 10;

export interface CodigoBarrasRenderizado {
  svg: string | null;
  /** Motivo quando o código existe mas não pode ser impresso legível nesta etiqueta. */
  aviso: string | null;
}

/**
 * SVG do código de barras esticado para `larguraMm`×`alturaMm`. Retorna aviso
 * (e svg null) quando o código é longo demais para ficar legível nessa largura.
 */
export function renderizarCodigoBarras(codigo: CodigoBarrasItem, larguraMm: number, alturaMm: number): CodigoBarrasRenderizado {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  try {
    JsBarcode(svg, codigo.valor, {
      format: codigo.formato,
      width: 1,
      height: 50,
      margin: 0,
      displayValue: false,
      background: "#ffffff",
      lineColor: "#000000",
      ...(codigo.formato === "EAN13" ? { flat: true } : {}),
    });
  } catch {
    return { svg: null, aviso: "Código com caracteres que não podem virar código de barras." };
  }

  // Com width=1, a largura do SVG em px = número de módulos (barras + espaços).
  const modulos = parseFloat(svg.getAttribute("width") ?? "") || 0; // JsBarcode grava "95px"
  if (!modulos) return { svg: null, aviso: "Não foi possível gerar o código de barras." };
  const moduloMm = larguraMm / (modulos + 2 * ZONA_SILENCIO_MODULOS);
  if (moduloMm < MODULO_MINIMO_MM) {
    return { svg: null, aviso: `Código longo demais (${codigo.valor.length} caracteres) para caber legível em ${larguraMm}mm.` };
  }

  const larguraBarrasMm = moduloMm * modulos;
  svg.setAttribute("viewBox", `0 0 ${modulos} 50`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.removeAttribute("style");
  svg.setAttribute("width", `${larguraBarrasMm.toFixed(2)}mm`);
  svg.setAttribute("height", `${alturaMm.toFixed(2)}mm`);
  return { svg: svg.outerHTML, aviso: null };
}

// ── HTML da etiqueta ────────────────────────────────────────────────────────

export interface ItemEtiqueta {
  item: ItemEstoque;
  quantidade: number;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONTE_PT: Record<TamanhoFonteEtiqueta, number> = { pequeno: 6, normal: 7, grande: 8.5 };

const MM_POR_PT = 25.4 / 72;
const PADDING_V_MM = 1;
const PADDING_H_MM = 1.5;
const GAP_MM = 0.3;
const ALTURA_MIN_BARRAS_MM = 4;
const ALTURA_MAX_BARRAS_MM = 12;

/** Altura de uma linha de texto (line-height 1.15) mais o espaçamento entre blocos. */
const alturaLinhaMm = (pt: number) => pt * 1.15 * MM_POR_PT + GAP_MM;

/**
 * Conteúdo de uma etiqueta (sem o documento em volta). A altura é orçada em mm:
 * os campos de texto entram primeiro, o nome cai para 1 linha se faltar espaço
 * e o código de barras fica com a altura que sobrar (entre 4 e 12mm) — assim
 * nada se sobrepõe em etiquetas baixas como a A4351 (21,2mm).
 */
export function montarEtiquetaHtml(item: ItemEstoque, config: ConfigEtiquetas, nomeLoja: string): string {
  const { larguraMm, alturaMm } = dimensoesEtiqueta(config);
  const fonte = FONTE_PT[config.tamanhoFonte];
  const c = config.campos;

  // Blocos que vão acima do preço, na ordem, com a altura estimada de cada um.
  const blocos: { html: string; alturaMm: number }[] = [];
  const linha = (html: string, pt: number) => blocos.push({ html, alturaMm: alturaLinhaMm(pt) });

  if (c.nome_loja && nomeLoja) linha(`<div class="etq-loja">${escaparHtml(nomeLoja)}</div>`, fonte - 1);
  if (c.variacao && item.variacao_label && !item.nome.includes(item.variacao_label)) {
    linha(`<div class="etq-linha">${escaparHtml(item.variacao_label)}</div>`, fonte);
  }
  if (c.categoria && item.categoria_nome) linha(`<div class="etq-linha etq-sec">${escaparHtml(item.categoria_nome)}</div>`, fonte - 1);
  if (c.fornecedor && item.fornecedor_nome) linha(`<div class="etq-linha etq-sec">${escaparHtml(item.fornecedor_nome)}</div>`, fonte - 1);
  const skuVisivel = c.sku && item.tipo === "produto" && !!item.sku;
  if (skuVisivel && item.tipo === "produto" && item.sku) linha(`<div class="etq-linha etq-mono">${escaparHtml(item.sku)}</div>`, fonte - 0.5);

  const precos: string[] = [];
  if (c.preco) precos.push(`<span class="etq-preco">${escaparHtml(formatCurrency(item.preco))}</span>`);
  if (c.preco_atacado && item.preco_atacado != null) {
    precos.push(`<span class="etq-atacado">Atac. ${escaparHtml(formatCurrency(item.preco_atacado))}</span>`);
  }
  const alturaPrecos = precos.length ? alturaLinhaMm(c.preco ? fonte + 3 : fonte) : 0;

  const codigo = c.codigo_barras ? escolherCodigoBarras(item) : null;
  const alturaNumeroBarras = alturaLinhaMm(Math.max(fonte - 1.5, 5));

  const disponivel = alturaMm - 2 * PADDING_V_MM;
  const ocupadoSemNome = blocos.reduce((acc, b) => acc + b.alturaMm, 0) + alturaPrecos
    + (codigo ? ALTURA_MIN_BARRAS_MM + alturaNumeroBarras : 0);
  const linhaNome = alturaLinhaMm(fonte);
  const linhasNome = !c.nome ? 0 : disponivel - ocupadoSemNome >= 2 * linhaNome ? 2 : 1;

  const partes: string[] = [];
  if (blocos.length && c.nome_loja && nomeLoja) partes.push(blocos.shift()!.html);
  if (linhasNome) {
    partes.push(`<div class="etq-nome" style="-webkit-line-clamp:${linhasNome}">${escaparHtml(item.nome)}</div>`);
  }
  partes.push(...blocos.map((b) => b.html));
  if (precos.length) partes.push(`<div class="etq-precos">${precos.join("")}</div>`);

  if (codigo) {
    const sobra = disponivel - ocupadoSemNome - linhasNome * linhaNome + ALTURA_MIN_BARRAS_MM;
    const alturaBarras = Math.min(ALTURA_MAX_BARRAS_MM, Math.max(ALTURA_MIN_BARRAS_MM, sobra));
    const { svg } = renderizarCodigoBarras(codigo, larguraMm - 2 * PADDING_H_MM, alturaBarras);
    if (svg) {
      partes.push(`<div class="etq-barras">${svg}<div class="etq-barras-num">${escaparHtml(codigo.valor)}</div></div>`);
    } else if (!(codigo.origem === "sku" && skuVisivel)) {
      // Longo demais para barras: imprime só o número (sem repetir o SKU já mostrado).
      partes.push(`<div class="etq-linha etq-mono">${escaparHtml(codigo.valor)}</div>`);
    }
  }

  return `<div class="etq-etiqueta">${partes.join("")}</div>`;
}

/** CSS das etiquetas (compartilhado pela prévia e pela impressão). */
export function montarCssEtiquetas(config: ConfigEtiquetas): string {
  const { larguraMm, alturaMm } = dimensoesEtiqueta(config);
  const fonte = FONTE_PT[config.tamanhoFonte];
  return `
    .etq-etiqueta {
      width: ${larguraMm}mm; height: ${alturaMm}mm; padding: 1mm 1.5mm;
      box-sizing: border-box; overflow: hidden; background: #fff; color: #000;
      font-family: Arial, Helvetica, sans-serif; font-size: ${fonte}pt; line-height: 1.15;
      display: flex; flex-direction: column; justify-content: center; gap: 0.3mm; text-align: center;
    }
    .etq-etiqueta * { margin: 0; padding: 0; box-sizing: border-box; }
    .etq-etiqueta > * { flex-shrink: 0; max-width: 100%; }
    .etq-loja { font-size: ${fonte - 1}pt; font-weight: 700; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .etq-nome {
      font-weight: 700; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      word-break: break-word;
    }
    .etq-linha { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .etq-sec { font-size: ${fonte - 1}pt; }
    .etq-mono { font-family: "Courier New", monospace; font-size: ${fonte - 0.5}pt; }
    .etq-precos { display: flex; justify-content: center; align-items: baseline; gap: 1.5mm; flex-wrap: wrap; }
    .etq-preco { font-size: ${fonte + 3}pt; font-weight: 900; white-space: nowrap; }
    .etq-atacado { font-size: ${fonte - 0.5}pt; white-space: nowrap; }
    .etq-barras { display: flex; flex-direction: column; align-items: center; }
    .etq-barras svg { display: block; }
    .etq-barras-num { font-family: "Courier New", monospace; font-size: ${Math.max(fonte - 1.5, 5)}pt; letter-spacing: 0.3pt; }
  `;
}

/** Lista plana com cada etiqueta a imprimir (item repetido conforme a quantidade). */
function expandirItens(itens: ItemEtiqueta[]): ItemEstoque[] {
  return itens.flatMap(({ item, quantidade }) => Array.from({ length: Math.max(0, Math.floor(quantidade)) }, () => item));
}

export function contarEtiquetas(itens: ItemEtiqueta[]): number {
  return itens.reduce((acc, i) => acc + Math.max(0, Math.floor(i.quantidade)), 0);
}

export function contarFolhasA4(total: number, config: ConfigEtiquetas): number {
  const porFolha = calcularLayoutFolha(config.a4).etiquetasPorFolha;
  if (!porFolha || !total) return 0;
  const inicio = Math.min(Math.max(config.posicaoInicial, 1), porFolha) - 1;
  return Math.ceil((total + inicio) / porFolha);
}

/** Corpo HTML (sem <html>) com todas as etiquetas paginadas. */
export function montarBodyEtiquetas(itens: ItemEtiqueta[], config: ConfigEtiquetas, nomeLoja: string): string {
  const lista = expandirItens(itens);
  // Cada produto é renderizado uma vez (inclui o SVG do código de barras) e repetido.
  const cache = new Map<string, string>();
  const html = (item: ItemEstoque) => {
    const chave = `${item.tipo}:${item.id}`;
    let pronto = cache.get(chave);
    if (!pronto) {
      pronto = montarEtiquetaHtml(item, config, nomeLoja);
      cache.set(chave, pronto);
    }
    return pronto;
  };

  if (config.formato === "termica") {
    return lista.map((item) => `<div class="etq-pagina-termica">${html(item)}</div>`).join("");
  }

  const porFolha = calcularLayoutFolha(config.a4).etiquetasPorFolha;
  if (!porFolha) return "";
  const vazias = Math.min(Math.max(config.posicaoInicial, 1), porFolha) - 1;
  const celulas = [...Array.from({ length: vazias }, () => '<div class="etq-celula"></div>'), ...lista.map((item) => `<div class="etq-celula">${html(item)}</div>`)];
  const folhas: string[] = [];
  for (let i = 0; i < celulas.length; i += porFolha) {
    folhas.push(`<div class="etq-folha">${celulas.slice(i, i + porFolha).join("")}</div>`);
  }
  return folhas.join("");
}

/** CSS de página (tamanho do papel e grade). */
export function montarCssPagina(config: ConfigEtiquetas): string {
  if (config.formato === "termica") {
    const { larguraMm, alturaMm } = config.termica;
    return `
      @page { size: ${larguraMm}mm ${alturaMm}mm; margin: 0; }
      .etq-pagina-termica { width: ${larguraMm}mm; height: ${alturaMm}mm; overflow: hidden; page-break-after: always; break-after: page; }
      .etq-pagina-termica:last-child { page-break-after: auto; break-after: auto; }
    `;
  }
  const p = config.a4;
  const l = calcularLayoutFolha(p);
  const mm = (v: number) => `${v.toFixed(2)}mm`;
  // Colunas com largura FIXA em mm (nunca fr/100%) e grade alinhada ao início:
  // a etiqueta não estica e a posição de cada coluna é exatamente a calculada.
  return `
    @page { size: ${mm(p.larguraFolhaMm)} ${ALTURA_FOLHA_MM}mm; margin: 0; }
    .etq-folha {
      width: ${mm(p.larguraFolhaMm)}; height: ${ALTURA_FOLHA_MM}mm; box-sizing: border-box; overflow: hidden;
      padding: ${mm(l.margemSuperiorMm)} 0 0 ${mm(l.margemLateralMm)}; margin: 0;
      display: grid; grid-template-columns: repeat(${p.colunas}, ${mm(p.larguraMm)}); grid-auto-rows: ${mm(p.alturaMm)};
      column-gap: ${mm(l.margemLateralMm)}; row-gap: ${mm(l.espacoLinhasMm)};
      justify-content: start; align-content: start;
      page-break-after: always; break-after: page;
    }
    .etq-folha:last-child { page-break-after: auto; break-after: auto; }
    .etq-celula {
      width: ${mm(p.larguraMm)}; height: ${mm(p.alturaMm)}; overflow: hidden;
      page-break-inside: avoid; break-inside: avoid;
    }
    /* iOS imprime via #print-root, cujo CSS global de impressão força width:100% e overflow:visible. */
    #print-root .etq-folha { width: ${mm(p.larguraFolhaMm)} !important; }
    #print-root .etq-folha, #print-root .etq-celula, #print-root .etq-etiqueta,
    #print-root .etq-nome, #print-root .etq-linha, #print-root .etq-loja { overflow: hidden !important; }
  `;
}

/** Documento HTML completo para popup/iframe, com o script que dispara a impressão. */
export function montarDocumentoEtiquetas(itens: ItemEtiqueta[], config: ConfigEtiquetas, nomeLoja: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas</title>
  <style>
    html, body { margin: 0; padding: 0; background: #fff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ${montarCssPagina(config)}
    ${montarCssEtiquetas(config)}
  </style>
</head>
<body>
  ${montarBodyEtiquetas(itens, config, nomeLoja)}
  ${getPrintScript()}
</body>
</html>`;
}
