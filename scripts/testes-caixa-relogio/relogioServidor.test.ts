// Módulo da hora do servidor: cache, fallback e volta à tela. Sem rede.
import assert from "node:assert/strict";
import { calcularOffsetMs, criarRelogioServidor, VALIDADE_AMOSTRA_MS } from "../../src/lib/horaBrasilia/relogioServidor.core.ts";

const H = 3_600_000;
const ISO = (ms: number) => new Date(ms).toISOString();

function montar(opcoes: { desvio?: number; ler?: () => Promise<unknown> } = {}) {
  const estado = { servidor: Date.parse("2026-11-17T15:00:00Z"), desvio: opcoes.desvio ?? 0, leituras: 0 };
  const relogio = criarRelogioServidor({
    agoraMs: () => estado.servidor + estado.desvio,
    tempoLimiteMs: 20,
    lerHoraServidor: opcoes.ler ?? (async () => { estado.leituras++; return ISO(estado.servidor); }),
  });
  return { estado, relogio };
}

Deno.test("offset: atrasado, adiantado e meio da requisição", () => {
  const s = 1_000_000;
  assert.equal(calcularOffsetMs({ enviadoEmMs: s - H, recebidoEmMs: s - H, horaServidor: ISO(s) }), H);
  assert.equal(calcularOffsetMs({ enviadoEmMs: s + H, recebidoEmMs: s + H, horaServidor: ISO(s) }), -H);
  assert.equal(calcularOffsetMs({ enviadoEmMs: s - 100, recebidoEmMs: s + 100, horaServidor: ISO(s) }), 0);
});

Deno.test("offset: resposta inválida vira null", () => {
  for (const horaServidor of [null, undefined, 123, "", "lixo", {}]) {
    assert.equal(calcularOffsetMs({ enviadoEmMs: 1, recebidoEmMs: 2, horaServidor }), null);
  }
});

for (const desvio of [-H, 0, H]) {
  Deno.test(`hora corrigida com aparelho desviado em ${desvio / H}h`, async () => {
    const { estado, relogio } = montar({ desvio });
    await relogio.sincronizar();
    assert.equal(relogio.agoraISO(), ISO(estado.servidor));
    assert.equal(relogio.agoraMs(), estado.servidor);
  });
}

Deno.test("antes de sincronizar vale o relógio do aparelho", () => {
  const { estado, relogio } = montar({ desvio: -H });
  assert.equal(relogio.offsetMs(), null);
  assert.equal(relogio.agoraISO(), ISO(estado.servidor - H));
});

Deno.test("cache de 5 minutos, com forcar ignorando o cache", async () => {
  const { estado, relogio } = montar();
  await relogio.sincronizar();
  await relogio.sincronizar();
  assert.equal(estado.leituras, 1);
  estado.servidor += VALIDADE_AMOSTRA_MS - 1;
  await relogio.sincronizar();
  assert.equal(estado.leituras, 1);
  estado.servidor += 1;
  await relogio.sincronizar();
  assert.equal(estado.leituras, 2);
  await relogio.sincronizar({ forcar: true });
  assert.equal(estado.leituras, 3);
});

Deno.test("relógio do aparelho que volta no tempo invalida o cache", async () => {
  const { estado, relogio } = montar();
  await relogio.sincronizar();
  estado.desvio = -H;
  await relogio.sincronizar();
  assert.equal(estado.leituras, 2);
  assert.equal(relogio.agoraISO(), ISO(estado.servidor));
});

Deno.test("chamadas simultâneas fazem uma leitura só", async () => {
  const { estado, relogio } = montar();
  await Promise.all([relogio.sincronizar(), relogio.sincronizar({ forcar: true }), relogio.sincronizar()]);
  assert.equal(estado.leituras, 1);
});

Deno.test("falha da função: não rejeita, usa o aparelho e não insiste a cada chamada", async () => {
  let leituras = 0;
  const { estado, relogio } = montar({ desvio: -H, ler: async () => { leituras++; throw new Error("função não existe"); } });
  await relogio.sincronizar();
  await relogio.sincronizar();
  assert.equal(leituras, 1);
  assert.equal(relogio.offsetMs(), null);
  assert.equal(relogio.agoraISO(), ISO(estado.servidor - H));
});

Deno.test("função que trava: o tempo limite libera o app", async () => {
  const { relogio } = montar({ ler: () => new Promise(() => undefined) });
  await relogio.sincronizar();
  assert.equal(relogio.offsetMs(), null);
});

Deno.test("falha com amostra recente mantém o offset; com amostra vencida volta ao aparelho", async () => {
  let falhar = false;
  const estadoServidor = { ms: Date.parse("2026-11-17T15:00:00Z") };
  const relogio = criarRelogioServidor({
    agoraMs: () => estadoServidor.ms - H,
    lerHoraServidor: async () => { if (falhar) throw new Error("x"); return ISO(estadoServidor.ms); },
  });
  await relogio.sincronizar();
  falhar = true;
  await relogio.sincronizar({ forcar: true });
  assert.equal(relogio.offsetMs(), H);
  estadoServidor.ms += VALIDADE_AMOSTRA_MS;
  await relogio.sincronizar({ forcar: true });
  assert.equal(relogio.offsetMs(), null);
});
