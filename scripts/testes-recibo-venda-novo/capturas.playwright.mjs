// Capturas do recibo novo (página de teste só de dev) com o Supabase simulado.
// Dados 100% fictícios; nenhuma requisição sai da máquina (tudo fora do
// localhost é respondido pelo mock ou abortado e conta como falha).
//
//   npx vite --port 8099 --strictPort --host 127.0.0.1      (outro terminal)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-recibo-venda-novo/capturas.playwright.mjs <pasta-saida> [png-referencia]
//
// Por cenário: 1280px, 390px (celular) e impressão (emulateMedia print +
// page.pdf A4). Cenários reabertos: o recibo lido via carregarReciboVenda com o
// Supabase simulado tem de sair com o MESMO HTML do recibo montado direto.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8099/dev/recibo-venda-novo.html";
const SAIDA = path.resolve(process.argv[2] ?? "capturas-recibo-novo");
const REFERENCIA = process.argv[3];
mkdirSync(SAIDA, { recursive: true });

const CENARIOS = [
  "item-unico", "varios-itens", "com-troca", "a-receber-4x", "credito-parcelado",
  "pagamento-duplo", "desconto", "sem-logo", "sem-redes", "cancelada", "modelo",
];
const REABERTOS = ["a-receber-4x", "pagamento-duplo", "cancelada"];

const falhas = [];
const falhar = (msg) => { falhas.push(msg); console.log(`  FALHA: ${msg}`); };

// ── Supabase simulado (PostgREST: eq, in, is.null) ──────────────────────────
function filtrar(linhas, params) {
  return linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
}

async function ligarMock(contexto, tabelas, registro) {
  await contexto.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "data:") return rota.continue();
    const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
    if (url.hostname.endsWith(".supabase.co") && m && tabelas) {
      const tabela = m[1];
      registro.push(`${tabela}?${url.searchParams.toString()}`);
      if (!(tabela in tabelas)) {
        falhar(`consulta a tabela sem mock: ${tabela}`);
        return rota.fulfill({ status: 404, json: { message: "sem mock" } });
      }
      const linhas = filtrar(tabelas[tabela], url.searchParams);
      const umObjeto = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      if (umObjeto) {
        return linhas.length === 1
          ? rota.fulfill({ status: 200, json: linhas[0] })
          : rota.fulfill({ status: 406, json: { code: "PGRST116", message: "0 ou várias linhas" } });
      }
      return rota.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
    }
    falhar(`requisição externa bloqueada: ${url.href}`);
    return rota.abort();
  });
}

function vigiarConsole(pagina, nome) {
  pagina.on("console", (msg) => { if (msg.type() === "error") falhar(`[${nome}] console.error: ${msg.text()}`); });
  pagina.on("pageerror", (e) => falhar(`[${nome}] erro na página: ${e.message}`));
}

const contarPaginasPdf = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

const navegador = await chromium.launch();
const relatorio = [];

try {
  // Dados das tabelas simuladas: vêm da própria página (cenarios.ts).
  const ctxDados = await navegador.newContext();
  await ligarMock(ctxDados, null, []);
  const pgDados = await ctxDados.newPage();
  await pgDados.goto(BASE, { waitUntil: "networkidle" });
  const banco = await pgDados.evaluate(() => window.__rvnBanco);
  const linksIndice = await pgDados.locator("li").count();
  if (linksIndice !== CENARIOS.length) falhar(`índice com ${linksIndice} cenários (esperado ${CENARIOS.length})`);
  await ctxDados.close();

  for (const [i, id] of CENARIOS.entries()) {
    const prefixo = `${String(i + 1).padStart(2, "0")}-${id}`;
    console.log(`▸ ${prefixo}`);
    const linhaRel = { cenario: id };

    // Computador 1280px
    const ctxDesk = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    await ligarMock(ctxDesk, null, []);
    const desk = await ctxDesk.newPage();
    vigiarConsole(desk, `${id}/1280`);
    await desk.goto(`${BASE}?cenario=${id}`, { waitUntil: "networkidle" });
    await desk.waitForSelector("#rvn-recibo[data-pronto='1']");
    await desk.screenshot({ path: path.join(SAIDA, `${prefixo}-1280.png`), fullPage: true });
    const htmlDireto = await desk.locator("#rvn-recibo").innerHTML();
    const imagensQuebradas = await desk.evaluate(() => [...document.images].filter((im) => !im.complete || im.naturalWidth === 0).length);
    if (imagensQuebradas) falhar(`[${id}] ${imagensQuebradas} imagem(ns) sem carregar`);
    await ctxDesk.close();

    // Celular 390px
    const ctxCel = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ligarMock(ctxCel, null, []);
    const cel = await ctxCel.newPage();
    vigiarConsole(cel, `${id}/390`);
    await cel.goto(`${BASE}?cenario=${id}`, { waitUntil: "networkidle" });
    await cel.waitForSelector("#rvn-recibo[data-pronto='1']");
    const larguraCel = await cel.evaluate(() => document.documentElement.scrollWidth);
    linhaRel.larguraCelular = larguraCel;
    if (larguraCel > 390) falhar(`[${id}] rolagem horizontal no celular (${larguraCel}px)`);
    await cel.screenshot({ path: path.join(SAIDA, `${prefixo}-390.png`), fullPage: true });
    await ctxCel.close();

    // Impressão: área útil do A4 com margem de 10mm (190mm ≈ 718px), emulateMedia print, PDF A4 com fundos
    const ctxImp = await navegador.newContext({ viewport: { width: 718, height: 1047 } });
    await ligarMock(ctxImp, null, []);
    const imp = await ctxImp.newPage();
    vigiarConsole(imp, `${id}/impressao`);
    await imp.goto(`${BASE}?cenario=${id}&impressao=1`, { waitUntil: "networkidle" });
    await imp.waitForSelector("#rvn-recibo[data-pronto='1']");
    await imp.emulateMedia({ media: "print" });
    await imp.screenshot({ path: path.join(SAIDA, `${prefixo}-impressao.png`), fullPage: true });
    const pdf = await imp.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    writeFileSync(path.join(SAIDA, `${prefixo}-a4.pdf`), pdf);
    linhaRel.paginasA4 = contarPaginasPdf(pdf);
    await ctxImp.close();

    // Reabertos: mesmo HTML lendo pelo Supabase simulado
    if (REABERTOS.includes(id)) {
      const consultas = [];
      const ctxSb = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
      await ligarMock(ctxSb, banco[id].tabelas, consultas);
      const sb = await ctxSb.newPage();
      vigiarConsole(sb, `${id}/supabase`);
      await sb.goto(`${BASE}?cenario=${id}&fonte=supabase`, { waitUntil: "networkidle" });
      await sb.waitForSelector("#rvn-recibo[data-pronto='1'], #rvn-erro");
      const erro = await sb.locator("#rvn-erro").count();
      if (erro) falhar(`[${id}] supabase: ${await sb.locator("#rvn-erro").innerText()}`);
      else {
        const htmlSb = await sb.locator("#rvn-recibo").innerHTML();
        linhaRel.supabaseIgual = htmlSb === htmlDireto;
        if (!linhaRel.supabaseIgual) {
          writeFileSync(path.join(SAIDA, `${prefixo}-supabase-diferente.html`), `${htmlDireto}\n\n<!-- ===== SUPABASE ===== -->\n\n${htmlSb}`);
          falhar(`[${id}] HTML via Supabase simulado difere do montado direto`);
        }
      }
      linhaRel.consultasSupabase = consultas.map((c) => c.split("?")[0]);
      await ctxSb.close();
    }
    relatorio.push(linhaRel);
  }

  // Modelo lado a lado com o PNG de referência (mesma largura: 1024px)
  if (REFERENCIA) {
    const ctx = await navegador.newContext({ viewport: { width: 1024, height: 900 } });
    await ligarMock(ctx, null, []);
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}?cenario=modelo`, { waitUntil: "networkidle" });
    await pg.waitForSelector("#rvn-recibo[data-pronto='1']");
    await pg.addStyleTag({ content: "body{padding:0 !important;background:#fff !important} .rvn{max-width:none;border-radius:0;box-shadow:none}" });
    const nosso = await pg.locator("#rvn-recibo").screenshot();
    await ctx.close();
    const b64 = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
    const ctxLado = await navegador.newContext({ viewport: { width: 2100, height: 1000 } });
    const lado = await ctxLado.newPage();
    await lado.setContent(`<body style="margin:0;padding:16px;background:#e9edf5;font-family:Arial;display:flex;gap:20px;align-items:flex-start">
      <figure style="margin:0;width:1024px"><figcaption style="font-weight:700;margin-bottom:8px">Referência (recibo-venda-modelo.png)</figcaption><img style="width:1024px;display:block" src="${b64(readFileSync(REFERENCIA))}"></figure>
      <figure style="margin:0;width:1024px"><figcaption style="font-weight:700;margin-bottom:8px">Layout novo (cenário "modelo", dados fictícios do modelo)</figcaption><img style="width:1024px;display:block" src="${b64(nosso)}"></figure></body>`);
    await lado.screenshot({ path: path.join(SAIDA, "12-modelo-lado-a-lado.png"), fullPage: true });
    await ctxLado.close();
  }
} finally {
  await navegador.close();
}

writeFileSync(path.join(SAIDA, "relatorio.json"), JSON.stringify({ relatorio, falhas }, null, 2));
console.log(JSON.stringify(relatorio, null, 1));
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nOK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
