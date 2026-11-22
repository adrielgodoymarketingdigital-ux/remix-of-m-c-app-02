// Validação pura do contrato da Edge Function
// crm-leads (sem rede, sem Supabase: roda no deno test).
// Contrato completo em docs/crm-leads/CONTRATO.md.

import { normalizarTelefone } from "./telefone.ts";

export const MAX_ITENS = 200;
/** Fase 2A: lote menor para o gasto da Meta (a função SQL recusa > 100). */
export const MAX_ITENS_GASTO = 100;
/** Feedback: registro de envio (a função SQL recusa > 100). */
export const MAX_ITENS_REGISTRO = 100;
export const MAX_BYTES = 512 * 1024;

export const ACOES = [
  "mensagens",        // fase 1: captura (entrada e saída)
  "resumo",           // fase 1: assunto/resumo/etapa vindos da IA
  "vincular",         // fase 1: telefone + user_id no momento do cadastro
  "vincular_lote",    // fase 1: cruzamento DDD + 8 dígitos com profiles
  "opt_out",          // fase 1: opt-out por fora da mensagem
  "retencao",         // fase 1: apaga mensagens/resumo após 90 dias
  "relatorio",        // fase 1: números agregados do dia (Brasília)
  "gasto_meta",       // fase 2A: gasto da Meta por anúncio e dia (Insights nível ad)
  "pagantes_contato", // feedback: lista de pagantes elegíveis para uma campanha
  "contato_registrar",// feedback: quem recebeu / falhou
] as const;
export type Acao = typeof ACOES[number];

const TIPOS = ["texto", "audio", "imagem", "video", "documento", "figurinha", "localizacao", "contato", "outro"];

export interface MensagemNormalizada {
  telefone: string;
  wa_jid: string | null;
  nome: string | null;
  wa_message_id: string;
  direcao: "entrada" | "saida";
  autor: "lead" | "humano" | "automacao";
  tipo: string;
  texto: string | null;
  enviada_em: string;
  referral: {
    ad_id: string | null;
    titulo: string | null;
    tipo: string | null;
    ctwa_clid: string | null;
    url: string | null;
  } | null;
}

export type ErroItem =
  | "nao_objeto" | "telefone_invalido" | "wa_message_id_invalido" | "direcao_invalida"
  | "autor_invalido" | "tipo_invalido" | "data_invalida" | "ad_id_invalido";

export type ResultadoEnvelope =
  | { ok: true; acao: Acao; itens: unknown[]; params: Record<string, unknown> }
  | { ok: false; status: 400 | 413; erro: string };

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, max);
};

/** Tamanho máximo do lote por ação (o 413 devolve este número). */
export function maxItens(acao: unknown): number {
  return acao === "gasto_meta" ? MAX_ITENS_GASTO : acao === "contato_registrar" ? MAX_ITENS_REGISTRO : MAX_ITENS;
}

/** Envelope: {acao, itens?, ...params}. Um item solto vira lote de 1. */
export function lerEnvelope(corpo: unknown): ResultadoEnvelope {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return { ok: false, status: 400, erro: "json_invalido" };
  }
  const { acao, itens, item, ...params } = corpo as Record<string, unknown>;
  if (typeof acao !== "string" || !(ACOES as readonly string[]).includes(acao)) {
    return { ok: false, status: 400, erro: "acao_invalida" };
  }
  const precisaItens = acao === "mensagens" || acao === "resumo" || acao === "vincular" || acao === "opt_out"
    || acao === "gasto_meta" || acao === "contato_registrar";
  const lista = Array.isArray(itens) ? itens : item !== undefined ? [item] : [];
  if (precisaItens && lista.length === 0) return { ok: false, status: 400, erro: "itens_vazios" };
  if (lista.length > maxItens(acao)) return { ok: false, status: 413, erro: "lote_grande" };
  return { ok: true, acao: acao as Acao, itens: lista, params };
}

/** Uma mensagem do n8n -> formato da função crm_ingerir_mensagens. */
export function normalizarMensagem(
  bruto: unknown,
  agora: Date = new Date(),
): { ok: true; valor: MensagemNormalizada } | { ok: false; erro: ErroItem } {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return { ok: false, erro: "nao_objeto" };
  const m = bruto as Record<string, unknown>;

  const telefone = normalizarTelefone(typeof m.telefone === "string" ? m.telefone : null);
  if (!telefone) return { ok: false, erro: "telefone_invalido" };

  const id = typeof m.wa_message_id === "string" ? m.wa_message_id.trim() : "";
  if (id.length < 1 || id.length > 128) return { ok: false, erro: "wa_message_id_invalido" };

  if (m.direcao !== "entrada" && m.direcao !== "saida") return { ok: false, erro: "direcao_invalida" };
  const autor = m.autor ?? (m.direcao === "entrada" ? "lead" : "humano");
  if (m.direcao === "entrada" ? autor !== "lead" : autor !== "humano" && autor !== "automacao") {
    return { ok: false, erro: "autor_invalido" };
  }

  const tipo = m.tipo ?? "texto";
  if (typeof tipo !== "string" || !TIPOS.includes(tipo)) return { ok: false, erro: "tipo_invalido" };

  const ms = typeof m.enviada_em === "string" ? Date.parse(m.enviada_em)
    : typeof m.enviada_em === "number" ? m.enviada_em * (m.enviada_em < 1e12 ? 1000 : 1) // epoch s ou ms
    : NaN;
  if (!Number.isFinite(ms) || ms > agora.getTime() + 10 * 60_000 || ms < agora.getTime() - 400 * 86_400_000) {
    return { ok: false, erro: "data_invalida" };
  }

  let referral: MensagemNormalizada["referral"] = null;
  if (typeof m.referral === "object" && m.referral !== null) {
    const r = m.referral as Record<string, unknown>;
    const adId = texto(r.ad_id, 64);
    if (adId !== null && !/^[A-Za-z0-9_.-]{1,64}$/.test(adId)) return { ok: false, erro: "ad_id_invalido" };
    referral = {
      ad_id: adId,
      titulo: texto(r.titulo, 200),
      tipo: texto(r.tipo, 20),
      ctwa_clid: texto(r.ctwa_clid, 500),
      url: texto(r.url, 500),
    };
    if (Object.values(referral).every((v) => v === null)) referral = null;
  }

  return {
    ok: true,
    valor: {
      telefone,
      wa_jid: texto(m.wa_jid, 100),
      nome: texto(m.nome, 120),
      wa_message_id: id,
      direcao: m.direcao,
      autor: autor as MensagemNormalizada["autor"],
      tipo,
      // Mídia nunca é guardada; só o texto/legenda.
      texto: texto(m.texto, 2000),
      enviada_em: new Date(ms).toISOString(),
      referral,
    },
  };
}

// ---------------------------------------------------------------------------
// Fase 2A: gasto da Meta por anúncio e dia. Mesmas regras de
// crm_gravar_gasto_meta (o banco valida de novo).
// ---------------------------------------------------------------------------

export interface GastoMetaNormalizado {
  ad_id: string;
  campaign_id: string | null;
  data: string;
  gasto_centavos: number;
  impressoes: number;
  cliques: number;
  conversas_meta: number;
  moeda: string;
}

export type ErroGastoMeta =
  | "nao_objeto" | "ad_id_invalido" | "campaign_id_invalido" | "data_invalida" | "data_fora_da_janela"
  | "gasto_invalido" | "impressoes_invalido" | "cliques_invalido" | "conversas_meta_invalido" | "moeda_invalida";

const RE_ID = /^[A-Za-z0-9_.-]{1,64}$/;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

const LIMITES = { gasto_centavos: 100_000_000, impressoes: 1_000_000_000, cliques: 1_000_000_000, conversas_meta: 10_000_000 } as const;

function diaISO(s: string, delta: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Um item do n8n -> formato de crm_gravar_gasto_meta. hojeISO = hoje em Brasília. */
export function normalizarGastoMeta(
  bruto: unknown,
  hojeISO: string,
): { ok: true; valor: GastoMetaNormalizado } | { ok: false; erro: ErroGastoMeta } {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return { ok: false, erro: "nao_objeto" };
  const g = bruto as Record<string, unknown>;

  if (typeof g.ad_id !== "string" || !RE_ID.test(g.ad_id)) return { ok: false, erro: "ad_id_invalido" };
  let campaign: string | null = null;
  if (g.campaign_id !== undefined && g.campaign_id !== null) {
    if (typeof g.campaign_id !== "string" || !RE_ID.test(g.campaign_id)) return { ok: false, erro: "campaign_id_invalido" };
    campaign = g.campaign_id;
  }

  const dia = typeof g.data === "string" ? g.data : "";
  if (!RE_DIA.test(dia) || Number.isNaN(Date.parse(`${dia}T00:00:00Z`)) || new Date(`${dia}T00:00:00Z`).toISOString().slice(0, 10) !== dia) {
    return { ok: false, erro: "data_invalida" };
  }
  if (dia < diaISO(hojeISO, -400) || dia > diaISO(hojeISO, 1) || dia < "2024-01-01") return { ok: false, erro: "data_fora_da_janela" };

  const nums = {} as Record<keyof typeof LIMITES, number>;
  for (const campo of Object.keys(LIMITES) as (keyof typeof LIMITES)[]) {
    const v = g[campo];
    if (v === undefined || v === null) {
      if (campo === "gasto_centavos") return { ok: false, erro: "gasto_invalido" };
      nums[campo] = 0;
      continue;
    }
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > LIMITES[campo]) {
      return { ok: false, erro: campo === "gasto_centavos" ? "gasto_invalido" : `${campo}_invalido` as ErroGastoMeta };
    }
    nums[campo] = v;
  }

  let moeda = "BRL";
  if (g.moeda !== undefined && g.moeda !== null) {
    if (typeof g.moeda !== "string" || !/^[A-Z]{3}$/.test(g.moeda)) return { ok: false, erro: "moeda_invalida" };
    moeda = g.moeda;
  }

  return { ok: true, valor: { ad_id: g.ad_id, campaign_id: campaign, data: dia, ...nums, moeda } };
}

// ---------------------------------------------------------------------------
// Pesquisa de feedback com pagantes. Mesmas regras de crm_pagantes_contato /
// crm_contato_registrar (o banco valida de novo).
// ---------------------------------------------------------------------------

export const RE_CAMPANHA = /^[a-z0-9_-]{3,40}$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LIMITE_PADRAO = 15;
export const PAUSA_PADRAO_DIAS = 120;

export interface ParamsPagantes {
  campanha: string;
  limite: number;
  pausa_dias: number;
  /** Só para teste: restringe a estas contas (as regras continuam valendo). */
  user_ids: string[] | null;
}

export type ErroParamsPagantes = "campanha_invalida" | "limite_invalido" | "pausa_dias_invalido" | "user_ids_invalido";

export function lerParamsPagantes(p: Record<string, unknown>): { ok: true; valor: ParamsPagantes } | { ok: false; erro: ErroParamsPagantes } {
  if (typeof p.campanha !== "string" || !RE_CAMPANHA.test(p.campanha)) return { ok: false, erro: "campanha_invalida" };
  const limite = p.limite === undefined || p.limite === null ? LIMITE_PADRAO : p.limite;
  if (typeof limite !== "number" || !Number.isInteger(limite) || limite < 1 || limite > 50) return { ok: false, erro: "limite_invalido" };
  const pausa = p.pausa_dias === undefined || p.pausa_dias === null ? PAUSA_PADRAO_DIAS : p.pausa_dias;
  if (typeof pausa !== "number" || !Number.isInteger(pausa) || pausa < 30 || pausa > 365) return { ok: false, erro: "pausa_dias_invalido" };
  let ids: string[] | null = null;
  if (p.user_ids !== undefined && p.user_ids !== null) {
    if (!Array.isArray(p.user_ids) || p.user_ids.length < 1 || p.user_ids.length > 10
      || !p.user_ids.every((u) => typeof u === "string" && RE_UUID.test(u))) {
      return { ok: false, erro: "user_ids_invalido" };
    }
    ids = [...new Set((p.user_ids as string[]).map((u) => u.toLowerCase()))];
  }
  return { ok: true, valor: { campanha: p.campanha, limite, pausa_dias: pausa, user_ids: ids } };
}

export interface RegistroContato { user_id: string; resultado: "enviado" | "falhou" }
export type ErroRegistro = "nao_objeto" | "user_id_invalido" | "resultado_invalido";

export function normalizarRegistro(bruto: unknown): { ok: true; valor: RegistroContato } | { ok: false; erro: ErroRegistro } {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return { ok: false, erro: "nao_objeto" };
  const r = bruto as Record<string, unknown>;
  if (typeof r.user_id !== "string" || !RE_UUID.test(r.user_id)) return { ok: false, erro: "user_id_invalido" };
  if (r.resultado !== "enviado" && r.resultado !== "falhou") return { ok: false, erro: "resultado_invalido" };
  return { ok: true, valor: { user_id: r.user_id.toLowerCase(), resultado: r.resultado } };
}

/**
 * 1ª palavra de profiles.nome (o banco já manda só ela) com a 1ª letra
 * maiúscula e o resto minúsculo ("JOÃO" e "joão" viram "João"). Sem letra
 * nenhuma ("123", "-", emoji) ou vazio: "".
 */
export function primeiroNome(bruto: unknown): string {
  if (typeof bruto !== "string") return "";
  const palavra = bruto.trim().split(/\s+/)[0] ?? "";
  if (!/\p{L}/u.test(palavra)) return "";
  const [primeira, ...resto] = [...palavra].slice(0, 40);
  return primeira.toLocaleUpperCase("pt-BR") + resto.join("").toLocaleLowerCase("pt-BR");
}

/** Celular brasileiro já normalizado: +55 DDD 9XXXXXXXX. */
export function ehCelularBrasil(e164: string): boolean {
  return /^\+55[1-9]{2}9\d{8}$/.test(e164) && normalizarTelefone(e164) === e164;
}

/** Compara o segredo em tempo constante sem vazar o tamanho (SHA-256 dos dois). */
export async function segredoConfere(recebido: string | null, esperado: string | undefined): Promise<boolean> {
  if (!recebido || !esperado || esperado.length < 32) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(recebido)),
    crypto.subtle.digest("SHA-256", enc.encode(esperado)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
