// Testes de navegador do topo estático das landings, comparando com a main.
// Supabase simulado e pixels (Meta, UTMify, TikTok) interceptados: nada sai da máquina.
//
//   node scripts/testes-landing-prerender/servidor.mjs <dist-main> <vercel-main.json> 4800 &
//   node scripts/testes-landing-prerender/servidor.mjs dist vercel.json 4801 &
//   PLAYWRIGHT=<caminho>/playwright/index.mjs node scripts/testes-landing-prerender/e2e.mjs <pasta-de-saida>
import fs from "node:fs";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
const MAIN = process.env.URL_MAIN ?? "http://localhost:4800";
const BRANCH = process.env.URL_BRANCH ?? "http://localhost:4801";
const SAIDA = path.resolve(process.argv[2] ?? "saida-e2e");
fs.mkdirSync(SAIDA, { recursive: true });

const SUPABASE = "qztuzcchknptrvkdmdph.supabase.co";
const CHAVE_SESSAO = "sb-qztuzcchknptrvkdmdph-auth-token";
const LARGURAS = [390, 768, 1280];
const LANDINGS = [
  { rota: "/", h1: "Quando as vendas caem, organização vira lucro.", ancora: "planos", cta: "Começar Grátis", entrar: "Entrar" },
  { rota: "/lp1", h1: "Organize a bancada. Multiplique o lucro.", ancora: "funcionalidades", cta: "Ver Funcionalidades", entrar: "Começar Agora — É Grátis" },
  { rota: "/lp2", h1: "Seu concorrente está organizando tudo.", ancora: "planos", cta: "Começar Grátis", entrar: "Entrar" },
  { rota: "/es", h1: "Cuando las ventas bajan, la organización se vuelve ganancia.", ancora: "planos", cta: "Empezar Gratis", entrar: "Iniciar sesión" },
];
const ROTAS_APP = [
  "/cadastro-plano", "/obrigado", "/renovar", "/cadastro-trial", "/completar-cadastro", "/c/loja-teste",
  "/lp/loja-teste", "/acompanhar/token-teste", "/entrada/item-teste", "/auth", "/dashboard", "/pdv", "/os",
];
const SEM_ANIMACAO = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

const resultados = [];
function registrar(grupo, nome, ok, detalhe = "") {
  resultados.push({ grupo, nome, ok, detalhe });
  console.log(`${ok ? "OK    " : "FALHOU"} [${grupo}] ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

// ─── navegador / contexto ─────────────────────────────────────────────
const browser = await chromium.launch();

function jwtFalso() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const agora = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-0000-0000-000000000001", role: "authenticated", aud: "authenticated", exp: agora + 3600, iat: agora })}.assinatura`;
}
const USUARIO = {
  id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated", email: "teste@example.com",
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
};
function sessaoFalsa() {
  return { access_token: jwtFalso(), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "refresh-falso", user: USUARIO };
}

/**
 * Contexto com rede controlada. `segurarJs`: o pacote principal (assets/index-*.js) só é
 * entregue quando `liberar()` for chamado (simula o JavaScript ainda baixando).
 */
async function criarContexto({ largura = 390, js = true, sessao = false, segurarJs = false, standaloneIos = false } = {}) {
  const contexto = await browser.newContext({
    viewport: { width: largura, height: largura < 768 ? 844 : 900 },
    deviceScaleFactor: 1,
    javaScriptEnabled: js,
    serviceWorkers: "block",
    isMobile: largura < 768,
    hasTouch: largura < 768,
  });
  const rede = { pixels: [], supabase: [], externos: [] };
  let liberar = () => {};
  const liberado = new Promise((r) => (liberar = r));
  if (!segurarJs) liberar();

  await contexto.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "localhost") {
      if (/\/assets\/index-[^/]+\.js$/.test(url.pathname)) await liberado;
      return route.continue();
    }
    if (/facebook\.(net|com)$|utmify\.com\.br$|tiktok\.com$/.test(url.hostname)) {
      rede.pixels.push(url.href);
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
    }
    if (url.hostname === SUPABASE) {
      rede.supabase.push(`${route.request().method()} ${url.pathname}`);
      if (url.pathname === "/auth/v1/user") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USUARIO) });
      if (url.pathname === "/auth/v1/token") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessaoFalsa()) });
      if (url.pathname.startsWith("/functions/")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    rede.externos.push(url.href);
    return route.abort();
  });

  if (standaloneIos) await contexto.addInitScript(() => Object.defineProperty(Navigator.prototype, "standalone", { get: () => true }));
  await contexto.addInitScript(
    ({ chave, valor }) => {
      if (valor && !localStorage.getItem(chave)) localStorage.setItem(chave, valor);
      // CLS, LCP e "Carregando..." visível na tela
      window.__cls = 0;
      window.__shifts = [];
      window.__lcp = [];
      window.__viuCarregando = false;
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) {
            if (e.hadRecentInput) continue;
            window.__cls += e.value;
            window.__shifts.push({ valor: e.value, t: Math.round(e.startTime), nos: (e.sources || []).map((s) => s.node?.nodeName + "." + (s.node?.className?.toString?.() || "").slice(0, 40)) });
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) {
            window.__lcp.push({ t: Math.round(e.startTime), tag: e.element?.tagName, texto: (e.element?.textContent || "").trim().slice(0, 60), dentroDoEstatico: !!e.element?.closest?.("#topo-estatico") });
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
      const vigiar = () => {
        for (const el of document.querySelectorAll("p")) {
          if (el.textContent?.trim() !== "Carregando...") continue;
          const r = el.getBoundingClientRect();
          if (!(r.bottom > 0 && r.top < innerHeight && r.width > 0)) continue;
          const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (topo && (topo === el || el.contains(topo))) window.__viuCarregando = true;
        }
        requestAnimationFrame(vigiar);
      };
      requestAnimationFrame(vigiar);
    },
    { chave: CHAVE_SESSAO, valor: sessao ? JSON.stringify(sessaoFalsa()) : "" },
  );

  const erros = [];
  contexto.on("page", (p) => p.on("pageerror", (e) => erros.push(e.message)));
  return { contexto, rede, liberar, erros };
}

const montada = (page) =>
  page.waitForFunction(() => !document.getElementById("topo-estatico") && document.querySelectorAll("h1").length === 1 && document.querySelector("#root h1"), null, { timeout: 30000 });

async function estabilizar(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: SEM_ANIMACAO });
  await page.waitForTimeout(400);
}

/** Pixels diferentes entre dois PNGs (mesmo tamanho), comparados num canvas. */
let paginaDiff;
async function diferenca(pngA, pngB) {
  paginaDiff ??= await (await browser.newContext()).newPage();
  return paginaDiff.evaluate(
    async ({ a, b }) => {
      const carregar = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([carregar(a), carregar(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { tamanhoDiferente: true, diferentes: -1, pct: 100 };
      const ler = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
      const da = ler(ia), db = ler(ib);
      let diferentes = 0, minY = Infinity, maxY = -1;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24) {
          diferentes++;
          const y = Math.floor(i / 4 / ia.width); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      return { diferentes, pct: +((diferentes / (ia.width * ia.height)) * 100).toFixed(3), faixaY: maxY < 0 ? null : [minY, maxY] };
    },
    { a: `data:image/png;base64,${pngA.toString("base64")}`, b: `data:image/png;base64,${pngB.toString("base64")}` },
  );
}

const nomeArquivo = (rota) => (rota === "/" ? "raiz" : rota.replace(/\//g, ""));

// ─── 1. Rotas → arquivo servido ───────────────────────────────────────
{
  const ctx = await browser.newContext();
  const appHtml = await (await ctx.request.get(`${BRANCH}/app.html`)).text();
  const mainIndex = await (await ctx.request.get(`${MAIN}/index.html`)).text();
  const semHash = (h) => h.replace(/\/assets\/([\w.-]+?)-[\w-]{8}\.(js|css|webp|png|woff2)/g, "/assets/$1.$2");
  registrar("arquivos", "app.html = index.html da main (sem contar os hashes dos arquivos)", semHash(appHtml) === semHash(mainIndex));
  for (const rota of ROTAS_APP) {
    const r = await ctx.request.get(`${BRANCH}${rota}`);
    const corpo = await r.text();
    registrar("arquivos", `${rota} recebe app.html sem o bloco`, r.headers()["x-arquivo"] === "app.html" && corpo === appHtml && !corpo.includes("topo-estatico"), r.headers()["x-arquivo"]);
  }
  const esperados = { "/": "index.html", "/lp1": "_landing/lp1.html", "/lp1/": "_landing/lp1.html", "/lp1/?utm_source=teste&fbclid=abc": "_landing/lp1.html", "/lp2": "_landing/lp2.html", "/lp2/": "_landing/lp2.html", "/es": "_landing/es.html", "/es/": "_landing/es.html", "/?utm_source=teste&fbclid=abc": "index.html" };
  for (const [rota, arquivo] of Object.entries(esperados)) {
    const r = await ctx.request.get(`${BRANCH}${rota}`);
    registrar("arquivos", `${rota} recebe ${arquivo}`, r.headers()["x-arquivo"] === arquivo, r.headers()["x-arquivo"]);
  }
  await ctx.close();
}

// ─── 2. Rotas do app: pixels, __mecUtmify e ausência do bloco = main ──
for (const rota of ROTAS_APP) {
  const medir = async (base) => {
    const { contexto, rede, erros } = await criarContexto({ largura: 1280, sessao: ["/dashboard", "/pdv", "/os"].includes(rota) });
    const page = await contexto.newPage();
    await page.goto(`${base}${rota}`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const estado = await page.evaluate(() => ({
      bloco: !!document.getElementById("topo-estatico"),
      utmifyCarregado: window.__mecUtmify?.carregado,
      fbq: typeof window.fbq,
      caminho: location.pathname,
    }));
    const pixels = [...new Set(rede.pixels.map((u) => (u.includes("fbevents") ? "meta-fbevents" : u.includes("facebook.com/tr") ? "meta-tr" : u.includes("utmify") ? "utmify:" + new URL(u).pathname : "outro:" + new URL(u).hostname)))].sort();
    await contexto.close();
    return { ...estado, pixels: pixels.join(","), erros: erros.length };
  };
  const [m, b] = [await medir(MAIN), await medir(BRANCH)];
  const igual = m.utmifyCarregado === b.utmifyCarregado && m.fbq === b.fbq && m.pixels === b.pixels && m.caminho === b.caminho;
  registrar("rotas do app", `${rota}: sem bloco e pixels/GuardaUtmify iguais à main`, !b.bloco && igual,
    `main {utmify:${m.utmifyCarregado}, pixels:[${m.pixels}], fim:${m.caminho}} branch {utmify:${b.utmifyCarregado}, pixels:[${b.pixels}], fim:${b.caminho}}`);
}

// ─── 3. Landings: pixels e GuardaUtmify iguais à main ─────────────────
for (const { rota } of LANDINGS) {
  const medir = async (base) => {
    const { contexto, rede } = await criarContexto({ largura: 1280 });
    const page = await contexto.newPage();
    await page.goto(`${base}${rota}?utm_source=teste&utm_campaign=c1&fbclid=abc123`, { waitUntil: "load" });
    await montada(page).catch(() => {});
    await page.waitForTimeout(1500);
    const estado = await page.evaluate(() => ({
      utmify: window.__mecUtmify?.carregado,
      utm: localStorage.getItem("tracking_utm_source"),
      fbclid: localStorage.getItem("tracking_fbclid"),
      fbc: document.cookie.includes("_fbc="),
    }));
    const pixels = [...new Set(rede.pixels.map((u) => (u.includes("fbevents") ? "meta-fbevents" : u.includes("utmify") ? "utmify" : u.includes("facebook.com/tr") ? "meta-tr" : "outro")))].sort().join(",");
    await contexto.close();
    return JSON.stringify({ ...estado, pixels });
  };
  const [m, b] = [await medir(MAIN), await medir(BRANCH)];
  registrar("landings", `${rota}?utm…&fbclid: pixels, UTMs e _fbc iguais à main`, m === b, `main ${m} | branch ${b}`);
}

// ─── 4. JavaScript desligado ──────────────────────────────────────────
for (const l of LANDINGS) {
  const { contexto } = await criarContexto({ largura: 390, js: false });
  const page = await contexto.newPage();
  await page.goto(`${BRANCH}${l.rota}`);
  const h1 = page.locator("h1");
  const textoH1 = (await h1.innerText()).replace(/\s+/g, " ").trim();
  registrar("sem JS", `${l.rota}: <h1> visível com o texto certo`, (await h1.count()) === 1 && (await h1.isVisible()) && textoH1.toLowerCase().startsWith(l.h1.toLowerCase()), textoH1);
  await page.screenshot({ path: path.join(SAIDA, `semjs-${nomeArquivo(l.rota)}-390.png`) });
  const links = await page.$$eval("#topo-estatico a[href]", (as) => as.map((a) => `${a.textContent.trim()}→${a.getAttribute("href")}`));
  registrar("sem JS", `${l.rota}: botões são links`, links.length > 0, links.join(" | "));
  await page.getByRole("link", { name: l.cta }).first().click();
  registrar("sem JS", `${l.rota}: "${l.cta}" põe #${l.ancora} na URL`, new URL(page.url()).hash === `#${l.ancora}`, page.url());
  await page.goto(`${BRANCH}${l.rota}`);
  const [resposta] = await Promise.all([page.waitForNavigation(), page.locator(`#topo-estatico a[href^="/auth"]`).filter({ hasText: l.entrar }).first().click()]);
  registrar("sem JS", `${l.rota}: "${l.entrar}" abre /auth (app.html)`, new URL(page.url()).pathname === "/auth" && resposta?.headers()["x-arquivo"] === "app.html", page.url());
  await contexto.close();
}

// ─── 5. JavaScript atrasado: clique antes do JS e rolagem depois ──────
for (const l of LANDINGS) {
  const { contexto, liberar } = await criarContexto({ largura: 390, segurarJs: true });
  const page = await contexto.newPage();
  await page.goto(`${BRANCH}${l.rota}`, { waitUntil: "commit" });
  await page.locator("#topo-estatico h1").waitFor({ state: "visible" });
  const antes = await page.evaluate(() => ({ estatico: !!document.getElementById("topo-estatico"), root: document.getElementById("root").childElementCount }));
  registrar("JS atrasado", `${l.rota}: topo visível antes do JS (#root vazio)`, antes.estatico && antes.root === 0, JSON.stringify(antes));
  await page.locator("#topo-estatico").getByRole("link", { name: l.cta }).first().click();
  const hash = new URL(page.url()).hash;
  liberar();
  await montada(page);
  const chegou = await page
    .waitForFunction((id) => { const el = document.getElementById(id); if (!el) return false; const r = el.getBoundingClientRect(); return r.top > -80 && r.top < innerHeight * 0.6; }, l.ancora, { timeout: 20000 })
    .then(() => true, () => false);
  registrar("JS atrasado", `${l.rota}: clique em "${l.cta}" antes do JS → depois rola até #${l.ancora}`, hash === `#${l.ancora}` && chegou, `hash=${hash} chegou=${chegou}`);
  await contexto.close();
}

// ─── 6. Prints estático × montado × main, CLS e LCP ───────────────────
const tabelaVisual = [];
for (const l of LANDINGS) {
  for (const largura of LARGURAS) {
    const nome = `${nomeArquivo(l.rota)}-${largura}`;
    // estático (JS segurado) e depois montado, na mesma página
    const b = await criarContexto({ largura, segurarJs: true });
    const pb = await b.contexto.newPage();
    // JS segurado: "load" e "domcontentloaded" esperam o <script type="module">
    await pb.goto(`${BRANCH}${l.rota}`, { waitUntil: "commit" });
    await pb.locator("#topo-estatico h1").waitFor({ state: "visible" });
    await pb.waitForFunction(() => [...document.querySelectorAll("#topo-estatico img")].every((i) => i.complete));
    await estabilizar(pb);
    const pngEstatico = await pb.screenshot({ path: path.join(SAIDA, `${nome}-estatico.png`) });
    const lcpEstatico = await pb.evaluate(() => window.__lcp.at(-1));
    await pb.evaluate(() => document.querySelectorAll("style").forEach((s) => s.textContent?.includes("animation:none!important") && s.remove()));
    b.liberar();
    await montada(pb);
    await pb.waitForTimeout(2500);
    const clsTroca = await pb.evaluate(() => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts }));
    await pb.evaluate(() => scrollTo(0, 0));
    await estabilizar(pb);
    const pngMontado = await pb.screenshot({ path: path.join(SAIDA, `${nome}-montado.png`) });
    await b.contexto.close();

    // main e branch carregando normalmente (CLS de uma carga comum)
    const medirNormal = async (base, arquivo) => {
      const c = await criarContexto({ largura });
      const p = await c.contexto.newPage();
      await p.goto(`${base}${l.rota}`, { waitUntil: "load" });
      await p.waitForFunction(() => document.querySelector("#root h1"), null, { timeout: 30000 });
      await p.waitForTimeout(2500);
      const cls = await p.evaluate(() => +window.__cls.toFixed(4));
      await p.evaluate(() => scrollTo(0, 0));
      await estabilizar(p);
      const png = await p.screenshot({ path: path.join(SAIDA, arquivo) });
      await c.contexto.close();
      return { cls, png };
    };
    const main = await medirNormal(MAIN, `${nome}-main.png`);
    const branch = await medirNormal(BRANCH, `${nome}-branch.png`);

    const dEM = await diferenca(pngEstatico, pngMontado);
    const dBM = await diferenca(branch.png, main.png);
    tabelaVisual.push({ rota: l.rota, largura, estaticoXmontado: dEM.pct, branchXmain: dBM.pct, clsTroca: clsTroca.cls, clsMain: main.cls, clsBranch: branch.cls, lcpEstatico: lcpEstatico ? `${lcpEstatico.tag}${lcpEstatico.dentroDoEstatico ? " (estático)" : ""}: ${lcpEstatico.texto}` : "-" });
    registrar("visual", `${l.rota} @${largura}: estático = montado`, dEM.diferentes === 0, JSON.stringify(dEM));
    registrar("visual", `${l.rota} @${largura}: branch montada = main`, dBM.diferentes === 0, JSON.stringify(dBM));
    registrar("CLS", `${l.rota} @${largura}: troca estático→React sem deslocamento`, clsTroca.cls < 0.01, JSON.stringify(clsTroca));
  }
}
fs.writeFileSync(path.join(SAIDA, "tabela-visual.json"), JSON.stringify(tabelaVisual, null, 2));
console.table(tabelaVisual);

// ─── 7. Sessão guardada abrindo a landing ─────────────────────────────
for (const base of [MAIN, BRANCH]) {
  const { contexto, liberar } = await criarContexto({ largura: 390, sessao: true, segurarJs: true });
  const page = await contexto.newPage();
  await page.goto(`${base}/`, { waitUntil: "commit" });
  await page.waitForTimeout(1500);
  const h1AntesDoJs = await page.locator("h1").first().isVisible().catch(() => false);
  liberar();
  await page.waitForFunction(() => document.querySelector("#root h1"), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const fim = await page.evaluate(() => ({ viuCarregando: window.__viuCarregando, h1s: document.querySelectorAll("h1").length, bloco: !!document.getElementById("topo-estatico"), caminho: location.pathname }));
  const lado = base === MAIN ? "main" : "branch";
  if (lado === "branch") {
    registrar("sessão guardada", `"/" com sessão: topo antes do JS, sem "Carregando..." na tela, 1 <h1> no fim`, h1AntesDoJs && !fim.viuCarregando && fim.h1s === 1 && !fim.bloco && fim.caminho === "/", JSON.stringify({ h1AntesDoJs, ...fim }));
  } else {
    registrar("sessão guardada", `(referência main) "/" com sessão`, true, JSON.stringify({ h1AntesDoJs, ...fim }));
  }
  await contexto.close();
}

// ─── 8. /lp1/ com barra e com ?utm…&fbclid ────────────────────────────
for (const sufixo of ["/lp1/", "/lp1/?utm_source=teste&utm_campaign=c1&fbclid=abc123", "/es/", "/lp2/?fbclid=xyz"]) {
  const { contexto, liberar } = await criarContexto({ largura: 390, segurarJs: true });
  const page = await contexto.newPage();
  await page.goto(`${BRANCH}${sufixo}`, { waitUntil: "commit" });
  const visivel = await page.locator("#topo-estatico h1").waitFor({ state: "visible", timeout: 10000 }).then(() => true, () => false);
  liberar();
  await montada(page).catch(() => {});
  const fim = await page.evaluate(() => ({ h1s: document.querySelectorAll("h1").length, bloco: !!document.getElementById("topo-estatico"), url: location.pathname + location.search, utm: localStorage.getItem("tracking_utm_source"), fbclid: localStorage.getItem("tracking_fbclid") }));
  registrar("barra/UTM", `${sufixo}: topo estático visível e depois 1 <h1>, URL preservada`, visivel && fim.h1s === 1 && !fim.bloco && fim.url === sufixo.replace(/\?.*$/, "") + (sufixo.includes("?") ? "?" + sufixo.split("?")[1] : ""), JSON.stringify(fim));
  await contexto.close();
}

// ─── 9. Rota errada recebendo HTML de landing (rewrite errado) ────────
{
  const { contexto } = await criarContexto({ largura: 390, segurarJs: true });
  const page = await contexto.newPage();
  await page.goto(`${BRANCH}/_landing/lp1.html`, { waitUntil: "commit" });
  await page.locator("#root").waitFor({ state: "attached" });
  const bloco = await page.evaluate(() => !!document.getElementById("topo-estatico"));
  registrar("guarda", "HTML da /lp1 aberto em outro caminho: bloco removido antes de aparecer", !bloco);
  await contexto.close();
}

// ─── 10. App instalado ────────────────────────────────────────────────
// O Chromium não emula display-mode: standalone (nem por CDP); testa o caminho do iOS
// (navigator.standalone), que a guarda do HTML e o ehAppInstalado() também usam.
for (const rota of ["/", "/es", "/lp1"]) {
  const resultado = {};
  for (const base of [MAIN, BRANCH]) {
    const { contexto, liberar } = await criarContexto({ largura: 390, segurarJs: true, standaloneIos: true });
    const page = await contexto.newPage();
    await page.goto(`${base}${rota}`, { waitUntil: "commit" });
    await page.locator("#root").waitFor({ state: "attached" });
    await page.waitForTimeout(500);
    const h1VisivelAntes = await page.locator("h1").first().isVisible().catch(() => false);
    liberar();
    if (rota === "/lp1") await page.waitForFunction(() => document.querySelector("#root h1"), null, { timeout: 20000 }).catch(() => {});
    else await page.waitForURL(/\/auth/, { timeout: 20000 }).catch(() => {});
    // o GuardaUtmify recarrega a página ao sair da landing para /auth
    await page.waitForTimeout(2000);
    await page.waitForLoadState("load");
    const fim = await page.evaluate(() => ({ caminho: location.pathname, bloco: !!document.getElementById("topo-estatico") }));
    resultado[base === MAIN ? "main" : "branch"] = { h1VisivelAntes, ...fim };
    await contexto.close();
  }
  const { main: m, branch: b } = resultado;
  registrar("standalone (iOS)", `${rota} no app instalado: topo estático não aparece e o destino é o mesmo da main (${m.caminho})`, !b.h1VisivelAntes && !b.bloco && b.caminho === m.caminho, JSON.stringify(resultado));
}

// ─── 11. Cliques nos links (com JS): normal, Ctrl/Cmd e botão do meio ─
{
  const cenario = async (base, acao) => {
    const { contexto } = await criarContexto({ largura: 1280 });
    const page = await contexto.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await page.goto(`${base}/`, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("#root h1"));
    await page.waitForTimeout(800);
    await page.evaluate(() => (window.__marcador = 1));
    const novaAba = contexto.waitForEvent("page", { timeout: 3000 }).catch(() => null);
    await acao(page);
    const aba = await novaAba;
    await page.waitForTimeout(2500);
    const estado = await page.evaluate(() => ({ url: location.pathname + location.hash, recarregou: window.__marcador !== 1, rolou: scrollY > 1500 }));
    const r = { ...estado, novaAba: aba ? new URL(aba.url()).pathname + new URL(aba.url()).hash : null, erros: erros.map((m) => m.slice(0, 120)) };
    await contexto.close();
    return r;
  };
  const botao = (nome) => (p) => p.locator("#root").locator("a,button").filter({ hasText: nome }).first();
  const casos = [
    ["clique normal em \"Ver Planos\"", (p) => botao("Ver Planos")(p).click()],
    ["clique normal em \"Entrar\"", (p) => botao("Entrar")(p).click()],
    ["Ctrl/Cmd + clique em \"Ver Planos\"", (p) => botao("Ver Planos")(p).click({ modifiers: ["ControlOrMeta"] })],
    ["Ctrl/Cmd + clique em \"Entrar\"", (p) => botao("Entrar")(p).click({ modifiers: ["ControlOrMeta"] })],
    ["botão do meio em \"Ver Planos\"", (p) => botao("Ver Planos")(p).click({ button: "middle" })],
    ["botão do meio em \"Entrar\"", (p) => botao("Entrar")(p).click({ button: "middle" })],
  ];
  for (const [nome, acao] of casos) {
    const m = await cenario(MAIN, acao);
    const b = await cenario(BRANCH, acao);
    const normal = nome.startsWith("clique normal");
    const ok = normal ? JSON.stringify(m) === JSON.stringify(b) : b.novaAba !== null && b.url === "/" && b.erros.length === 0;
    registrar("cliques", `${nome}${normal ? " igual à main" : ": abre nova aba, a página atual não muda"}`, ok, `main ${JSON.stringify(m)} | branch ${JSON.stringify(b)}`);
  }
}

await browser.close();
const falhas = resultados.filter((r) => !r.ok);
fs.writeFileSync(path.join(SAIDA, "resultados.json"), JSON.stringify(resultados, null, 2));
console.log(`\n${resultados.length - falhas.length}/${resultados.length} ok`);
process.exit(falhas.length ? 1 : 0);
