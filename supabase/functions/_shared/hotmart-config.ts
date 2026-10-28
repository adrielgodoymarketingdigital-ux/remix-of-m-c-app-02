/**
 * CATÁLOGO DE PRODUTOS HOTMART — versão Deno (Edge Functions)
 *
 * Espelha o padrão de ticto-config.ts. Fluxo internacional (/es).
 *
 * O mapeamento offer_code → plano NÃO fica no repositório: vem do secret
 * HOTMART_OFFER_MAP das Edge Functions, um JSON {"codigo_da_oferta": "plano"}
 * (codigo_da_oferta = data.offer.code no payload do webhook). Secret ausente,
 * JSON inválido ou plano fora da lista: lerMapaOfertas recusa o mapa inteiro
 * e o webhook não ativa nenhuma venda (ver hotmart-webhook/index.ts).
 */

export type PlanoTipoPago =
  | "basico_mensal"
  | "intermediario_mensal"
  | "profissional_mensal"
  | "basico_anual"
  | "intermediario_anual"
  | "profissional_anual";

// ─── Nomes amigáveis ─────────────────────────────────────────────────
export const PLANO_NOMES: Record<PlanoTipoPago, string> = {
  basico_mensal: "Básico Mensal",
  intermediario_mensal: "Intermediário Mensal",
  profissional_mensal: "Profissional Mensal",
  basico_anual: "Básico Anual",
  intermediario_anual: "Intermediário Anual",
  profissional_anual: "Profissional Anual",
};

// ─── Mapeamento: offer_code (Hotmart) → planoTipo ───────────────────
export type MapaOfertas = Readonly<Record<string, PlanoTipoPago>>;

export type LeituraMapaOfertas =
  | { ok: true; mapa: MapaOfertas }
  | { ok: false; erro: string };

const PLACEHOLDER_ANTIGO = "SEU_OFFER_CODE_AQUI";

function ehPlanoPago(valor: unknown): valor is PlanoTipoPago {
  return typeof valor === "string" && Object.hasOwn(PLANO_NOMES, valor);
}

// As mensagens de erro citam a posição da entrada, nunca o código da oferta
// nem o plano: vão para o log e para a notificação do admin.
export function lerMapaOfertas(bruto: string | undefined): LeituraMapaOfertas {
  if (!bruto || bruto.trim() === "") {
    return { ok: false, erro: "secret HOTMART_OFFER_MAP não configurado" };
  }

  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return { ok: false, erro: "HOTMART_OFFER_MAP não é um JSON válido" };
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, erro: 'HOTMART_OFFER_MAP precisa ser um objeto {"codigo":"plano"}' };
  }

  const entradas = Object.entries(json);
  if (entradas.length === 0) {
    return { ok: false, erro: "HOTMART_OFFER_MAP está vazio" };
  }

  const mapa: Record<string, PlanoTipoPago> = {};
  for (const [i, [codigo, plano]] of entradas.entries()) {
    if (codigo.trim() === "" || codigo !== codigo.trim() || codigo === PLACEHOLDER_ANTIGO) {
      return { ok: false, erro: `HOTMART_OFFER_MAP: código da oferta inválido na entrada ${i + 1}` };
    }
    if (!ehPlanoPago(plano)) {
      return { ok: false, erro: `HOTMART_OFFER_MAP: plano inválido na entrada ${i + 1} (aceitos: ${Object.keys(PLANO_NOMES).join(", ")})` };
    }
    mapa[codigo] = plano;
  }
  return { ok: true, mapa };
}

// Object.hasOwn: "__proto__", "constructor" e afins não viram plano.
export function getPlanoFromOfferCode(offerCode: string, mapa: MapaOfertas): PlanoTipoPago | null {
  return Object.hasOwn(mapa, offerCode) ? mapa[offerCode] : null;
}
