/**
 * Fotos da OS na impressão A4 (Padrão e Tech) e no PDF (gerarOrdemServicoPDF).
 * O cupom 80 mm NÃO tem fotos. Módulo puro (sem React, navegador nem banco):
 * URL da miniatura, seleção/limite, decisão de incluir, HTML/CSS da grade e a
 * geometria da grade no PDF — com as MESMAS medidas nos dois. Testado com Deno
 * em scripts/testes-fotos-os/. A leitura/pré-carregamento fica em
 * carregarFotosImpressaoOS.ts.
 */

/** Máximo de fotos impressas (duas linhas de 3). */
export const MAX_FOTOS_IMPRESSAO = 6;
export const FOTOS_POR_LINHA = 3;
/** Caixa de cada foto (mm): a foto inteira cabe nela, sem cortar. */
export const CAIXA_FOTO_MM = 58;
/** Espaço para a legenda "Foto N" abaixo da caixa (mm). */
export const LEGENDA_FOTO_MM = 5;
/** Espaço entre linhas de fotos (mm). */
export const ESPACO_LINHAS_MM = 3;
/** Altura do título "Fotos do aparelho" (mm). */
export const TITULO_FOTOS_MM = 7;
/** Altura da linha "+N fotos não impressas" (mm). */
export const AVISO_EXCEDENTE_MM = 5;
export const TITULO_FOTOS = "Fotos do aparelho";

/** Miniatura: 600×600, foto inteira (contain), qualidade ~70. */
export const PARAMETROS_MINIATURA = "width=600&height=600&resize=contain&quality=70";

export const MOTIVO_SEM_FOTOS = "Esta OS não tem fotos";
export const MOTIVO_DUAS_OS = "Fotos não cabem com duas OS por folha";
export const MOTIVO_80MM = "Fotos não saem no cupom 80 mm";
export const AVISO_DOCUMENTO = "Confira se não há foto de documento do cliente.";

export const textoExcedentes = (n: number) => `+${n} ${n === 1 ? "foto não impressa" : "fotos não impressas"}`;
export const textoBotaoSemFotos = (n: number) => `Imprimir sem ${n === 1 ? "ela" : "elas"}`;
export const textoFalhas = (n: number) => `${n} ${n === 1 ? "foto não carregou" : "fotos não carregaram"} — imprimir sem ${n === 1 ? "ela" : "elas"}?`;

const URL_PUBLICA_SUPABASE = /^(https:\/\/[a-z0-9-]+\.supabase\.co)\/storage\/v1\/object\/public\/([^?#]+)(?:[?#].*)?$/i;

/**
 * Miniatura pelo endpoint render/image do Storage (já vem na orientação certa e
 * converte HEIC para JPEG). URL de fora do Supabase fica como está.
 */
export function urlMiniatura(url: string): string {
  const m = URL_PUBLICA_SUPABASE.exec(url.trim());
  if (!m) return url;
  return `${m[1]}/storage/v1/render/image/public/${m[2]}?${PARAMETROS_MINIATURA}`;
}

/** Fotos válidas na ordem de envio, no máximo MAX_FOTOS_IMPRESSAO, e quantas ficaram de fora. */
export function selecionarFotos(fotos: unknown): { urls: string[]; excedentes: number } {
  const validas = Array.isArray(fotos)
    ? fotos.filter((f): f is string => typeof f === "string" && /^https?:\/\//i.test(f.trim())).map((f) => f.trim())
    : [];
  return { urls: validas.slice(0, MAX_FOTOS_IMPRESSAO), excedentes: Math.max(0, validas.length - MAX_FOTOS_IMPRESSAO) };
}

export interface DecisaoFotos {
  /** A caixa "Incluir fotos na impressão" pode ser marcada. */
  habilitada: boolean;
  /** Por que a caixa está desabilitada (mostrado abaixo dela). */
  motivo: string | null;
  /** Estado da caixa: a escolha lembrada no aparelho, senão o padrão da loja (desligado se ausente). */
  marcada: boolean;
  /** Fotos entram nesta impressão. */
  incluir: boolean;
}

export function decidirFotos(p: {
  padraoLoja: boolean | null | undefined;
  escolhaLembrada: boolean | null;
  totalFotos: number;
  formato: "a4" | "80mm";
  duasOsPorFolha: boolean;
}): DecisaoFotos {
  const marcada = p.escolhaLembrada ?? p.padraoLoja === true;
  const motivo = p.formato === "80mm" ? MOTIVO_80MM
    : p.totalFotos <= 0 ? MOTIVO_SEM_FOTOS
    : p.duasOsPorFolha ? MOTIVO_DUAS_OS
    : null;
  return { habilitada: motivo === null, motivo, marcada, incluir: motivo === null && marcada };
}

export interface FotoCarregada {
  original: string;
  /** Miniatura baixada como data URL; null se não carregou. */
  dataUrl: string | null;
  /** Só verificada no caminho de HTML direto, quando a miniatura falhou. */
  originalAbre: boolean;
}

/**
 * - html-direto (desktop, iPhone no navegador): miniatura; se falhar e a
 *   original abrir, a original.
 * - base64 (Android) e pdf: só a miniatura — a original NUNCA é convertida.
 */
export type ModoImpressaoFotos = "html-direto" | "base64" | "pdf";

export interface FotoImpressao {
  src: string;
  legenda: string;
}

export function montarFotosParaImpressao(carregadas: FotoCarregada[], modo: ModoImpressaoFotos): { fotos: FotoImpressao[]; falhas: number } {
  const fotos: FotoImpressao[] = [];
  let falhas = 0;
  carregadas.forEach((f, i) => {
    const legenda = `Foto ${i + 1}`;
    if (f.dataUrl) fotos.push({ src: f.dataUrl, legenda });
    else if (modo === "html-direto" && f.originalAbre) fotos.push({ src: f.original, legenda });
    else falhas++;
  });
  return { fotos, falhas };
}

export function escaparHtml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const mm = (v: number) => `${v}mm`;

/**
 * CSS da grade no A4: 3 por linha, caixa de 58 mm, linha nunca partida, título
 * junto da 1ª linha. O A4 da OS é forçado a 1 página (index.css: max-height
 * 277mm + overflow hidden — o que passar é CORTADO); com a seção de fotos
 * presente essa trava sai SÓ na impressão, a OS pode ir para a 2ª página e o
 * termo/assinaturas nunca são partidos. Sem fotos nada muda.
 */
export function cssGradeFotos(): string {
  return `
.os-fotos-impressao { margin-top: 4mm; }
.os-fotos-inicio, .os-fotos-linha { break-inside: avoid; page-break-inside: avoid; }
.os-fotos-titulo { font-size: 11pt; font-weight: 700; height: ${mm(TITULO_FOTOS_MM)}; line-height: ${mm(TITULO_FOTOS_MM)}; break-after: avoid; page-break-after: avoid; }
.os-fotos-linha { display: grid; grid-template-columns: repeat(${FOTOS_POR_LINHA}, ${mm(CAIXA_FOTO_MM)}); justify-content: space-between; margin-bottom: ${mm(ESPACO_LINHAS_MM)}; }
.os-foto { margin: 0; break-inside: avoid; page-break-inside: avoid; }
.os-foto-caixa { width: ${mm(CAIXA_FOTO_MM)}; height: ${mm(CAIXA_FOTO_MM)}; border: 0.3mm solid #ccc; box-sizing: border-box; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; }
.os-foto-caixa img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
.os-foto figcaption { height: ${mm(LEGENDA_FOTO_MM)}; line-height: ${mm(LEGENDA_FOTO_MM)}; font-size: 8pt; text-align: center; }
.os-fotos-excedentes { height: ${mm(AVISO_EXCEDENTE_MM)}; line-height: ${mm(AVISO_EXCEDENTE_MM)}; font-size: 8pt; color: #555; }
@media print {
  .impressao-ordem-container:has(.os-fotos-impressao) { max-height: none !important; overflow: visible !important; }
  .impressao-ordem-container:has(.os-fotos-impressao) .impressao-termo-garantia,
  .impressao-ordem-container:has(.os-fotos-impressao) .impressao-footer { break-inside: avoid; page-break-inside: avoid; }
}`;
}

/** HTML da seção (com o próprio <style>), ou "" sem fotos. */
export function htmlGradeFotos(fotos: FotoImpressao[], excedentes: number): string {
  if (fotos.length === 0) return "";
  const figura = (f: FotoImpressao) =>
    `<figure class="os-foto"><div class="os-foto-caixa"><img src="${escaparHtml(f.src)}" alt="${escaparHtml(f.legenda)}" /></div><figcaption>${escaparHtml(f.legenda)}</figcaption></figure>`;
  const linhas: string[] = [];
  for (let i = 0; i < fotos.length; i += FOTOS_POR_LINHA) {
    linhas.push(`<div class="os-fotos-linha">${fotos.slice(i, i + FOTOS_POR_LINHA).map(figura).join("")}</div>`);
  }
  const [primeira, ...demais] = linhas;
  return `<div class="os-fotos-impressao"><style>${cssGradeFotos()}</style>`
    + `<div class="os-fotos-inicio"><div class="os-fotos-titulo">${escaparHtml(TITULO_FOTOS)}</div>${primeira}</div>`
    + demais.join("")
    + (excedentes > 0 ? `<div class="os-fotos-excedentes">${escaparHtml(textoExcedentes(excedentes))}</div>` : "")
    + `</div>`;
}

export interface GeometriaFotosPDF {
  /** pagina: 0 = página atual, 1 = a seguinte, ... */
  titulo: { pagina: number; y: number };
  fotos: { pagina: number; x: number; y: number; w: number; h: number; legendaY: number }[];
  aviso: { pagina: number; y: number } | null;
  paginaFinal: number;
  yFinal: number;
}

/**
 * Posições da grade no PDF (mm, origem no topo), com as medidas do A4: o título
 * só é desenhado se a 1ª linha couber logo abaixo dele; uma linha que não cabe
 * passa inteira para a página seguinte.
 */
export function geometriaGradeFotosPDF(p: {
  quantidade: number;
  excedentes: number;
  yInicial: number;
  margemEsquerda: number;
  larguraUtil: number;
  yTopo: number;
  yLimite: number;
}): GeometriaFotosPDF {
  const alturaLinha = CAIXA_FOTO_MM + LEGENDA_FOTO_MM;
  const espacoColunas = (p.larguraUtil - FOTOS_POR_LINHA * CAIXA_FOTO_MM) / (FOTOS_POR_LINHA - 1);
  let pagina = 0;
  let y = p.yInicial;
  if (y + TITULO_FOTOS_MM + alturaLinha > p.yLimite) { pagina++; y = p.yTopo; }
  const titulo = { pagina, y };
  y += TITULO_FOTOS_MM;
  const fotos: GeometriaFotosPDF["fotos"] = [];
  for (let i = 0; i < p.quantidade; i++) {
    const coluna = i % FOTOS_POR_LINHA;
    if (coluna === 0 && i > 0) {
      y += alturaLinha + ESPACO_LINHAS_MM;
      if (y + alturaLinha > p.yLimite) { pagina++; y = p.yTopo; }
    }
    const x = p.margemEsquerda + coluna * (CAIXA_FOTO_MM + espacoColunas);
    fotos.push({ pagina, x: Math.round(x * 100) / 100, y, w: CAIXA_FOTO_MM, h: CAIXA_FOTO_MM, legendaY: y + CAIXA_FOTO_MM + LEGENDA_FOTO_MM - 1.5 });
  }
  y += p.quantidade > 0 ? alturaLinha + ESPACO_LINHAS_MM : 0;
  let aviso: GeometriaFotosPDF["aviso"] = null;
  if (p.excedentes > 0) {
    if (y + AVISO_EXCEDENTE_MM > p.yLimite) { pagina++; y = p.yTopo; }
    aviso = { pagina, y: y + AVISO_EXCEDENTE_MM - 1.5 };
    y += AVISO_EXCEDENTE_MM;
  }
  return { titulo, fotos, aviso, paginaFinal: pagina, yFinal: y + 8 };
}

/** Foto inteira dentro da caixa (contain), centralizada. */
export function encaixarNaCaixa(larguraPx: number, alturaPx: number, caixaMm: number = CAIXA_FOTO_MM): { w: number; h: number; dx: number; dy: number } {
  if (!(larguraPx > 0) || !(alturaPx > 0)) return { w: caixaMm, h: caixaMm, dx: 0, dy: 0 };
  const escala = Math.min(caixaMm / larguraPx, caixaMm / alturaPx);
  const w = Math.round(larguraPx * escala * 100) / 100;
  const h = Math.round(alturaPx * escala * 100) / 100;
  return { w, h, dx: Math.round(((caixaMm - w) / 2) * 100) / 100, dy: Math.round(((caixaMm - h) / 2) * 100) / 100 };
}

/** Formato do jsPDF a partir do data URL (a miniatura vem em JPEG). */
export function formatoImagemDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (/^data:image\/png/i.test(dataUrl)) return "PNG";
  if (/^data:image\/webp/i.test(dataUrl)) return "WEBP";
  return "JPEG";
}
