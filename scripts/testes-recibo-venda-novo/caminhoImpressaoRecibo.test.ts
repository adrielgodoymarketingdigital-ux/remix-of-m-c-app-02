// deno test --no-check scripts/testes-recibo-venda-novo/
// Por onde sai a impressão dos recibos de venda: só o iOS com app instalado muda.
import { assertEquals } from "jsr:@std/assert@1";
import {
  decidirCaminhoImpressaoRecibo,
  fatiasDePagina,
  medidasDoFormato,
  nomeArquivoPDF,
  prepararDocumentoParaCamada,
  SCRIPT_CAMADA_IOS,
} from "../../src/lib/impressao/caminhoImpressaoRecibo.ts";

const COMPUTADOR = { isIOS: false, isMobile: false, isStandalone: false };
const COMPUTADOR_INSTALADO = { isIOS: false, isMobile: false, isStandalone: true };
const ANDROID = { isIOS: false, isMobile: true, isStandalone: false };
const ANDROID_INSTALADO = { isIOS: false, isMobile: true, isStandalone: true };
const IOS_SAFARI = { isIOS: true, isMobile: true, isStandalone: false };
const IOS_INSTALADO = { isIOS: true, isMobile: true, isStandalone: true };

Deno.test("PDV e Vendas: janela em tudo, menos iOS instalado (camada)", () => {
  for (const lugar of ["pdv", "vendas"] as const) {
    assertEquals(decidirCaminhoImpressaoRecibo(COMPUTADOR, lugar), "janela");
    assertEquals(decidirCaminhoImpressaoRecibo(COMPUTADOR_INSTALADO, lugar), "janela");
    assertEquals(decidirCaminhoImpressaoRecibo(ANDROID, lugar), "janela");
    assertEquals(decidirCaminhoImpressaoRecibo(ANDROID_INSTALADO, lugar), "janela");
    assertEquals(decidirCaminhoImpressaoRecibo(IOS_SAFARI, lugar), "janela");
    assertEquals(decidirCaminhoImpressaoRecibo(IOS_INSTALADO, lugar), "camada-ios");
  }
});

Deno.test("Dispositivos: os mesmos caminhos de antes", () => {
  assertEquals(decidirCaminhoImpressaoRecibo(COMPUTADOR, "dispositivos"), "janela");
  assertEquals(decidirCaminhoImpressaoRecibo(COMPUTADOR_INSTALADO, "dispositivos"), "iframe");
  assertEquals(decidirCaminhoImpressaoRecibo(ANDROID, "dispositivos"), "iframe");
  assertEquals(decidirCaminhoImpressaoRecibo(ANDROID_INSTALADO, "dispositivos"), "iframe");
  assertEquals(decidirCaminhoImpressaoRecibo(IOS_SAFARI, "dispositivos"), "print-root");
  assertEquals(decidirCaminhoImpressaoRecibo(IOS_INSTALADO, "dispositivos"), "pdf-ios");
});

Deno.test("Dispositivos: igual à regra antiga em todas as combinações", () => {
  for (const isIOS of [false, true]) for (const isAndroid of [false, true]) for (const isStandalone of [false, true]) {
    if (isIOS && isAndroid) continue;
    const isMobile = isIOS || isAndroid;
    // Regra antiga de DialogReimprimirReciboVenda.imprimirRecibo:
    const mecanismoMobile = isMobile || isStandalone;
    const antiga = isIOS && isStandalone ? "pdf-ios" : mecanismoMobile ? (isIOS ? "print-root" : "iframe") : "janela";
    assertEquals(decidirCaminhoImpressaoRecibo({ isIOS, isMobile, isStandalone }, "dispositivos"), antiga);
  }
});

Deno.test("documento da camada: script logo depois do <head>, resto idêntico", () => {
  const doc = '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n</head><body>x<script>window.print()</script></body></html>';
  const pronto = prepararDocumentoParaCamada(doc);
  assertEquals(pronto, doc.replace("<head>", `<head>${SCRIPT_CAMADA_IOS}`));
  assertEquals(pronto.replace(SCRIPT_CAMADA_IOS, ""), doc);
  assertEquals(prepararDocumentoParaCamada("<div>sem head</div>"), `${SCRIPT_CAMADA_IOS}<div>sem head</div>`);
});

Deno.test("script da camada: print automático vira no-op e o original fica guardado", () => {
  let impresso = 0;
  let fechado = 0;
  const win = { print: () => { impresso++; }, close: () => { fechado++; } } as Record<string, unknown>;
  const corpo = SCRIPT_CAMADA_IOS.replace(/^<script>|<\/script>$/g, "");
  new Function("window", corpo)(win);
  (win.print as () => void)();
  (win.close as () => void)();
  assertEquals([impresso, fechado, win.__printed], [0, 0, true]);
  (win.__imprimirOriginal as () => void)();
  assertEquals(impresso, 1);
});

Deno.test("medidas, nome do arquivo e páginas do PDF", () => {
  assertEquals(medidasDoFormato("a4"), { larguraMm: 210, larguraPx: 794 });
  assertEquals(medidasDoFormato("80mm").larguraMm, 80);
  assertEquals(medidasDoFormato("58mm").larguraMm, 58);
  assertEquals(nomeArquivoPDF("Recibo de Venda - VD-000555", "a4"), "Recibo-de-Venda-VD-000555-a4.pdf");
  assertEquals(nomeArquivoPDF("Película 3D / ação", "80mm"), "Pelicula-3D-acao-80mm.pdf");
  assertEquals(nomeArquivoPDF("???", "58mm"), "Recibo-58mm.pdf");
  assertEquals(fatiasDePagina(100, 297), [0]);
  assertEquals(fatiasDePagina(297, 297), [0]);
  assertEquals(fatiasDePagina(300, 297), [0, 297]);
  assertEquals(fatiasDePagina(0, 297), [0]);
});
