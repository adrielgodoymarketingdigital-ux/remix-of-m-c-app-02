/**
 * Funil do WhatsApp — custos (cálculo puro, sem rede e sem imports de alias,
 * para rodar no deno test: scripts/testes-crm-leads/custoWhatsApp.test.ts).
 *
 * Entrada = uma linha de public.admin_crm_funil(p_inicio, p_fim).
 *
 * Gasto: UMA FONTE SÓ, nunca somadas.
 *   - "meta"   quando meta_ads_insights_dia tem linhas das campanhas de
 *              WhatsApp (crm_campanhas_whatsapp) em algum dia do período;
 *   - "manual" senão, quando há gasto informado no card;
 *   - "nenhum" sem nenhum dos dois (custos ficam null, nunca 0 nem Infinity).
 * Custo = gasto ÷ quantidade, em centavos inteiros (arredondado); null quando
 * a quantidade é 0.
 *
 * Amostra pequena: menos de 30 conversas OU menos de 5 assinantes no período.
 * Os custos continuam aparecendo, com o aviso. Nenhuma recomendação.
 */

export const AMOSTRA_MIN_CONVERSAS = 30;
export const AMOSTRA_MIN_ASSINANTES = 5;

export interface LinhaFunilWhatsApp {
  conversas: number;
  conversas_anuncio: number;
  ja_clientes: number;
  cadastros: number;
  testes: number;
  assinantes: number;
  opt_outs: number;
  gasto_meta_centavos: number;
  gasto_meta_dias: number;
  gasto_manual_centavos: number;
  gasto_manual_lancamentos: number;
}

export type FonteGasto = "meta" | "manual" | "nenhum";

export interface CustosWhatsApp {
  fonte: FonteGasto;
  gastoCentavos: number | null;
  /** Só para fonte "meta": dias do período com linha da Meta. */
  diasComGastoMeta: number;
  porConversaCentavos: number | null;
  porCadastroCentavos: number | null;
  porAssinanteCentavos: number | null;
  amostraPequena: boolean;
}

/** bigint do Postgres chega como number ou string pelo PostgREST. */
export function lerInteiro(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export function normalizarLinhaFunil(bruta: Record<string, unknown> | null | undefined): LinhaFunilWhatsApp {
  const b = bruta ?? {};
  return {
    conversas: lerInteiro(b.conversas),
    conversas_anuncio: lerInteiro(b.conversas_anuncio),
    ja_clientes: lerInteiro(b.ja_clientes),
    cadastros: lerInteiro(b.cadastros),
    testes: lerInteiro(b.testes),
    assinantes: lerInteiro(b.assinantes),
    opt_outs: lerInteiro(b.opt_outs),
    gasto_meta_centavos: lerInteiro(b.gasto_meta_centavos),
    gasto_meta_dias: lerInteiro(b.gasto_meta_dias),
    gasto_manual_centavos: lerInteiro(b.gasto_manual_centavos),
    gasto_manual_lancamentos: lerInteiro(b.gasto_manual_lancamentos),
  };
}

export function escolherFonteGasto(l: LinhaFunilWhatsApp): { fonte: FonteGasto; gastoCentavos: number | null } {
  if (l.gasto_meta_dias > 0) return { fonte: "meta", gastoCentavos: l.gasto_meta_centavos };
  if (l.gasto_manual_lancamentos > 0) return { fonte: "manual", gastoCentavos: l.gasto_manual_centavos };
  return { fonte: "nenhum", gastoCentavos: null };
}

export function custoPor(gastoCentavos: number | null, quantidade: number): number | null {
  if (gastoCentavos === null || !Number.isFinite(gastoCentavos) || quantidade <= 0) return null;
  return Math.round(gastoCentavos / quantidade);
}

export function ehAmostraPequena(conversas: number, assinantes: number): boolean {
  return conversas < AMOSTRA_MIN_CONVERSAS || assinantes < AMOSTRA_MIN_ASSINANTES;
}

export function calcularCustosWhatsApp(l: LinhaFunilWhatsApp): CustosWhatsApp {
  const { fonte, gastoCentavos } = escolherFonteGasto(l);
  return {
    fonte,
    gastoCentavos,
    diasComGastoMeta: fonte === "meta" ? l.gasto_meta_dias : 0,
    porConversaCentavos: custoPor(gastoCentavos, l.conversas),
    porCadastroCentavos: custoPor(gastoCentavos, l.cadastros),
    porAssinanteCentavos: custoPor(gastoCentavos, l.assinantes),
    amostraPequena: ehAmostraPequena(l.conversas, l.assinantes),
  };
}

/** Percentual com 1 casa (14.8); null quando a base é 0. */
export function percentual(parte: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round((parte / base) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Formulário "informar gasto" — validação igual à de admin_crm_gasto_informar
// ---------------------------------------------------------------------------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD que existe no calendário (recusa 2026-13-01, 2026-02-30). */
function dataValida(s: string): boolean {
  if (!RE_DATA.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}
const RE_AD = /^[A-Za-z0-9_.-]{1,64}$/;

/** "1.234,56" | "1234,56" | "1234.56" | "1234" -> centavos; inválido -> null. */
export function valorDigitadoParaCentavos(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/i, "");
  let normal: string;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})?$/.test(t)) normal = t.replace(",", ".");
  else if (/^\d+(\.\d{1,2})?$/.test(t)) normal = t;
  else return null;
  const [int, dec = ""] = normal.split(".");
  const centavos = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

export type ErroGasto = "periodo_invalido" | "data_futura" | "periodo_longo" | "valor_invalido" | "anuncio_invalido";

export function validarGastoInformado(
  entrada: { inicio: string; fim: string; valor: string; adId?: string },
  hojeISO: string,
): { ok: true; inicio: string; fim: string; valorCentavos: number; adId: string | null } | { ok: false; erro: ErroGasto } {
  const { inicio, fim } = entrada;
  if (!dataValida(inicio) || !dataValida(fim) || fim < inicio) return { ok: false, erro: "periodo_invalido" };
  if (fim > hojeISO) return { ok: false, erro: "data_futura" };
  const dias = (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(dias)) return { ok: false, erro: "periodo_invalido" };
  if (dias > 400) return { ok: false, erro: "periodo_longo" };
  const valorCentavos = valorDigitadoParaCentavos(entrada.valor);
  if (valorCentavos === null || valorCentavos < 1 || valorCentavos > 100_000_000) return { ok: false, erro: "valor_invalido" };
  const ad = (entrada.adId ?? "").trim();
  if (ad !== "" && !RE_AD.test(ad)) return { ok: false, erro: "anuncio_invalido" };
  return { ok: true, inicio, fim, valorCentavos, adId: ad === "" ? null : ad };
}
