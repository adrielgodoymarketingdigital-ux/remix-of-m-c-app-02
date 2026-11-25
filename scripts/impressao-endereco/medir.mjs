// Mede as impressões HTML geradas por gerar.tsx num Chromium (Playwright), com
// mídia de impressão, e imprime cada uma em PDF A4 contando as páginas.
// Nenhuma requisição sai da máquina (tudo que não for file:/data: é abortado).
//
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> [CHROME_PATH=<chrome>] node medir.mjs <pasta-gerada> <css-do-app> <ImpressaoOrdemServico.tsx>
//
// Caminhos de impressão medidos (os dois do app para A4):
//   desktop  — window.print() do app: CSS inteiro do app (index.css compilado) +
//              #print-root. Aqui a OS tem max-height 277mm e overflow hidden:
//              nunca passa de 1 página; o que não cabe é CORTADO (medimos isso).
//   android  — documento isolado de handlePrintAndroid: regras filtradas pelo
//              MESMO critério do app + o bloco "Essential resets" tirado do
//              próprio ImpressaoOrdemServico.tsx (aqui pode virar 2 folhas).
//   cupom    — documento isolado de print80mm() (bobina: mede a altura).
// Saída: <pasta-gerada>/medidas.json  e  <pasta-gerada>/pdf-html/*.pdf
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const [pasta, cssApp, arquivoImpressao] = process.argv.slice(2);
const css = readFileSync(cssApp, "utf8");
const PX_POR_MM = 96 / 25.4;

// Bloco "Essential resets" do documento do Android, como está no código medido.
function blocoAndroid() {
  const fonte = readFileSync(arquivoImpressao, "utf8");
  const ini = fonte.indexOf("/* Essential resets */");
  const fim = fonte.indexOf("</style>", ini);
  if (ini < 0 || fim < 0) throw new Error("bloco do Android não encontrado em ImpressaoOrdemServico.tsx");
  return fonte.slice(ini, fim)
    .replace(/\$\{isHorizontalMode[\s\S]*?\}mm; \}`\}/, "@page { size: A4 portrait; margin: 8mm; }")
    .replace(/\$\{layoutConfig\.duas_os_por_folha \? '0' : '4mm'\}/, "4mm")
    .replace(/\$\{[^}]*\}/g, "0");
}
const CSS_ANDROID = blocoAndroid();
if (CSS_ANDROID.includes("${")) throw new Error("sobrou interpolação no bloco do Android");

const saidaPdf = path.join(pasta, "pdf-html");
mkdirSync(saidaPdf, { recursive: true });
const docDesktop = (corpo) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="print-root" class="print-root">${corpo}</div></body></html>`;

const contarPaginas = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const navegador = await chromium.launch({ executablePath: CHROME });
const contexto = await navegador.newContext({ viewport: { width: Math.round(194 * PX_POR_MM), height: 1200 } });
await contexto.route("**/*", (rota) => {
  const u = rota.request().url();
  return u.startsWith("file:") || u.startsWith("data:") ? rota.continue() : rota.abort();
});
const pagina = await contexto.newPage();
pagina.setDefaultTimeout(90000);
// Máquina carregada (duas medições em paralelo): tenta de novo antes de desistir.
async function abrir(url) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await pagina.goto(url);
    } catch (erro) {
      if (tentativa >= 3) throw erro;
    }
  }
}
await pagina.emulateMedia({ media: "print" });

async function medir(seletor) {
  return pagina.evaluate(([sel, pxmm]) => {
    const c = document.querySelector(sel);
    if (!c) return null;
    const topo = c.getBoundingClientRect().top;
    const mm = (px) => Math.round((px / pxmm) * 100) / 100;
    const bloco = c.querySelector(".impressao-grid-2, .osr-linha-2");
    const filhos = Array.from(c.children).filter((f) => f.tagName !== "STYLE");
    const ultimo = filhos[filhos.length - 1];
    // Impressão digital do layout: posição e tamanho de cada elemento.
    const caixas = Array.from(c.querySelectorAll("*")).map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName}.${el.getAttribute("class") ?? ""}@${r.left.toFixed(2)},${(r.top - topo).toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}`;
    });
    // Texto do endereço cortado por reticências? (largura do texto > caixa)
    // e em quantas linhas ele quebrou (topos distintos das linhas do texto).
    const linhaEndereco = Array.from(c.querySelectorAll("[data-endereco-cliente]")).map((el) => {
      const faixa = document.createRange();
      faixa.selectNodeContents(el);
      const topos = new Set(Array.from(faixa.getClientRects()).filter((r) => r.width > 0).map((r) => Math.round(r.top)));
      return {
        cabe: el.scrollWidth <= el.clientWidth + 0.5,
        alturaMm: mm(el.getBoundingClientRect().height),
        linhas: topos.size,
      };
    });
    return {
      alturaConteudoMm: mm(c.scrollHeight),
      alturaVisivelMm: mm(c.getBoundingClientRect().height),
      cortadoMm: mm(Math.max(0, c.scrollHeight - c.clientHeight)),
      blocoClienteMm: bloco ? mm(bloco.getBoundingClientRect().height) : null,
      fimUltimoBlocoMm: ultimo ? mm(ultimo.getBoundingClientRect().bottom - topo) : null,
      linhaEndereco,
      caixas,
    };
  }, [seletor, PX_POR_MM]);
}

const FILTRO_ANDROID = ["impressao-", "cupom-", "print-", "@media print", "@page", "checklist", "silhueta", "avaria", ".text-xs", ".text-sm", ":root"];

const medidas = {};
const arquivos = readdirSync(path.join(pasta, "html")).filter((f) => f.endsWith(".html")).sort();
for (const arquivo of arquivos) {
  const nome = arquivo.replace(/\.html$/, "");
  const corpo = readFileSync(path.join(pasta, "html", arquivo), "utf8");
  if (nome.startsWith("cupom__")) {
    const caminho = path.join(saidaPdf, `${nome}.doc.html`);
    writeFileSync(caminho, corpo);
    await abrir(pathToFileURL(caminho).href);
    medidas[nome] = { cupom: await medir(".cupom-80mm-container") };
    continue;
  }
  const entrada = {};
  // desktop
  const caminhoDesk = path.join(saidaPdf, `${nome}.desktop.html`);
  writeFileSync(caminhoDesk, docDesktop(corpo));
  await abrir(pathToFileURL(caminhoDesk).href);
  await pagina.evaluate(() => document.fonts.ready);
  entrada.desktop = await medir(".impressao-ordem-container");
  const pdfDesk = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
  entrada.desktop.paginas = contarPaginas(pdfDesk);
  writeFileSync(path.join(saidaPdf, `${nome}.desktop.pdf`), pdfDesk);

  // android: mesmo filtro de regras do app, aplicado às folhas do documento do desktop
  const printCSS = await pagina.evaluate((filtro) => {
    let saida = "";
    for (const folha of Array.from(document.styleSheets)) {
      for (const regra of Array.from(folha.cssRules || [])) {
        const t = regra.cssText;
        if (filtro.some((f) => t.includes(f))) saida += t + "\n";
      }
    }
    return saida;
  }, FILTRO_ANDROID);
  const docAndroid = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${printCSS}\n${CSS_ANDROID}</style></head><body><div id="print-root">${corpo}</div></body></html>`;
  const caminhoAnd = path.join(saidaPdf, `${nome}.android.html`);
  writeFileSync(caminhoAnd, docAndroid);
  await abrir(pathToFileURL(caminhoAnd).href);
  await pagina.evaluate(() => document.fonts.ready);
  entrada.android = await medir(".impressao-ordem-container");
  const pdfAnd = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
  entrada.android.paginas = contarPaginas(pdfAnd);
  writeFileSync(path.join(saidaPdf, `${nome}.android.pdf`), pdfAnd);
  medidas[nome] = entrada;
}
await navegador.close();
writeFileSync(path.join(pasta, "medidas.json"), JSON.stringify(medidas));
console.log(`medidos: ${arquivos.length} documentos em ${pasta}`);
