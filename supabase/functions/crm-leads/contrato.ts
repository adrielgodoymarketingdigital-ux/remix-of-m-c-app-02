// Validação pura do contrato da Edge Function
// crm-leads (sem rede, sem Supabase: roda no deno test).
// Contrato completo em docs/crm-leads/CONTRATO.md.

import { normalizarTelefone } from "./telefone.ts";

export const MAX_ITENS = 200;
export const MAX_BYTES = 512 * 1024;

export const ACOES = [
  "mensagens",        // fase 1: captura (entrada e saída)
  "resumo",           // fase 1: assunto/resumo/etapa vindos da IA
  "vincular",         // fase 1: telefone + user_id no momento do cadastro
  "vincular_lote",    // fase 1: cruzamento DDD + 8 dígitos com profiles
  "opt_out",          // fase 1: opt-out por fora da mensagem
  "retencao",         // fase 1: apaga mensagens/resumo após 90 dias
  "relatorio",        // fase 1: números agregados do dia (Brasília)
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

/** Envelope: {acao, itens?, ...params}. Um item solto vira lote de 1. */
export function lerEnvelope(corpo: unknown): ResultadoEnvelope {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return { ok: false, status: 400, erro: "json_invalido" };
  }
  const { acao, itens, item, ...params } = corpo as Record<string, unknown>;
  if (typeof acao !== "string" || !(ACOES as readonly string[]).includes(acao)) {
    return { ok: false, status: 400, erro: "acao_invalida" };
  }
  const precisaItens = acao === "mensagens" || acao === "resumo" || acao === "vincular" || acao === "opt_out";
  const lista = Array.isArray(itens) ? itens : item !== undefined ? [item] : [];
  if (precisaItens && lista.length === 0) return { ok: false, status: 400, erro: "itens_vazios" };
  if (lista.length > MAX_ITENS) return { ok: false, status: 413, erro: "lote_grande" };
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
