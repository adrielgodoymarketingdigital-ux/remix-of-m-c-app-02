/**
 * CATÁLOGO DE PRODUTOS HOTMART — versão Deno (Edge Functions)
 *
 * Espelha o padrão de ticto-config.ts. Fluxo internacional (/es), MVP de
 * validação de demanda — inicialmente só uma oferta mapeada.
 *
 * ⚠️ PREENCHER: troque "SEU_OFFER_CODE_AQUI" pelo código real da oferta
 * (data.offer.code no payload do webhook), copiado do painel da Hotmart
 * depois de criar o produto/oferta.
 */

export type PlanoTipoPago =
  | "basico_mensal"
  | "intermediario_mensal"
  | "profissional_mensal"
  | "basico_anual"
  | "intermediario_anual"
  | "profissional_anual";

// ─── Mapeamento: offer_code (Hotmart) → planoTipo ───────────────────
export const OFFER_CODE_TO_PLANO: Record<string, PlanoTipoPago> = {
  "SEU_OFFER_CODE_AQUI": "intermediario_mensal",
};

// ─── Nomes amigáveis ─────────────────────────────────────────────────
export const PLANO_NOMES: Record<PlanoTipoPago, string> = {
  basico_mensal: "Básico Mensal",
  intermediario_mensal: "Intermediário Mensal",
  profissional_mensal: "Profissional Mensal",
  basico_anual: "Básico Anual",
  intermediario_anual: "Intermediário Anual",
  profissional_anual: "Profissional Anual",
};

export function getPlanoFromOfferCode(offerCode: string): PlanoTipoPago | null {
  return OFFER_CODE_TO_PLANO[offerCode] ?? null;
}
