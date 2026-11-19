// deno test --no-check scripts/testes-recibo-os-layout/
// Recibo personalizado em uma folha: regra que escolhe o nível de compactação
// (ou o agrupamento do fim, em 2 folhas) a partir das alturas medidas.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  LIMITE_UMA_FOLHA_MM,
  NIVEL_MAXIMO_COMPACTACAO,
  SEM_COMPACTACAO,
  decidirCompactacao,
  decisaoMudaRecibo,
  type MedidasCompactacao,
} from "../../src/lib/ordemServico/compactacaoReciboPersonalizado.ts";

// Medidas reais do harness (Chromium, mm): checklist + avarias e cenários de 2 folhas.
const CHECKLIST_AVARIAS: MedidasCompactacao = { alturasPorNivel: [313.9, 276, 268.9, 251.4], alturaFinalMm: 54.1, alturaAnteriorEFinalMm: 119.9 };
const med = (alturas: (number | null | undefined)[], final: number | null | undefined = 54, comAnterior: number | null | undefined = 120): MedidasCompactacao =>
  ({ alturasPorNivel: alturas, alturaFinalMm: final, alturaAnteriorEFinalMm: comAnterior });

Deno.test("limite de 270 mm e 4 níveis (0 a 3)", () => {
  assertEquals(LIMITE_UMA_FOLHA_MM, 270);
  assertEquals(NIVEL_MAXIMO_COMPACTACAO, 3);
});

Deno.test("cabe sem compactar: nível 0, nada muda", () => {
  const d = decidirCompactacao(med([217, 200, 198, 185]));
  assertEquals(d, { nivel: 0, agrupamento: "nenhum", motivo: "cabe" });
  assertEquals(decisaoMudaRecibo(d), false);
});

Deno.test("exatamente no limite ainda cabe (≤ 270)", () => {
  assertEquals(decidirCompactacao(med([270, 260, 250, 240])).nivel, 0);
  assertEquals(decidirCompactacao(med([270.01, 270, 250, 240])).nivel, 1);
});

Deno.test("vale o PRIMEIRO nível que cabe", () => {
  assertEquals(decidirCompactacao(CHECKLIST_AVARIAS), { nivel: 2, agrupamento: "nenhum", motivo: "compactado" });
  assertEquals(decidirCompactacao(med([300, 265, 250, 240])).nivel, 1);
  assertEquals(decidirCompactacao(med([300, 290, 280, 262])).nivel, 3);
  assert(decisaoMudaRecibo(decidirCompactacao(med([300, 265, 250, 240]))));
});

Deno.test("limite configurável (ex.: Android 273)", () => {
  assertEquals(decidirCompactacao(med([272, 260, 250, 240]), 273).nivel, 0);
  assertEquals(decidirCompactacao(med([272, 260, 250, 240])).nivel, 1);
});

Deno.test("nem o nível 3 cabe: nível 0 em 2 folhas, levando o bloco anterior junto", () => {
  assertEquals(decidirCompactacao(med([446, 400, 397, 386], 54, 186)), { nivel: 0, agrupamento: "anteriorEFinal", motivo: "duasFolhas" });
});

Deno.test("2 folhas com bloco anterior grande demais: só termo + assinaturas juntos", () => {
  assertEquals(decidirCompactacao(med([500, 480, 470, 460], 54, 300)), { nivel: 0, agrupamento: "final", motivo: "duasFolhas" });
  // anterior + fim exatamente no limite ainda vai junto
  assertEquals(decidirCompactacao(med([500, 480, 470, 460], 54, 270)).agrupamento, "anteriorEFinal");
  assertEquals(decidirCompactacao(med([500, 480, 470, 460], 54, 270.5)).agrupamento, "final");
});

Deno.test("termo + assinaturas maiores que a folha: recibo de sempre (nada a proteger)", () => {
  assertEquals(decidirCompactacao(med([600, 590, 580, 570], 280, 300)), { nivel: 0, agrupamento: "nenhum", motivo: "finalMaiorQueFolha" });
});

Deno.test("sem termo nem assinaturas: 2 folhas sem agrupamento", () => {
  assertEquals(decidirCompactacao(med([400, 380, 370, 360], null, null)), { nivel: 0, agrupamento: "nenhum", motivo: "duasFolhas" });
});

Deno.test("medida inválida ou ausente em qualquer nível: recibo de sempre", () => {
  for (const ruim of [null, undefined, NaN, Infinity, 0, -5]) {
    for (let i = 0; i < 4; i++) {
      const alturas: (number | null | undefined)[] = [300, 265, 250, 240];
      alturas[i] = ruim as number;
      assertEquals(decidirCompactacao(med(alturas)), SEM_COMPACTACAO, `nível ${i} = ${ruim}`);
    }
  }
  assertEquals(decidirCompactacao(med([300, 265])), SEM_COMPACTACAO); // faltam níveis
  assertEquals(decidirCompactacao(med([300, 265, 250, 240, 230])), SEM_COMPACTACAO); // sobra nível
  assertEquals(decidirCompactacao(med([])), SEM_COMPACTACAO);
});

Deno.test("2 folhas com medida do fim inválida: recibo de sempre", () => {
  const altas = [446, 400, 397, 386];
  const fim = (final: number | null | undefined, comAnterior: number | null | undefined) =>
    decidirCompactacao({ alturasPorNivel: altas, alturaFinalMm: final, alturaAnteriorEFinalMm: comAnterior });
  for (const ruim of [undefined, NaN, 0, -1]) assertEquals(fim(ruim, 120), SEM_COMPACTACAO, `fim = ${ruim}`);
  for (const ruim of [undefined, null, NaN, 0, -1]) assertEquals(fim(54, ruim), SEM_COMPACTACAO, `anterior + fim = ${ruim}`);
  // anterior + fim menor que o fim sozinho não faz sentido
  assertEquals(decidirCompactacao(med(altas, 54, 40)), SEM_COMPACTACAO);
});

Deno.test("recibo de sempre não muda o recibo; decisão nula também não", () => {
  assertEquals(SEM_COMPACTACAO.nivel, 0);
  assertEquals(SEM_COMPACTACAO.agrupamento, "nenhum");
  assertEquals(decisaoMudaRecibo(SEM_COMPACTACAO), false);
  assertEquals(decisaoMudaRecibo(null), false);
  assertEquals(decisaoMudaRecibo(undefined), false);
  assert(decisaoMudaRecibo({ nivel: 0, agrupamento: "final", motivo: "duasFolhas" }));
});

Deno.test("a decisão nunca escolhe nível que não cabe nem compacta quando cabe (varredura)", () => {
  for (let a0 = 150; a0 <= 450; a0 += 7) {
    const alturas = [a0, a0 * 0.88, a0 * 0.86, a0 * 0.81];
    const d = decidirCompactacao(med(alturas));
    if (d.motivo === "duasFolhas") {
      assertEquals(d.nivel, 0);
      assert(alturas.every((h) => h > LIMITE_UMA_FOLHA_MM));
    } else {
      assert(alturas[d.nivel] <= LIMITE_UMA_FOLHA_MM);
      for (let n = 0; n < d.nivel; n++) assert(alturas[n] > LIMITE_UMA_FOLHA_MM);
    }
  }
});

// PDF do iPhone: os cortes são o começo de cada filho do recibo. Agrupado, o fim
// (anterior + termo + assinaturas) é UM filho — a página só quebra antes dele.
import { quebrasDePagina } from "../../src/lib/ordemServico/paginasReciboPersonalizado.ts";

Deno.test("PDF do iPhone: bloco final agrupado vai inteiro para a folha 2", () => {
  // cenário "com fotos" medido: blocos começam em 0, 28.8, 59.8, 82.1, 117.6, 135.6, 193.9, 259.7; o grupo final
  // (fotos 132.1 + termo 28.6 + assinaturas 25.5 + espaços) começa em 259.7 e termina em 446.1.
  const paginas = quebrasDePagina(446.1, [0, 28.8, 59.8, 82.1, 117.6, 135.6, 193.9, 259.7]);
  assertEquals(paginas, [[0, 259.7], [259.7, 446.1]]);
  // sem agrupar, termo e assinaturas seriam cortes próprios e a folha 2 poderia ficar só com eles
  const soltos = quebrasDePagina(446.1, [0, 28.8, 59.8, 82.1, 117.6, 135.6, 193.9, 259.7, 394.6, 420.6]);
  assertEquals(soltos[0], [0, 259.7]);
});
