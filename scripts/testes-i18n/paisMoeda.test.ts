// for tz in UTC America/Sao_Paulo Asia/Tokyo America/Mexico_City; do
//   TZ=$tz deno test --no-check --allow-read --allow-env scripts/testes-i18n/paisMoeda.test.ts; done
// P1 de docs/i18n/pais-moeda.md: formatadores guiados pelo país e pela moeda da
// conta. A tabela 1.5 do documento vira teste (com a data dd/MM/aaaa forçada,
// que era um dos ajustes da P1), e o Brasil continua byte a byte o de hoje.
import { assertEquals } from "jsr:@std/assert@1";
import {
  FORMATO_BRASIL,
  FORMATO_NAVEGADOR_BRASIL,
  formatarData,
  formatarDataHora,
  formatarHora,
  formatarMoeda,
  formatarNumero,
  localeIntl,
  simboloMoeda,
  type ContextoFormato,
} from "../../src/lib/i18n/formatadores.ts";
import { infoMercadoDoPerfil, MERCADO_BRASIL } from "../../src/lib/i18n/mercado.ts";
import { formatCurrency, formatDate, formatDateTime, formatarNumeroParaInputBR } from "../../src/lib/formatters.ts";

const N = " ";
const INSTANTE = "2026-10-27T02:30:00Z";

const es = (pais: string, moeda: string, fuso: string): ContextoFormato => ({ idioma: "es", moeda, pais, fuso });

// [contexto, moeda(1234567.891), moeda(29.9), moeda(-0.5), moeda(null), numero(1234567.5), data, dataHora]
const TABELA_1_5: [string, ContextoFormato, string, string, string, string, string, string, string][] = [
  ["México × MXN", es("MX", "MXN", "America/Mexico_City"), "$1,234,567.89", "$29.90", "-$0.50", "$0.00", "1,234,567.5", "26/10/2026", "26/10/2026 20:30"],
  ["México × USD", es("MX", "USD", "America/Mexico_City"), `US$${N}1,234,567.89`, `US$${N}29.90`, `-US$${N}0.50`, `US$${N}0.00`, "1,234,567.5", "26/10/2026", "26/10/2026 20:30"],
  ["Colômbia × COP", es("CO", "COP", "America/Bogota"), `$${N}1.234.568`, `$${N}30`, `-$${N}1`, `$${N}0`, "1.234.567,5", "26/10/2026", "26/10/2026 21:30"],
  ["Colômbia × USD", es("CO", "USD", "America/Bogota"), `US$${N}1.234.567,89`, `US$${N}29,90`, `-US$${N}0,50`, `US$${N}0,00`, "1.234.567,5", "26/10/2026", "26/10/2026 21:30"],
  ["Chile × CLP", es("CL", "CLP", "America/Santiago"), "$1.234.568", "$30", "$-1", "$0", "1.234.567,5", "26/10/2026", "26/10/2026 23:30"],
  ["Chile × USD", es("CL", "USD", "America/Santiago"), "US$1.234.567,89", "US$29,90", "US$-0,50", "US$0,00", "1.234.567,5", "26/10/2026", "26/10/2026 23:30"],
  ["Bolívia × BOB", es("BO", "BOB", "America/La_Paz"), `Bs${N}1.234.567,89`, `Bs${N}29,90`, `-Bs${N}0,50`, `Bs${N}0,00`, "1.234.567,5", "26/10/2026", "26/10/2026 22:30"],
  ["Bolívia × USD", es("BO", "USD", "America/La_Paz"), `US$${N}1.234.567,89`, `US$${N}29,90`, `-US$${N}0,50`, `US$${N}0,00`, "1.234.567,5", "26/10/2026", "26/10/2026 22:30"],
  ["Otro país × USD", es("ZZ", "USD", "America/New_York"), `US$${N}1,234,567.89`, `US$${N}29.90`, `-US$${N}0.50`, `US$${N}0.00`, "1,234,567.5", "26/10/2026", "26/10/2026 22:30"],
];

Deno.test("tabela 1.5 do documento: onda 1, cada país × moeda e o Otro país", () => {
  for (const [nome, ctx, grande, pequeno, negativo, nulo, numero, data, dataHora] of TABELA_1_5) {
    assertEquals(formatarMoeda(1234567.891, ctx), grande, nome);
    assertEquals(formatarMoeda(29.9, ctx), pequeno, nome);
    assertEquals(formatarMoeda(-0.5, ctx), negativo, nome);
    assertEquals(formatarMoeda(null, ctx), nulo, nome);
    assertEquals(formatarMoeda(undefined, ctx), nulo, nome);
    assertEquals(formatarNumero(1234567.5, {}, ctx), numero, nome);
    assertEquals(formatarData(INSTANTE, ctx), data, nome);
    assertEquals(formatarDataHora(INSTANTE, ctx), dataHora, nome);
    assertEquals(formatarData("2026-10-27", ctx), "27/10/2026", nome);
  }
});

Deno.test("casas da moeda: COP, CLP e PYG sem centavos; CRC, BOB, MXN e USD com 2; quem chama ainda manda", () => {
  assertEquals(formatarMoeda(1999.5, es("CO", "COP", "America/Bogota")), `$${N}2.000`);
  assertEquals(formatarMoeda(1999.5, es("CL", "CLP", "America/Santiago")), "$2.000");
  assertEquals(formatarMoeda(1999.5, es("PY", "PYG", "America/Asuncion")), `Gs.${N}2.000`);
  assertEquals(formatarMoeda(1999.5, es("CR", "CRC", "America/Costa_Rica")), `₡1${N}999,50`);
  assertEquals(formatarMoeda(1999.5, es("BO", "BOB", "America/La_Paz")), `Bs${N}1.999,50`);
  assertEquals(formatarMoeda(1999.5, es("MX", "MXN", "America/Mexico_City")), "$1,999.50");
  // gráfico sem centavos continua funcionando, e com só uma das duas opções não quebra
  assertEquals(formatarMoeda(1999.5, es("MX", "MXN", "America/Mexico_City"), { minimumFractionDigits: 0, maximumFractionDigits: 0 }), "$2,000");
  assertEquals(formatarMoeda(1999.5, es("MX", "MXN", "America/Mexico_City"), { maximumFractionDigits: 0 }), "$2,000");
  // casas vindas do banco (P4) têm prioridade sobre a tabela
  assertEquals(formatarMoeda(1999.5, { ...es("CO", "COP", "America/Bogota"), casas: 2 }), `$${N}1.999,50`);
});

Deno.test("formatarNumero: casas da moeda só quando pedidas (quantidade e percentual seguem o Intl)", () => {
  assertEquals(formatarNumero(1234567.5, { casasDaMoeda: true }, es("CO", "COP", "America/Bogota")), "1.234.568");
  assertEquals(formatarNumero(1234567.5, { casasDaMoeda: true }, es("MX", "MXN", "America/Mexico_City")), "1,234,567.50");
  assertEquals(formatarNumero(1234567.5, { casasDaMoeda: true }, es("ZZ", "USD", "UTC")), "1,234,567.50");
  assertEquals(formatarNumero(1.5, {}, es("CO", "COP", "America/Bogota")), "1,5");
  assertEquals(formatarNumero(0.125, { style: "percent", maximumFractionDigits: 1 }, es("CL", "CLP", "America/Santiago")), "12,5%");
});

Deno.test("símbolo: formatToParts inteiro; dólar = '$' em EC/PA/SV e 'US$' nos demais, sempre na frente", () => {
  assertEquals(simboloMoeda(es("PY", "PYG", "America/Asuncion")), "Gs.");
  assertEquals(simboloMoeda(es("PA", "PAB", "America/Panama")), "B/.");
  assertEquals(simboloMoeda(es("PE", "PEN", "America/Lima")), "S/");
  assertEquals(simboloMoeda(es("BO", "BOB", "America/La_Paz")), "Bs");
  assertEquals(simboloMoeda(es("MX", "MXN", "America/Mexico_City")), "$");
  for (const pais of ["MX", "CO", "CL", "BO", "ZZ", "AR", "PE"]) assertEquals(simboloMoeda(es(pais, "USD", "UTC")), "US$", pais);
  for (const pais of ["EC", "PA", "SV"]) assertEquals(simboloMoeda(es(pais, "USD", "UTC")), "$", pais);
  assertEquals(formatarMoeda(1234567.891, es("EC", "USD", "America/Guayaquil")), "$1.234.567,89");
  assertEquals(formatarMoeda(1234567.891, es("PA", "USD", "America/Panama")), `$${N}1,234,567.89`);
  assertEquals(formatarMoeda(-1234567.891, es("SV", "USD", "America/El_Salvador")), "-$1,234,567.89");
  // símbolo do banco (P4) tem prioridade
  assertEquals(simboloMoeda({ ...es("MX", "USD", "UTC"), simbolo: "USD" }), "USD");
  // o es da Espanha poria o símbolo depois ("1234,50 US$"): em espanhol vai sempre na frente
  assertEquals(formatarMoeda(1234.5, es("ES", "USD", "Europe/Madrid")), `US$${N}1234,50`);
  assertEquals(formatarMoeda(-1234.5, es("ES", "USD", "Europe/Madrid")), `-US$${N}1234,50`);
  assertEquals(formatarMoeda(1234.5, es("ES", "EUR", "Europe/Madrid")), `€${N}1234,50`);
});

Deno.test("Otro país (ZZ) = es-419, nunca o es da Espanha", () => {
  assertEquals(localeIntl({ idioma: "es", pais: "ZZ" }), "es-419");
  assertEquals(formatarMoeda(1234.5, es("ZZ", "USD", "Europe/Madrid")), `US$${N}1,234.50`);
  assertEquals(formatarNumero(1234.5, {}, es("ZZ", "USD", "Europe/Madrid")), "1,234.5");
});

Deno.test("data dd/MM/aaaa e relógio de 24 h em todo espanhol, inclusive na troca de horário", () => {
  // Chile: horário de verão começou em 2026-09-06 (00:00 virou 01:00) e termina em 2027-04-04.
  const santiago = es("CL", "CLP", "America/Santiago");
  assertEquals(formatarDataHora("2026-09-06T03:59:00Z", santiago), "05/09/2026 23:59");
  assertEquals(formatarDataHora("2026-09-06T04:00:00Z", santiago), "06/09/2026 01:00");
  assertEquals(formatarDataHora("2027-04-04T02:59:00Z", santiago), "03/04/2027 23:59");
  assertEquals(formatarDataHora("2027-04-04T03:00:00Z", santiago), "03/04/2027 23:00");
  // Panamá: o Intl daria 03/04 com o mês primeiro
  assertEquals(formatarData("2026-03-04T15:00:00Z", es("PA", "USD", "America/Panama")), "04/03/2026");
  assertEquals(formatarData("2026-03-04", es("PA", "USD", "America/Panama")), "04/03/2026");
  assertEquals(formatarHora("2026-10-27T00:05:00Z", es("ZZ", "USD", "UTC")), "00:05");
  assertEquals(formatarHora("2026-10-27T23:59:00Z", es("ZZ", "USD", "UTC")), "23:59");
  assertEquals(formatarData("lixo", santiago), "");
  // en continua no padrão do Intl (fora do escopo do ES_LATAM)
  assertEquals(formatarData("2026-03-04", { idioma: "en", moeda: "USD", pais: "US", fuso: "UTC" }), "03/04/2026");
});

Deno.test("fuso ausente ou inválido: padrão do país (ZZ e desconhecido = UTC); Brasil = São Paulo ou o navegador", () => {
  const iso = "2026-10-27T02:30:00Z";
  assertEquals(formatarDataHora(iso, { idioma: "es", moeda: "MXN", pais: "MX", fuso: "Lua/Base" }), "26/10/2026 20:30");
  assertEquals(formatarDataHora(iso, { idioma: "es", moeda: "MXN", pais: "MX" }), "26/10/2026 20:30");
  assertEquals(formatarDataHora(iso, { idioma: "es", moeda: "CLP", pais: "CL", fuso: "" }), "26/10/2026 23:30");
  assertEquals(formatarDataHora(iso, { idioma: "es", moeda: "USD", pais: "ZZ" }), "27/10/2026 02:30");
  assertEquals(formatarDataHora(iso, { idioma: "es", moeda: "USD", pais: "XX", fuso: "Lua/Base" }), "27/10/2026 02:30");
  assertEquals(formatarDataHora(iso, { ...FORMATO_BRASIL, fuso: "Lua/Base" }), "26/10/2026 23:30");
  // Brasil sem fuso = o do navegador, exatamente como o date-fns
  assertEquals(formatarDataHora(iso, FORMATO_NAVEGADOR_BRASIL), formatDateTime(iso));
  assertEquals(formatarData(iso, FORMATO_NAVEGADOR_BRASIL), formatDate(iso));
});

Deno.test("perfil com fuso inválido: padrão do país, não São Paulo; Brasil continua igual", () => {
  const chile = infoMercadoDoPerfil({ idioma: "es", mercado: "ES_LATAM", pais: "CL", moeda: "CLP", fuso_horario: "America/Nao_Existe" });
  assertEquals(chile.fuso, "America/Santiago");
  const outro = infoMercadoDoPerfil({ idioma: "es", mercado: "ES_LATAM", pais: "ZZ", moeda: "USD", fuso_horario: null });
  assertEquals(outro.fuso, "UTC");
  assertEquals(infoMercadoDoPerfil({ idioma: "pt-BR", mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "Lua/Base" }), MERCADO_BRASIL);
});

// --- Brasil byte a byte ---------------------------------------------------------

const VALORES_BR = [0, -0, 0.5, -0.5, 1, -1, 1.005, 2.675, 29.9, 1234.5, -1234.56, 1234567.891, 99999999.99, 123456789.12, 1e21, -1e21, Number.MAX_SAFE_INTEGER];
const regexAntigaSimbolo = (s: string) => s.replace(/[\d.,\s-]/g, "");

Deno.test("Brasil: moeda, número, símbolo e casas = formatadores de hoje (zero, negativo, grande, NaN, null)", () => {
  for (const ctx of [FORMATO_BRASIL, FORMATO_NAVEGADOR_BRASIL]) {
    for (const v of [...VALORES_BR, NaN, Infinity, -Infinity]) {
      assertEquals(formatarMoeda(v, ctx), formatCurrency(v), String(v));
      assertEquals(formatarNumero(v, {}, ctx), v.toLocaleString("pt-BR"), String(v));
      // formatarNumeroParaInputBR devolve "" para NaN/Infinity (regra do campo, não do número):
      // o central segue o Intl ("NaN", "∞"); a P11 mantém o "" no adaptador do campo.
      if (Number.isFinite(v)) assertEquals(formatarNumero(v, { casasDaMoeda: true }, ctx), formatarNumeroParaInputBR(v), String(v));
    }
    assertEquals(formatarMoeda(null, ctx), formatCurrency(null));
    assertEquals(formatarMoeda(undefined, ctx), formatCurrency(undefined));
    // useFormatadores calculava o símbolo com esta regex; no Brasil dá o mesmo
    assertEquals(simboloMoeda(ctx), regexAntigaSimbolo(formatarMoeda(0, ctx)));
    assertEquals(simboloMoeda(ctx), "R$");
    // casas/símbolo do banco nunca valem no Brasil
    assertEquals(formatarMoeda(1234.5, { ...ctx, casas: 0, simbolo: "X" }), formatCurrency(1234.5));
    assertEquals(simboloMoeda({ ...ctx, simbolo: "X" }), "R$");
  }
  assertEquals(formatarData("lixo"), "");
  assertEquals(formatarDataHora(new Date(NaN)), "");
});

Deno.test("símbolo antigo (regex) × novo: só muda onde a regex cortava pontuação", () => {
  const casos: [ContextoFormato, string][] = [
    [es("PY", "PYG", "America/Asuncion"), "Gs."],
    [es("PA", "PAB", "America/Panama"), "B/."],
    [es("VE", "VES", "America/Caracas"), "Bs.S"],
  ];
  for (const [ctx, esperado] of casos) {
    assertEquals(simboloMoeda(ctx), esperado);
    assertEquals(regexAntigaSimbolo(formatarMoeda(0, ctx)) === esperado, false);
  }
  for (const [, ctx] of TABELA_1_5.map((l) => [l[0], l[1]] as const)) {
    assertEquals(simboloMoeda(ctx), regexAntigaSimbolo(formatarMoeda(0, ctx)), `${ctx.pais} ${ctx.moeda}`);
  }
});
