/**
 * CATÁLOGO DE PRODUTOS TICTO
 * 
 * Fonte única de verdade para IDs de produto e URLs de checkout da Ticto.
 * Espelhado em supabase/functions/_shared/ticto-config.ts para Edge Functions.
 */

export type PlanoTipoPago =
  | "basico_mensal"
  | "intermediario_mensal"
  | "profissional_mensal"
  | "basico_anual"
  | "intermediario_anual"
  | "profissional_anual";

// ─── IDs de oferta Ticto (offer_code) ────────────────────────────────
export const TICTO_OFFER_CODES: Record<PlanoTipoPago, string> = {
  basico_mensal: "OFF48CFF0",
  intermediario_mensal: "O1F3B8945",
  profissional_mensal: "O6E1764B4",
  basico_anual: "O0D2335D2",
  intermediario_anual: "O31F7E780",
  profissional_anual: "O9A02B1A7",
};

// ─── URLs de checkout ────────────────────────────────────────────────
export const TICTO_CHECKOUT_URLS: Record<PlanoTipoPago, string> = {
  basico_mensal: "https://checkout.ticto.app/OFF48CFF0",
  intermediario_mensal: "https://checkout.ticto.app/O1F3B8945",
  profissional_mensal: "https://checkout.ticto.app/O6E1764B4",
  basico_anual: "https://checkout.ticto.app/O0D2335D2",
  intermediario_anual: "https://checkout.ticto.app/O31F7E780",
  profissional_anual: "https://checkout.ticto.app/O9A02B1A7",
};

// ─── Mapeamento reverso: offer_code → planoTipo ─────────────────────
export const OFFER_CODE_TO_PLANO: Record<string, PlanoTipoPago> = {
  "OFF48CFF0": "basico_mensal",
  "O1F3B8945": "intermediario_mensal",
  "O6E1764B4": "profissional_mensal",
  "O0D2335D2": "basico_anual",
  "O31F7E780": "intermediario_anual",
  "O9A02B1A7": "profissional_anual",
};

// ─── Helpers ─────────────────────────────────────────────────────────
export function getCheckoutUrl(plano: PlanoTipoPago, email?: string): string {
  const baseUrl = TICTO_CHECKOUT_URLS[plano];
  if (email) {
    return `${baseUrl}?email=${encodeURIComponent(email)}`;
  }
  return baseUrl;
}

export function getPlanoFromOfferCode(offerCode: string): PlanoTipoPago | null {
  return OFFER_CODE_TO_PLANO[offerCode] ?? null;
}
