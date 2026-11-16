// Parte de navegador da preparação das imagens do Recibo Legal: baixa cada URL
// com fetch assíncrono (sem o XHR síncrono do jsPDF, sem baixar duas vezes),
// confere formato e tamanho pelas regras de imagensRecibo.ts, reduz no canvas
// e devolve data URL JPEG. Uma imagem por vez (memória do celular); a falha de
// uma não derruba as outras nem o PDF.
import {
  LADO_MAXIMO_PX,
  LIMITE_BYTES_IMAGEM,
  MAX_DOCUMENTOS_RECIBO,
  MAX_FOTOS_RECIBO,
  QUALIDADE_JPEG,
  TEMPO_MAXIMO_IMAGEM_MS,
  detectarFormatoImagem,
  dimensaoReduzida,
  ehTipoPdf,
  ehUrlPdf,
  limitarQuantidade,
  prepararEmSequencia,
  resumirFalhas,
  tamanhoDentroDoLimite,
  type ImagemPreparada,
  type ResumoFalhas,
} from "./imagensRecibo";

export interface OpcoesCarregamento {
  tempoMaximoMs?: number;
  limiteBytes?: number;
  ladoMaximo?: number;
  qualidade?: number;
  /** Para testes: troca o fetch. */
  fetchFn?: typeof fetch;
  /** Para testes: troca a decodificação no canvas. */
  decodificar?: (blob: Blob, ladoMaximo: number, qualidade: number) => Promise<string | null>;
}

class TempoEsgotadoImagem extends Error {}

async function decodificarParaJpeg(blob: Blob, ladoMaximo: number, qualidade: number): Promise<string | null> {
  let bitmap: ImageBitmap | null = null;
  let img: HTMLImageElement | null = null;
  let urlObjeto: string | null = null;
  let largura = 0;
  let altura = 0;
  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(blob);
      largura = bitmap.width;
      altura = bitmap.height;
    } else {
      urlObjeto = URL.createObjectURL(blob);
      img = new Image();
      img.decoding = "async";
      img.src = urlObjeto;
      await img.decode();
      largura = img.naturalWidth;
      altura = img.naturalHeight;
    }
    const final = dimensaoReduzida(largura, altura, ladoMaximo);
    if (!final.largura || !final.altura) return null;
    const canvas = document.createElement("canvas");
    canvas.width = final.largura;
    canvas.height = final.altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // JPEG não tem transparência: fundo branco evita PNG transparente virar preto.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, final.largura, final.altura);
    ctx.drawImage((bitmap ?? img) as CanvasImageSource, 0, 0, final.largura, final.altura);
    const dataUrl = canvas.toDataURL("image/jpeg", qualidade);
    // Libera a memória do canvas já (Safari segura até o GC).
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl.startsWith("data:image/jpeg") ? dataUrl : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
    if (urlObjeto) URL.revokeObjectURL(urlObjeto);
  }
}

/** Carrega UMA imagem; nunca lança — falha vem em `motivo`. */
export async function carregarImagemRecibo(url: string, opcoes: OpcoesCarregamento = {}): Promise<ImagemPreparada> {
  const tempoMaximoMs = opcoes.tempoMaximoMs ?? TEMPO_MAXIMO_IMAGEM_MS;
  const limiteBytes = opcoes.limiteBytes ?? LIMITE_BYTES_IMAGEM;
  const ladoMaximo = opcoes.ladoMaximo ?? LADO_MAXIMO_PX;
  const qualidade = opcoes.qualidade ?? QUALIDADE_JPEG;
  const fetchFn = opcoes.fetchFn ?? fetch;

  if (!url) return { dataUrl: null, motivo: "vazio" };
  if (ehUrlPdf(url)) return { dataUrl: null, motivo: "pdf" };

  const controle = new AbortController();
  let esgotou = false;
  const timer = setTimeout(() => {
    esgotou = true;
    controle.abort(new TempoEsgotadoImagem());
  }, tempoMaximoMs);

  let blob: Blob;
  try {
    const resposta = await fetchFn(url, { signal: controle.signal, cache: "no-store", credentials: "omit" });
    if (!resposta.ok) return { dataUrl: null, motivo: "http", status: resposta.status };
    if (ehTipoPdf(resposta.headers.get("content-type"))) return { dataUrl: null, motivo: "pdf" };
    const declarado = Number(resposta.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > limiteBytes) {
      controle.abort();
      return { dataUrl: null, motivo: "muito_grande" };
    }
    blob = await resposta.blob();
  } catch {
    return { dataUrl: null, motivo: esgotou ? "tempo_esgotado" : "rede" };
  } finally {
    clearTimeout(timer);
  }

  if (blob.size === 0) return { dataUrl: null, motivo: "vazio" };
  if (!tamanhoDentroDoLimite(blob.size, limiteBytes)) return { dataUrl: null, motivo: "muito_grande" };

  const cabecalho = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const formato = detectarFormatoImagem(cabecalho);
  if ("motivo" in formato) return { dataUrl: null, motivo: formato.motivo };

  let dataUrl: string | null = null;
  try {
    dataUrl = await (opcoes.decodificar ?? decodificarParaJpeg)(blob, ladoMaximo, qualidade);
  } catch {
    dataUrl = null;
  }
  return dataUrl ? { dataUrl, motivo: null } : { dataUrl: null, motivo: "decodificacao" };
}

export interface EntradaImagensRecibo {
  fotos?: readonly string[] | null;
  documentoFrente?: string | null;
  documentoVerso?: string | null;
}

export interface ImagensReciboPreparadas {
  /** Uma posição por foto usada (no máximo MAX_FOTOS_RECIBO). */
  fotos: ImagemPreparada[];
  documentoFrente: ImagemPreparada | null;
  documentoVerso: ImagemPreparada | null;
  fotosIgnoradas: number;
  resumoFotos: ResumoFalhas;
  resumoDocumentos: ResumoFalhas;
}

/** Fotos primeiro, depois frente e verso; uma de cada vez. */
export async function carregarImagensRecibo(
  entrada: EntradaImagensRecibo,
  opcoes: OpcoesCarregamento = {},
): Promise<ImagensReciboPreparadas> {
  const carregar = (url: string) => carregarImagemRecibo(url, opcoes);
  const { usados: urlsFotos, ignorados } = limitarQuantidade(entrada.fotos, MAX_FOTOS_RECIBO);
  const fotos = await prepararEmSequencia(urlsFotos, carregar);

  const urlsDocs = [entrada.documentoFrente ?? "", entrada.documentoVerso ?? ""].slice(0, MAX_DOCUMENTOS_RECIBO);
  const docs = await prepararEmSequencia(urlsDocs.filter(Boolean), carregar);
  let i = 0;
  const documentoFrente = urlsDocs[0] ? docs[i++] : null;
  const documentoVerso = urlsDocs[1] ? docs[i++] : null;

  return {
    fotos,
    documentoFrente,
    documentoVerso,
    fotosIgnoradas: ignorados,
    resumoFotos: resumirFalhas(fotos),
    resumoDocumentos: resumirFalhas(
      [documentoFrente, documentoVerso].filter((d): d is ImagemPreparada => d !== null),
      { ignorarPdf: true },
    ),
  };
}
