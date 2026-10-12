/**
 * Pré-carregamento das fotos da OS para a impressão A4 e o PDF, e a escolha
 * "Incluir fotos na impressão" lembrada no aparelho. As regras ficam em
 * fotosImpressaoOS.ts.
 */
import { urlMiniatura, type FotoCarregada } from "./fotosImpressaoOS";

export const TIMEOUT_FOTOS_MS = 8000;
const CHAVE_ESCOLHA = "incluir_fotos_impressao_os";

export function lerEscolhaFotos(): boolean | null {
  try {
    const v = localStorage.getItem(CHAVE_ESCOLHA);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function salvarEscolhaFotos(incluir: boolean): void {
  try {
    localStorage.setItem(CHAVE_ESCOLHA, incluir ? "1" : "0");
  } catch {
    /* modo privado / storage indisponível */
  }
}

/** Baixa a MINIATURA como data URL (≈50 KB). null se falhar ou passar do tempo. */
async function baixarMiniatura(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(urlMiniatura(url), { mode: "cors", signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(typeof leitor.result === "string" ? leitor.result : null);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** A original abre? (só exibição em <img>, nunca convertida). */
function originalAbre(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => { img.src = ""; resolve(false); }, timeoutMs);
    img.onload = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}

/**
 * Pré-carrega as miniaturas (em paralelo, timeout por foto). Com
 * verificarOriginal (caminho de HTML direto), testa se a original abre quando
 * a miniatura falhar.
 */
export async function carregarFotosImpressao(
  urls: string[],
  opcoes: { verificarOriginal: boolean; timeoutMs?: number } = { verificarOriginal: false },
): Promise<FotoCarregada[]> {
  const timeout = opcoes.timeoutMs ?? TIMEOUT_FOTOS_MS;
  return Promise.all(urls.map(async (original) => {
    const dataUrl = await baixarMiniatura(original, timeout);
    const abre = !dataUrl && opcoes.verificarOriginal ? await originalAbre(original, timeout) : false;
    return { original, dataUrl, originalAbre: abre };
  }));
}
