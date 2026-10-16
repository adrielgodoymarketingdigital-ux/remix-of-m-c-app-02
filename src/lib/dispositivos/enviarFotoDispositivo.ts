import { supabase } from "@/integrations/supabase/client";
import {
  PREFIXO_FOTO_V2,
  arquivosParaRemover,
  caminhoMiniatura,
} from "./fotosDispositivoNomes";

const BUCKET = "dispositivos-fotos";

const PRINCIPAL = { ladoMaximo: 1600, qualidade: 0.8, qualidadeMinima: 0.6, metaBytes: 300 * 1024 };
const MINIATURA = { ladoMaximo: 400, qualidade: 0.75, qualidadeMinima: 0.55, metaBytes: 40 * 1024 };

interface Versao {
  ladoMaximo: number;
  qualidade: number;
  qualidadeMinima: number;
  metaBytes: number;
}

/**
 * Abre a imagem por <img>: os navegadores atuais já aplicam a orientação EXIF
 * (image-orientation: from-image) ao desenhar no canvas.
 */
async function carregarImagem(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function desenhar(origem: CanvasImageSource, largura: number, altura: number, ladoMaximo: number): HTMLCanvasElement {
  const escala = Math.min(1, ladoMaximo / Math.max(largura, altura));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  // Fundo branco: PNG com transparência não vira preto no JPEG
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(origem, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function paraJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar JPEG"))),
      "image/jpeg",
      qualidade,
    );
  });
}

/** Comprime baixando a qualidade aos poucos até ficar abaixo da meta (ou no mínimo). */
async function comprimir(canvas: HTMLCanvasElement, v: Versao): Promise<Blob> {
  let qualidade = v.qualidade;
  let blob = await paraJpeg(canvas, qualidade);
  while (blob.size > v.metaBytes && qualidade - 0.05 >= v.qualidadeMinima - 1e-9) {
    qualidade -= 0.05;
    blob = await paraJpeg(canvas, qualidade);
  }
  return blob;
}

/** Gera a foto principal (≤1600px) e a miniatura (≤400px) em JPEG. */
export async function gerarVersoesFoto(file: File): Promise<{ principal: Blob; miniatura: Blob }> {
  const img = await carregarImagem(file);
  const canvasPrincipal = desenhar(img, img.naturalWidth, img.naturalHeight, PRINCIPAL.ladoMaximo);
  // A miniatura sai da principal já reduzida: menos memória no celular e boa nitidez
  const canvasMiniatura = desenhar(canvasPrincipal, canvasPrincipal.width, canvasPrincipal.height, MINIATURA.ladoMaximo);
  const [principal, miniatura] = await Promise.all([
    comprimir(canvasPrincipal, PRINCIPAL),
    comprimir(canvasMiniatura, MINIATURA),
  ]);
  return { principal, miniatura };
}

function idAleatorio(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function enviar(caminho: string, corpo: Blob | File, contentType?: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, corpo, contentType ? { contentType } : undefined);
  if (error) throw error;
}

function urlPublica(caminho: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

/**
 * Envia uma foto de dispositivo para a raiz do bucket (mesmo lugar de sempre) e
 * devolve a URL pública da foto principal — o que vai para o banco, como antes.
 *
 * Caminho normal: miniatura "v2-<id>_thumb.jpg" e depois principal "v2-<id>.jpg".
 * Se a compressão falhar → envia o arquivo original com o nome antigo.
 * Se o envio da miniatura falhar → envia só a principal comprimida, com o nome
 * antigo (sem "v2-"), e as listas usam a própria foto. Nunca perde a foto.
 */
export async function enviarFotoDispositivo(file: File): Promise<string> {
  let versoes: { principal: Blob; miniatura: Blob } | null = null;
  try {
    versoes = await gerarVersoesFoto(file);
  } catch (erro) {
    console.warn("[fotos-dispositivo] Compressão falhou; enviando a foto original.", erro);
  }

  if (!versoes) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const caminho = `${Math.random()}.${ext}`;
    await enviar(caminho, file);
    return urlPublica(caminho);
  }

  const id = idAleatorio();
  const caminhoPrincipal = `${PREFIXO_FOTO_V2}${id}.jpg`;
  const caminhoThumb = caminhoMiniatura(caminhoPrincipal);

  try {
    await enviar(caminhoThumb, versoes.miniatura, "image/jpeg");
  } catch (erro) {
    console.warn("[fotos-dispositivo] Envio da miniatura falhou; enviando só a foto comprimida.", erro);
    const caminho = `${Math.random()}.jpg`;
    await enviar(caminho, versoes.principal, "image/jpeg");
    return urlPublica(caminho);
  }

  try {
    await enviar(caminhoPrincipal, versoes.principal, "image/jpeg");
  } catch (erro) {
    // Sem a principal a miniatura fica órfã: apaga e repassa o erro (como hoje)
    await supabase.storage.from(BUCKET).remove([caminhoThumb]).catch(() => undefined);
    throw erro;
  }
  return urlPublica(caminhoPrincipal);
}

/** Apaga a foto do bucket e, se for v2, a miniatura junto. */
export async function removerFotoDispositivo(url: string): Promise<void> {
  const arquivos = arquivosParaRemover(url);
  if (arquivos.length === 0) return;
  await supabase.storage.from(BUCKET).remove(arquivos);
}
