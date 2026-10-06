/**
 * Motor de OCR de números (modo "Números" do LeitorCodigoBarras): tesseract.js
 * rodando no aparelho, num Web Worker, sem enviar imagem para servidor.
 *
 * A biblioteca e seus arquivos (worker, core wasm, dados "eng") só são baixados
 * quando o modo Números é aberto: import dinâmico aqui e arquivos servidos pelo
 * próprio app em /ocr/<versão>/ (copiados de node_modules no build pelo plugin
 * arquivosOcr do vite.config.ts; fora do precache do PWA, ver sw.ts).
 */
import { escalaParaOcr, preprocessarPixels } from "./preprocessamento";

declare const __TESSERACT_VERSAO__: string;

/** Caminho dos arquivos do OCR, com a versão para não misturar cache entre atualizações. */
export const CAMINHO_OCR = `/ocr/${typeof __TESSERACT_VERSAO__ === "string" ? __TESSERACT_VERSAO__ : "dev"}`;

/** Caracteres que o OCR pode devolver em cada tipo de campo. */
export const CARACTERES_IMEI = "0123456789IMEImei:/- ";
export const CARACTERES_SERIE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:- ";

export interface RecorteOcr {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface MotorOcr {
  /** Texto reconhecido no recorte (coordenadas em pixels da fonte). */
  reconhecer: (fonte: CanvasImageSource, recorte: RecorteOcr) => Promise<string>;
  /** Encerra o worker (libera memória). Seguro chamar mais de uma vez. */
  encerrar: () => Promise<void>;
}

/** Desenha o recorte ampliado e binarizado (texto preto, fundo branco) no canvas usado pelo OCR. */
export function prepararCanvasOcr(fonte: CanvasImageSource, recorte: RecorteOcr, canvas: HTMLCanvasElement): HTMLCanvasElement {
  const escala = escalaParaOcr(recorte.largura);
  canvas.width = Math.max(1, Math.round(recorte.largura * escala));
  canvas.height = Math.max(1, Math.round(recorte.altura * escala));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fonte, recorte.x, recorte.y, recorte.largura, recorte.altura, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  preprocessarPixels(img.data, canvas.width, canvas.height);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function carregarMotorOcr(opcoes: {
  caracteres: string;
  onProgresso?: (fracao: number) => void;
}): Promise<MotorOcr> {
  // tesseract.js é CommonJS: conforme o empacotador, os nomes vêm direto ou dentro de `default`.
  type BibliotecaOcr = typeof import("tesseract.js");
  const modulo = (await import("tesseract.js")) as BibliotecaOcr & { default?: BibliotecaOcr };
  const { createWorker, OEM, PSM } = typeof modulo.createWorker === "function" ? modulo : (modulo.default as BibliotecaOcr);
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: `${CAMINHO_OCR}/worker.min.js`,
    corePath: `${CAMINHO_OCR}/core`,
    langPath: `${CAMINHO_OCR}/lang`,
    workerBlobURL: false,
    gzip: true,
    // O cache fica com o service worker (sw.ts, "ocr-cache"); sem cópia extra no IndexedDB.
    cacheMethod: "none",
    logger: (m: { status: string; progress: number }) => {
      if (m.status.startsWith("loading")) opcoes.onProgresso?.(m.progress);
    },
  });
  await worker.setParameters({
    tessedit_char_whitelist: opcoes.caracteres,
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    user_defined_dpi: "300",
  });

  const canvas = document.createElement("canvas");
  let encerrado = false;
  return {
    reconhecer: async (fonte, recorte) => {
      if (encerrado) return "";
      const { data } = await worker.recognize(prepararCanvasOcr(fonte, recorte, canvas));
      return data.text ?? "";
    },
    encerrar: async () => {
      if (encerrado) return;
      encerrado = true;
      await worker.terminate();
    },
  };
}
