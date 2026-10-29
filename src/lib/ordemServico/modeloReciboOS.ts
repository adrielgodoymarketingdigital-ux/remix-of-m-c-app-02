/**
 * Modelo do recibo A4 da OS escolhido pela loja em "Layout da OS"
 * (layout_os_config.modelo_recibo_a4, no JSON que já existe — sem coluna nova).
 *
 * - Ausente, nulo, 'padrao' ou qualquer valor desconhecido = "padrao": o recibo
 *   de sempre (ImpressaoA4Padrao / ImpressaoA4Tech), sem nenhuma diferença.
 * - 'personalizado' = o desenho novo (ImpressaoA4Personalizado), só nos
 *   caminhos que o suportam. Os que não suportam ficam em CAMINHOS_SO_PADRAO,
 *   que é também a lista mostrada na tela de configuração.
 */
export type ModeloReciboA4 = "padrao" | "personalizado";

export function modeloReciboA4(layout: { modelo_recibo_a4?: unknown } | null | undefined): ModeloReciboA4 {
  return layout?.modelo_recibo_a4 === "personalizado" ? "personalizado" : "padrao";
}

/**
 * Onde o recibo personalizado NÃO sai (fica sempre no padrão). Para liberar um
 * caminho, tire-o daqui e da condição de usaReciboPersonalizado — a tela de
 * configuração lista o que estiver aqui.
 */
export const CAMINHOS_SO_PADRAO = ["cupom80mm", "duasOsPorFolha", "pdfIphoneInstalado", "pdfWhatsapp"] as const;
export type CaminhoSoPadrao = (typeof CAMINHOS_SO_PADRAO)[number];

export interface ContextoImpressaoA4 {
  formato: "a4" | "80mm";
  duasOsPorFolha: boolean;
  /** iPhone com o app instalado: a impressão vira PDF (jsPDF), que ainda é só o padrão. */
  pdfIphoneInstalado: boolean;
}

/** true = a impressão desta OS usa o recibo personalizado. */
export function usaReciboPersonalizado(
  layout: { modelo_recibo_a4?: unknown } | null | undefined,
  ctx: ContextoImpressaoA4,
): boolean {
  if (modeloReciboA4(layout) !== "personalizado") return false;
  if (ctx.formato !== "a4") return false;
  if (ctx.duasOsPorFolha) return false;
  if (ctx.pdfIphoneInstalado) return false;
  return true;
}
