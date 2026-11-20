// node --test scripts/testes-avarias-posicao/posicaoAvaria.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pontoNoDesenho, tipoDoDesenho, VIEWBOX_DESENHO } from "../../src/lib/ordemServico/posicaoAvaria.ts";

const perto = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

test("celular (9:16, mesma proporção da caixa): ponto gravado = ponto no desenho", () => {
  for (const [x, y] of [[0, 0], [50, 50], [11.5, 13.2], [100, 100]]) {
    const { fx, fy } = pontoNoDesenho(x, y, VIEWBOX_DESENHO.celular);
    perto(fx, x / 100); perto(fy, y / 100);
  }
});

test("tablet 4:3: centro continua centro; faixas vazias da caixa ficam fora do desenho", () => {
  const vb = VIEWBOX_DESENHO.tablet; // desenho ocupa a largura toda e 9*(240/320)=6,75 de 16 na altura
  const c = pontoNoDesenho(50, 50, vb); perto(c.fx, 0.5); perto(c.fy, 0.5);
  const topo = ((16 - 6.75) / 2) / 16 * 100; // % da caixa onde começa o desenho
  perto(pontoNoDesenho(0, topo, vb).fy, 0);
  perto(pontoNoDesenho(100, 100 - topo, vb).fy, 1);
  perto(pontoNoDesenho(100, 50, vb).fx, 1);
});

test("ida e volta: pixel do desenho na caixa 9:16 → % → fração do viewBox", () => {
  for (const [tipo, vb] of Object.entries(VIEWBOX_DESENHO)) {
    const s = Math.min(9 / vb[0], 16 / vb[1]);
    const ox = (9 - vb[0] * s) / 2, oy = (16 - vb[1] * s) / 2;
    for (const [vx, vy] of [[0, 0], [vb[0], vb[1]], [vb[0] * 0.3, vb[1] * 0.8]]) {
      const x = (ox + vx * s) / 9 * 100, y = (oy + vy * s) / 16 * 100;
      const r = pontoNoDesenho(x, y, vb);
      perto(r.fx, vx / vb[0], 1e-9); perto(r.fy, vy / vb[1], 1e-9);
    }
    assert.ok(tipo);
  }
});

test("tipo normalizado como na tela de marcação", () => {
  assert.equal(tipoDoDesenho("Relogio_Smart"), "relogio_smart");
  assert.equal(tipoDoDesenho("relogio"), "relogio_smart");
  assert.equal(tipoDoDesenho("smartwatch"), "relogio_smart");
  assert.equal(tipoDoDesenho("Video_Game"), "video_game");
  assert.equal(tipoDoDesenho("Video Game"), "video_game");
  assert.equal(tipoDoDesenho("Celular"), "celular");
  assert.equal(tipoDoDesenho("smartphone"), "celular");
  assert.equal(tipoDoDesenho("Televisao"), "televisao");
  assert.equal(tipoDoDesenho("Outro qualquer"), "celular");
  assert.equal(tipoDoDesenho(null), "celular");
});

test("tabela de viewBox bate com os SVGs dos desenhos", async () => {
  const fs = await import("node:fs");
  const arq: Record<string, string> = { celular: "Celular", tablet: "Tablet", notebook: "Notebook", computador: "Computador", desktop: "Desktop", relogio_smart: "RelogioSmart", impressora: "Impressora", video_game: "VideoGame", televisao: "Televisao", estabilizador: "Estabilizador", nobreak: "Nobreak", projetor: "Projetor" };
  for (const [tipo, nome] of Object.entries(arq)) {
    const src = fs.readFileSync(new URL(`../../src/components/ordens/silhuetas/Silhueta${nome}.tsx`, import.meta.url), "utf8");
    const vbs = new Set([...src.matchAll(/viewBox="0 0 (\d+) (\d+)"/g)].map((m) => `${m[1]}x${m[2]}`));
    assert.deepEqual([...vbs], [`${VIEWBOX_DESENHO[tipo][0]}x${VIEWBOX_DESENHO[tipo][1]}`], tipo);
  }
});
