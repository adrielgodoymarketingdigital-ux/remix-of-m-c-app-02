// deno test --no-check scripts/testes-recibo-os-layout/
// PDF do recibo personalizado no iPhone instalado: quebra só na borda dos blocos e limite do canvas.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ALTURA_UTIL_MM,
  LARGURA_UTIL_MM,
  escalaDaCaptura,
  primeiraMaiuscula,
  quebrasDePagina,
} from "../../src/lib/ordemServico/paginasReciboPersonalizado.ts";

Deno.test("A4 útil = 194 × 281 mm (margem de 8 mm)", () => {
  assertEquals([LARGURA_UTIL_MM, ALTURA_UTIL_MM], [194, 281]);
});

Deno.test("cabe em uma página: uma página só", () => {
  assertEquals(quebrasDePagina(200, [0, 30, 80, 150]), [[0, 200]]);
  assertEquals(quebrasDePagina(281, [30, 100]), [[0, 281]]);
  assertEquals(quebrasDePagina(0, []), [[0, 0]]);
});

Deno.test("quebra no último começo de bloco que cabe (nenhum cartão partido)", () => {
  // blocos começam em 0, 40, 120, 250, 300; total 400
  assertEquals(quebrasDePagina(400, [0, 40, 120, 250, 300]), [[0, 250], [250, 400]]);
  // três páginas
  assertEquals(quebrasDePagina(700, [100, 270, 300, 520, 560]), [[0, 270], [270, 520], [520, 700]]);
});

Deno.test("bloco maior que a página: corta na altura da página", () => {
  assertEquals(quebrasDePagina(600, [10, 500]), [[0, 281], [281, 500], [500, 600]]);
});

Deno.test("cortes fora de ordem, repetidos ou inválidos não atrapalham", () => {
  assertEquals(quebrasDePagina(400, [300, NaN, 250, 250, -5, 900, 0]), [[0, 250], [250, 400]]);
});

Deno.test("cada página tem no máximo 281 mm e as páginas são contínuas", () => {
  const cortes = Array.from({ length: 40 }, (_, i) => i * 37 + 5);
  const p = quebrasDePagina(1500, cortes);
  assertEquals(p[0][0], 0);
  assertEquals(p[p.length - 1][1], 1500);
  for (let i = 0; i < p.length; i++) {
    assert(p[i][1] - p[i][0] <= 281 + 1e-9);
    if (i > 0) assertEquals(p[i][0], p[i - 1][1]);
  }
});

Deno.test("escala: 2× quando cabe no teto; menor quando passaria de 4 MP", () => {
  assertEquals(escalaDaCaptura(733, 1062), 2); // 1466×2124 ≈ 3,1 MP
  const s = escalaDaCaptura(1200, 2000);
  assert(s < 2 && Math.abs(1200 * s * 2000 * s - 4_000_000) < 10);
  assertEquals(escalaDaCaptura(100000, 100000), 0.5); // piso
  assertEquals(escalaDaCaptura(733, 1062, { escalaMaxima: 1.5 }), 1.5);
});

Deno.test("primeira letra maiúscula (sem ::first-letter na captura)", () => {
  assertEquals(primeiraMaiuscula("camera traseira"), "Camera traseira");
  assertEquals(primeiraMaiuscula("ícone"), "Ícone");
  assertEquals(primeiraMaiuscula(""), "");
});
