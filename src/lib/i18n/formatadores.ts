import type { Idioma } from "./idiomas";

/**
 * Formatadores centrais de moeda, número e data, pelo idioma, moeda e fuso da
 * conta (useMercado). Com o contexto Brasil (pt-BR, BRL, America/Sao_Paulo) a
 * saída é BYTE A BYTE a dos formatadores de hoje (formatCurrency,
 * formatCurrencyPDF, formatDate, formatDateTime...) — conferido em
 * scripts/testes-i18n/formatadores.test.ts. A troca dos usos é a etapa 5
 * (plano em docs/i18n/convencoes.md); nesta etapa ninguém chama isto ainda.
 *
 * Sem React e sem navegador (testado com Deno).
 */
export interface ContextoFormato {
  idioma: Idioma;
  /** ISO 4217 */
  moeda: string;
  /**
   * IANA. undefined = o fuso do navegador, que é o que o date-fns faz hoje:
   * é o contexto de quem não tem i18n (FORMATO_NAVEGADOR_BRASIL), para nada
   * mudar para a loja de Manaus ou de Rio Branco.
   */
  fuso?: string;
  /** ISO 3166-1 alfa-2: escolhe a variante regional (es-MX, es-AR...). */
  pais?: string;
}

export const FORMATO_BRASIL: ContextoFormato = { idioma: "pt-BR", moeda: "BRL", fuso: "America/Sao_Paulo", pais: "BR" };

/** O app de sempre para quem não tem i18n: pt-BR, BRL e a hora no fuso do navegador (como o date-fns). */
export const FORMATO_NAVEGADOR_BRASIL: ContextoFormato = { idioma: "pt-BR", moeda: "BRL", pais: "BR" };

/**
 * Etiqueta do Intl. Espanhol sem país (ou com o padrão BR, que a etapa 1 põe
 * em todo perfil novo) = es-419, o espanhol latino-americano do Intl: "es"
 * puro é o da Espanha (1234,50 US$, sem separador de milhar até 9999).
 */
export function localeIntl(ctx: Pick<ContextoFormato, "idioma" | "pais">): string {
  const pais = ctx.pais && ctx.pais !== "BR" ? ctx.pais : null;
  switch (ctx.idioma) {
    case "pt-BR": return "pt-BR";
    case "es": return pais ? `es-${pais}` : "es-419";
    case "en": return pais ? `en-${pais}` : "en-US";
    case "it": return "it-IT";
  }
}

// Intl.*Format é caro de criar e estas funções rodam em listas: um por combinação.
const cacheNumero = new Map<string, Intl.NumberFormat>();
const cacheData = new Map<string, Intl.DateTimeFormat>();

function numeroFmt(locale: string, opcoes: Intl.NumberFormatOptions): Intl.NumberFormat {
  const chave = `${locale}|${JSON.stringify(opcoes)}`;
  let fmt = cacheNumero.get(chave);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, opcoes);
    cacheNumero.set(chave, fmt);
  }
  return fmt;
}

function dataFmt(locale: string, opcoes: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const chave = `${locale}|${JSON.stringify(opcoes)}`;
  let fmt = cacheData.get(chave);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opcoes);
    cacheData.set(chave, fmt);
  }
  return fmt;
}

const ehBrasil = (ctx: ContextoFormato) => ctx.idioma === "pt-BR" && ctx.moeda === "BRL";

/**
 * 1234.5 → "R$ 1.234,50" (com espaço não separável, como o Intl). null e
 * undefined: no Brasil, "R$ 0,00" com espaço COMUM — é o que formatCurrency
 * devolve hoje para null (texto fixo) e a etapa 5 não pode mudar isso; nos
 * outros mercados, o zero formatado.
 *
 * Dólar em espanhol sai sempre "US$" (decisão do glossário): o Intl escreve
 * "USD" em es-419/es-MX e "US$" em es-AR/es-CO.
 */
export function formatarMoeda(valor: number | null | undefined, ctx: ContextoFormato = FORMATO_BRASIL): string {
  if (valor === null || valor === undefined) {
    if (ehBrasil(ctx)) return "R$ 0,00";
    valor = 0;
  }
  const fmt = numeroFmt(localeIntl(ctx), { style: "currency", currency: ctx.moeda });
  if (ctx.idioma === "es" && ctx.moeda === "USD") {
    return fmt.formatToParts(valor).map((p) => (p.type === "currency" ? "US$" : p.value)).join("");
  }
  return fmt.format(valor);
}

/** Número no padrão do idioma: 1500 → "1.500" (pt-BR) / "1,500" (es-419). Opções do Intl.NumberFormat. */
export function formatarNumero(
  valor: number,
  opcoes: Intl.NumberFormatOptions = {},
  ctx: ContextoFormato = FORMATO_BRASIL,
): string {
  return numeroFmt(localeIntl(ctx), opcoes).format(valor);
}

export const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Entrada → instante + fuso em que deve ser lido. "AAAA-MM-DD" (coluna date)
 * é dia de calendário: meia-noite lida em UTC, nunca desliza de dia em nenhum
 * fuso (como o parseDate de hoje, que a lê como meia-noite local).
 * Timestamp/Date/número: lido no fuso da conta.
 */
function instante(valor: string | Date | number, ctx: ContextoFormato): { d: Date; fuso: string | undefined } | null {
  if (typeof valor === "string") {
    const m = SO_DATA.exec(valor);
    if (m) return { d: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))), fuso: "UTC" };
  }
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : { d, fuso: ctx.fuso };
}

/** "26/10/2026" (pt-BR, es-419), "10/26/2026" (en-US). Data inválida → "". */
export function formatarData(valor: string | Date | number, ctx: ContextoFormato = FORMATO_BRASIL): string {
  const i = instante(valor, ctx);
  if (!i) return "";
  return dataFmt(localeIntl(ctx), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: i.fuso }).format(i.d);
}

/** "18:55" — relógio de 24 h em todos os idiomas (decisão do glossário). Data inválida → "". */
export function formatarHora(valor: string | Date | number, ctx: ContextoFormato = FORMATO_BRASIL): string {
  const i = instante(valor, ctx);
  if (!i) return "";
  return dataFmt(localeIntl(ctx), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: i.fuso }).format(i.d);
}

/**
 * "26/10/2026 18:55" — data e hora separadas por espaço, como o
 * "dd/MM/yyyy HH:mm" de hoje (o Intl puro poria vírgula). Data pura
 * ("AAAA-MM-DD") sai com 00:00, como formatDateTime; quem quer só a data
 * nesse caso (formatDataVenda) testa antes.
 */
export function formatarDataHora(valor: string | Date | number, ctx: ContextoFormato = FORMATO_BRASIL): string {
  const data = formatarData(valor, ctx);
  return data && `${data} ${formatarHora(valor, ctx)}`;
}
