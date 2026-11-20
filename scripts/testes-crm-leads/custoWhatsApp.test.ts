// deno test --no-check --allow-read scripts/testes-crm-leads/
// Funil do WhatsApp (src/lib/marketing/custoWhatsApp.ts): fonte única do
// gasto, custos sem divisão por zero, limite da "amostra pequena" e
// validação do gasto informado no card.
import { assertEquals } from "jsr:@std/assert@1";
import {
  AMOSTRA_MIN_ASSINANTES,
  AMOSTRA_MIN_CONVERSAS,
  calcularCustosWhatsApp,
  custoPor,
  ehAmostraPequena,
  escolherFonteGasto,
  type LinhaFunilWhatsApp,
  normalizarLinhaFunil,
  percentual,
  validarGastoInformado,
  valorDigitadoParaCentavos,
} from "../../src/lib/marketing/custoWhatsApp.ts";

const base: LinhaFunilWhatsApp = {
  conversas: 412, conversas_anuncio: 318, ja_clientes: 14, cadastros: 61, testes: 48, assinantes: 9,
  opt_outs: 3, gasto_meta_centavos: 0, gasto_meta_dias: 0, gasto_manual_centavos: 0, gasto_manual_lancamentos: 0,
};

Deno.test("limites da amostra pequena: 30 conversas e 5 assinantes", () => {
  assertEquals(AMOSTRA_MIN_CONVERSAS, 30);
  assertEquals(AMOSTRA_MIN_ASSINANTES, 5);
  assertEquals(ehAmostraPequena(29, 100), true);
  assertEquals(ehAmostraPequena(30, 5), false);
  assertEquals(ehAmostraPequena(30, 4), true);
  assertEquals(ehAmostraPequena(1000, 4), true);
  assertEquals(ehAmostraPequena(0, 0), true);
});

Deno.test("amostra pequena continua mostrando os custos", () => {
  const c = calcularCustosWhatsApp({ ...base, conversas: 29, assinantes: 4, gasto_manual_centavos: 10000, gasto_manual_lancamentos: 1 });
  assertEquals(c.amostraPequena, true);
  assertEquals(c.porConversaCentavos, 345);
  assertEquals(c.porAssinanteCentavos, 2500);
});

Deno.test("fonte única: Meta quando há linha das campanhas de WhatsApp, nunca soma com o manual", () => {
  const l = { ...base, gasto_meta_centavos: 124000, gasto_meta_dias: 30, gasto_manual_centavos: 50000, gasto_manual_lancamentos: 2 };
  assertEquals(escolherFonteGasto(l), { fonte: "meta", gastoCentavos: 124000 });
  const c = calcularCustosWhatsApp(l);
  assertEquals(c.gastoCentavos, 124000);
  assertEquals(c.diasComGastoMeta, 30);
  assertEquals(c.porConversaCentavos, 301);
  assertEquals(c.porCadastroCentavos, 2033);
  assertEquals(c.porAssinanteCentavos, 13778);
});

Deno.test("Meta com 1 dia de linha (mesmo gasto 0) ainda é a fonte", () => {
  assertEquals(escolherFonteGasto({ ...base, gasto_meta_dias: 1, gasto_manual_lancamentos: 1, gasto_manual_centavos: 9 }),
    { fonte: "meta", gastoCentavos: 0 });
});

Deno.test("sem Meta usa o manual; sem nenhum, custos null", () => {
  assertEquals(escolherFonteGasto({ ...base, gasto_manual_centavos: 5000, gasto_manual_lancamentos: 1 }), { fonte: "manual", gastoCentavos: 5000 });
  const c = calcularCustosWhatsApp(base);
  assertEquals(c.fonte, "nenhum");
  assertEquals([c.gastoCentavos, c.porConversaCentavos, c.porCadastroCentavos, c.porAssinanteCentavos], [null, null, null, null]);
});

Deno.test("custo com quantidade 0 é null (nunca Infinity/NaN)", () => {
  assertEquals(custoPor(1000, 0), null);
  assertEquals(custoPor(null, 10), null);
  assertEquals(custoPor(1000, 3), 333);
  const c = calcularCustosWhatsApp({ ...base, assinantes: 0, gasto_manual_centavos: 100, gasto_manual_lancamentos: 1 });
  assertEquals(c.porAssinanteCentavos, null);
});

Deno.test("linha do PostgREST (bigint como texto, nulos) vira números seguros", () => {
  const l = normalizarLinhaFunil({ conversas: "412", assinantes: 9, gasto_meta_centavos: null, gasto_meta_dias: "x", opt_outs: -1 });
  assertEquals([l.conversas, l.assinantes, l.gasto_meta_centavos, l.gasto_meta_dias, l.opt_outs], [412, 9, 0, 0, 0]);
  assertEquals(normalizarLinhaFunil(null).conversas, 0);
});

Deno.test("percentual com 1 casa; base 0 = null", () => {
  assertEquals(percentual(61, 412), 14.8);
  assertEquals(percentual(9, 412), 2.2);
  assertEquals(percentual(1, 0), null);
});

Deno.test("valor digitado em reais -> centavos", () => {
  assertEquals(valorDigitadoParaCentavos("1.240,00"), 124000);
  assertEquals(valorDigitadoParaCentavos("R$ 1.240,5"), 124050);
  assertEquals(valorDigitadoParaCentavos("1240,55"), 124055);
  assertEquals(valorDigitadoParaCentavos("1240.55"), 124055);
  assertEquals(valorDigitadoParaCentavos("1240"), 124000);
  assertEquals(valorDigitadoParaCentavos("1,234"), null);
  assertEquals(valorDigitadoParaCentavos("-5"), null);
  assertEquals(valorDigitadoParaCentavos(""), null);
  assertEquals(valorDigitadoParaCentavos("12a"), null);
});

Deno.test("validação do gasto informado espelha admin_crm_gasto_informar", () => {
  const hoje = "2026-11-20";
  assertEquals(validarGastoInformado({ inicio: "2026-11-01", fim: "2026-11-20", valor: "500,00" }, hoje),
    { ok: true, inicio: "2026-11-01", fim: "2026-11-20", valorCentavos: 50000, adId: null });
  assertEquals(validarGastoInformado({ inicio: "2026-11-01", fim: "2026-11-20", valor: "5", adId: " 120000000000001 " }, hoje),
    { ok: true, inicio: "2026-11-01", fim: "2026-11-20", valorCentavos: 500, adId: "120000000000001" });
  assertEquals(validarGastoInformado({ inicio: "2026-11-10", fim: "2026-11-01", valor: "5" }, hoje), { ok: false, erro: "periodo_invalido" });
  assertEquals(validarGastoInformado({ inicio: "2026-11-10", fim: "2026-11-21", valor: "5" }, hoje), { ok: false, erro: "data_futura" });
  assertEquals(validarGastoInformado({ inicio: "2025-10-15", fim: "2026-11-20", valor: "5" }, hoje), { ok: false, erro: "periodo_longo" });
  assertEquals(validarGastoInformado({ inicio: "2025-10-16", fim: "2026-11-20", valor: "5" }, hoje).ok, true); // 400 dias
  assertEquals(validarGastoInformado({ inicio: "2026-11-01", fim: "2026-11-02", valor: "0" }, hoje), { ok: false, erro: "valor_invalido" });
  assertEquals(validarGastoInformado({ inicio: "2026-11-01", fim: "2026-11-02", valor: "1.000.000,01" }, hoje), { ok: false, erro: "valor_invalido" });
  assertEquals(validarGastoInformado({ inicio: "2026-11-01", fim: "2026-11-02", valor: "1.000.000,00" }, hoje).ok, true);
  assertEquals(validarGastoInformado({ inicio: "2026-11-01", fim: "2026-11-02", valor: "5", adId: "anúncio 1" }, hoje), { ok: false, erro: "anuncio_invalido" });
  assertEquals(validarGastoInformado({ inicio: "2026-13-01", fim: "2026-13-02", valor: "5" }, hoje), { ok: false, erro: "periodo_invalido" });
  assertEquals(validarGastoInformado({ inicio: "2026-02-30", fim: "2026-03-01", valor: "5" }, hoje), { ok: false, erro: "periodo_invalido" });
});
