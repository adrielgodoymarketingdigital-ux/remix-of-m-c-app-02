/**
 * Camada de impressão do iOS com app instalado (PWA na tela inicial). Lá
 * window.print() é ignorado e a janela de window.open() fica em tela cheia
 * sem como sair; então o recibo abre aqui, numa camada do próprio app:
 *
 *  - barra fixa no topo (respeita a área segura; some no @media print) com
 *    Fechar (sempre, 44px), Compartilhar PDF e Imprimir;
 *  - o recibo num iframe (documento isolado, o mesmo que iria para a janela;
 *    o print automático dele vira no-op — prepararDocumentoParaCamada);
 *  - o PDF é gerado ao abrir (html2canvas + jsPDF), para o toque em
 *    Compartilhar ainda valer como gesto do usuário; até lá "Preparando...";
 *  - Imprimir tenta o print do iframe; se nada abrir em 1,5s, mostra a dica
 *    "use Compartilhar > Imprimir";
 *  - Fechar e o voltar do iOS (history) fecham a camada.
 *
 * Qualquer falha (iframe, PDF, compartilhar) deixa a camada com o Fechar.
 * Fica por cima do diálogo do Radix: pointer-events próprio e os eventos não
 * sobem até o document (senão o Radix fecharia o diálogo e travaria a rolagem).
 */
import { comTempoMaximo } from "@/lib/tempoMaximo";
import { fatiasDePagina, type FormatoPapelRecibo, medidasDoFormato, nomeArquivoPDF, prepararDocumentoParaCamada } from "./caminhoImpressaoRecibo";

export const ID_CAMADA_IMPRESSAO_IOS = "camada-impressao-ios";
const CHAVE_HISTORICO = "__camadaImpressaoIOS";
const TEMPO_MAXIMO_PDF_MS = 20000;
const ESPERA_IMPRIMIR_MS = 1500;

const CSS = `
#${ID_CAMADA_IMPRESSAO_IOS} { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; background: #e2e8f0; pointer-events: auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
#${ID_CAMADA_IMPRESSAO_IOS} .cii-barra { flex: none; display: flex; align-items: center; gap: 8px; padding: calc(env(safe-area-inset-top, 0px) + 6px) calc(env(safe-area-inset-right, 0px) + 8px) 6px calc(env(safe-area-inset-left, 0px) + 8px); background: #101318; color: #fff; }
#${ID_CAMADA_IMPRESSAO_IOS} .cii-titulo { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${ID_CAMADA_IMPRESSAO_IOS} button { min-height: 44px; min-width: 44px; padding: 0 12px; border: 0; border-radius: 10px; font-size: 15px; font-weight: 600; color: #fff; background: #334155; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#${ID_CAMADA_IMPRESSAO_IOS} button.cii-principal { background: #2563eb; }
#${ID_CAMADA_IMPRESSAO_IOS} button:disabled { opacity: 0.55; cursor: default; }
#${ID_CAMADA_IMPRESSAO_IOS} .cii-dica { flex: none; padding: 8px 12px; background: #fef3c7; color: #78350f; font-size: 14px; text-align: center; }
#${ID_CAMADA_IMPRESSAO_IOS} .cii-dica[hidden] { display: none; }
#${ID_CAMADA_IMPRESSAO_IOS} .cii-area { flex: 1; min-height: 0; overflow: auto; -webkit-overflow-scrolling: touch; padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 12px); }
#${ID_CAMADA_IMPRESSAO_IOS} .cii-folha { position: relative; margin: 0 auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); overflow: hidden; }
#${ID_CAMADA_IMPRESSAO_IOS} iframe { position: absolute; top: 0; left: 0; border: 0; background: #fff; transform-origin: 0 0; pointer-events: none; }
@media print { #${ID_CAMADA_IMPRESSAO_IOS} .cii-barra, #${ID_CAMADA_IMPRESSAO_IOS} .cii-dica { display: none !important; } }
`;

type JanelaDoRecibo = Window & { __imprimirOriginal?: () => void };

function botao(texto: string, rotulo: string, principal = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texto;
  b.setAttribute("aria-label", rotulo);
  if (principal) b.className = "cii-principal";
  return b;
}

async function gerarPDF(iframe: HTMLIFrameElement, formato: FormatoPapelRecibo, nome: string): Promise<File> {
  const doc = iframe.contentDocument;
  if (!doc?.body) throw new Error("documento do recibo indisponível");
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const canvas = await html2canvas(doc.body, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
  const { larguraMm } = medidasDoFormato(formato);
  const alturaMm = (canvas.height * larguraMm) / canvas.width;
  const imagem = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = formato === "a4"
    ? new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    : new jsPDF({ orientation: "portrait", unit: "mm", format: [larguraMm, Math.max(alturaMm, 20)] });
  const paginaMm = formato === "a4" ? 297 : Math.max(alturaMm, 20);
  fatiasDePagina(alturaMm, paginaMm).forEach((y, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(imagem, "JPEG", 0, -y, larguraMm, alturaMm);
  });
  return new File([pdf.output("blob")], nome, { type: "application/pdf" });
}

/**
 * PDF com uma página por elemento (ex.: cada etiqueta), no tamanho exato pedido.
 * Usado só pelas etiquetas; os recibos seguem no gerarPDF acima.
 */
export interface PaginasPDFCamada {
  larguraMm: number;
  alturaMm: number;
  /** Cada elemento que casa com o seletor vira uma página. */
  seletor: string;
  /** Escala do html2canvas (1 = 96 dpi). */
  escala: number;
  nomeArquivo: string;
  tempoMaximoMs: number;
}

/** Passos da camada, para quem quiser registrar (os recibos não usam). */
export type EventoCamadaImpressao = "pdf_pronto" | "pdf_falhou" | "compartilhado" | "compartilhar_falhou" | "imprimir_nao_abriu";

async function gerarPDFPorPaginas(
  iframe: HTMLIFrameElement,
  paginas: PaginasPDFCamada,
  parar: () => boolean,
  aoProgresso: (feitas: number, total: number) => void,
): Promise<File> {
  const doc = iframe.contentDocument;
  const elementos = Array.from(doc?.querySelectorAll<HTMLElement>(paginas.seletor) ?? []);
  if (!doc || !elementos.length) throw new Error("nenhuma página para o PDF");
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const { larguraMm, alturaMm } = paginas;
  const orientacao = larguraMm > alturaMm ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation: orientacao, unit: "mm", format: [larguraMm, alturaMm] });

  // Cada página é desenhada num documento só com ela: o html2canvas clona o
  // documento inteiro a cada chamada, e com centenas de etiquetas o PDF não
  // ficava pronto no tempo máximo (e a tela travava).
  const estilos = Array.from(doc.querySelectorAll("style")).map((e) => e.outerHTML).join("");
  const auxiliar = document.createElement("iframe");
  auxiliar.setAttribute("aria-hidden", "true");
  auxiliar.tabIndex = -1;
  auxiliar.style.cssText = `position:fixed;left:-10000px;top:0;border:0;width:${Math.ceil((larguraMm * 96) / 25.4) + 2}px;height:${Math.ceil((alturaMm * 96) / 25.4) + 2}px;`;
  document.body.appendChild(auxiliar);
  // O html2canvas mede a linha de base das fontes no documento PRINCIPAL
  // (FontMetrics usa o `document` global) com uma <img> ao lado do texto; o
  // reset do Tailwind (img { display: block }) tira essa <img> da linha e o
  // texto saía deslocado para baixo no PDF. Só durante a geração, a <img> da
  // medição (div oculto com white-space: nowrap criado por ele) volta a ficar em linha.
  const correcaoMedicao = document.createElement("style");
  correcaoMedicao.textContent =
    'body > div[style*="visibility: hidden"][style*="white-space: nowrap"] > img { display: inline !important; }';
  document.head.appendChild(correcaoMedicao);
  try {
    await new Promise<void>((resolve) => {
      auxiliar.addEventListener("load", () => resolve(), { once: true });
      auxiliar.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8">${estilos}</head><body style="margin:0;background:#fff"></body></html>`;
    });
    const corpo = auxiliar.contentDocument?.body;
    if (!corpo) throw new Error("documento auxiliar indisponível");

    // Páginas iguais (mesma etiqueta repetida) são desenhadas uma vez só e reaproveitadas no PDF.
    const imagens = new Map<string, { dados: string; apelido: string }>();
    for (const [i, elemento] of elementos.entries()) {
      if (parar()) throw new Error("geração do PDF interrompida");
      const chave = elemento.innerHTML;
      let imagem = imagens.get(chave);
      if (!imagem) {
        corpo.innerHTML = elemento.outerHTML;
        const alvo = corpo.firstElementChild as HTMLElement;
        const canvas = await html2canvas(alvo, { scale: paginas.escala, useCORS: true, backgroundColor: "#ffffff", logging: false });
        // PNG: barras de código nítidas (JPEG borra as bordas).
        imagem = { dados: canvas.toDataURL("image/png"), apelido: `pagina-${imagens.size}` };
        imagens.set(chave, imagem);
        // Devolve a vez à tela (Fechar continua respondendo).
        await new Promise((r) => setTimeout(r, 0));
      }
      if (i > 0) pdf.addPage([larguraMm, alturaMm], orientacao);
      pdf.addImage(imagem.dados, "PNG", 0, 0, larguraMm, alturaMm, imagem.apelido, "FAST");
      aoProgresso(i + 1, elementos.length);
    }
  } finally {
    auxiliar.remove();
    correcaoMedicao.remove();
  }
  return new File([pdf.output("blob")], paginas.nomeArquivo, { type: "application/pdf" });
}

type OpcoesCamadaImpressao =
  | { titulo: string; formato: FormatoPapelRecibo; paginas?: undefined; aoEvento?: undefined }
  | { titulo: string; formato?: undefined; paginas: PaginasPDFCamada; aoEvento?: (evento: EventoCamadaImpressao, detalhe?: string) => void };

export function abrirCamadaImpressaoIOS(documento: string, p: OpcoesCamadaImpressao): void {
  const avisar = (evento: EventoCamadaImpressao, detalhe?: string) => {
    try {
      p.aoEvento?.(evento, detalhe);
    } catch {
      // registro opcional: nunca atrapalha a camada
    }
  };
  document.getElementById(ID_CAMADA_IMPRESSAO_IOS)?.remove();

  const raiz = document.createElement("div");
  raiz.id = ID_CAMADA_IMPRESSAO_IOS;
  raiz.setAttribute("role", "dialog");
  raiz.setAttribute("aria-modal", "true");
  raiz.setAttribute("aria-label", p.titulo);
  const estilo = document.createElement("style");
  estilo.textContent = CSS;

  const barra = document.createElement("div");
  barra.className = "cii-barra";
  const fecharBtn = botao("✕ Fechar", "Fechar");
  const titulo = document.createElement("span");
  titulo.className = "cii-titulo";
  titulo.textContent = p.titulo;
  const compartilharBtn = botao("Preparando...", "Compartilhar ou salvar PDF", true);
  compartilharBtn.disabled = true;
  const imprimirBtn = botao("Imprimir", "Imprimir");
  barra.append(fecharBtn, titulo, compartilharBtn, imprimirBtn);

  const dica = document.createElement("div");
  dica.className = "cii-dica";
  dica.hidden = true;
  const mostrarDica = (texto: string) => {
    dica.textContent = texto;
    dica.hidden = false;
  };

  raiz.append(estilo, barra, dica);
  // Nada da camada chega ao document: o Radix acharia que foi "clique fora"
  // (fecharia o diálogo) e o bloqueio de rolagem dele travaria a camada.
  for (const tipo of ["pointerdown", "mousedown", "touchstart", "touchmove", "wheel", "focusin"]) {
    raiz.addEventListener(tipo, (e) => e.stopPropagation());
  }
  document.body.appendChild(raiz);

  let fechada = false;
  const aoVoltar = () => fechar(true);
  function fechar(peloHistorico: boolean) {
    if (fechada) return;
    fechada = true;
    window.removeEventListener("popstate", aoVoltar);
    window.removeEventListener("resize", ajustar);
    raiz.remove();
    const estado = window.history.state as Record<string, unknown> | null;
    if (!peloHistorico && estado?.[CHAVE_HISTORICO]) window.history.back();
  }
  fecharBtn.addEventListener("click", () => fechar(false));
  try {
    window.history.pushState({ ...((window.history.state as object | null) ?? {}), [CHAVE_HISTORICO]: true }, "");
    window.addEventListener("popstate", aoVoltar);
  } catch (erro) {
    console.error("[camada impressão] sem voltar pelo histórico", erro);
  }

  const area = document.createElement("div");
  area.className = "cii-area";
  const folha = document.createElement("div");
  folha.className = "cii-folha";
  const iframe = document.createElement("iframe");
  iframe.title = p.titulo;
  const larguraPx = p.paginas ? Math.round((p.paginas.larguraMm * 96) / 25.4) : medidasDoFormato(p.formato).larguraPx;
  iframe.style.width = `${larguraPx}px`;
  iframe.style.height = "1123px";
  folha.append(iframe);
  area.append(folha);

  // Recibo do tamanho dele, reduzido para caber na largura da tela.
  function ajustar() {
    const doc = iframe.contentDocument;
    if (!doc?.documentElement) return;
    const largura = Math.max(larguraPx, doc.documentElement.scrollWidth);
    iframe.style.width = `${largura}px`;
    const altura = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    iframe.style.height = `${altura}px`;
    const escala = Math.min(1, Math.max(0.2, (area.clientWidth - 24) / largura));
    iframe.style.transform = `scale(${escala})`;
    folha.style.width = `${largura * escala}px`;
    folha.style.height = `${altura * escala}px`;
  }

  try {
    raiz.append(area);
    const carregou = new Promise<void>((resolve) => {
      iframe.addEventListener("load", () => resolve(), { once: true });
    });
    iframe.srcdoc = prepararDocumentoParaCamada(documento);
    window.addEventListener("resize", ajustar);
    carregou.then(() => {
      ajustar();
      const win = iframe.contentWindow as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
      const doc = iframe.contentDocument;
      if (win?.ResizeObserver && doc?.body) new win.ResizeObserver(() => ajustar()).observe(doc.body);
    });

    const paginas = p.paginas;
    const formato = p.formato;
    const limitePdf = Date.now() + (paginas?.tempoMaximoMs ?? 0);
    const gerar = paginas
      ? () =>
          gerarPDFPorPaginas(iframe, paginas, () => fechada || Date.now() > limitePdf, (feitas, total) => {
            if (total > 1 && !fechada) compartilharBtn.textContent = `Preparando ${feitas}/${total}...`;
          })
      : () => gerarPDF(iframe, formato as FormatoPapelRecibo, nomeArquivoPDF(p.titulo, formato as FormatoPapelRecibo));
    const pdf = comTempoMaximo(
      carregou.then(() => new Promise((r) => setTimeout(r, 400))).then(gerar),
      paginas?.tempoMaximoMs ?? TEMPO_MAXIMO_PDF_MS,
      () => null,
    ).catch((erro) => {
      console.error("[camada impressão] falha ao gerar o PDF", erro);
      avisar("pdf_falhou", erro instanceof Error ? erro.message.slice(0, 120) : undefined);
      return null;
    });
    let arquivo: File | null = null;
    pdf.then((f) => {
      if (fechada) return;
      arquivo = f;
      compartilharBtn.textContent = f ? "Compartilhar PDF" : "PDF indisponível";
      compartilharBtn.disabled = !f;
      if (f) avisar("pdf_pronto", `${Math.round(f.size / 1024)}KB`);
      else avisar("pdf_falhou", "sem arquivo (tempo máximo ou erro)");
      if (!f) mostrarDica("Não foi possível gerar o PDF. Tente Imprimir ou feche e abra de novo.");
    });

    compartilharBtn.addEventListener("click", async () => {
      if (!arquivo) return;
      try {
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] })) {
          await navigator.share({ files: [arquivo], title: p.titulo });
          avisar("compartilhado", "share");
          return;
        }
        const url = URL.createObjectURL(arquivo);
        const link = document.createElement("a");
        link.href = url;
        link.download = arquivo.name;
        link.style.display = "none";
        raiz.appendChild(link);
        link.click();
        avisar("compartilhado", "download");
        setTimeout(() => {
          link.remove();
          URL.revokeObjectURL(url);
        }, 10000);
      } catch (erro) {
        if (erro instanceof Error && erro.name === "AbortError") return;
        console.error("[camada impressão] falha ao compartilhar", erro);
        avisar("compartilhar_falhou", erro instanceof Error ? erro.name : undefined);
        mostrarDica("Não foi possível compartilhar. Tente de novo.");
      }
    });

    imprimirBtn.addEventListener("click", () => {
      const win = iframe.contentWindow as JanelaDoRecibo | null;
      let abriu = false;
      const marcar = () => {
        abriu = true;
      };
      win?.addEventListener("beforeprint", marcar);
      window.addEventListener("beforeprint", marcar);
      try {
        win?.focus();
        (win?.__imprimirOriginal ?? (() => win?.print()))();
      } catch (erro) {
        console.error("[camada impressão] print falhou", erro);
      }
      setTimeout(() => {
        win?.removeEventListener("beforeprint", marcar);
        window.removeEventListener("beforeprint", marcar);
        if (!abriu && !fechada) {
          avisar("imprimir_nao_abriu");
          mostrarDica("A impressão não abriu? Use Compartilhar PDF › Imprimir.");
        }
      }, ESPERA_IMPRIMIR_MS);
    });
  } catch (erro) {
    console.error("[camada impressão] falha ao montar o recibo", erro);
    mostrarDica("Não foi possível mostrar o recibo. Feche e tente de novo.");
  }
}
