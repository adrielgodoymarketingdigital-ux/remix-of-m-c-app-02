/**
 * CATÁLOGO CENTRAL DE PLANOS
 * 
 * Fonte única de verdade para IDs de preço Stripe, mapeamentos e preços.
 * Este arquivo é espelhado em supabase/functions/_shared/planos-config.ts
 * para uso em Edge Functions (Deno). Qualquer alteração aqui deve ser 
 * replicada lá.
 */

export type PlanoTipoPago =
  | "basico_mensal"
  | "intermediario_mensal"
  | "profissional_mensal"
  | "basico_anual"
  | "intermediario_anual"
  | "profissional_anual"
  | "profissional_ultra_mensal"
  | "profissional_ultra_anual";

// ─── IDs de preço Stripe (conta atual) ───────────────────────────────
export const STRIPE_PRICE_IDS: Record<PlanoTipoPago, string> = {
  basico_mensal: "price_1TCTqfFu8jWFILvSyfTI73ff",
  intermediario_mensal: "price_1TCTrRFu8jWFILvSl50ZKqpy",
  profissional_mensal: "price_1TCTrnFu8jWFILvS4hBfmUiz",
  basico_anual: "price_1TCTszFu8jWFILvSLajvpW8A",
  intermediario_anual: "price_1TCTtTFu8jWFILvSwTuoRvm8",
  profissional_anual: "price_1TCTtxFu8jWFILvSZgjoxpX6",
  profissional_ultra_mensal: "",
  profissional_ultra_anual: "",
};

// ─── Mapeamento planoTipo → priceId ──────────────────────────────────
export const PLANO_TO_PRICE = STRIPE_PRICE_IDS;

// ─── Mapeamento reverso priceId → planoTipo (inclui IDs legados) ─────
export const PRICE_TO_PLANO: Record<string, PlanoTipoPago> = {
  // Conta atual
  "price_1TCTqfFu8jWFILvSyfTI73ff": "basico_mensal",
  "price_1TCTrRFu8jWFILvSl50ZKqpy": "intermediario_mensal",
  "price_1TCTrnFu8jWFILvS4hBfmUiz": "profissional_mensal",
  "price_1TCTszFu8jWFILvSLajvpW8A": "basico_anual",
  "price_1TCTtTFu8jWFILvSwTuoRvm8": "intermediario_anual",
  "price_1TCTtxFu8jWFILvSZgjoxpX6": "profissional_anual",
  // Legados — conta anterior (Skx)
  "price_1SkxEACjA5c0MuV8VVfibyhD": "basico_mensal",
  "price_1SkxLbCjA5c0MuV8M6rYpYd6": "intermediario_mensal",
  "price_1SkxObCjA5c0MuV8G3OccySn": "profissional_mensal",
  "price_1SkxQnCjA5c0MuV8J0F7vf5m": "basico_anual",
  "price_1SkxRPCjA5c0MuV8cgcNtFsf": "intermediario_anual",
  "price_1SkxSNCjA5c0MuV8yJ5ZLr7o": "profissional_anual",
  // Legados — conta anterior (SlD / SSF)
  "price_1SlDtpCjA5c0MuV8RAmPGdHb": "basico_mensal",
  "price_1SlDxDCjA5c0MuV8eaynwHC5": "intermediario_mensal",
  "price_1SSFGSCjA5c0MuV8tQE82qGs": "profissional_anual",
  "price_1SSFE6CjA5c0MuV8wQcFYhHf": "intermediario_anual",
};

// ─── Preços para exibição (em BRL) ───────────────────────────────────
export const PRECOS: Record<PlanoTipoPago, number> = {
  basico_mensal: 19.90,
  intermediario_mensal: 39.90,
  profissional_mensal: 79.90,
  basico_anual: 190.80,
  intermediario_anual: 382.80,
  profissional_anual: 898.80,
  profissional_ultra_mensal: 129.90,
  profissional_ultra_anual: 1318.80,
};

// ─── Valores em centavos para Pagar.me ───────────────────────────────
export const PRECOS_CENTAVOS: Record<PlanoTipoPago, number> = {
  basico_mensal: 1990,
  intermediario_mensal: 3990,
  profissional_mensal: 7990,
  basico_anual: 19080,
  intermediario_anual: 38280,
  profissional_anual: 89880,
  profissional_ultra_mensal: 12990,
  profissional_ultra_anual: 131880,
};

// ─── Nomes amigáveis ─────────────────────────────────────────────────
export const PLANO_NOMES: Record<PlanoTipoPago, string> = {
  basico_mensal: "Básico Mensal",
  intermediario_mensal: "Intermediário Mensal",
  profissional_mensal: "Profissional Mensal",
  basico_anual: "Básico Anual",
  intermediario_anual: "Intermediário Anual",
  profissional_anual: "Profissional Anual",
  profissional_ultra_mensal: "Ultra Mensal",
  profissional_ultra_anual: "Ultra Anual",
};

// ─── Helper: obter planoTipo a partir de qualquer priceId ────────────
export function getPlanoFromPriceId(priceId: string): PlanoTipoPago | null {
  return PRICE_TO_PLANO[priceId] ?? null;
}

// ─── Helper: obter priceId Stripe para um plano ─────────────────────
export function getPriceIdFromPlano(plano: PlanoTipoPago): string {
  return STRIPE_PRICE_IDS[plano];
}

// ─── IDs de plano Pagar.me ───────────────────────────────────────────
export const PAGARME_PLAN_IDS: Record<PlanoTipoPago, string> = {
  basico_mensal: "plan_dJwbQ2trnFVlEOqD",
  intermediario_mensal: "plan_BJOKlwGi3HrZEM6Q",
  profissional_mensal: "plan_W8ZYNDuJ8T28jAOe",
  basico_anual: "plan_QNKdqZays0u9rpO4",
  intermediario_anual: "plan_0J7BaJRCXiJaj4rp",
  profissional_anual: "plan_lQA4XEWfaPhevqb5",
  profissional_ultra_mensal: "plan_6jJlbZC9mCoxlL71",
  profissional_ultra_anual: "plan_2mLJ98I7Ohp7ROgN",
};

// ─── Helper: obter plan_id Pagar.me para um plano ───────────────────
export function getPagarmePlanId(plano: PlanoTipoPago): string {
  return PAGARME_PLAN_IDS[plano];
}
