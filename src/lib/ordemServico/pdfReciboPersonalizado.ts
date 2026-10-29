/**
 * PDF do recibo A4 PERSONALIZADO da OS no iPhone com o app instalado (lá não há
 * window.print). Mesmo caminho do recibo de venda (lib/impressao/camadaImpressaoIOS):
 * html2canvas + jsPDF, carregados só aqui (import sob demanda).
 *
 * Captura POR PÁGINA (um canvas de cada vez, liberado logo depois), quebrando só
 * no começo dos blocos do recibo (paginasReciboPersonalizado.quebrasDePagina),
 * com teto de megapixels e JPEG de qualidade controlada. Espera fontes e imagens;
 * imagem que não carregar some do PDF em vez de derrubá-lo. Qualquer erro aqui
 * é tratado por quem chama: vale o PDF padrão (gerarOrdemServicoPDF).
 */
import {
  ALTURA_UTIL_MM,
  LARGURA_UTIL_MM,
  PAGINA_A4_MM,
  QUALIDADE_JPEG_RECIBO,
  TEMPO_MAXIMO_IMAGEM_MS,
  escalaDaCaptura,
  quebrasDePagina,
} from "./paginasReciboPersonalizado";

/**
 * O html2canvas mede a linha de base do texto com uma imagem 1×1 (esta) no
 * documento principal; a regra geral do Tailwind (img { display: block }) a
 * tira da linha e o texto sai desenhado mais baixo que os ícones. Durante a
 * captura, e só nela, essa imagem volta a ficar na linha. Nada mais é afetado.
 */
const IMAGEM_MEDIDA_HTML2CANVAS = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const CSS_MEDIDA_TEXTO = `img[src="${IMAGEM_MEDIDA_HTML2CANVAS}"] { display: inline !important; }`;

export interface ResultadoPDFPersonalizado {
  arquivo: Blob;
  paginas: number;
  ms: number;
}

function esperarImagem(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  if (img.complete) {
    img.style.display = "none"; // já falhou
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const fim = (ok: boolean) => {
      clearTimeout(id);
      if (!ok) img.style.display = "none";
      resolve();
    };
    const id = setTimeout(() => fim(img.complete && img.naturalWidth > 0), TEMPO_MAXIMO_IMAGEM_MS);
    img.addEventListener("load", () => fim(true), { once: true });
    img.addEventListener("error", () => fim(false), { once: true });
  });
}

/** Logo do storage como data URL (para o canvas não ficar "tainted"). null se não der. */
export async function imagemComoDataUrl(url: string | null | undefined, ms = TEMPO_MAXIMO_IMAGEM_MS): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  const controle = new AbortController();
  const id = setTimeout(() => controle.abort(), ms);
  try {
    const resposta = await fetch(url, { mode: "cors", signal: controle.signal });
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(typeof leitor.result === "string" ? leitor.result : null);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Gera o PDF a partir do recibo personalizado JÁ RENDERIZADO em modo captura
 * (.osr-captura, numa área escondida). Lança erro se algo falhar.
 */
export async function gerarPDFReciboPersonalizado(recibo: HTMLElement): Promise<ResultadoPDFPersonalizado> {
  const inicio = performance.now();
  if (!recibo.classList.contains("osr-captura")) throw new Error("recibo fora do modo captura");

  await Promise.all(Array.from(recibo.querySelectorAll("img")).map(esperarImagem));
  if (document.fonts?.ready) await document.fonts.ready;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const caixa = recibo.getBoundingClientRect();
  if (caixa.width <= 0 || caixa.height <= 0) throw new Error("recibo sem tamanho");
  const pxPorMm = caixa.width / LARGURA_UTIL_MM;
  const alturaMm = caixa.height / pxPorMm;
  const cortes = Array.from(recibo.children)
    .filter((filho) => filho.tagName !== "STYLE")
    .map((filho) => (filho.getBoundingClientRect().top - caixa.top) / pxPorMm);
  const paginas = quebrasDePagina(alturaMm, cortes, ALTURA_UTIL_MM);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  // Recorte na posição da cópia NA TELA, sem somar a rolagem: o html2canvas mede
  // a cópia com rolagem zero (scrollX/scrollY: 0 abaixo) e ela é fixa no topo.
  // Somar window.scrollY jogava o recorte para fora do recibo quando a lista de
  // OS estava rolada — o PDF saía em branco.
  const x = caixa.left;
  const y0 = caixa.top;

  const ajusteTexto = document.createElement("style");
  ajusteTexto.textContent = CSS_MEDIDA_TEXTO;
  document.head.appendChild(ajusteTexto);
  try {
    for (let i = 0; i < paginas.length; i++) {
      const [a, z] = paginas[i];
      const alturaPx = Math.max(1, Math.round((z - a) * pxPorMm));
      const canvas = await html2canvas(recibo, {
        scale: escalaDaCaptura(caixa.width, alturaPx),
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: TEMPO_MAXIMO_IMAGEM_MS,
        x,
        y: y0 + Math.round(a * pxPorMm),
        width: Math.ceil(caixa.width),
        height: alturaPx,
        windowWidth: Math.max(document.documentElement.clientWidth, Math.ceil(caixa.width)),
        windowHeight: Math.max(document.documentElement.clientHeight, Math.ceil(caixa.height)),
        scrollX: 0,
        scrollY: 0,
      });
      try {
        const jpeg = canvas.toDataURL("image/jpeg", QUALIDADE_JPEG_RECIBO);
        if (i > 0) pdf.addPage();
        pdf.addImage(jpeg, "JPEG", PAGINA_A4_MM.margem, PAGINA_A4_MM.margem, LARGURA_UTIL_MM, z - a, undefined, "FAST");
      } finally {
        // Libera a memória do canvas já (o Safari do iPhone segura muito).
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } finally {
    ajusteTexto.remove();
  }

  return { arquivo: pdf.output("blob"), paginas: paginas.length, ms: Math.round(performance.now() - inicio) };
}
