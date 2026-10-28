import type { Idioma } from "./idiomas";
import { CASAS_DECIMAIS_MOEDA, ehFusoValido, fusoPadraoDoPais, PAIS_OUTRO, PAISES_DOLARIZADOS } from "./regiao";

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
  /** ISO 3166-1 alfa-2: escolhe a variante regional (es-MX, es-AR...). "ZZ" = Otro país. */
  pais?: string;
  /** Casas decimais da moeda vindas do banco (P4). Sem isto: CASAS_DECIMAIS_MOEDA, depois o Intl. Ignorado no Brasil. */
  casas?: number;
  /** Símbolo da moeda vindo do banco (P4). Sem isto: "$"/"US$" para o dólar em espanhol, senão o do Intl. Ignorado no Brasil. */
  simbolo?: string;
}

export const FORMATO_BRASIL: ContextoFormato = { idioma: "pt-BR", moeda: "BRL", fuso: "America/Sao_Paulo", pais: "BR" };

/** O app de sempre para quem não tem i18n: pt-BR, BRL e a hora no fuso do navegador (como o date-fns). */
export const FORMATO_NAVEGADOR_BRASIL: ContextoFormato = { idioma: "pt-BR", moeda: "BRL", pais: "BR" };

/**
 * Etiqueta do Intl. Espanhol sem país (ou com o padrão BR, que a etapa 1 põe
 * em todo perfil novo, ou com o "Otro país" ZZ) = es-419, o espanhol
 * latino-americano do Intl: "es" puro (e "es-ZZ", que o Intl lê como "es") é o
 * da Espanha (1.234,50 US$).
 */
export function localeIntl(ctx: Pick<ContextoFormato, "idioma" | "pais">): string {
  const pais = ctx.pais && ctx.pais !== "BR" && ctx.pais !== PAIS_OUTRO ? ctx.pais : null;
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

type Casas = Pick<Intl.NumberFormatOptions, "minimumFractionDigits" | "maximumFractionDigits">;

/** Casas da moeda da conta: banco (ctx.casas) → tabela fixa → padrão do Intl para a moeda. */
function casasDaMoeda(ctx: ContextoFormato): number {
  const fixas = ctx.casas ?? CASAS_DECIMAIS_MOEDA[ctx.moeda];
  if (fixas !== undefined) return fixas;
  return numeroFmt(localeIntl(ctx), { style: "currency", currency: ctx.moeda }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Quem chama manda (gráfico sem centavos); senão, as casas da moeda. */
function casasEfetivas(ctx: ContextoFormato, pedidas: Casas): Casas {
  if (pedidas.minimumFractionDigits !== undefined || pedidas.maximumFractionDigits !== undefined) return pedidas;
  const c = casasDaMoeda(ctx);
  return { minimumFractionDigits: c, maximumFractionDigits: c };
}

/**
 * Símbolo da moeda para rótulos ("Valor (R$)") e para formatarMoeda em
 * espanhol. Dólar em espanhol: "$" nos países dolarizados (EC, PA, SV), "US$"
 * nos demais (o peso de MX/CO/CL também usa "$"). Os outros vêm do Intl
 * inteiros ("Gs.", "B/.", "S/"), sem cortar pontuação.
 */
export function simboloMoeda(ctx: ContextoFormato = FORMATO_BRASIL): string {
  if (!ehBrasil(ctx) && ctx.simbolo) return ctx.simbolo;
  if (ctx.idioma === "es" && ctx.moeda === "USD") return ctx.pais && PAISES_DOLARIZADOS.has(ctx.pais) ? "$" : "US$";
  const partes = numeroFmt(localeIntl(ctx), { style: "currency", currency: ctx.moeda }).formatToParts(0);
  return partes.find((p) => p.type === "currency")?.value ?? ctx.moeda;
}

/** Troca o símbolo e garante o símbolo na frente do número (o es da Espanha o põe depois). */
function montarEmEspanhol(partes: Intl.NumberFormatPart[], simbolo: string): string {
  const iMoeda = partes.findIndex((p) => p.type === "currency");
  const iNumero = partes.findIndex((p) => p.type === "integer" || p.type === "nan" || p.type === "infinity");
  if (iMoeda < 0 || iMoeda < iNumero) {
    return partes.map((p) => (p.type === "currency" ? simbolo : p.value)).join("");
  }
  const sinal = partes.some((p) => p.type === "minusSign") ? "-" : "";
  const numero = partes
    .filter((p) => p.type !== "currency" && p.type !== "minusSign" && p.type !== "plusSign")
    .map((p) => p.value)
    .join("")
    .trim();
  return `${sinal}${simbolo}\u00a0${numero}`;
}

/**
 * 1234.5 → "R$ 1.234,50" (com espaço não separável, como o Intl). null e
 * undefined: no Brasil, "R$ 0,00" com espaço COMUM — é o que formatCurrency
 * devolve hoje para null (texto fixo) e a etapa 5 não pode mudar isso; nos
 * outros mercados, o zero formatado.
 *
 * Fora do Brasil as casas são as da moeda (COP/CLP/PYG sem centavos), a menos
 * que quem chama passe outras. Em espanhol o símbolo vem de simboloMoeda e
 * sai sempre na frente.
 */
export function formatarMoeda(
  valor: number | null | undefined,
  ctx: ContextoFormato = FORMATO_BRASIL,
  /** Casas decimais (ex.: gráfico sem centavos: { minimumFractionDigits: 0, maximumFractionDigits: 0 }). */
  casas: Casas = {},
): string {
  if (valor === null || valor === undefined) {
    if (ehBrasil(ctx) && casas.maximumFractionDigits === undefined) return "R$ 0,00";
    valor = 0;
  }
  if (ehBrasil(ctx)) {
    // Caminho de sempre, sem casas da moeda: byte a byte o formatCurrency.
    return numeroFmt(localeIntl(ctx), { style: "currency", currency: ctx.moeda, ...casas }).format(valor);
  }
  const fmt = numeroFmt(localeIntl(ctx), { style: "currency", currency: ctx.moeda, ...casasEfetivas(ctx, casas) });
  if (ctx.idioma === "es") return montarEmEspanhol(fmt.formatToParts(valor), simboloMoeda(ctx));
  return fmt.format(valor);
}

export interface OpcoesNumero extends Intl.NumberFormatOptions {
  /**
   * Usar as casas da moeda da conta (campo de valor: "1.234,50" no Brasil =
   * formatarNumeroParaInputBR; "1.234.568" em pesos colombianos). Sem isto o
   * número segue o Intl, porque também formata quantidade e percentual.
   */
  casasDaMoeda?: boolean;
}

/** Número no padrão do idioma: 1500 → "1.500" (pt-BR) / "1,500" (es-419). Opções do Intl.NumberFormat. */
export function formatarNumero(
  valor: number,
  opcoes: OpcoesNumero = {},
  ctx: ContextoFormato = FORMATO_BRASIL,
): string {
  const { casasDaMoeda: usarCasasDaMoeda, ...intl } = opcoes;
  const casas = usarCasasDaMoeda ? casasEfetivas(ehBrasil(ctx) ? { ...ctx, casas: undefined } : ctx, intl) : {};
  return numeroFmt(localeIntl(ctx), { ...intl, ...casas }).format(valor);
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
  return Number.isNaN(d.getTime()) ? null : { d, fuso: fusoDoContexto(ctx) };
}

/**
 * Fuso válido do contexto. Sem fuso e sem país (ou Brasil): undefined = o do
 * navegador, como o date-fns (FORMATO_NAVEGADOR_BRASIL). Fora do Brasil, fuso
 * ausente ou inválido = o padrão do país (ZZ e país desconhecido: UTC); no
 * Brasil, inválido = America/Sao_Paulo.
 */
function fusoDoContexto(ctx: ContextoFormato): string | undefined {
  if (ehFusoValido(ctx.fuso)) return ctx.fuso;
  const semPaisOuBrasil = !ctx.pais || ctx.pais === "BR";
  if (ctx.fuso === undefined && semPaisOuBrasil) return undefined;
  return fusoPadraoDoPais(ctx.pais ?? "BR");
}

function partesData(fmt: Intl.DateTimeFormat, d: Date): Record<string, string> {
  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(d)) if (type !== "literal") p[type] = value;
  return p;
}

/**
 * "26/10/2026" (pt-BR e todo espanhol), "10/26/2026" (en-US). Em espanhol o
 * dd/MM/aaaa é forçado: o Intl daria "26-10-2026" no Chile e "10/26/2026" no
 * Panamá. Data inválida → "".
 */
export function formatarData(valor: string | Date | number, ctx: ContextoFormato = FORMATO_BRASIL): string {
  const i = instante(valor, ctx);
  if (!i) return "";
  const fmt = dataFmt(localeIntl(ctx), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: i.fuso });
  if (ctx.idioma !== "es") return fmt.format(i.d);
  const p = partesData(fmt, i.d);
  return `${p.day}/${p.month}/${p.year}`;
}

/** "18:55" — relógio de 24 h em todos os idiomas (decisão do glossário). Data inválida → "". */
export function formatarHora(valor: string | Date | number, ctx: ContextoFormato = FORMATO_BRASIL): string {
  const i = instante(valor, ctx);
  if (!i) return "";
  const fmt = dataFmt(localeIntl(ctx), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: i.fuso });
  if (ctx.idioma !== "es") return fmt.format(i.d);
  const p = partesData(fmt, i.d);
  return `${p.hour}:${p.minute}`;
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
