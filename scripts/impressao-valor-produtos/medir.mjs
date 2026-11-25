// Mede as impressões HTML geradas por gerar.tsx (prova do valor dos produtos) num Chromium (Playwright), com
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

// Duas OS por folha: a mesma geometria de getDuasOSGeometria() (paper-size-utils.ts):
// margem 8 mm, divisor 1 mm, conteúdo de 194 mm reduzido para caber em cada metade.
const GEO_DUAS = {
  vertical: { pagina: "portrait", areaLarguraMm: 194, areaAlturaMm: 281, slotLarguraMm: 96.5, slotAlturaMm: 281, scale: 96.5 / 194 },
  horizontal: { pagina: "landscape", areaLarguraMm: 281, areaAlturaMm: 194, slotLarguraMm: 140, slotAlturaMm: 194, scale: 140 / 194 },
};

// Bloco "Essential resets" do documento do Android, como está no código medido.
// orientacao = null (1 OS por folha) ou "vertical"/"horizontal" (duas OS por folha).
function blocoAndroid(orientacao) {
  const fonte = readFileSync(arquivoImpressao, "utf8");
  const ini = fonte.indexOf("/* Essential resets */");
  const fim = fonte.indexOf("</style>", ini);
  if (ini < 0 || fim < 0) throw new Error("bloco do Android não encontrado em ImpressaoOrdemServico.tsx");
  const geo = (nome) => (_, campo) => String(GEO_DUAS[nome][campo]);
  return fonte.slice(ini, fim)
    .replace(/\$\{isHorizontalMode[\s\S]*?\}mm; \}`\}/, `@page { size: A4 ${orientacao ? GEO_DUAS[orientacao].pagina : "portrait"}; margin: 8mm; }`)
    .replace(/\$\{layoutConfig\.duas_os_por_folha \? '0' : '4mm'\}/, orientacao ? "0" : "4mm")
    .replace(/\$\{geoDuasOsVertical\.(\w+)\}/g, geo("vertical"))
    .replace(/\$\{geoDuasOsHorizontal\.(\w+)\}/g, geo("horizontal"))
    .replace(/\$\{[^}]*\}/g, "0");
}
const CSS_ANDROID = blocoAndroid(null);
const CSS_ANDROID_DUAS = { vertical: blocoAndroid("vertical"), horizontal: blocoAndroid("horizontal") };
for (const t of [CSS_ANDROID, ...Object.values(CSS_ANDROID_DUAS)]) if (t.includes("${")) throw new Error("sobrou interpolação no bloco do Android");

// Wrapper de duas OS igual ao do app (ImpressaoOrdemServico.tsx): a mesma OS nas duas metades.
const wrapperDuas = (corpo, orientacao) =>
  `<div class="impressao-duas-os-wrapper impressao-duas-os-${orientacao}"><div class="impressao-duas-os-slot os-pdf-slot">${corpo}</div>` +
  `<div class="impressao-duas-os-corte"><span class="impressao-duas-os-corte-label">✂ cortar aqui</span></div>` +
  `<div class="impressao-duas-os-slot os-pdf-slot">${corpo}</div></div>`;
// Desktop: o <style id="print-page-duas-os"> que o useEffect injeta + a classe do body na horizontal.
const estiloDuasDesktop = (o) => {
  const g = GEO_DUAS[o];
  return `@media print { @page { size: A4 ${g.pagina}; margin: 8mm; } :root { --duas-os-largura-mm: ${g.areaLarguraMm}mm; --duas-os-altura-mm: ${g.areaAlturaMm}mm; --duas-os-slot-largura-mm: ${g.slotLarguraMm}mm; --duas-os-scale: ${g.scale}; } }`;
};

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
    // Altura do termo de garantia (para medir quanto o termo 0,5 pt menor recupera).
    const termoEl = c.querySelector(".impressao-termo-garantia") ?? c.querySelector(".osr-termo")?.closest(".osr-card");
    const faixaEl = c.querySelector("[data-faixa-endereco]");
    // Linhas de produto/peça: nome com "…" (texto maior que a caixa), numa linha só
    // (altura do nome ≤ a do valor, que é nowrap) e valor inteiro dentro da linha.
    const produtos = Array.from(c.querySelectorAll(".impressao-item-produto")).map((l) => {
      const n = l.querySelector(".impressao-item-nome");
      const v = l.querySelector(".impressao-item-valor");
      if (!n || !v) return { semValor: true };
      const rl = l.getBoundingClientRect();
      const rn = n.getBoundingClientRect();
      const rv = v.getBoundingClientRect();
      return {
        reticencias: n.scrollWidth > n.clientWidth + 0.5 && getComputedStyle(n).textOverflow === "ellipsis",
        umaLinha: rn.height <= rv.height + 0.5,
        valorInteiro: rv.width > 0 && v.scrollWidth <= v.clientWidth + 0.5 && rv.right <= rl.right + 0.5 && rv.left >= rn.right - 0.5,
      };
    });
    return {
      produtos,
      termoMm: termoEl ? mm(termoEl.getBoundingClientRect().height) : null,
      faixaMm: faixaEl ? mm(faixaEl.getBoundingClientRect().height) : null,
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

  // Duas OS por folha (vertical e horizontal; desktop e Android). A folha nunca vira 2:
  // cada metade tem altura fixa e corta o que passar (overflow hidden). Mede-se quanto
  // a OS (já reduzida) passa da altura da metade. PDF só numa amostra (OS normal e a
  // mais cheia), para confirmar que é sempre 1 folha.
  // Duas OS só existe em Padrão e Tech (usaReciboPersonalizado = false com duas OS).
  const amostraPdf = /__(semprod-simples-00|mista-cheia-40|longo-cheia-40|longo-leve-20)$/.test(nome);
  const temDuas = /^(padrao|tech)__/.test(nome);
  for (const orientacao of temDuas ? ["vertical", "horizontal"] : []) {
    for (const via of ["desktop", "android"]) {
      const corpoDuas = wrapperDuas(corpo, orientacao);
      const doc = via === "desktop"
        ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style><style>${estiloDuasDesktop(orientacao)}</style></head><body class="${orientacao === "horizontal" ? "print-duas-os-horizontal" : ""}"><div id="print-root" class="print-root">${corpoDuas}</div></body></html>`
        : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${printCSS}\n${CSS_ANDROID_DUAS[orientacao]}</style></head><body><div id="print-root">${corpoDuas}</div></body></html>`;
      const caminho = path.join(saidaPdf, `${nome}.duas-${orientacao}-${via}.html`);
      writeFileSync(caminho, doc);
      await abrir(pathToFileURL(caminho).href);
      await pagina.evaluate(() => document.fonts.ready);
      const m = await medir(".impressao-duas-os-slot .impressao-ordem-container");
      const slot = await pagina.evaluate((pxmm) => {
        const s = document.querySelector(".impressao-duas-os-slot");
        const c = s?.querySelector(".impressao-ordem-container");
        if (!s || !c) return null;
        const mm = (px) => Math.round((px / pxmm) * 100) / 100;
        return { alturaReduzidaMm: mm(c.getBoundingClientRect().height), alturaMetadeMm: mm(s.getBoundingClientRect().height) };
      }, PX_POR_MM);
      const chaveVia = `duas-${orientacao === "vertical" ? "v" : "h"}-${via}`;
      entrada[chaveVia] = {
        ...m,
        ...slot,
        // altura da OS reduzida (mm no papel) e quanto passa da metade
        alturaConteudoMm: slot.alturaReduzidaMm,
        cortadoMm: Math.max(0, Math.round((slot.alturaReduzidaMm - slot.alturaMetadeMm) * 100) / 100),
      };
      if (amostraPdf) {
        const pdf = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
        entrada[chaveVia].paginas = contarPaginas(pdf);
      }
    }
  }
  medidas[nome] = entrada;
}
await navegador.close();
writeFileSync(path.join(pasta, "medidas.json"), JSON.stringify(medidas));
console.log(`medidos: ${arquivos.length} documentos em ${pasta}`);
