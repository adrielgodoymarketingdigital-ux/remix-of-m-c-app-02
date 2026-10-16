/**
 * Nomes das fotos de dispositivo no bucket `dispositivos-fotos`.
 *
 * Fotos novas são comprimidas no navegador e enviadas em duas versões, lado a
 * lado no mesmo caminho:
 *   v2-<id>.jpg        → foto principal (≤1600px) — é a URL salva no banco
 *   v2-<id>_thumb.jpg  → miniatura (≤400px) — usada nas listas
 * Fotos antigas (sem o prefixo "v2-") não têm miniatura: as listas usam a
 * própria URL, sem tentar um arquivo que não existe.
 * Sem dependências (testado com Deno em scripts/testes-fotos-miniatura/).
 */

export const PREFIXO_FOTO_V2 = "v2-";
const SUFIXO_MINIATURA = "_thumb";

/** Insere "_thumb" antes da extensão do último trecho do caminho. */
function comSufixoMiniatura(caminho: string): string {
  const barra = caminho.lastIndexOf("/");
  const ponto = caminho.lastIndexOf(".");
  if (ponto <= barra) return caminho + SUFIXO_MINIATURA;
  return caminho.slice(0, ponto) + SUFIXO_MINIATURA + caminho.slice(ponto);
}

/** Nome do arquivo (último trecho), sem query string nem fragmento. */
function nomeDoArquivo(caminhoOuUrl: string): string {
  const semQuery = caminhoOuUrl.split(/[?#]/)[0];
  return semQuery.slice(semQuery.lastIndexOf("/") + 1);
}

/** A foto foi enviada no formato novo (tem miniatura ao lado)? */
export function ehFotoV2(caminhoOuUrl: string | null | undefined): boolean {
  return !!caminhoOuUrl && nomeDoArquivo(caminhoOuUrl).startsWith(PREFIXO_FOTO_V2);
}

/** URL da miniatura de uma foto v2; para fotos antigas, a própria URL. */
export function urlMiniatura(url: string): string;
export function urlMiniatura(url: string | null | undefined): string | null | undefined;
export function urlMiniatura(url: string | null | undefined): string | null | undefined {
  if (!url || !ehFotoV2(url)) return url;
  const corte = url.search(/[?#]/);
  const base = corte === -1 ? url : url.slice(0, corte);
  const resto = corte === -1 ? "" : url.slice(corte);
  return comSufixoMiniatura(base) + resto;
}

/** Caminho da miniatura dentro do bucket (para envio e remoção). */
export function caminhoMiniatura(caminho: string): string {
  return comSufixoMiniatura(caminho);
}

/**
 * Arquivos a apagar do bucket ao remover uma foto: o principal e, se for v2,
 * a miniatura. Mantém a regra de hoje: arquivo na raiz, nome = último trecho da URL.
 */
export function arquivosParaRemover(url: string): string[] {
  const nome = nomeDoArquivo(url);
  if (!nome) return [];
  return ehFotoV2(nome) ? [nome, caminhoMiniatura(nome)] : [nome];
}
