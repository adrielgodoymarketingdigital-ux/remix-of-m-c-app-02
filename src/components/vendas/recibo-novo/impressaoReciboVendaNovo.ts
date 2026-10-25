/**
 * Documento de impressão do recibo novo (A4): o HTML do ReciboVendaNovo já
 * renderizado + cssReciboVendaNovo({ paraImpressao: true }) + o script de
 * impressão dos recibos de venda (o mesmo do PDV: espera as imagens e chama
 * window.print), com dois acréscimos:
 *  - imagem que falha (ou não carrega em 8s) some antes de imprimir — o logo
 *    quebrado dá lugar ao nome da loja ([data-rvn-reserva]); foto some sozinha;
 *  - só imprime depois que TODAS as imagens carregaram ou falharam.
 */
import { cssReciboVendaNovo } from "./cssReciboVendaNovo";

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const SCRIPT_IMPRESSAO_RECIBO_NOVO = `
(function() {
  var printed = false;
  function esconder(img) {
    var alvo = img.closest('[data-rvn-ocultar-se-falhar]') || img;
    alvo.style.display = 'none';
    var reserva = alvo.parentNode && alvo.parentNode.querySelector('[data-rvn-reserva]');
    if (reserva) reserva.style.display = '';
  }
  function doPrint() {
    if (printed) return;
    printed = true;
    window.__printed = true;
    window.focus();
    window.print();
    window.onafterprint = function() { window.close(); };
  }
  var images = Array.prototype.slice.call(document.querySelectorAll('img'));
  var pendentes = images.map(function(img) {
    if (img.complete) {
      if (!img.naturalWidth) esconder(img);
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      img.onload = resolve;
      img.onerror = function() { esconder(img); resolve(); };
    });
  });
  Promise.all(pendentes).then(function() { setTimeout(doPrint, 300); });
  // Imagem que não respondeu em 8s conta como falha: some e imprime.
  setTimeout(function() {
    images.forEach(function(img) { if (!img.complete || !img.naturalWidth) esconder(img); });
    doPrint();
  }, 8000);
})();
`;

export function documentoImpressaoReciboNovo(htmlRecibo: string, titulo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <link rel="icon" type="image/png" href="/pwa-192x192.png">
  <title>${escapar(titulo)}</title>
  <style>${cssReciboVendaNovo({ paraImpressao: true })}</style>
</head>
<body>
${htmlRecibo}
  <script>${SCRIPT_IMPRESSAO_RECIBO_NOVO}</script>
</body>
</html>`;
}

/**
 * CSS para imprimir pelo #print-root (iOS fora do app instalado): o HTML vai
 * para a página viva, então nada de regra global além do @page.
 */
export function cssPrintRootReciboNovo(): string {
  return `@page { size: A4 portrait; margin: 10mm; }\n${cssReciboVendaNovo()}`;
}
