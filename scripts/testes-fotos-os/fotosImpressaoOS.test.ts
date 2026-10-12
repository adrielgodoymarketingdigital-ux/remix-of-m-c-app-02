// deno test --no-check scripts/testes-fotos-os/
// Fotos da OS na impressão A4 e no PDF (src/lib/os/fotosImpressaoOS.ts).
import { assertEquals } from "jsr:@std/assert@1";
import {
  AVISO_DOCUMENTO, CAIXA_FOTO_MM, MAX_FOTOS_IMPRESSAO, MOTIVO_80MM, MOTIVO_DUAS_OS, MOTIVO_SEM_FOTOS,
  cssGradeFotos, decidirFotos, encaixarNaCaixa, escaparHtml, formatoImagemDataUrl, geometriaGradeFotosPDF,
  htmlGradeFotos, montarFotosParaImpressao, selecionarFotos, textoBotaoSemFotos, textoExcedentes, textoFalhas, urlMiniatura,
} from "../../src/lib/os/fotosImpressaoOS.ts";

const SUPA = "https://qztuzcchknptrvkdmdph.supabase.co/storage/v1/object/public/dispositivos-fotos/u1/os-1.jpg";
const sem = (s: string) => s.replace(/\s+/g, " ");

Deno.test("miniatura: URL pública do Supabase vira render/image 600×600 contain q70", () => {
  assertEquals(urlMiniatura(SUPA), "https://qztuzcchknptrvkdmdph.supabase.co/storage/v1/render/image/public/dispositivos-fotos/u1/os-1.jpg?width=600&height=600&resize=contain&quality=70");
  // Parâmetros antigos na URL são trocados pelos da miniatura.
  assertEquals(urlMiniatura(SUPA + "?t=123").endsWith("os-1.jpg?width=600&height=600&resize=contain&quality=70"), true);
});

Deno.test("miniatura: URL de fora do Supabase (ou já render/assinada) fica como está", () => {
  for (const u of ["https://exemplo.com/foto.jpg", "https://qztuzcchknptrvkdmdph.supabase.co/storage/v1/object/sign/x/y.jpg?token=a", "data:image/jpeg;base64,AAA"]) {
    assertEquals(urlMiniatura(u), u);
  }
});

Deno.test("seleção: ordem de envio, no máximo 6, +N das que sobram; ignora lixo", () => {
  const dez = Array.from({ length: 10 }, (_, i) => `https://x.supabase.co/storage/v1/object/public/b/${i}.jpg`);
  const r = selecionarFotos(dez);
  assertEquals([r.urls.length, r.excedentes, r.urls[0].endsWith("/0.jpg"), r.urls[5].endsWith("/5.jpg")], [MAX_FOTOS_IMPRESSAO, 4, true, true]);
  assertEquals(selecionarFotos([null, "", "  ", 3, "ftp://x", "https://a/b.jpg"]), { urls: ["https://a/b.jpg"], excedentes: 0 });
  assertEquals(selecionarFotos(undefined), { urls: [], excedentes: 0 });
  assertEquals(textoExcedentes(4), "+4 fotos não impressas");
  assertEquals(textoExcedentes(1), "+1 foto não impressa");
});

const base = { padraoLoja: false, escolhaLembrada: null, totalFotos: 3, formato: "a4" as const, duasOsPorFolha: false };
Deno.test("decisão: padrão da loja desligado (ou ausente) não inclui; ligado inclui", () => {
  assertEquals(decidirFotos(base), { habilitada: true, motivo: null, marcada: false, incluir: false });
  assertEquals(decidirFotos({ ...base, padraoLoja: undefined }).incluir, false);
  assertEquals(decidirFotos({ ...base, padraoLoja: true }).incluir, true);
});
Deno.test("decisão: a escolha lembrada no aparelho vence o padrão da loja", () => {
  assertEquals(decidirFotos({ ...base, padraoLoja: true, escolhaLembrada: false }).incluir, false);
  assertEquals(decidirFotos({ ...base, padraoLoja: false, escolhaLembrada: true }).incluir, true);
});
Deno.test("decisão: OS sem fotos, duas OS por folha e 80 mm desabilitam a caixa com o motivo", () => {
  assertEquals(decidirFotos({ ...base, escolhaLembrada: true, totalFotos: 0 }), { habilitada: false, motivo: MOTIVO_SEM_FOTOS, marcada: true, incluir: false });
  assertEquals(decidirFotos({ ...base, escolhaLembrada: true, duasOsPorFolha: true }).motivo, MOTIVO_DUAS_OS);
  assertEquals(decidirFotos({ ...base, escolhaLembrada: true, formato: "80mm" }).motivo, MOTIVO_80MM);
  assertEquals(decidirFotos({ ...base, escolhaLembrada: true, formato: "80mm" }).incluir, false);
  assertEquals([MOTIVO_SEM_FOTOS, MOTIVO_DUAS_OS, MOTIVO_80MM, AVISO_DOCUMENTO], ["Esta OS não tem fotos", "Fotos não cabem com duas OS por folha", "Fotos não saem no cupom 80 mm", "Confira se não há foto de documento do cliente."]);
});

Deno.test("montar: html-direto usa a original se a miniatura falhou; base64 e pdf pulam e contam a falha", () => {
  const c = [
    { original: "https://a/1.jpg", dataUrl: "data:image/jpeg;base64,AAA", originalAbre: false },
    { original: "https://a/2.jpg", dataUrl: null, originalAbre: true },
    { original: "https://a/3.jpg", dataUrl: null, originalAbre: false },
  ];
  assertEquals(montarFotosParaImpressao(c, "html-direto"), { fotos: [{ src: "data:image/jpeg;base64,AAA", legenda: "Foto 1" }, { src: "https://a/2.jpg", legenda: "Foto 2" }], falhas: 1 });
  for (const modo of ["base64", "pdf"] as const) {
    assertEquals(montarFotosParaImpressao(c, modo), { fotos: [{ src: "data:image/jpeg;base64,AAA", legenda: "Foto 1" }], falhas: 2 });
  }
  assertEquals(textoFalhas(2), "2 fotos não carregaram — imprimir sem elas?");
  assertEquals(textoFalhas(1), "1 foto não carregou — imprimir sem ela?");
  assertEquals([textoBotaoSemFotos(1), textoBotaoSemFotos(2)], ["Imprimir sem ela", "Imprimir sem elas"]);
});

Deno.test("CSS da grade: 3 por linha de 58 mm, contain, linha e foto nunca partidas, título preso à 1ª linha", () => {
  const css = sem(cssGradeFotos());
  for (const r of [
    "grid-template-columns: repeat(3, 58mm);",
    "width: 58mm; height: 58mm;",
    "object-fit: contain;",
    ".os-fotos-inicio, .os-fotos-linha { break-inside: avoid; page-break-inside: avoid; }",
    "break-after: avoid; page-break-after: avoid;",
    // Com fotos, a trava de 1 página do A4 (index.css) sai só na impressão; termo e assinaturas não se partem.
    ".impressao-ordem-container:has(.os-fotos-impressao) { max-height: none !important; overflow: visible !important; }",
    ".impressao-ordem-container:has(.os-fotos-impressao) .impressao-footer { break-inside: avoid; page-break-inside: avoid; }",
  ]) assertEquals(css.includes(r), true, r);
});

Deno.test("HTML da grade: título + 1ª linha juntos, linhas de 3, +N, e sem fotos não gera nada", () => {
  const fotos = Array.from({ length: 5 }, (_, i) => ({ src: `data:image/jpeg;base64,${i}`, legenda: `Foto ${i + 1}` }));
  const h = htmlGradeFotos(fotos, 4);
  assertEquals((h.match(/class="os-fotos-linha"/g) ?? []).length, 2);
  assertEquals(h.includes('<div class="os-fotos-inicio"><div class="os-fotos-titulo">Fotos do aparelho</div><div class="os-fotos-linha">'), true);
  assertEquals((h.match(/<figure class="os-foto">/g) ?? []).length, 5);
  assertEquals(h.includes(">+4 fotos não impressas<"), true);
  assertEquals(htmlGradeFotos([], 3), "");
});

Deno.test("HTML da grade: escapa texto e src", () => {
  assertEquals(escaparHtml(`<b>"x"&'y'</b>`), "&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
  const h = htmlGradeFotos([{ src: `x" onerror="alert(1)`, legenda: "<script>" }], 0);
  assertEquals([h.includes("<script>"), h.includes('src="x&quot; onerror=&quot;alert(1)"')], [false, true]);
});

const pdf = { margemEsquerda: 15, larguraUtil: 180, yTopo: 20, yLimite: 280, excedentes: 0 };
Deno.test("PDF: 3 por linha, colunas em 15 / 76 / 137 mm, linhas de 66 mm", () => {
  const g = geometriaGradeFotosPDF({ ...pdf, quantidade: 6, yInicial: 40 });
  assertEquals(g.titulo, { pagina: 0, y: 40 });
  assertEquals(g.fotos.map((f) => [f.pagina, f.x, f.y]), [[0, 15, 47], [0, 76, 47], [0, 137, 47], [0, 15, 113], [0, 76, 113], [0, 137, 113]]);
  assertEquals(g.fotos.every((f) => f.w === CAIXA_FOTO_MM && f.h === CAIXA_FOTO_MM), true);
});

Deno.test("PDF: título vai junto com a 1ª linha para a página seguinte quando ela não cabe", () => {
  const g = geometriaGradeFotosPDF({ ...pdf, quantidade: 2, yInicial: 230 }); // 230+7+63 > 280
  assertEquals([g.titulo, g.fotos[0].pagina, g.fotos[0].y], [{ pagina: 1, y: 20 }, 1, 27]);
});

Deno.test("PDF: 2ª linha que não cabe passa inteira para a página seguinte (foto nunca partida)", () => {
  const g = geometriaGradeFotosPDF({ ...pdf, quantidade: 6, yInicial: 150, excedentes: 4 });
  assertEquals(g.fotos.map((f) => [f.pagina, f.y]), [[0, 157], [0, 157], [0, 157], [1, 20], [1, 20], [1, 20]]);
  for (const f of g.fotos) assertEquals(f.y + f.h <= pdf.yLimite, true);
  assertEquals(g.aviso, { pagina: 1, y: 20 + 63 + 3 + 5 - 1.5 });
  assertEquals(g.paginaFinal, 1);
});

Deno.test("PDF: foto inteira dentro da caixa (contain) e formato pelo data URL", () => {
  assertEquals(encaixarNaCaixa(600, 450), { w: 58, h: 43.5, dx: 0, dy: 7.25 });
  assertEquals(encaixarNaCaixa(450, 600), { w: 43.5, h: 58, dx: 7.25, dy: 0 });
  assertEquals(encaixarNaCaixa(0, 0), { w: 58, h: 58, dx: 0, dy: 0 });
  assertEquals([formatoImagemDataUrl("data:image/jpeg;base64,x"), formatoImagemDataUrl("data:image/png;base64,x")], ["JPEG", "PNG"]);
});
