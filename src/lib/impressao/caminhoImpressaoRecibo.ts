/**
 * Decisão pura de por onde sai a impressão dos recibos de venda (PDV, Vendas,
 * Dispositivos vendidos). ÚNICA regra: abrirDestinoImpressaoRecibo e os três
 * diálogos só consultam isto. Sem import nenhum (testável no Deno).
 *
 * Só o iOS com app instalado muda: lá window.print() é ignorado e a janela de
 * window.open() fica em tela cheia sem como sair. O resto segue como sempre:
 *  - PDV e Vendas: janela (window.open) em qualquer aparelho;
 *  - Dispositivos: janela no computador, iframe no Android, #print-root no
 *    iOS pelo Safari e o PDF (jsPDF + compartilhar) no iOS instalado.
 */

export interface ContextoCaminhoImpressao {
  isIOS: boolean;
  isMobile: boolean;
  isStandalone: boolean;
}

export type LugarReciboVenda = "pdv" | "vendas" | "dispositivos";

/**
 * janela     = window.open + document.write (como sempre)
 * iframe     = printViaIframe (Android, Dispositivos)
 * print-root = printViaPrintRoot (iOS pelo Safari, Dispositivos)
 * camada-ios = camada do próprio app com o recibo, Fechar, Compartilhar PDF e Imprimir
 * pdf-ios    = PDF próprio de Dispositivos (gerarReciboVendaPDF) + compartilhar
 */
export type CaminhoImpressaoRecibo = "janela" | "iframe" | "print-root" | "camada-ios" | "pdf-ios";

export function iosInstalado(ctx: ContextoCaminhoImpressao): boolean {
  return ctx.isIOS && ctx.isStandalone;
}

export function decidirCaminhoImpressaoRecibo(ctx: ContextoCaminhoImpressao, lugar: LugarReciboVenda): CaminhoImpressaoRecibo {
  if (iosInstalado(ctx)) return lugar === "dispositivos" ? "pdf-ios" : "camada-ios";
  if (lugar !== "dispositivos") return "janela";
  if (!ctx.isMobile && !ctx.isStandalone) return "janela";
  return ctx.isIOS ? "print-root" : "iframe";
}

/**
 * Documento de impressão pronto para ficar visível na camada do iOS: o
 * window.print() automático do script do recibo vira no-op (e window.close
 * também), guardando o print de verdade em window.__imprimirOriginal para o
 * botão Imprimir da camada. O resto do documento fica idêntico.
 */
export const SCRIPT_CAMADA_IOS =
  "<script>(function(){var p=window.print;window.__imprimirOriginal=function(){p.call(window);};" +
  "window.print=function(){window.__printed=true;};window.close=function(){};})();</script>";

export function prepararDocumentoParaCamada(html: string): string {
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + SCRIPT_CAMADA_IOS + html.slice(head.index + head[0].length);
  return SCRIPT_CAMADA_IOS + html;
}

export type FormatoPapelRecibo = "a4" | "80mm" | "58mm";

/** Largura da página do PDF (mm) e largura inicial do recibo na camada (px, 96 dpi). */
export function medidasDoFormato(formato: FormatoPapelRecibo): { larguraMm: number; larguraPx: number } {
  const larguraMm = formato === "a4" ? 210 : formato === "80mm" ? 80 : 58;
  return { larguraMm, larguraPx: Math.round((larguraMm * 96) / 25.4) };
}

/** Nome do PDF a partir do título do recibo: sem acento nem caractere estranho. */
export function nomeArquivoPDF(titulo: string, formato: FormatoPapelRecibo): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "Recibo"}-${formato}.pdf`;
}

/** Fatias verticais (mm) de uma imagem de altura `alturaMm` em páginas de `paginaMm`. */
export function fatiasDePagina(alturaMm: number, paginaMm: number): number[] {
  const fatias: number[] = [];
  for (let y = 0; y < alturaMm - 0.5 || fatias.length === 0; y += paginaMm) fatias.push(y);
  return fatias;
}
