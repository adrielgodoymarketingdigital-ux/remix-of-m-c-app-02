// deno test --no-check scripts/testes-etiquetas/
// PDF das etiquetas no iPhone com app instalado: tamanho, seletor e resolução.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DPI_ALVO_PDF_ETIQUETAS,
  escalaRenderizacaoPagina,
  MAX_PIXELS_CANVAS,
  nomeArquivoEtiquetas,
  paginasPDFEtiquetas,
  tempoMaximoPdfEtiquetasMs,
} from "../../src/lib/etiquetas/pdfEtiquetas.ts";
import { usarCamadaIOS } from "../../src/lib/etiquetas/avisoImpressao.ts";

const PX_POR_MM = 96 / 25.4;
const pixels = (larguraMm: number, alturaMm: number, escala: number) =>
  Math.round(larguraMm * PX_POR_MM * escala) * Math.round(alturaMm * PX_POR_MM * escala);

Deno.test("camada só no iOS com app instalado", () => {
  assertEquals(usarCamadaIOS({ isIOS: true, isStandalone: true }), true);
  assertEquals(usarCamadaIOS({ isIOS: true, isStandalone: false }), false); // Safari: #print-root
  assertEquals(usarCamadaIOS({ isIOS: false, isStandalone: true }), false); // Android/computador instalado
  assertEquals(usarCamadaIOS({ isIOS: false, isStandalone: false }), false);
});

Deno.test("térmica: uma página por etiqueta, no tamanho dela", () => {
  const p = paginasPDFEtiquetas({ formato: "termica", termica: { larguraMm: 40, alturaMm: 25 }, folha: { larguraMm: 210, alturaMm: 297 }, titulo: "Etiquetas", totalPaginas: 5 });
  assertEquals([p.larguraMm, p.alturaMm, p.seletor], [40, 25, ".etq-pagina-termica"]);
  assertEquals(p.nomeArquivo, "Etiquetas-40x25mm.pdf");
  assertEquals(p.escala, DPI_ALVO_PDF_ETIQUETAS / 96);
  assertEquals(p.tempoMaximoMs, 60000);
});

Deno.test("folha/grade: uma página por folha, no tamanho da folha", () => {
  const p = paginasPDFEtiquetas({ formato: "a4", termica: { larguraMm: 40, alturaMm: 25 }, folha: { larguraMm: 210, alturaMm: 297 }, titulo: "Etiqueta de teste", totalPaginas: 1 });
  assertEquals([p.larguraMm, p.alturaMm, p.seletor], [210, 297, ".etq-folha"]);
  assertEquals(p.nomeArquivo, "Etiqueta-de-teste-210x297mm.pdf");
});

Deno.test("tempo máximo cresce com as páginas, entre 1 e 5 minutos", () => {
  assertEquals(tempoMaximoPdfEtiquetasMs(0), 60000);
  assertEquals(tempoMaximoPdfEtiquetasMs(1), 60000);
  assertEquals(tempoMaximoPdfEtiquetasMs(120), 78000);
  assertEquals(tempoMaximoPdfEtiquetasMs(400), 190000);
  assertEquals(tempoMaximoPdfEtiquetasMs(1000), 300000); // limite do diálogo: 1000 etiquetas
});

Deno.test("resolução: 400 dpi na etiqueta; folha A4 limitada ao canvas do iPhone", () => {
  const etiqueta = escalaRenderizacaoPagina(40, 25);
  assertEquals(Math.round(etiqueta * 96), 400);
  const a4 = escalaRenderizacaoPagina(210, 297);
  assert(a4 < etiqueta);
  assert(pixels(210, 297, a4) <= MAX_PIXELS_CANVAS * 1.01, `A4 com ${pixels(210, 297, a4)} px`);
  assert(a4 * 96 >= 300, `A4 a ${Math.round(a4 * 96)} dpi`);
  // Rolo contínuo de 107mm e 1 fileira: cabe nos 400 dpi.
  assertEquals(Math.round(escalaRenderizacaoPagina(107, 23) * 96), 400);
  assertEquals(escalaRenderizacaoPagina(0, 25), 1);
});

Deno.test("nome do arquivo sem acento e com vírgula decimal", () => {
  assertEquals(nomeArquivoEtiquetas("Etiquetas", 63.5, 38.1), "Etiquetas-63,5x38,1mm.pdf");
  assertEquals(nomeArquivoEtiquetas("Ação ç", 40, 25), "Acao-c-40x25mm.pdf");
});
