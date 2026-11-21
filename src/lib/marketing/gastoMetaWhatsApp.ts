/**
 * Fase 2A — gasto da Meta POR ANÚNCIO (automático, via n8n) no card "Funil do
 * WhatsApp". Regras de apresentação puras (sem rede, sem React, sem imports
 * de alias), testadas em scripts/testes-crm-leads/gastoMeta2a.test.ts.
 *
 * RPCs (supabase/migrations/20261122120000_crm_leads_2a_gasto_meta_anuncio.sql):
 *   admin_crm_funil_gasto(p_inicio, p_fim)             -> 1 linha
 *   admin_crm_funil_gasto_por_anuncio(p_inicio, p_fim) -> até 500 linhas
 * O banco já aplica a regra: o automático vale e o informado do MESMO anúncio
 * e dia (ou o geral, em dia com qualquer linha automática) vem descontado em
 * gasto_manual_efetivo_centavos. Aqui só se soma automático + informado
 * efetivo (nunca se sobrepõem) e se decide o que mostrar.
 *
 * Sem as funções novas (SQL da 2A não aplicado) o card fica EXATAMENTE como
 * antes: custos de calcularCustosWhatsApp (fonte Meta-campanha/informado).
 * Com elas, o gasto da Meta por campanha (meta_ads_insights_dia) é ignorado:
 * o automático por anúncio o substitui, nunca somados.
 */

import { calcularCustosWhatsApp, custoPor, lerInteiro, type CustosWhatsApp, type LinhaFunilWhatsApp } from "./custoWhatsApp.ts";
import type { LinhaAnuncio } from "./funilWhatsApp.ts";

export interface GastoPeriodo {
  gastoAutoCentavos: number;
  diasAuto: number;
  anunciosAuto: number;
  conversasMeta: number;
  impressoes: number;
  cliques: number;
  gastoManualEfetivoCentavos: number;
  lancamentosManuaisEfetivos: number;
  /** ISO da última sincronização (tabela inteira); null = nunca sincronizou. */
  atualizadoEm: string | null;
}

export interface GastoAnuncio {
  adId: string;
  gastoAutoCentavos: number;
  diasAuto: number;
  conversasMeta: number;
  gastoManualEfetivoCentavos: number;
  atualizadoEm: string | null;
}

const registro = (b: unknown) => (typeof b === "object" && b !== null && !Array.isArray(b) ? b : {}) as Record<string, unknown>;

function lerData(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}

/** 1 linha de admin_crm_funil_gasto. */
export function normalizarGastoPeriodo(brutas: unknown): GastoPeriodo {
  const r = registro(Array.isArray(brutas) ? brutas[0] : brutas);
  return {
    gastoAutoCentavos: lerInteiro(r.gasto_auto_centavos),
    diasAuto: lerInteiro(r.dias_auto),
    anunciosAuto: lerInteiro(r.anuncios_auto),
    conversasMeta: lerInteiro(r.conversas_meta),
    impressoes: lerInteiro(r.impressoes),
    cliques: lerInteiro(r.cliques),
    gastoManualEfetivoCentavos: lerInteiro(r.gasto_manual_efetivo_centavos),
    lancamentosManuaisEfetivos: lerInteiro(r.lancamentos_manuais_efetivos),
    atualizadoEm: lerData(r.atualizado_em),
  };
}

/** Linhas de admin_crm_funil_gasto_por_anuncio (descarta linha sem ad_id). */
export function normalizarGastoPorAnuncio(brutas: unknown): GastoAnuncio[] {
  if (!Array.isArray(brutas)) return [];
  return brutas.map(registro).filter((r) => typeof r.ad_id === "string" && r.ad_id !== "").map((r) => ({
    adId: r.ad_id as string,
    gastoAutoCentavos: lerInteiro(r.gasto_auto_centavos),
    diasAuto: lerInteiro(r.dias_auto),
    conversasMeta: lerInteiro(r.conversas_meta),
    gastoManualEfetivoCentavos: lerInteiro(r.gasto_manual_efetivo_centavos),
    atualizadoEm: lerData(r.atualizado_em),
  }));
}

// ---------------------------------------------------------------------------
// Custos do período
// ---------------------------------------------------------------------------

export type FonteGasto2A = "automatico" | "manual" | "nenhum";

export interface Custos2A extends Omit<CustosWhatsApp, "fonte"> {
  fonte: FonteGasto2A | CustosWhatsApp["fonte"];
  /** true = veio das funções da 2A (gasto automático por anúncio). */
  daFase2A: boolean;
  gastoAutoCentavos: number;
  gastoInformadoCentavos: number;
}

/**
 * Sem `g` (função da 2A ausente/erro): exatamente calcularCustosWhatsApp.
 * Com `g`: automático + informado efetivo; Meta por campanha ignorada.
 */
export function custosComGastoAutomatico(f: LinhaFunilWhatsApp, g: GastoPeriodo | null | undefined): Custos2A {
  if (!g) {
    const c = calcularCustosWhatsApp(f);
    return { ...c, daFase2A: false, gastoAutoCentavos: 0, gastoInformadoCentavos: c.fonte === "manual" ? c.gastoCentavos ?? 0 : 0 };
  }
  const fonte: FonteGasto2A = g.diasAuto > 0 ? "automatico" : g.lancamentosManuaisEfetivos > 0 ? "manual" : "nenhum";
  const gasto = fonte === "automatico" ? g.gastoAutoCentavos + g.gastoManualEfetivoCentavos
    : fonte === "manual" ? g.gastoManualEfetivoCentavos : null;
  const base = calcularCustosWhatsApp(f);
  return {
    fonte,
    daFase2A: true,
    gastoCentavos: gasto,
    gastoAutoCentavos: fonte === "automatico" ? g.gastoAutoCentavos : 0,
    gastoInformadoCentavos: fonte === "nenhum" ? 0 : g.gastoManualEfetivoCentavos,
    diasComGastoMeta: fonte === "automatico" ? g.diasAuto : 0,
    porConversaCentavos: custoPor(gasto, f.conversas),
    porCadastroCentavos: custoPor(gasto, f.cadastros),
    porAssinanteCentavos: custoPor(gasto, f.assinantes),
    amostraPequena: base.amostraPequena,
  };
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Rótulo do selo de fonte quando as funções da 2A responderam. */
export function rotuloFonteGasto2A(c: Custos2A, diasPeriodo: number): string {
  if (c.fonte === "automatico") {
    const extra = c.gastoInformadoCentavos > 0 ? ` + ${BRL.format(c.gastoInformadoCentavos / 100)} informado nos dias sem dado da Meta` : "";
    return `Gasto da Meta por anúncio · ${c.diasComGastoMeta} de ${diasPeriodo} dias${extra}`;
  }
  if (c.fonte === "manual") return "Gasto informado (sem dado da Meta no período)";
  return "Sem gasto no período";
}

// ---------------------------------------------------------------------------
// "atualizado há X min" (hora da última sincronização)
// ---------------------------------------------------------------------------

export function textoAtualizado(atualizadoEm: string | null | undefined, agoraMs: number): string | null {
  if (!atualizadoEm) return null;
  const t = Date.parse(atualizadoEm);
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.floor((agoraMs - t) / 60_000));
  if (min < 1) return "atualizado agora há pouco";
  if (min < 60) return `atualizado há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `atualizado há ${h} h`;
  return `atualizado há ${Math.floor(h / 24)} dias`;
}

/** Mais de 6 h sem sincronizar: o card avisa (o n8n roda a cada 1–2 h). */
export function sincronizacaoAtrasada(atualizadoEm: string | null | undefined, agoraMs: number): boolean {
  if (!atualizadoEm) return false;
  const t = Date.parse(atualizadoEm);
  return Number.isFinite(t) && agoraMs - t > 6 * 3_600_000;
}

export const TEXTO_AJUDA_GASTO_META =
  "O gasto vem da Meta por anúncio e dia. A Meta leva de minutos a algumas horas para fechar os números, "
  + "e os últimos 3 dias são recalculados a cada sincronização: o valor de hoje e de ontem ainda pode mudar. "
  + "\"Atualizado há\" é a hora da última sincronização. Gasto informado à mão só vale nos dias sem dado da Meta "
  + "(do mesmo anúncio; o geral, nos dias sem nenhum dado da Meta).";

export function textoConversasMeta(conversasMeta: number, nossas: number): string {
  return `A Meta contou ${conversasMeta.toLocaleString("pt-BR")} ${conversasMeta === 1 ? "conversa" : "conversas"} `
    + `(aqui: ${nossas.toLocaleString("pt-BR")} em que o cliente escreveu primeiro)`;
}

// ---------------------------------------------------------------------------
// Tabela por anúncio
// ---------------------------------------------------------------------------

export type OrigemGasto = "meta" | "informado" | "meta_informado" | null;

export interface LinhaAnuncio2A extends LinhaAnuncio {
  /** Gasto que vale para a linha (null = sem gasto). */
  gastoCentavos: number | null;
  origemGasto: OrigemGasto;
  /** null = sem dado da 2A (coluna não aparece). */
  conversasMeta: number | null;
}

/**
 * Sem `gastos` (função da 2A ausente): gasto = informado da linha, como antes.
 * Com `gastos`: gasto = automático + informado efetivo do anúncio (o
 * gasto_manual_centavos antigo é ignorado: ele não desconta os dias com dado
 * da Meta). Anúncio com gasto e sem nenhuma conversa entra no fim, com zeros.
 */
export function linhasAnuncioComGasto(linhas: LinhaAnuncio[], gastos: GastoAnuncio[] | null | undefined): LinhaAnuncio2A[] {
  if (!gastos) {
    return linhas.map((l) => ({
      ...l,
      gastoCentavos: l.gastoInformadoCentavos > 0 ? l.gastoInformadoCentavos : null,
      origemGasto: l.gastoInformadoCentavos > 0 ? "informado" : null,
      conversasMeta: null,
    }));
  }
  const porAd = new Map(gastos.map((g) => [g.adId, g]));
  const comGasto = (l: LinhaAnuncio, g: GastoAnuncio | undefined): LinhaAnuncio2A => {
    const auto = g?.gastoAutoCentavos ?? 0;
    const inf = g?.gastoManualEfetivoCentavos ?? 0;
    const temAuto = (g?.diasAuto ?? 0) > 0;
    const total = auto + inf;
    const origem: OrigemGasto = temAuto ? (inf > 0 ? "meta_informado" : "meta") : inf > 0 ? "informado" : null;
    return { ...l, gastoCentavos: temAuto || total > 0 ? total : null, origemGasto: origem, conversasMeta: l.adId === "" ? null : g?.conversasMeta ?? 0 };
  };
  const vistas = new Set(linhas.map((l) => l.adId));
  const semConversa = gastos
    .filter((g) => !vistas.has(g.adId) && (g.diasAuto > 0 || g.gastoManualEfetivoCentavos > 0))
    .map((g) => comGasto({ adId: g.adId, titulo: `Anúncio ${g.adId}`, conversas: 0, cadastros: 0, testes: 0, assinantes: 0, gastoInformadoCentavos: 0 }, g));
  return [...linhas.map((l) => comGasto(l, porAd.get(l.adId))), ...semConversa];
}

export function rotuloOrigemGasto(o: OrigemGasto): string {
  if (o === "meta") return "Meta";
  if (o === "meta_informado") return "Meta + informado";
  if (o === "informado") return "informado";
  return "";
}
