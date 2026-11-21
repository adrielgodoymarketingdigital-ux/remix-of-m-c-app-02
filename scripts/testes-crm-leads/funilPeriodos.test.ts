// deno test --no-check --allow-read scripts/testes-crm-leads/
// Filtro de período do card "Funil do WhatsApp": Hoje, Ontem, 7/14/30 dias e
// Personalizado (inclusive virada de mês e de ano), período padrão (7 dias) e
// textos com 1 dia só ("1 de 1 dia", "em DD/MM/AAAA"). Dados fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import {
  PERIODOS_FUNIL,
  PERIODO_FUNIL_PADRAO,
  intervaloFunil,
  rotuloDias,
  rotuloFonteGasto,
  textoPeriodoFunil,
} from "../../src/lib/marketing/funilWhatsApp.ts";
import { rotuloFonteGasto2A, type Custos2A } from "../../src/lib/marketing/gastoMetaWhatsApp.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => Deno.readTextFileSync(new URL(p, raiz));
const vazio = { inicio: "", fim: "" };
const intervalo = (inicio: string, fim: string, dias: number) => ({ ok: true, inicio, fim, dias });

// ---------------------------------------------------------------- opções
Deno.test("opções na ordem: Hoje, Ontem, 7, 14, 30 dias, Personalizado", () => {
  assertEquals(PERIODOS_FUNIL.map((p) => p.rotulo),
    ["Hoje", "Ontem", "Últimos 7 dias", "Últimos 14 dias", "Últimos 30 dias", "Personalizado"]);
  assertEquals(PERIODOS_FUNIL.map((p) => p.valor), ["hoje", "ontem", "7d", "14d", "30d", "personalizado"]);
});

Deno.test("card abre em 'Últimos 7 dias' e o personalizado começa em hoje-6", () => {
  assertEquals(PERIODO_FUNIL_PADRAO, "7d");
  const card = ler("src/components/admin/marketing/CardFunilWhatsApp.tsx");
  assertEquals(card.includes("useState<PeriodoFunil>(PERIODO_FUNIL_PADRAO)"), true);
  assertEquals(card.includes("useState({ inicio: somarDiasISO(hoje, -6), fim: hoje })"), true);
  // "hoje" vem de Brasília, não do relógio local
  assertEquals(card.includes("const hoje = dataBrasiliaISO();"), true);
});

// ---------------------------------------------------------------- hoje / ontem
Deno.test("hoje: início = fim = hoje, 1 dia", () => {
  assertEquals(intervaloFunil("hoje", vazio, "2026-11-21"), intervalo("2026-11-21", "2026-11-21", 1));
});

Deno.test("ontem: início = fim = hoje-1, 1 dia (virada de mês e de ano)", () => {
  assertEquals(intervaloFunil("ontem", vazio, "2026-11-21"), intervalo("2026-11-20", "2026-11-20", 1));
  assertEquals(intervaloFunil("ontem", vazio, "2026-12-01"), intervalo("2026-11-30", "2026-11-30", 1));
  assertEquals(intervaloFunil("ontem", vazio, "2027-01-01"), intervalo("2026-12-31", "2026-12-31", 1));
  assertEquals(intervaloFunil("ontem", vazio, "2028-03-01"), intervalo("2028-02-29", "2028-02-29", 1)); // bissexto
});

Deno.test("hoje/ontem ignoram as datas do personalizado (mesmo inválidas)", () => {
  assertEquals(intervaloFunil("hoje", { inicio: "x", fim: "2030-01-01" }, "2026-11-21").ok, true);
  assertEquals(intervaloFunil("ontem", { inicio: "2026-11-10", fim: "2026-11-01" }, "2026-11-21").ok, true);
});

// ---------------------------------------------------------------- 7 / 14 / 30
Deno.test("7d: hoje-6..hoje (comportamento antigo mantido)", () => {
  assertEquals(intervaloFunil("7d", vazio, "2026-11-21"), intervalo("2026-11-15", "2026-11-21", 7));
  assertEquals(intervaloFunil("7d", vazio, "2026-12-03"), intervalo("2026-11-27", "2026-12-03", 7));
  assertEquals(intervaloFunil("7d", vazio, "2027-01-02"), intervalo("2026-12-27", "2027-01-02", 7));
});

Deno.test("14d: hoje-13..hoje (virada de mês e de ano)", () => {
  assertEquals(intervaloFunil("14d", vazio, "2026-11-21"), intervalo("2026-11-08", "2026-11-21", 14));
  assertEquals(intervaloFunil("14d", vazio, "2026-12-05"), intervalo("2026-11-22", "2026-12-05", 14));
  assertEquals(intervaloFunil("14d", vazio, "2027-01-05"), intervalo("2026-12-23", "2027-01-05", 14));
});

Deno.test("30d: hoje-29..hoje (virada de mês e de ano)", () => {
  assertEquals(intervaloFunil("30d", vazio, "2026-11-21"), intervalo("2026-10-23", "2026-11-21", 30));
  assertEquals(intervaloFunil("30d", vazio, "2027-01-10"), intervalo("2026-12-12", "2027-01-10", 30));
  assertEquals(intervaloFunil("30d", vazio, "2027-03-01"), intervalo("2027-01-31", "2027-03-01", 30));
});

// ---------------------------------------------------------------- personalizado
Deno.test("personalizado: 1 dia, virada de mês e de ano, recusas", () => {
  const hoje = "2027-01-15";
  assertEquals(intervaloFunil("personalizado", { inicio: "2027-01-15", fim: "2027-01-15" }, hoje), intervalo("2027-01-15", "2027-01-15", 1));
  assertEquals(intervaloFunil("personalizado", { inicio: "2026-11-28", fim: "2026-12-03" }, hoje), intervalo("2026-11-28", "2026-12-03", 6));
  assertEquals(intervaloFunil("personalizado", { inicio: "2026-12-30", fim: "2027-01-02" }, hoje), intervalo("2026-12-30", "2027-01-02", 4));
  // padrão do estado (hoje-6..hoje) = mesmo intervalo do 7d
  assertEquals(intervaloFunil("personalizado", { inicio: "2027-01-09", fim: hoje }, hoje), intervaloFunil("7d", vazio, hoje));
  assertEquals(intervaloFunil("personalizado", { inicio: "2027-01-10", fim: "2027-01-09" }, hoje).ok, false);
  assertEquals(intervaloFunil("personalizado", { inicio: "2027-01-15", fim: "2027-01-16" }, hoje).ok, false);
  assertEquals(intervaloFunil("personalizado", { inicio: "2027-02-30", fim: hoje }, hoje).ok, false);
});

// ---------------------------------------------------------------- textos com 1 dia
Deno.test("textos: 1 dia no singular, período de 1 dia com 'em'", () => {
  assertEquals(rotuloDias(1), "1 dia");
  assertEquals(rotuloDias(7), "7 dias");
  assertEquals(rotuloFonteGasto("meta", 1, 1), "Gasto da Meta (campanhas de WhatsApp) · 1 de 1 dia");
  assertEquals(rotuloFonteGasto("meta", 0, 1), "Gasto da Meta (campanhas de WhatsApp) · 0 de 1 dia");
  assertEquals(rotuloFonteGasto("meta", 12, 30), "Gasto da Meta (campanhas de WhatsApp) · 12 de 30 dias");
  assertEquals(textoPeriodoFunil("2026-11-21", "2026-11-21"), "em 21/11/2026");
  assertEquals(textoPeriodoFunil("2026-11-15", "2026-11-21"), "de 15/11/2026 a 21/11/2026");
});

Deno.test("selo 2A: '1 de 1 dia' e '7 de 30 dias'", () => {
  const c = { fonte: "automatico", daFase2A: true, diasComGastoMeta: 1, gastoInformadoCentavos: 0 } as Custos2A;
  assertEquals(rotuloFonteGasto2A(c, 1), "Gasto da Meta por anúncio · 1 de 1 dia");
  assertEquals(rotuloFonteGasto2A({ ...c, diasComGastoMeta: 7 }, 30), "Gasto da Meta por anúncio · 7 de 30 dias");
});
