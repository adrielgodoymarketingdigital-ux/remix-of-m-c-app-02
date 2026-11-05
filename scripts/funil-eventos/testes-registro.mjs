// node scripts/funil-eventos/testes-registro.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  aguardarEnvioAntesDeSair,
  enviarRegistroNovo,
} from "../../src/lib/registroAntesDeSair.core.ts";

function cenario(sobrescrever = {}) {
  const chamadas = { pixel: [], capi: [], marcar: 0, falhas: [] };
  const envio = {
    gerarEventId: () => "evt-1",
    dispararPixel: (id) => chamadas.pixel.push(id),
    enviarCapi: async (id) => chamadas.capi.push(id),
    marcarRastreado: async () => {
      chamadas.marcar += 1;
    },
    aoFalhar: (etapa) => chamadas.falhas.push(etapa),
    ...sobrescrever,
  };
  return { chamadas, envio };
}

test("Pixel e CAPI saem uma vez, com o mesmo event_id, e a conta é marcada", async () => {
  const { chamadas, envio } = cenario();
  await enviarRegistroNovo(envio);
  assert.deepEqual(chamadas, { pixel: ["evt-1"], capi: ["evt-1"], marcar: 1, falhas: [] });
});

test("Pixel e as duas requisições começam na mesma passada, sem esperar resposta", () => {
  const { chamadas, envio } = cenario();
  void enviarRegistroNovo(envio);
  assert.deepEqual(chamadas.pixel, ["evt-1"]);
  assert.deepEqual(chamadas.capi, ["evt-1"]);
  assert.equal(chamadas.marcar, 1);
});

test("falha no Pixel não impede CAPI nem marcação", async () => {
  const { chamadas, envio } = cenario({
    dispararPixel: () => {
      throw new Error("adblock");
    },
  });
  await enviarRegistroNovo(envio);
  assert.deepEqual(chamadas.capi, ["evt-1"]);
  assert.equal(chamadas.marcar, 1);
  assert.deepEqual(chamadas.falhas, ["pixel"]);
});

test("falha na CAPI ou na marcação não rejeita", async () => {
  const { chamadas, envio } = cenario({
    enviarCapi: () => Promise.reject(new Error("rede")),
    marcarRastreado: () => {
      throw new Error("síncrono");
    },
  });
  await enviarRegistroNovo(envio);
  assert.deepEqual(chamadas.falhas.sort(), ["capi", "marcar"]);
});

const medir = async (promessa) => {
  const inicio = Date.now();
  await promessa;
  return Date.now() - inicio;
};
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

test("envio rápido: respeita o mínimo", async () => {
  const ms = await medir(aguardarEnvioAntesDeSair(Promise.resolve(), 100, 300));
  assert.ok(ms >= 95 && ms < 200, `esperou ${ms} ms`);
});

test("envio entre o mínimo e o máximo: sai quando o envio termina", async () => {
  const ms = await medir(aguardarEnvioAntesDeSair(dormir(180), 100, 400));
  assert.ok(ms >= 170 && ms < 300, `esperou ${ms} ms`);
});

test("envio travado: sai no máximo", async () => {
  const ms = await medir(aguardarEnvioAntesDeSair(new Promise(() => {}), 100, 200));
  assert.ok(ms >= 195 && ms < 300, `esperou ${ms} ms`);
});

test("envio rejeitado: sai sem erro, ainda respeitando o mínimo", async () => {
  const ms = await medir(aguardarEnvioAntesDeSair(Promise.reject(new Error("x")), 100, 300));
  assert.ok(ms >= 95 && ms < 200, `esperou ${ms} ms`);
});
