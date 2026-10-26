/**
 * Idiomas e mercados do MecApp — os mesmos valores das CHECKs de
 * profiles.idioma e profiles.mercado (migration 20261030120000). Sem React e
 * sem navegador (testado com Deno em scripts/testes-i18n/).
 */
export const IDIOMAS = ["pt-BR", "es", "en", "it"] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_PADRAO: Idioma = "pt-BR";

export const MERCADOS = ["BR", "ES_LATAM", "EN", "IT"] as const;
export type CodigoMercado = (typeof MERCADOS)[number];
export const MERCADO_PADRAO: CodigoMercado = "BR";

/** Nome de cada idioma escrito nele mesmo (seletor de idioma). */
export const NOME_IDIOMA: Record<Idioma, string> = {
  "pt-BR": "Português (Brasil)",
  es: "Español",
  en: "English",
  it: "Italiano",
};

export function ehIdioma(valor: unknown): valor is Idioma {
  return typeof valor === "string" && (IDIOMAS as readonly string[]).includes(valor);
}

export function ehMercado(valor: unknown): valor is CodigoMercado {
  return typeof valor === "string" && (MERCADOS as readonly string[]).includes(valor);
}

/**
 * Etiqueta qualquer ("es-MX", "pt_PT", "EN-us", "it") → idioma do MecApp, ou
 * null se não houver. Todo português vira pt-BR.
 */
export function normalizarIdioma(valor: string | null | undefined): Idioma | null {
  if (!valor) return null;
  const base = valor.trim().replace("_", "-").split("-")[0].toLowerCase();
  if (base === "pt") return "pt-BR";
  return ehIdioma(base) ? base : null;
}
