/**
 * "Ajuste vertical" da impressão de etiquetas: calibração em mm para impressoras
 * que imprimem deslocadas em relação ao recorte da etiqueta (caso real: topo do
 * nome cortado num rolo de 3 colunas, out/2026). Positivo desce o conteúdo,
 * negativo sobe. Sem dependências (testado com Deno em scripts/testes-etiquetas/).
 */

export const LIMITES_AJUSTE_VERTICAL_MM = { min: -5, max: 5 } as const;

/** Número seguro no intervalo -5..+5 (NaN, texto, null e ausente viram 0), com 2 casas. */
export function clampAjusteVertical(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return 0;
  const { min, max } = LIMITES_AJUSTE_VERTICAL_MM;
  const limitado = Math.min(Math.max(valor, min), max);
  // + 0 normaliza -0 (Math.round(-0.001 * 100) = -0).
  return Math.round(limitado * 100) / 100 + 0;
}

/** Ajuste guardado num padrão/config (padrões salvos antes do campo valem 0). */
export function lerAjusteVertical(origem: unknown): number {
  if (!origem || typeof origem !== "object") return 0;
  return clampAjusteVertical((origem as { ajusteVerticalMm?: unknown }).ajusteVerticalMm);
}

export function aplicarAjusteNoPadrao<T extends object>(padrao: T, ajuste: unknown): T & { ajusteVerticalMm: number } {
  return { ...padrao, ajusteVerticalMm: clampAjusteVertical(ajuste) };
}

/**
 * Padding de cima/baixo da etiqueta com o ajuste: o conteúdo desce `ajuste` mm
 * trocando padding de baixo por padding de cima. Enquanto |ajuste| ≤ padding é
 * só um deslocamento (área útil igual); além disso o lado que zerou não fica
 * negativo e a área útil encolhe — o orçamento de altura da etiqueta usa estes
 * valores, então o conteúdo se reacomoda (código de barras mais baixo) em vez de
 * vazar para fora da etiqueta.
 */
export function paddingVerticalComAjuste(paddingMm: number, ajuste: unknown): { topoMm: number; baseMm: number } {
  const a = clampAjusteVertical(ajuste);
  const arred = (mm: number) => Math.round(Math.max(0, mm) * 100) / 100 + 0;
  return { topoMm: arred(paddingMm + a), baseMm: arred(paddingMm - a) };
}

/** "+1,5 mm", "-2 mm", "0 mm". */
export function formatarAjusteVertical(mm: number): string {
  const v = clampAjusteVertical(mm);
  const texto = String(Math.abs(v)).replace(".", ",");
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}${texto} mm`;
}
