// TZ=America/Sao_Paulo deno test --no-check --allow-read --allow-env scripts/testes-i18n/
// TZ=Asia/Tokyo        deno test --no-check --allow-read --allow-env scripts/testes-i18n/
// Formatadores centrais (src/lib/i18n/formatadores.ts). Com o contexto Brasil a
// saída tem de ser BYTE A BYTE a dos formatadores de hoje — a etapa 5 troca os
// ~200 usos por estes e o Brasil não pode mudar em nada.
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
  type ContextoFormato,
} from "../../src/lib/i18n/formatadores.ts";
import {
  formatCurrency,
  formatDataVenda,
  formatDate,
  formatDateTime,
  formatTime,
  formatarNumeroParaInputBR,
} from "../../src/lib/formatters.ts";
import { formatarMoedaRecibo } from "../../src/lib/vendas/reciboTroca.ts";
import { formatarDataHoraRecibo, formatarDataRecibo } from "../../src/lib/vendas/reciboVendaModelo.ts";
import { toBrasilia } from "../../src/lib/dataBrasilia.ts";

const NO_FUSO_DE_SAO_PAULO = Deno.env.get("TZ") === "America/Sao_Paulo";

// Cópias literais de formatadores que não dá para importar no Deno (puxam jsPDF / alias @/).
const formatCurrencyPDF = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatarMoedaPDFOS = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VALORES = [
  0, -0, 1, -1, 0.1, 0.005, 0.015, 1.005, 2.675, 10, 99.99, 100, 999.995, 1000, 1234.5, -1234.56,
  12345.678, 999999.99, 1e6, 123456789.12, -0.004, Number.MAX_SAFE_INTEGER, 1e21,
];

Deno.test("formatarMoeda (Brasil) = formatCurrency, formatCurrencyPDF e toLocaleString, byte a byte", () => {
  for (const v of VALORES) {
    const esperado = formatCurrency(v);
    assertEquals(formatarMoeda(v), esperado, `valor ${v}`);
    assertEquals(formatarMoeda(v, FORMATO_BRASIL), esperado);
    assertEquals(formatCurrencyPDF(v), esperado);
    assertEquals(formatarMoedaPDFOS(v), esperado);
  }
  // NaN e Infinity também saem iguais (o Intl decide).
  for (const v of [NaN, Infinity, -Infinity]) assertEquals(formatarMoeda(v), formatCurrency(v));
});

Deno.test("formatarMoeda(null/undefined) no Brasil = formatCurrency: 'R$ 0,00' com espaço comum", () => {
  assertEquals(formatarMoeda(null), formatCurrency(null));
  assertEquals(formatarMoeda(undefined), formatCurrency(undefined));
  assertEquals(formatarMoeda(null), "R$ 0,00");
  // e o 0 de verdade tem o espaço não separável do Intl (já é assim hoje):
  assertEquals(formatarMoeda(0), "R$ 0,00");
});

Deno.test("formatarMoedaRecibo arredonda antes: só difere de formatarMoeda onde o arredondamento difere", () => {
  // O recibo faz (Number(v) || 0) e Math.round(v*100)/100 antes do Intl. Nos valores
  // comuns é igual; registra onde não é, para a etapa 5 manter o arredondamento do
  // recibo como está (adaptador próprio, não formatarMoeda direto):
  //   -0    → recibo "R$ 0,00", Intl "-R$ 0,00" (-0 é falso no ||)
  //   1.005 → recibo "R$ 1,00" (1.005*100 = 100.4999... em binário), Intl "R$ 1,01"
  //           (o Intl arredonda o decimal mais curto, "1.005", para cima)
  //   1e21  → Math.round(1e23)/100 perde precisão
  const diferentes = VALORES.filter((v) => formatarMoedaRecibo(v) !== formatarMoeda(v));
  assertEquals(diferentes, [-0, 1.005, 1e21]);
  assertEquals(formatarMoedaRecibo(-0), "R$\u00a00,00");
  assertEquals(formatarMoeda(-0), "-R$\u00a00,00");
  assertEquals(formatarMoedaRecibo(1.005), "R$\u00a01,00");
  assertEquals(formatarMoeda(1.005), "R$\u00a01,01");
  for (const v of [0, 1, 10, 99.99, 1234.5, -1234.56, 999999.99]) assertEquals(formatarMoedaRecibo(v), formatarMoeda(v));
});

Deno.test("formatarNumero (Brasil) = toLocaleString('pt-BR') e formatarNumeroParaInputBR", () => {
  for (const v of VALORES) {
    assertEquals(formatarNumero(v), v.toLocaleString("pt-BR"));
    assertEquals(formatarNumero(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), formatarNumeroParaInputBR(v));
  }
});

// Instantes que atravessam a virada do dia em Brasília e em UTC, horário de verão antigo, meia-noite.
const INSTANTES = [
  "2026-10-26T21:55:00Z", "2026-10-27T02:59:59Z", "2026-10-27T03:00:00Z", "2026-10-26T03:00:00.000Z",
  "2026-01-01T00:00:00Z", "2026-12-31T23:59:00-03:00", "2018-11-04T02:30:00Z", "2019-02-17T01:30:00Z",
  "2026-10-26T15:04:05.123456+00:00", "2026-03-08T12:00:00Z",
];
const DATAS_PURAS = ["2026-10-26", "2026-01-01", "2026-12-31", "2024-02-29", "2018-11-04"];
// Dias em que a meia-noite não existiu em São Paulo (início do horário de verão, extinto em 2019):
// formatDateTime("2018-11-04") dá "04/11/2018 01:00" (date-fns lê meia-noite local, que pulou
// para 01:00); formatarDataHora dá "00:00". Única diferença conhecida; só em data pura COM hora.
const MEIA_NOITE_INEXISTENTE = new Set(["2018-11-04"]);

Deno.test("formatarData/Hora/DataHora (Brasil) = recibo de venda (fuso fixo de Brasília), em qualquer TZ", () => {
  for (const iso of INSTANTES) {
    assertEquals(formatarDataHora(iso).replace(" ", " às "), formatarDataHoraRecibo(iso), iso);
    assertEquals(formatarData(iso), formatarDataRecibo(iso), iso);
    // Hora de parede de Brasília, conferida por outro caminho (dataBrasilia.ts).
    assertEquals(formatarHora(iso), toBrasilia(new Date(iso)).toISOString().slice(11, 16), iso);
  }
  for (const d of DATAS_PURAS) assertEquals(formatarData(d), formatarDataRecibo(d), d);
});

Deno.test("data pura 'AAAA-MM-DD' nunca muda de dia (em qualquer TZ)", () => {
  assertEquals(formatarData("2026-10-26"), "26/10/2026");
  assertEquals(formatarDataHora("2026-10-26"), "26/10/2026 00:00");
  assertEquals(formatarData("2026-10-26", { idioma: "en", moeda: "USD", fuso: "Asia/Tokyo" }), "10/26/2026");
  assertEquals(formatarData("2026-10-26", { idioma: "es", moeda: "USD", fuso: "Pacific/Kiritimati" }), "26/10/2026");
});

Deno.test({
  name: "formatarData/DataHora/Hora (Brasil) = formatDate/formatDateTime/formatTime/formatDataVenda (date-fns), com o navegador em São Paulo",
  ignore: !NO_FUSO_DE_SAO_PAULO,
  fn() {
    for (const v of [...INSTANTES, ...DATAS_PURAS]) {
      assertEquals(formatarData(v), formatDate(v), v);
      if (!MEIA_NOITE_INEXISTENTE.has(v)) assertEquals(formatarDataHora(v), formatDateTime(v), v);
      if (!MEIA_NOITE_INEXISTENTE.has(v)) assertEquals(formatarHora(v), formatTime(v), v);
      const venda = /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatarData(v) : formatarDataHora(v);
      assertEquals(venda, formatDataVenda(v), v);
    }
    assertEquals(formatDateTime("2018-11-04"), "04/11/2018 01:00");
    assertEquals(formatarDataHora("2018-11-04"), "04/11/2018 00:00");
    for (const iso of INSTANTES) {
      const d = new Date(iso);
      assertEquals(formatarData(d), formatDate(d));
      assertEquals(formatarDataHora(d.getTime()), formatDateTime(d));
    }
  },
});

Deno.test({
  name: "FORMATO_NAVEGADOR_BRASIL = formatDate/formatDateTime/formatTime (date-fns) em QUALQUER fuso do navegador",
  fn() {
    for (const v of [...INSTANTES, ...DATAS_PURAS]) {
      assertEquals(formatarData(v, FORMATO_NAVEGADOR_BRASIL), formatDate(v), v);
      if (!MEIA_NOITE_INEXISTENTE.has(v)) {
        assertEquals(formatarDataHora(v, FORMATO_NAVEGADOR_BRASIL), formatDateTime(v), v);
        assertEquals(formatarHora(v, FORMATO_NAVEGADOR_BRASIL), formatTime(v), v);
      }
    }
    for (const v of VALORES) assertEquals(formatarMoeda(v, FORMATO_NAVEGADOR_BRASIL), formatCurrency(v));
    assertEquals(formatarMoeda(null, FORMATO_NAVEGADOR_BRASIL), formatCurrency(null));
  },
});

// Cópia literal do formatCurrency local de src/components/dashboard/GraficosDashboard.tsx (sem centavos).
const formatCurrencyGraficos = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

Deno.test("formatarMoeda sem centavos (Brasil) = formatCurrency do GraficosDashboard", () => {
  const semCentavos = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  for (const v of VALORES) assertEquals(formatarMoeda(v, FORMATO_NAVEGADOR_BRASIL, semCentavos), formatCurrencyGraficos(v), String(v));
  assertEquals(formatarMoeda(1234.5, { idioma: "es", moeda: "USD", fuso: "UTC" }, semCentavos), "US$\u00a01,235");
});

Deno.test("data inválida → '' (date-fns lançaria RangeError)", () => {
  assertEquals(formatarData("lixo"), "");
  assertEquals(formatarDataHora(""), "");
  assertEquals(formatarHora(new Date(NaN)), "");
});

Deno.test("locale do Intl: es sem país (ou BR, padrão da etapa 1) = es-419", () => {
  assertEquals(localeIntl({ idioma: "pt-BR", pais: "BR" }), "pt-BR");
  assertEquals(localeIntl({ idioma: "es", pais: "BR" }), "es-419");
  assertEquals(localeIntl({ idioma: "es" }), "es-419");
  assertEquals(localeIntl({ idioma: "es", pais: "MX" }), "es-MX");
  assertEquals(localeIntl({ idioma: "es", pais: "AR" }), "es-AR");
  assertEquals(localeIntl({ idioma: "en", pais: "BR" }), "en-US");
  assertEquals(localeIntl({ idioma: "it" }), "it-IT");
});

Deno.test("fora do Brasil: moeda, número, data e hora da conta", () => {
  const latam: ContextoFormato = { idioma: "es", moeda: "USD", fuso: "America/Mexico_City", pais: "BR" };
  const iso = "2026-10-26T21:55:00Z"; // 15:55 na Cidade do México
  assertEquals(formatarMoeda(1234.5, latam), "US$\u00a01,234.50");
  assertEquals(formatarMoeda(-1234.5, latam), "-US$\u00a01,234.50");
  assertEquals(formatarMoeda(1234.5, { ...latam, pais: "MX" }), "US$\u00a01,234.50");
  assertEquals(formatarMoeda(null, latam), "US$\u00a00.00");
  assertEquals(formatarNumero(1234567.891, {}, latam), "1,234,567.891");
  assertEquals(formatarData(iso, latam), "26/10/2026");
  assertEquals(formatarHora(iso, latam), "15:55");
  const argentina: ContextoFormato = { idioma: "es", moeda: "USD", fuso: "America/Argentina/Buenos_Aires", pais: "AR" };
  assertEquals(formatarMoeda(1234.5, argentina), "US$ 1.234,50");
  assertEquals(formatarData(iso, argentina), "26/10/2026");
  const eua: ContextoFormato = { idioma: "en", moeda: "USD", fuso: "America/New_York" };
  assertEquals(formatarMoeda(-1234.5, eua), "-$1,234.50");
  assertEquals(formatarDataHora(iso, eua), "10/26/2026 17:55");
});
