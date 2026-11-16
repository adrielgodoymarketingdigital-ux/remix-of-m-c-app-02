// Regras puras para preparar as imagens do Recibo Legal de compra (fotos do
// aparelho e documento do vendedor). Sem navegador, sem rede, sem efeito
// colateral: o carregamento de verdade fica em carregarImagensRecibo.ts.

export type FormatoImagem = "jpeg" | "png" | "webp";

/** Por que uma imagem ficou de fora do PDF (vira o quadro cinza de sempre). */
export type MotivoFalhaImagem =
  | "vazio"          // URL vazia ou arquivo sem bytes
  | "heic"           // HEIC/HEIF (iPhone) — o PDF não aceita
  | "pdf"            // arquivo PDF, não imagem
  | "gif"            // GIF — fora dos formatos aceitos
  | "desconhecido"   // bytes que não são JPEG, PNG nem WebP
  | "muito_grande"   // acima de LIMITE_BYTES_IMAGEM
  | "tempo_esgotado" // passou de TEMPO_MAXIMO_IMAGEM_MS
  | "http"           // resposta diferente de 2xx (expirada, apagada, sem permissão)
  | "rede"           // falha de rede / CORS
  | "decodificacao"; // o navegador não conseguiu abrir a imagem

export interface ImagemPreparada {
  /** data URL JPEG pronta para o jsPDF, ou null quando falhou. */
  dataUrl: string | null;
  motivo: MotivoFalhaImagem | null;
  /** Status HTTP quando motivo = "http". */
  status?: number;
}

export const LIMITE_BYTES_IMAGEM = 8 * 1024 * 1024;
export const MAX_FOTOS_RECIBO = 5;
export const MAX_DOCUMENTOS_RECIBO = 2;
export const LADO_MAXIMO_PX = 1600;
export const TEMPO_MAXIMO_IMAGEM_MS = 15_000;
export const QUALIDADE_JPEG = 0.8;

export type ResultadoFormato =
  | { aceito: true; formato: FormatoImagem }
  | { aceito: false; motivo: Extract<MotivoFalhaImagem, "vazio" | "heic" | "pdf" | "gif" | "desconhecido"> };

const ascii = (b: Uint8Array, inicio: number, fim: number): string => {
  let s = "";
  for (let i = inicio; i < fim && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};

const MARCAS_HEIF = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1", "avif"]);

/**
 * Formato pelos PRIMEIROS BYTES (não confia em extensão nem em Content-Type).
 * Bastam os 32 primeiros bytes.
 */
export function detectarFormatoImagem(bytes: Uint8Array): ResultadoFormato {
  if (!bytes || bytes.length === 0) return { aceito: false, motivo: "vazio" };
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { aceito: true, formato: "jpeg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return { aceito: true, formato: "png" };
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { aceito: true, formato: "webp" };
  if (b.length >= 4 && ascii(b, 0, 4) === "%PDF") return { aceito: false, motivo: "pdf" };
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return { aceito: false, motivo: "gif" };
  // ISO-BMFF: [tamanho 4 bytes]["ftyp"][marca 4 bytes]
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp" && MARCAS_HEIF.has(ascii(b, 8, 12).toLowerCase())) {
    return { aceito: false, motivo: "heic" };
  }
  return { aceito: false, motivo: "desconhecido" };
}

/**
 * true quando a URL aponta para um PDF. Olha só o caminho — ignora ?token=…
 * e #… da URL assinada (o endsWith('.pdf') antigo nunca acertava nela).
 */
export function ehUrlPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.trim();
  if (/^data:application\/pdf[;,]/i.test(u)) return true;
  const semQuery = u.split(/[?#]/, 1)[0];
  let caminho = semQuery;
  try {
    caminho = decodeURIComponent(semQuery);
  } catch {
    // %-codificação inválida: usa o texto cru
  }
  return caminho.toLowerCase().endsWith(".pdf");
}

/** true quando o Content-Type diz PDF. */
export function ehTipoPdf(contentType: string | null | undefined): boolean {
  return !!contentType && contentType.split(";", 1)[0].trim().toLowerCase() === "application/pdf";
}

export function tamanhoDentroDoLimite(bytes: number, limite = LIMITE_BYTES_IMAGEM): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= limite;
}

/**
 * Tamanho final proporcional: o lado maior fica em no máximo `ladoMaximo`,
 * nunca amplia, nunca dá 0.
 */
export function dimensaoReduzida(
  largura: number,
  altura: number,
  ladoMaximo = LADO_MAXIMO_PX,
): { largura: number; altura: number } {
  if (!(largura > 0) || !(altura > 0)) return { largura: 0, altura: 0 };
  const maior = Math.max(largura, altura);
  if (maior <= ladoMaximo) return { largura: Math.round(largura), altura: Math.round(altura) };
  const escala = ladoMaximo / maior;
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

/** Corta a lista no limite; o resto é contado como ignorado. Vazios saem antes. */
export function limitarQuantidade<T>(itens: readonly T[] | null | undefined, maximo: number): { usados: T[]; ignorados: number } {
  const lista = (itens ?? []).filter((x) => x !== null && x !== undefined && x !== "");
  return { usados: lista.slice(0, maximo), ignorados: Math.max(0, lista.length - maximo) };
}

export interface ResumoFalhas {
  total: number;
  falhas: number;
  /** Quantas falhas por motivo. */
  porMotivo: Partial<Record<MotivoFalhaImagem, number>>;
}

/**
 * Conta as falhas. `ignorarPdf` serve para documentos: documento em PDF não
 * entra como imagem (sai "[Arquivo PDF - Ver anexo]"), então não é falha.
 */
export function resumirFalhas(resultados: readonly ImagemPreparada[], opcoes: { ignorarPdf?: boolean } = {}): ResumoFalhas {
  const considerados = opcoes.ignorarPdf ? resultados.filter((r) => r.motivo !== "pdf") : resultados;
  const porMotivo: Partial<Record<MotivoFalhaImagem, number>> = {};
  let falhas = 0;
  for (const r of considerados) {
    if (r.dataUrl) continue;
    falhas++;
    const m = r.motivo ?? "desconhecido";
    porMotivo[m] = (porMotivo[m] ?? 0) + 1;
  }
  return { total: considerados.length, falhas, porMotivo };
}

/** "2 de 5 fotos não carregaram" / "1 de 3 fotos não carregou"; null sem falhas. */
export function textoResumoFalhas(resumo: ResumoFalhas, singular = "foto", plural = "fotos"): string | null {
  if (resumo.falhas === 0) return null;
  const nome = resumo.total === 1 ? singular : plural;
  const verbo = resumo.falhas === 1 ? "não carregou" : "não carregaram";
  return `${resumo.falhas} de ${resumo.total} ${nome} ${verbo}`;
}

/**
 * Processa UMA imagem por vez, na ordem. Uma falha (inclusive exceção) vira
 * { dataUrl: null, motivo } só daquela posição; as outras seguem.
 */
export async function prepararEmSequencia(
  urls: readonly string[],
  carregar: (url: string) => Promise<ImagemPreparada>,
): Promise<ImagemPreparada[]> {
  const saida: ImagemPreparada[] = [];
  for (const url of urls) {
    if (!url) {
      saida.push({ dataUrl: null, motivo: "vazio" });
      continue;
    }
    try {
      const r = await carregar(url);
      saida.push(r && (r.dataUrl || r.motivo) ? r : { dataUrl: null, motivo: "desconhecido" });
    } catch {
      saida.push({ dataUrl: null, motivo: "rede" });
    }
  }
  return saida;
}
