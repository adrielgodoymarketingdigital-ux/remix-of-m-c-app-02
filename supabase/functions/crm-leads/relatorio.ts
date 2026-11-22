// Ação "relatorio_marketing" (n8n: relatório semanal e mensal) — regras puras,
// sem rede e sem Supabase, para o deno test.
// Contrato: docs/crm-leads/CONTRATO.md, seção 4.10. Números: public.crm_relatorio_marketing
// (supabase/migrations/20261123120000_crm_leads_relatorio_marketing.sql).
//
// Datas: sempre de calendário de Brasília. hojeISO vem de dataBrasiliaISO()
// (_shared/dataBrasilia.ts); a conta é feita em UTC sobre as strings
// YYYY-MM-DD, então o fuso do servidor não interfere.

export const PERIODOS_RELATORIO = ["semana_anterior", "mes_anterior", "personalizado"] as const;
export type PeriodoRelatorio = typeof PERIODOS_RELATORIO[number];

/** Mesmo limite do card (intervaloFunil): fim − início ≤ 400. */
export const MAX_DIAS_RELATORIO = 400;

export type ErroPeriodo =
  | "periodo_invalido" | "datas_obrigatorias" | "datas_so_no_personalizado"
  | "data_invalida" | "periodo_invertido" | "data_futura" | "periodo_longo";

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ID = /^[A-Za-z0-9_.-]{1,64}$/;

function dataValida(s: unknown): s is string {
  if (typeof s !== "string" || !RE_DIA.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000);
}

/**
 * semana_anterior = última semana COMPLETA (segunda a domingo) antes de hoje.
 *   Hoje segunda 23/11 -> 16/11..22/11; hoje domingo 22/11 -> 09/11..15/11.
 * mes_anterior = último mês de calendário completo (hoje 01/12 -> 01/11..30/11).
 * personalizado = inicio e fim obrigatórios, fim ≥ inicio, fim ≤ hoje, até 400 dias.
 */
export function periodoRelatorio(
  params: Record<string, unknown>,
  hojeISO: string,
): { ok: true; periodo: PeriodoRelatorio; inicio: string; fim: string } | { ok: false; erro: ErroPeriodo } {
  const periodo = params.periodo;
  if (typeof periodo !== "string" || !(PERIODOS_RELATORIO as readonly string[]).includes(periodo)) {
    return { ok: false, erro: "periodo_invalido" };
  }
  const temDatas = params.inicio !== undefined || params.fim !== undefined;

  if (periodo === "semana_anterior") {
    if (temDatas) return { ok: false, erro: "datas_so_no_personalizado" };
    const diaDaSemana = (new Date(`${hojeISO}T00:00:00Z`).getUTCDay() + 6) % 7; // segunda = 0
    const segunda = somarDias(hojeISO, -diaDaSemana);
    return { ok: true, periodo, inicio: somarDias(segunda, -7), fim: somarDias(segunda, -1) };
  }
  if (periodo === "mes_anterior") {
    if (temDatas) return { ok: false, erro: "datas_so_no_personalizado" };
    const fim = somarDias(`${hojeISO.slice(0, 8)}01`, -1);
    return { ok: true, periodo, inicio: `${fim.slice(0, 8)}01`, fim };
  }

  const { inicio, fim } = params;
  if (inicio === undefined || fim === undefined) return { ok: false, erro: "datas_obrigatorias" };
  if (!dataValida(inicio) || !dataValida(fim)) return { ok: false, erro: "data_invalida" };
  if (fim < inicio) return { ok: false, erro: "periodo_invertido" };
  if (fim > hojeISO) return { ok: false, erro: "data_futura" };
  if (diasEntre(inicio, fim) > MAX_DIAS_RELATORIO) return { ok: false, erro: "periodo_longo" };
  return { ok: true, periodo: "personalizado", inicio, fim };
}

// ---------------------------------------------------------------------------
// Resposta: lista fechada de campos (só agregados). Qualquer coisa a mais que
// a função SQL devolva é descartada aqui.
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null && !Array.isArray(v) ? v as Obj : {});
/** Inteiro ≥ 0 (bigint do jsonb chega como number); qualquer outra coisa -> 0. */
const int = (v: unknown): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : 0);
/** Inteiro ≥ 0 ou null (custos e gasto sem fonte). */
const intOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null);
const data = (v: unknown): string | null => (dataValida(v) ? v : null);
const instante = (v: unknown): string | null =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null;

const FONTES = ["automatico", "manual", "nenhum"] as const;

function cadastros(v: unknown) {
  const o = obj(v);
  return { total: int(o.total), com_utm: int(o.com_utm), vindos_meta: int(o.vindos_meta) };
}

function funil(v: unknown) {
  const o = obj(v);
  return {
    conversas_iniciadas: int(o.conversas_iniciadas),
    cadastros: int(o.cadastros),
    em_teste_agora: int(o.em_teste_agora),
    teste_acabou_sem_pagar: int(o.teste_acabou_sem_pagar),
    assinantes_pagos: int(o.assinantes_pagos),
  };
}

export function montarRelatorioMarketing(bruto: unknown) {
  const r = obj(bruto);
  const p = obj(r.periodo), pa = obj(r.periodo_anterior);
  const c = obj(r.cadastros), f = obj(r.funil_whatsapp), g = obj(r.gasto), cu = obj(r.custos), am = obj(r.amadurecendo);
  const fonte = (FONTES as readonly unknown[]).includes(g.fonte) ? g.fonte as typeof FONTES[number] : "nenhum";
  return {
    periodo: { inicio: data(p.inicio), fim: data(p.fim), dias: int(p.dias) },
    periodo_anterior: { inicio: data(pa.inicio), fim: data(pa.fim) },
    cadastros: { ...cadastros(c), anterior: cadastros(c.anterior) },
    funil_whatsapp: { ...funil(f), anterior: funil(f.anterior) },
    gasto: {
      total_centavos: intOuNull(g.total_centavos),
      meta_centavos: int(g.meta_centavos),
      manual_centavos: int(g.manual_centavos),
      fonte,
      dias_com_gasto_meta: int(g.dias_com_gasto_meta),
      dias_no_periodo: int(g.dias_no_periodo),
      atualizado_em: instante(g.atualizado_em),
    },
    custos: {
      por_conversa_centavos: intOuNull(cu.por_conversa_centavos),
      por_cadastro_centavos: intOuNull(cu.por_cadastro_centavos),
      por_assinante_centavos: intOuNull(cu.por_assinante_centavos),
    },
    receita_estimada_centavos: int(r.receita_estimada_centavos),
    amadurecendo: { cadastros_em_teste: int(am.cadastros_em_teste) },
    por_anuncio: (Array.isArray(r.por_anuncio) ? r.por_anuncio : []).map((x) => {
      const a = obj(x);
      const adId = typeof a.ad_id === "string" && RE_ID.test(a.ad_id) ? a.ad_id : null;
      return {
        ad_id: adId,
        rotulo: typeof a.rotulo === "string" && a.rotulo.trim() !== ""
          ? a.rotulo.slice(0, 200)
          : adId === null ? "Sem anúncio (orgânico / link direto)" : `Anúncio ${adId}`,
        conversas: int(a.conversas),
        cadastros: int(a.cadastros),
        teste: int(a.teste),
        assinantes: int(a.assinantes),
        gasto_centavos: intOuNull(a.gasto_centavos),
        custo_por_conversa_centavos: intOuNull(a.custo_por_conversa_centavos),
      };
    }),
  };
}
