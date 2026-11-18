// Parte 1B: aviso de relógio, exibição no fuso certo e gravação do PDV. Dados fictícios, sem rede.
// Rodar também com TZ=Asia/Tokyo e TZ=America/Manaus: o resultado não pode depender do fuso do aparelho.
import assert from "node:assert/strict";
import { criarRelogioServidor, divergenciaRelogio, LIMITE_AVISO_RELOGIO_MS } from "../../src/lib/horaBrasilia/relogioServidor.core.ts";
import { formatarDataHoraDaConta, formatarDataHoraRecibo, FUSO_BRASILIA, noFusoDaConta } from "../../src/lib/horaBrasilia/formatoBrasilia.ts";
import { FORMATO_NAVEGADOR_BRASIL, type ContextoFormato } from "../../src/lib/i18n/formatadores.ts";
import ptBR from "../../src/locales/pt-BR/pdv.ts";
import es from "../../src/locales/es/pdv.ts";

const ler = (rel: string) => Deno.readTextFileSync(new URL(`../../${rel}`, import.meta.url));
const H = 3_600_000;
const INSTANTE = "2026-11-18T23:30:00.000Z"; // 20:30 em Brasília

Deno.test("aviso: só acima de 3 minutos", () => {
  assert.equal(LIMITE_AVISO_RELOGIO_MS, 180_000);
  assert.equal(divergenciaRelogio(0), null);
  assert.equal(divergenciaRelogio(180_000), null);
  assert.equal(divergenciaRelogio(-180_000), null);
  assert.equal(divergenciaRelogio(180_001)?.direcao, "atrasado");
  assert.equal(divergenciaRelogio(-180_001)?.direcao, "adiantado");
});

Deno.test("aviso: não aparece sem a hora do servidor", () => {
  assert.equal(divergenciaRelogio(null), null);
});

Deno.test("aviso: direção e tempo", () => {
  assert.deepEqual(divergenciaRelogio(H), { direcao: "atrasado", horas: 1, minutos: 0 });
  assert.deepEqual(divergenciaRelogio(-H), { direcao: "adiantado", horas: 1, minutos: 0 });
  assert.deepEqual(divergenciaRelogio(5 * 60_000), { direcao: "atrasado", horas: 0, minutos: 5 });
  assert.deepEqual(divergenciaRelogio(-(H + 25 * 60_000)), { direcao: "adiantado", horas: 1, minutos: 25 });
});

Deno.test("aviso: atualiza quando a diferença muda e some se a função falhar depois", async () => {
  let servidor: string | null = new Date(Date.parse(INSTANTE) + H).toISOString();
  let agora = Date.parse(INSTANTE);
  const relogio = criarRelogioServidor({ agoraMs: () => agora, lerHoraServidor: async () => { if (!servidor) throw new Error("x"); return servidor; } });
  let avisos = 0;
  const cancelar = relogio.assinar(() => avisos++);
  await relogio.sincronizar();
  assert.equal(avisos, 1);
  await relogio.sincronizar({ forcar: true });
  assert.equal(avisos, 1, "sem mudança, sem aviso");
  servidor = null;
  agora += 6 * 60_000;
  await relogio.sincronizar({ forcar: true });
  assert.equal(relogio.offsetMs(), null);
  assert.equal(avisos, 2);
  cancelar();
});

Deno.test("textos do aviso em pt-BR e es orientam data, hora e fuso", () => {
  assert.match(ptBR.caixa.relogio.orientacao, /data, a hora e o fuso/);
  assert.match(es.caixa.relogio.orientacao, /fecha, la hora y la zona horaria/);
  assert.match(es.caixa.relogio.orientacao, /^Las ventas.*Ajuste /, "usted: Ajuste, nunca Ajusta");
  assert.deepEqual(Object.keys(es.caixa.relogio), Object.keys(ptBR.caixa.relogio));
});

Deno.test("aviso nas três telas, sem bloquear a venda", () => {
  for (const f of ["src/components/pdv/DialogAberturaCaixa.tsx", "src/components/pdv/DialogFechamentoCaixa.tsx", "src/pages/PDV.tsx"]) {
    assert.ok(ler(f).includes("<AvisoRelogioAparelho"), f);
  }
  const pdv = ler("src/pages/PDV.tsx");
  assert.ok(pdv.includes("disabled={finalizando || itensCarrinho.length === 0 || !caixaEstaAberto || !totaisVenda.podeFinalizar || !!bloqueioTroca}"));
  assert.ok(!ler("src/components/pdv/AvisoRelogioAparelho.tsx").includes("disabled"));
});

Deno.test("exibição: conta sem fuso sai em Brasília, em qualquer fuso do aparelho", () => {
  assert.equal(noFusoDaConta(FORMATO_NAVEGADOR_BRASIL).fuso, FUSO_BRASILIA);
  assert.equal(formatarDataHoraDaConta(INSTANTE, FORMATO_NAVEGADOR_BRASIL), "18/11/2026 20:30");
  assert.equal(formatarDataHoraRecibo(INSTANTE, FORMATO_NAVEGADOR_BRASIL), "18/11/2026 às 20:30");
});

Deno.test("exibição: conta de outro país usa o fuso da conta", () => {
  const lima: ContextoFormato = { idioma: "es", moeda: "PEN", pais: "PE", fuso: "America/Lima" };
  assert.equal(noFusoDaConta(lima).fuso, "America/Lima");
  assert.equal(formatarDataHoraDaConta(INSTANTE, lima), "18/11/2026 18:30");
  assert.equal(formatarDataHoraRecibo(INSTANTE, lima), "18/11/2026 às 18:30");
});

Deno.test("exibição: status com a vírgula de sempre, agora no fuso certo", () => {
  const texto = new Date(INSTANTE).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: noFusoDaConta(FORMATO_NAVEGADOR_BRASIL).fuso });
  assert.equal(texto, "18/11/2026, 20:30");
  assert.ok(ler("src/components/pdv/DialogStatusCaixa.tsx").includes("timeZone: noFusoDaConta(fmt.ctx).fuso"));
});

Deno.test("exibição: histórico e recibo usam o formatador central", () => {
  assert.ok(ler("src/components/pdv/DialogHistoricoCaixas.tsx").includes("formatarDataHoraDaConta(iso, formatadores.ctx)"));
  const recibo = ler("src/components/pdv/DialogReciboPDV.tsx");
  assert.ok(recibo.includes("formatarDataHoraRecibo(dados.data, formatadoresConta.ctx)"));
  assert.ok(!recibo.includes('from "date-fns"'));
});

Deno.test("PDV: nenhuma linha de venda envia a hora do aparelho", () => {
  const pdv = ler("src/pages/PDV.tsx");
  const principal = pdv.slice(pdv.indexOf("const vendaData = {"), pdv.indexOf("const { data: venda, error: vendaError }"));
  const secundaria = pdv.slice(pdv.indexOf("const vendaSegundaForma = {"), pdv.indexOf("const { data: vendaSegunda, error: errSegunda }"));
  for (const bloco of [principal, secundaria]) {
    assert.ok(bloco.length > 200);
    assert.doesNotMatch(bloco, /^\s*data:/m);
  }
  assert.ok(pdv.includes("data: vendasRegistradas[0]?.data ?? agoraISO(),"), "recibo usa a data devolvida pelo banco");
  assert.ok(pdv.includes("const agoraISO = (): string => relogioServidor.agoraISO();"));
  assert.ok(!pdv.includes("new Date().toISOString();\n\n// Entrada da troca"));
});

Deno.test("PDV: sem fila offline; a venda grava direto no banco", () => {
  const pdv = ler("src/pages/PDV.tsx");
  const sw = ler("src/sw.ts");
  assert.ok(!/BackgroundSync|Queue/.test(sw));
  assert.ok(!/indexedDB|navigator\.onLine|withRetry/.test(pdv));
  assert.ok(pdv.includes(".insert([vendaData])\n            .select()\n            .single();"));
  assert.ok(pdv.includes(".insert([vendaSegundaForma])\n              .select()\n              .single();"));
});
