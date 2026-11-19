/**
 * Datas e horas do recibo legal de compra (lógica pura, testada com Deno em
 * scripts/testes-recibo-legal/datasReciboLegal.test.ts).
 *
 * - data_compra é `date` (dia de calendário, sem hora): o dia sai como está,
 *   sem passar por fuso. A hora só aparece quando a compra foi cadastrada no
 *   mesmo dia (created_at lido em Brasília); aí é a hora do cadastro.
 * - Assinaturas e "agora": em America/Sao_Paulo, qualquer que seja o fuso do
 *   aparelho.
 */
import { FUSO_BRASILIA } from "../horaBrasilia/formatoBrasilia.ts";

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})/;

interface PartesBrasilia {
  ano: string;
  mes: string;
  dia: string;
  hora: string;
  minuto: string;
  segundo: string;
}

const FORMATO_PARTES = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_BRASILIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Instante lido em Brasília. Valor vazio ou inválido → null. */
function partesBrasilia(valor: string | null | undefined): PartesBrasilia | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const { type, value } of FORMATO_PARTES.formatToParts(d)) p[type] = value;
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute, segundo: p.second };
}

/** "19/11/2026 às 14:32" (ou "14:32:05" com segundos), em Brasília. Inválido → null. */
export function dataHoraBrasiliaRecibo(valor: string | null | undefined, comSegundos = false): string | null {
  const p = partesBrasilia(valor);
  if (!p) return null;
  const hora = comSegundos ? `${p.hora}:${p.minuto}:${p.segundo}` : `${p.hora}:${p.minuto}`;
  return `${p.dia}/${p.mes}/${p.ano} às ${hora}`;
}

/**
 * Data de uma assinatura digital ("dd/MM/yyyy às HH:mm:ss" em Brasília). Sem
 * data gravada (ou inválida), vale `agoraISO` — como antes, quando era o relógio.
 */
export function textoDataAssinaturaRecibo(dataAssinatura: string | null | undefined, agoraISO: string): string {
  return dataHoraBrasiliaRecibo(dataAssinatura, true) ?? dataHoraBrasiliaRecibo(agoraISO, true) ?? "";
}

/**
 * "Data:" da compra no recibo.
 * - "19/11/2026 às 14:32": data_compra é o dia (em Brasília) de created_at; a hora é a do cadastro.
 * - "19/11/2026": compra de outro dia (retroativa) ou sem created_at. Nunca "00:00".
 * - Sem data_compra (ou fora do formato): data e hora de `agoraISO`, como antes.
 */
export function textoDataCompraRecibo(
  dataCompra: string | null | undefined,
  createdAt: string | null | undefined,
  agoraISO: string,
): string {
  const m = dataCompra ? RE_DIA.exec(dataCompra) : null;
  if (!m) return dataHoraBrasiliaRecibo(agoraISO) ?? "";
  const [, ano, mes, dia] = m;
  const data = `${dia}/${mes}/${ano}`;
  const cadastro = partesBrasilia(createdAt);
  if (cadastro && cadastro.ano === ano && cadastro.mes === mes && cadastro.dia === dia) {
    return `${data} às ${cadastro.hora}:${cadastro.minuto}`;
  }
  return data;
}

/**
 * Datas das assinaturas no recibo gerado logo após cadastrar a compra
 * (OrigemDispositivos): as gravadas na linha da compra, para o PDF sair com o
 * que está no banco; sem elas, `agoraISO`. Sem assinatura, sem data.
 */
export function datasAssinaturaAposCadastro(
  assinaturas: { assinatura_vendedor?: string | null; assinatura_cliente?: string | null },
  gravada: { assinatura_vendedor_data?: string | null; assinatura_cliente_data?: string | null },
  agoraISO: string,
): { assinatura_vendedor_data: string | undefined; assinatura_cliente_data: string | undefined } {
  return {
    assinatura_vendedor_data: assinaturas.assinatura_vendedor ? gravada.assinatura_vendedor_data || agoraISO : undefined,
    assinatura_cliente_data: assinaturas.assinatura_cliente ? gravada.assinatura_cliente_data || agoraISO : undefined,
  };
}
