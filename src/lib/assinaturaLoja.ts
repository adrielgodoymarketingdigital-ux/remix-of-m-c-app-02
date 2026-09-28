import type jsPDF from "jspdf";

interface ConfigAssinaturaLike {
  assinatura_loja?: string | null;
  usar_assinatura_loja?: boolean | null;
}

/**
 * Assinatura da loja a usar nos documentos, ou null. Critério único para
 * impressão da OS, recibo e PDF do WhatsApp: opção ligada E assinatura salva.
 */
export function assinaturaLojaAtiva(config: ConfigAssinaturaLike | null | undefined): string | null {
  if (!config?.usar_assinatura_loja) return null;
  const img = config.assinatura_loja;
  return img && img.startsWith("data:image/") ? img : null;
}

/**
 * addImage mantendo a proporção, centralizada dentro da caixa (x, y, w, h).
 * Devolve a altura efetivamente desenhada (0 se a imagem for inválida).
 */
export function adicionarImagemContida(doc: jsPDF, img: string, x: number, y: number, w: number, h: number): number {
  try {
    const props = doc.getImageProperties(img);
    const escala = Math.min(w / props.width, h / props.height);
    const lw = props.width * escala;
    const lh = props.height * escala;
    doc.addImage(img, "PNG", x + (w - lw) / 2, y + (h - lh), lw, lh);
    return lh;
  } catch {
    return 0;
  }
}

// ───────────── Tratamento de foto/scan: papel → transparente ─────────────

const LARGURA_MAX = 600;
const TAM_BLOCO = 24;
// Razão luminância/fundo-local: acima de CLARO vira transparente, abaixo de
// ESCURO fica opaco, entre os dois é rampa (bordas suaves do traço).
const RAZAO_CLARO = 0.82;
const RAZAO_ESCURO = 0.55;

export interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Deixa o papel transparente in-place (RGBA) e devolve o recorte com o traço,
 * ou null se não sobrou traço nenhum. Fundo estimado POR REGIÃO (blocos de
 * 24px, máximo da vizinhança 3×3) em vez de um limiar global — foto de
 * celular tem sombra/iluminação desigual, e limiar global deixa manchas
 * cinzas justamente nos cantos escuros.
 */
export function removerFundoAssinatura(px: Uint8ClampedArray, largura: number, altura: number): Recorte | null {
  const lum = new Float32Array(largura * altura);
  for (let i = 0; i < largura * altura; i++) {
    lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  }

  const bx = Math.ceil(largura / TAM_BLOCO);
  const by = Math.ceil(altura / TAM_BLOCO);
  const maxBloco = new Float32Array(bx * by);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const b = Math.floor(y / TAM_BLOCO) * bx + Math.floor(x / TAM_BLOCO);
      if (lum[y * largura + x] > maxBloco[b]) maxBloco[b] = lum[y * largura + x];
    }
  }
  // Máximo da vizinhança: um bloco inteiro coberto de tinta herda o papel do lado.
  const fundo = new Float32Array(bx * by);
  for (let j = 0; j < by; j++) {
    for (let i = 0; i < bx; i++) {
      let m = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < bx && jj < by) m = Math.max(m, maxBloco[jj * bx + ii]);
        }
      }
      fundo[j * bx + i] = Math.max(m, 1);
    }
  }

  let x0 = largura, y0 = altura, x1 = -1, y1 = -1;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = y * largura + x;
      const razao = lum[i] / fundo[Math.floor(y / TAM_BLOCO) * bx + Math.floor(x / TAM_BLOCO)];
      const opacidade = Math.min(Math.max((RAZAO_CLARO - razao) / (RAZAO_CLARO - RAZAO_ESCURO), 0), 1);
      const alfa = Math.round(opacidade * (px[i * 4 + 3] / 255) * 255);
      px[i * 4 + 3] = alfa;
      if (alfa > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;

  const margem = 4;
  const rx = Math.max(x0 - margem, 0);
  const ry = Math.max(y0 - margem, 0);
  return {
    x: rx,
    y: ry,
    w: Math.min(x1 + margem, largura - 1) - rx + 1,
    h: Math.min(y1 + margem, altura - 1) - ry + 1,
  };
}

const carregarImagem = (arquivo: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem"));
    };
    img.src = url;
  });

/**
 * Foto/scan da assinatura → data URI PNG com fundo transparente, recortado
 * no traço e reduzido a no máximo 600px de largura (vai em base64 na coluna
 * configuracoes_loja.assinatura_loja, carregada junto com a config da loja).
 */
export async function processarImagemAssinatura(arquivo: File): Promise<string> {
  const img = await carregarImagem(arquivo);
  const escala = Math.min(1, LARGURA_MAX / img.naturalWidth);
  const largura = Math.max(1, Math.round(img.naturalWidth * escala));
  const altura = Math.max(1, Math.round(img.naturalHeight * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(img, 0, 0, largura, altura);

  const dados = ctx.getImageData(0, 0, largura, altura);
  const recorte = removerFundoAssinatura(dados.data, largura, altura);
  if (!recorte) throw new Error("Nenhum traço de assinatura encontrado na imagem");
  ctx.putImageData(dados, 0, 0);

  const saida = document.createElement("canvas");
  saida.width = recorte.w;
  saida.height = recorte.h;
  saida.getContext("2d")!.drawImage(canvas, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, recorte.w, recorte.h);
  return saida.toDataURL("image/png");
}
