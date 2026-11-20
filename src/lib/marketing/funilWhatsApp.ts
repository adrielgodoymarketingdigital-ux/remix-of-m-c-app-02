/**
 * Card "Funil do WhatsApp" (/admin/marketing) — regras de apresentação, puras
 * (sem rede, sem React, sem imports de alias), testadas em
 * scripts/testes-crm-leads/funilWhatsApp.test.ts.
 *
 * Custo, fonte do gasto e "amostra pequena" NÃO são calculados aqui: vêm de
 * ./custoWhatsApp.ts (fonte única da 1A). Este arquivo só decide o que mostrar.
 *
 * RPCs (supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql):
 *   admin_crm_funil(p_inicio date, p_fim date)            -> 1 linha de contagens/gastos
 *   admin_crm_funil_por_anuncio(p_inicio date, p_fim date) -> até 200 linhas
 *   admin_crm_gasto_informar(p_inicio, p_fim, p_valor numeric, p_ad_id text, p_descricao text) -> bigint
 *   admin_crm_gasto_remover(p_id bigint)                  -> boolean
 * Nenhuma delas devolve telefone, nome ou texto de lead.
 */

import { custoPor, ehAmostraPequena, lerInteiro } from "./custoWhatsApp.ts";

// ---------------------------------------------------------------------------
// Período do card: 7, 14, 30 dias ou personalizado (datas de Brasília)
// ---------------------------------------------------------------------------

export type PeriodoFunil = "7d" | "14d" | "30d" | "personalizado";

export const PERIODOS_FUNIL: { valor: PeriodoFunil; rotulo: string }[] = [
  { valor: "7d", rotulo: "Últimos 7 dias" },
  { valor: "14d", rotulo: "Últimos 14 dias" },
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "personalizado", rotulo: "Personalizado" },
];

export const MAX_DIAS_FUNIL = 400;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD de uma data à meia-noite UTC (getters UTC: datas de calendário, sem fuso). */
function isoDeDataUTC(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function dataValidaISO(s: string): boolean {
  if (!RE_DATA.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && isoDeDataUTC(new Date(t)) === s;
}

export function somarDiasISO(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return isoDeDataUTC(d);
}

export function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000);
}

export type ResultadoIntervalo =
  | { ok: true; inicio: string; fim: string; dias: number }
  | { ok: false; erro: string };

/** Intervalo inclusivo (inicio..fim) a mandar para as RPCs, ou o motivo de não mandar. */
export function intervaloFunil(
  periodo: PeriodoFunil,
  personalizado: { inicio: string; fim: string },
  hojeISO: string,
): ResultadoIntervalo {
  if (periodo !== "personalizado") {
    const n = { "7d": 7, "14d": 14, "30d": 30 }[periodo];
    return { ok: true, inicio: somarDiasISO(hojeISO, -(n - 1)), fim: hojeISO, dias: n };
  }
  const { inicio, fim } = personalizado;
  if (!dataValidaISO(inicio) || !dataValidaISO(fim)) return { ok: false, erro: "Escolha as duas datas." };
  if (fim < inicio) return { ok: false, erro: "A data final é anterior à inicial." };
  if (fim > hojeISO) return { ok: false, erro: "A data final não pode ser futura." };
  if (diasEntre(inicio, fim) > MAX_DIAS_FUNIL) return { ok: false, erro: "Período máximo de 400 dias." };
  return { ok: true, inicio, fim, dias: diasEntre(inicio, fim) + 1 };
}

// ---------------------------------------------------------------------------
// Formatação (sem Infinity/NaN; null vira "—")
// ---------------------------------------------------------------------------

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarCentavos(c: number | null | undefined): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return "—";
  return BRL.format(c / 100);
}

/** Custo = gasto ÷ quantidade (custoPor da lib); quantidade 0 ou sem gasto -> "—". */
export function formatarCusto(gastoCentavos: number | null, quantidade: number): string {
  return formatarCentavos(custoPor(gastoCentavos, quantidade));
}

export function formatarNumero(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—";
}

export function formatarPercentual(p: number | null): string {
  return p === null || !Number.isFinite(p) ? "—" : `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function formatarDataBR(iso: string): string {
  return dataValidaISO(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso;
}

// ---------------------------------------------------------------------------
// Aviso de amostra pequena (regra: ehAmostraPequena da lib)
// ---------------------------------------------------------------------------

export const TEXTO_AMOSTRA_PEQUENA = "Amostra pequena: use como indicativo";

export function avisoAmostraPequena(conversas: number, assinantes: number): string | null {
  return ehAmostraPequena(conversas, assinantes) ? TEXTO_AMOSTRA_PEQUENA : null;
}

// ---------------------------------------------------------------------------
// Fonte do gasto (sempre uma só)
// ---------------------------------------------------------------------------

export function rotuloFonteGasto(fonte: "meta" | "manual" | "nenhum", diasMeta: number, diasPeriodo: number): string {
  if (fonte === "meta") return `Gasto da Meta (campanhas de WhatsApp) · ${diasMeta} de ${diasPeriodo} dias`;
  if (fonte === "manual") return "Gasto informado";
  return "Sem gasto no período";
}

// ---------------------------------------------------------------------------
// Linhas por anúncio
// ---------------------------------------------------------------------------

export interface LinhaAnuncio {
  adId: string;            // "" = sem anúncio
  titulo: string;
  conversas: number;
  cadastros: number;
  testes: number;
  assinantes: number;
  gastoInformadoCentavos: number;
}

export function normalizarLinhasAnuncio(brutas: unknown): LinhaAnuncio[] {
  if (!Array.isArray(brutas)) return [];
  return brutas.map((b) => {
    const r = (typeof b === "object" && b !== null ? b : {}) as Record<string, unknown>;
    const adId = typeof r.ad_id === "string" ? r.ad_id : "";
    const titulo = typeof r.ad_titulo === "string" && r.ad_titulo.trim() !== "" ? r.ad_titulo.trim() : "";
    return {
      adId,
      titulo: adId === "" ? "Sem anúncio (orgânico / link direto)" : titulo || `Anúncio ${adId}`,
      conversas: lerInteiro(r.conversas),
      cadastros: lerInteiro(r.cadastros),
      testes: lerInteiro(r.testes),
      assinantes: lerInteiro(r.assinantes),
      gastoInformadoCentavos: lerInteiro(r.gasto_manual_centavos),
    };
  });
}

// ---------------------------------------------------------------------------
// Erros das RPCs
// ---------------------------------------------------------------------------

export interface ErroRpc { code?: string | null; message?: string | null }

/**
 * "nao_ativado": a função/tabela ainda não existe no banco (SQL da fase 1 não
 * aplicado). PostgREST: PGRST202 (função) / PGRST205 (tabela); Postgres:
 * 42883 (função) / 42P01 (tabela).
 */
export type EstadoErroFunil = "nao_ativado" | "sem_permissao" | "falha";

export function classificarErroFunil(e: ErroRpc | null | undefined): EstadoErroFunil {
  const code = e?.code ?? "";
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(code)) return "nao_ativado";
  if ((e?.message ?? "").includes("Apenas administradores")) return "sem_permissao";
  return "falha";
}

export const TEXTO_NAO_ATIVADO = "Funil do WhatsApp ainda não ativado";

/** Mensagem em português para a recusa do gasto informado (RPC ou validação local). */
export function mensagemRecusaGasto(e: ErroRpc | string | null | undefined): string {
  if (typeof e === "string") {
    const local: Record<string, string> = {
      periodo_invalido: "Período inválido: confira as datas de início e fim.",
      data_futura: "A data final não pode ser futura.",
      periodo_longo: "O período pode ter no máximo 400 dias.",
      valor_invalido: "Valor inválido: informe de R$ 0,01 a R$ 1.000.000,00, com no máximo 2 casas decimais.",
      anuncio_invalido: "ID do anúncio inválido: use só letras, números, ponto, hífen ou sublinhado.",
      descricao_longa: "A observação pode ter no máximo 200 caracteres.",
    };
    return local[e] ?? "Não foi possível salvar o gasto.";
  }
  const msg = e?.message ?? "";
  const code = e?.code ?? "";
  if (code === "23P01" || msg.includes("sobrepõe")) {
    return "Já existe gasto informado que se sobrepõe a este período (mesmo anúncio ou gasto geral). Remova o lançamento anterior antes de informar de novo.";
  }
  if (msg.includes("Período inválido")) return "Período inválido: até 400 dias e sem datas futuras.";
  if (msg.includes("Valor inválido")) return "Valor inválido: informe de R$ 0,01 a R$ 1.000.000,00, com no máximo 2 casas decimais (valor zero não é aceito).";
  if (msg.includes("ID do anúncio")) return "ID do anúncio inválido: use só letras, números, ponto, hífen ou sublinhado.";
  if (msg.includes("Descrição")) return "A observação pode ter no máximo 200 caracteres.";
  if (msg.includes("Apenas administradores")) return "Só administradores podem informar gasto.";
  if (classificarErroFunil(e) === "nao_ativado") return `${TEXTO_NAO_ATIVADO}: o gasto ainda não pode ser informado.`;
  return "Não foi possível salvar o gasto. Tente de novo.";
}

// ---------------------------------------------------------------------------
// Lançamentos de gasto informado (crm_gasto_manual, leitura via RLS de admin)
// ---------------------------------------------------------------------------

export interface LancamentoGasto {
  id: number;
  inicio: string;
  fim: string;
  adId: string | null;
  descricao: string | null;
  valorCentavos: number;
}

/** numeric(14,2) chega como string ("123.45") ou number; -> centavos inteiros. */
export function numericParaCentavos(v: unknown): number {
  const t = typeof v === "number" ? v.toFixed(2) : typeof v === "string" ? v.trim() : "";
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return 0;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function normalizarLancamentos(brutos: unknown): LancamentoGasto[] {
  if (!Array.isArray(brutos)) return [];
  return brutos
    .map((b) => (typeof b === "object" && b !== null ? b : {}) as Record<string, unknown>)
    .filter((r) => r.removido_em === null || r.removido_em === undefined)
    .map((r) => ({
      id: lerInteiro(r.id),
      inicio: String(r.inicio ?? ""),
      fim: String(r.fim ?? ""),
      adId: typeof r.ad_id === "string" && r.ad_id !== "" ? r.ad_id : null,
      descricao: typeof r.descricao === "string" && r.descricao !== "" ? r.descricao : null,
      valorCentavos: numericParaCentavos(r.valor),
    }));
}
