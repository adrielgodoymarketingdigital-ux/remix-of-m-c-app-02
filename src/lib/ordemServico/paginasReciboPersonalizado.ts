/**
 * PDF do recibo PERSONALIZADO no iPhone com o app instalado (captura com
 * html2canvas + jsPDF): regras puras de página e de tamanho do canvas. Sem
 * import nenhum (testável no Deno).
 */

/** A4 com 8 mm de margem, igual à impressão do navegador (index.css: @page margin 8mm). */
export const PAGINA_A4_MM = { largura: 210, altura: 297, margem: 8 } as const;
export const LARGURA_UTIL_MM = PAGINA_A4_MM.largura - 2 * PAGINA_A4_MM.margem; // 194
export const ALTURA_UTIL_MM = PAGINA_A4_MM.altura - 2 * PAGINA_A4_MM.margem; // 281

/** Qualidade do JPEG de cada página (equilíbrio entre nitidez e peso do PDF). */
export const QUALIDADE_JPEG_RECIBO = 0.82;
/** Escala máxima da captura e teto de megapixels POR PÁGINA (canvas do Safari/iPhone). */
export const ESCALA_MAXIMA_CAPTURA = 2;
export const MEGAPIXELS_MAXIMOS_POR_PAGINA = 4;
/** Tempo máximo para gerar o PDF personalizado; passou disso, vale o PDF padrão. */
export const TEMPO_MAXIMO_PDF_PERSONALIZADO_MS = 20000;
/** Tempo máximo de espera por cada imagem do recibo (logo, fotos, assinaturas). */
export const TEMPO_MAXIMO_IMAGEM_MS = 8000;

/**
 * Páginas [início, fim] em mm. Só quebra num dos `cortes` (o começo de cada
 * bloco do recibo: cabeçalho, cartão ou linha de cartões), no último que ainda
 * cabe na página — assim nenhum cartão é partido. Se um bloco sozinho for maior
 * que a página, aí sim corta na altura da página (o navegador faz o mesmo).
 */
export function quebrasDePagina(alturaMm: number, cortesMm: readonly number[], paginaMm: number = ALTURA_UTIL_MM): [number, number][] {
  const total = Math.max(0, alturaMm);
  const cortes = [...cortesMm].filter((c) => Number.isFinite(c) && c > 0 && c < total).sort((a, b) => a - b);
  const paginas: [number, number][] = [];
  let inicio = 0;
  while (total - inicio > 0.5 || paginas.length === 0) {
    let fim = Math.min(inicio + paginaMm, total);
    if (fim < total) {
      const corte = cortes.filter((c) => c > inicio + 1 && c <= inicio + paginaMm).pop();
      // O bloco que começa no corte não cabe nem numa página inteira: quebrar antes
      // dele só deixaria esta página vazia — então a página vai até o fim.
      const proximo = corte === undefined ? undefined : cortes.find((c) => c > corte) ?? total;
      if (corte !== undefined && proximo !== undefined && proximo - corte <= paginaMm) fim = corte;
    }
    if (fim <= inicio) fim = Math.min(inicio + paginaMm, total);
    paginas.push([inicio, fim]);
    if (fim >= total) break;
    inicio = fim;
  }
  return paginas;
}

/** Escala da captura: até ESCALA_MAXIMA, sem passar do teto de megapixels por página. */
export function escalaDaCaptura(
  larguraPx: number,
  alturaPx: number,
  limites: { escalaMaxima?: number; megapixelsMaximos?: number } = {},
): number {
  const escalaMaxima = limites.escalaMaxima ?? ESCALA_MAXIMA_CAPTURA;
  const megapixels = limites.megapixelsMaximos ?? MEGAPIXELS_MAXIMOS_POR_PAGINA;
  const area = Math.max(1, larguraPx) * Math.max(1, alturaPx);
  const pelaArea = Math.sqrt((megapixels * 1_000_000) / area);
  return Math.max(0.5, Math.min(escalaMaxima, pelaArea));
}

/** "camera traseira" → "Camera traseira" (a captura não usa ::first-letter, que o html2canvas desenha errado). */
export function primeiraMaiuscula(texto: string): string {
  return texto ? texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1) : texto;
}

/**
 * Conferência de cada página capturada (em branco nunca vale como sucesso).
 * A amostra é o canvas reduzido (LARGURA_AMOSTRA px); pixel "com conteúdo" é
 * opaco e com algum canal abaixo do limiar. Página sem nenhum = falha.
 */
export const LARGURA_AMOSTRA_PX = 240;
export const LIMIAR_PIXEL_CONTEUDO = 225;
export const FRACAO_MINIMA_CONTEUDO = 0.001;
/** data URL de JPEG menor que isto é vazio/quebrado ("data:," etc.). */
export const TAMANHO_MINIMO_JPEG = 3000;

export function amostraTemConteudo(
  rgba: ArrayLike<number>,
  limiar: number = LIMIAR_PIXEL_CONTEUDO,
  fracaoMinima: number = FRACAO_MINIMA_CONTEUDO,
): boolean {
  let total = 0;
  let comConteudo = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    total++;
    if (rgba[i + 3] > 0 && (rgba[i] < limiar || rgba[i + 1] < limiar || rgba[i + 2] < limiar)) comConteudo++;
  }
  return total > 0 && comConteudo / total >= fracaoMinima;
}

export function jpegValido(dataUrl: string | null | undefined): boolean {
  return !!dataUrl && dataUrl.startsWith("data:image/jpeg") && dataUrl.length >= TAMANHO_MINIMO_JPEG;
}
