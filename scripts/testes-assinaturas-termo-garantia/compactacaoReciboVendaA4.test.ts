// deno test -A --no-check --config scripts/testes-assinaturas-termo-garantia/deno.json scripts/testes-assinaturas-termo-garantia/
// Regra pura que escolhe o nível de compactação do recibo / termo de garantia
// de dispositivo em A4 (ou o agrupamento do fim do termo com as assinaturas).
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  AREA_CONTEUDO_PDF_MM,
  CLASSE_FINAL_JUNTO,
  ESCALAS_PDF_A4,
  FONTE_MINIMA_TERMO_PT,
  LIMITE_UMA_FOLHA_HTML_MM,
  LIMITE_UMA_FOLHA_PDF_MM,
  NIVEL_MAXIMO_COMPACTACAO,
  SEM_COMPACTACAO,
  agruparTermoFinalEAssinaturas,
  aplicarCompactacaoReciboDispositivoA4,
  cssCompactacaoReciboDispositivoA4,
  decidirCompactacao,
  decisaoMudaDocumento,
  linhasDoBlocoFinal,
  type MedidasCompactacao,
} from "../../src/lib/recibo/compactacaoReciboVendaA4.ts";

const L = LIMITE_UMA_FOLHA_PDF_MM;
const med = (alturas: (number | null | undefined)[], final: number | null | undefined = 40): MedidasCompactacao => ({ alturasPorNivel: alturas, alturaFinalMm: final });

Deno.test("constantes: 3 níveis, limites com folga, termo nunca abaixo de 7 pt", () => {
  assertEquals(NIVEL_MAXIMO_COMPACTACAO, 2);
  assertEquals(ESCALAS_PDF_A4.length, 3);
  assert(LIMITE_UMA_FOLHA_PDF_MM < 280 && AREA_CONTEUDO_PDF_MM === 280 - 15);
  assert(LIMITE_UMA_FOLHA_HTML_MM < 277 - 8);
  for (const e of ESCALAS_PDF_A4) assert(e.fonteTermoPt >= FONTE_MINIMA_TERMO_PT);
  // Nível 0 = os números de sempre do gerarReciboVendaPDF.
  assertEquals(ESCALAS_PDF_A4[0], { passoLinha: 5, fonteLinhaPt: 9, passoTermo: 4, fonteTermoPt: 8, avancoTitulo: 9, aposFaixa: 6, aposSecao: 3, aposTermo: 6, aposTotal: 10, antesAssinaturas: 10 });
  // Cada nível ocupa menos (ou igual) que o anterior.
  for (let n = 1; n < ESCALAS_PDF_A4.length; n++) {
    for (const k of Object.keys(ESCALAS_PDF_A4[0]) as (keyof (typeof ESCALAS_PDF_A4)[0])[]) assert(ESCALAS_PDF_A4[n][k] <= ESCALAS_PDF_A4[n - 1][k], `${k} nível ${n}`);
  }
});

Deno.test("cabe sem compactar: nível 0, sem agrupamento (documento de sempre)", () => {
  const d = decidirCompactacao(med([200, 180, 170]), L);
  assertEquals(d, { nivel: 0, agruparFinal: false, motivo: "cabe" });
  assertEquals(decisaoMudaDocumento(d), false);
  // Exatamente no limite ainda cabe.
  assertEquals(decidirCompactacao(med([L, 250, 240]), L).nivel, 0);
});

Deno.test("cabe no nível 1", () => {
  // Medidas reais do PDF: termo padrão, 1 aparelho (Y final 308,3 / 271 / 252,5).
  assertEquals(decidirCompactacao(med([308.3, 271, 252.5]), L), { nivel: 1, agruparFinal: false, motivo: "compactado" });
  assertEquals(decidirCompactacao(med([L + 0.1, L, 240]), L).nivel, 1);
});

Deno.test("cabe só no nível 2", () => {
  assertEquals(decidirCompactacao(med([310, 280, 268]), L), { nivel: 2, agruparFinal: false, motivo: "compactado" });
  assert(decisaoMudaDocumento(decidirCompactacao(med([310, 280, 268]), L)));
});

Deno.test("não cabe nem no nível 2: volta ao nível 0 e agrupa fim do termo + assinaturas", () => {
  const d = decidirCompactacao(med([500, 430, 400], 45), L, AREA_CONTEUDO_PDF_MM);
  assertEquals(d, { nivel: 0, agruparFinal: true, motivo: "duasFolhas" });
  assert(decisaoMudaDocumento(d));
  // Bloco final maior que uma folha: não há o que agrupar → documento de sempre.
  assertEquals(decidirCompactacao(med([500, 430, 400], 300), L, AREA_CONTEUDO_PDF_MM), { nivel: 0, agruparFinal: false, motivo: "finalMaiorQueFolha" });
  // Sem área informada, vale o próprio limite.
  assertEquals(decidirCompactacao(med([500, 430, 400], L + 1), L).agruparFinal, false);
});

Deno.test("medida inválida ou ausente = nível 0 sem agrupamento", () => {
  for (const m of [
    null,
    undefined,
    med([]),
    med([200, 180]),
    med([200, 180, 170, 160]),
    med([null, 180, 170]),
    med([200, undefined, 170]),
    med([200, 180, NaN]),
    med([Infinity, 180, 170]),
    med([0, 180, 170]),
    med([-5, 180, 170]),
    med([500, 430, 400], null),
    { alturasPorNivel: [500, 430, 400], alturaFinalMm: undefined },
    med([500, 430, 400], NaN),
    med([500, 430, 400], 0),
  ]) {
    assertEquals(decidirCompactacao(m, L), SEM_COMPACTACAO, JSON.stringify(m));
    assertEquals(decisaoMudaDocumento(decidirCompactacao(m, L)), false);
  }
  assertEquals(decidirCompactacao(med([200, 180, 170]), NaN), SEM_COMPACTACAO);
  assertEquals(decidirCompactacao(med([200, 180, 170]), L, 0), SEM_COMPACTACAO);
});

Deno.test("linhasDoBlocoFinal: último bloco, estendido até 3 linhas com texto, limitado ao que cabe", () => {
  const termo = ["TERMO", "", "1. A", "  • a1", "", "4. EXCLUSÕES", "  • x", "  • y", "  • z", "", "Para acionamento."];
  // Último bloco tem 1 linha → leva o bloco de antes junto (4. EXCLUSÕES): 6 linhas (com a em branco).
  assertEquals(linhasDoBlocoFinal(termo, 100), 6);
  // Bloco final já com 3 linhas basta.
  assertEquals(linhasDoBlocoFinal(["a", "", "b", "c", "d"], 100), 3);
  // Sem linha em branco: o termo inteiro.
  assertEquals(linhasDoBlocoFinal(["a", "b"], 100), 2);
  // Linhas em branco no fim não contam como bloco.
  assertEquals(linhasDoBlocoFinal(["a", "", "b", "c", "d", "", ""], 100), 5);
  // Termo curto inteiro com menos de 3 linhas: tudo.
  assertEquals(linhasDoBlocoFinal(["a", "", "b"], 100), 3);
  // Limite do que cabe na folha.
  assertEquals(linhasDoBlocoFinal(termo, 4), 4);
  assertEquals(linhasDoBlocoFinal(termo, 4.9), 4);
  // Nada cabe / termo vazio = nada a agrupar.
  assertEquals(linhasDoBlocoFinal(termo, 0), 0);
  assertEquals(linhasDoBlocoFinal(termo, NaN), 0);
  assertEquals(linhasDoBlocoFinal([], 10), 0);
});

Deno.test("HTML antigo: nível 0 sem agrupamento = CSS e corpo idênticos (mesmo objeto)", () => {
  const doc = { css: "body{}", body: '<div class="recibo-print-termo-box">T</div><div class="recibo-print-assinaturas">A</div>' };
  assertEquals(cssCompactacaoReciboDispositivoA4(decidirCompactacao(med([200, 180, 170]), LIMITE_UMA_FOLHA_HTML_MM)), "");
  assertEquals(cssCompactacaoReciboDispositivoA4(null), "");
  assert(aplicarCompactacaoReciboDispositivoA4(doc, { nivel: 0, agruparFinal: false, motivo: "cabe" }) === doc);
  assert(aplicarCompactacaoReciboDispositivoA4(doc, SEM_COMPACTACAO) === doc);
  assert(aplicarCompactacaoReciboDispositivoA4(doc, undefined) === doc);
});

Deno.test("HTML antigo: CSS por nível só mexe em espaçamento/fonte, termo continua 9px, nada escondido", () => {
  const n1 = cssCompactacaoReciboDispositivoA4({ nivel: 1, agruparFinal: false, motivo: "compactado" });
  const n2 = cssCompactacaoReciboDispositivoA4({ nivel: 2, agruparFinal: false, motivo: "compactado" });
  const g = cssCompactacaoReciboDispositivoA4({ nivel: 0, agruparFinal: true, motivo: "duasFolhas" });
  assert(n1 && n2.startsWith(n1) && n2.length > n1.length);
  assert(!n1.includes(CLASSE_FINAL_JUNTO) && !n2.includes(CLASSE_FINAL_JUNTO));
  assert(g.includes(`.${CLASSE_FINAL_JUNTO} { page-break-inside: avoid; break-inside: avoid; }`));
  assert(!g.includes("padding") && !g.includes("font-size"));
  for (const css of [n1, n2, g]) {
    assert(!/display\s*:\s*none|visibility|opacity|overflow\s*:\s*hidden|height\s*:\s*0/.test(css), css);
    // Todo seletor é recibo-print-* (o CSS do #print-root vai para a página viva).
    for (const sel of css.replace(/\/\*[^*]*\*\//g, "").match(/[^{}]+(?=\{)/g) ?? []) {
      for (const s of sel.split(",")) assert(s.trim().startsWith(".recibo-print-"), s);
    }
  }
  // Fonte do termo nunca muda no HTML (já é 9px ≈ 6,75 pt).
  for (const css of [n1, n2]) assert(!/recibo-print-termo-body[^}]*font-size/.test(css));
  // Assinaturas: espaço para assinar (altura da linha) intocado.
  for (const css of [n1, n2]) assert(!css.includes("assinatura-linha"));
});

Deno.test("HTML antigo: agrupamento envolve o ÚLTIMO termo + assinaturas num bloco", () => {
  const corpo = 'X<div class="recibo-print-termo-box" style="margin-bottom: 12px;">T1</div>\n<div class="recibo-print-termo-box" style="margin-bottom: 12px;">T2</div>\n<!-- ASSINATURAS -->\n<div class="recibo-print-assinaturas">A</div>';
  const agrupado = agruparTermoFinalEAssinaturas(corpo);
  assertEquals(agrupado, `X<div class="recibo-print-termo-box" style="margin-bottom: 12px;">T1</div>\n<div class="${CLASSE_FINAL_JUNTO}"><div class="recibo-print-termo-box" style="margin-bottom: 12px;">T2</div>\n<!-- ASSINATURAS -->\n<div class="recibo-print-assinaturas">A</div></div>`);
  // Tirando o envoltório, o corpo é o mesmo (nada some).
  assertEquals(agrupado.replace(`<div class="${CLASSE_FINAL_JUNTO}">`, "").replace(/<\/div>$/, ""), corpo);
  // Sem termo: corpo de sempre.
  assertEquals(agruparTermoFinalEAssinaturas("<div>sem termo</div>"), "<div>sem termo</div>");
  const r = aplicarCompactacaoReciboDispositivoA4({ css: "c", body: corpo }, { nivel: 0, agruparFinal: true, motivo: "duasFolhas" });
  assertEquals(r.body, agrupado);
  assert(r.css.startsWith("c") && r.css.includes(CLASSE_FINAL_JUNTO));
});
