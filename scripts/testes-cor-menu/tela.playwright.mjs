// Cor do menu: componentes REAIS (Dashboard com AppLayout e a aba Cores) na página
// de teste teste.local/app.html, com o Supabase simulado (mock.ts). Dados 100%
// fictícios; nada sai de localhost (CSP + fetch trocado). As "gravações" (PATCH)
// só mudam a tabela em memória da página.
//
//   cp -R scripts/testes-cor-menu/pagina teste.local                           (teste.local é ignorado pelo git)
//   PORTA=8104 npx vite --config teste.local/vite.config.ts --force            (branch)
//   PORTA=8105 npx vite --config teste.local/vite.config.ts --force            (cópia da origin/main, mesmo teste.local)
//   Playwright: um com o Chromium já baixado (aqui: ~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright).
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-cor-menu/tela.playwright.mjs <pasta-das-capturas>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const pasta = process.argv[2] ?? "capturas-cor-menu";
mkdirSync(pasta, { recursive: true });

const BRANCH = "http://localhost:8104/teste.local/app.html";
const MAIN = "http://localhost:8105/teste.local/app.html";
const DESKTOP = { width: 1280, height: 800 };
const CELULAR = { width: 390, height: 844 };

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "ok  " : "FALHA"} ${msg}`);
  if (!cond) falhas++;
};

const navegador = await chromium.launch();

async function abrir(base, params, viewport) {
  const ctx = await navegador.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  // Fora de localhost: abortado aqui (além do CSP). O app tenta o SDK do OneSignal; nada sai.
  const externas = [];
  await ctx.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("http://localhost:") || u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
    externas.push(u);
    return r.abort();
  });
  page.on("pageerror", (e) => console.log("   [erro na página]", e.message));
  const porta = new URL(base).port;
  await page.goto(`${base}?porta=${porta}&${params}`);
  await page.waitForSelector(viewport === DESKTOP ? '[data-sidebar="sidebar"]' : "nav.fixed.bottom-0", { timeout: 20000 });
  await page.waitForTimeout(1500);
  return { ctx, page, externas };
}

// IDs gerados (radix/useId) mudam entre execuções; o resto do HTML tem de ser igual.
const normalizar = (html) => html.replace(/:r[0-9a-z]+:/g, ":r:").replace(/radix-[^"\s]+/g, "radix-");

async function coletarPadrao(base) {
  const r = {};
  {
    const { ctx, page, externas } = await abrir(base, "tela=dashboard", DESKTOP);
    r.htmlStyle = await page.evaluate(() => document.documentElement.getAttribute("style"));
    r.lateral = normalizar(await page.locator('[data-sidebar="sidebar"]').evaluate((e) => e.outerHTML));
    r.lateralPng = await page.locator('[data-sidebar="sidebar"]').screenshot();
    r.externasDesk = externas;
    await ctx.close();
  }
  {
    const { ctx, page, externas } = await abrir(base, "tela=dashboard", CELULAR);
    const nav = page.locator("nav.fixed.bottom-0");
    r.inferior = normalizar(await nav.evaluate((e) => e.outerHTML));
    r.inferiorPng = await nav.screenshot();
    await nav.locator("button").last().click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(800);
    r.gaveta = normalizar(await page.locator('[role="dialog"]').evaluate((e) => e.outerHTML));
    r.gavetaPng = await page.locator('[role="dialog"]').screenshot();
    r.externasCel = externas;
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(base, "tela=dashboard&tema=escuro", CELULAR);
    r.inferiorEscuroPng = await page.locator("nav.fixed.bottom-0").screenshot();
    await ctx.close();
  }
  return r;
}

// ------------------------------------------------ 1) sem cor: igual à main
console.log("\n== Sem cor escolhida: branch × origin/main ==");
const [main, branch] = [await coletarPadrao(MAIN), await coletarPadrao(BRANCH)];
ok(main.htmlStyle === branch.htmlStyle, `style do <html> igual (main=${main.htmlStyle} branch=${branch.htmlStyle})`);
ok(main.lateral === branch.lateral, `HTML da barra lateral igual (${branch.lateral.length} caracteres)`);
ok(main.inferior === branch.inferior, `HTML da barra inferior igual (${branch.inferior.length} caracteres)`);
ok(main.gaveta === branch.gaveta, `HTML do menu do celular igual (${branch.gaveta.length} caracteres)`);
ok(Buffer.compare(main.lateralPng, branch.lateralPng) === 0, "captura da barra lateral idêntica byte a byte");
ok(Buffer.compare(main.inferiorPng, branch.inferiorPng) === 0, "captura da barra inferior idêntica byte a byte");
ok(Buffer.compare(main.inferiorEscuroPng, branch.inferiorEscuroPng) === 0, "captura da barra inferior (tema escuro) idêntica byte a byte");
ok(Buffer.compare(main.gavetaPng, branch.gavetaPng) === 0, "captura do menu do celular idêntica byte a byte");
const bloqueadas = [...new Set([...branch.externasDesk, ...branch.externasCel, ...main.externasDesk, ...main.externasCel])];
ok(bloqueadas.every((u) => u.startsWith("https://cdn.onesignal.com/")), `fora de localhost só o SDK do OneSignal, abortado: ${JSON.stringify(bloqueadas)}`);
writeFileSync(path.join(pasta, "00-padrao-lateral.png"), branch.lateralPng);
writeFileSync(path.join(pasta, "00-padrao-inferior.png"), branch.inferiorPng);

// ------------------------------------------------ 2) com cor: capturas + contraste medido na tela
function lum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

const CORES = [
  ["vinho-escuro", "4a0e1c"],
  ["claro", "f1f5f9"],
  ["azul-saturado", "1d4ed8"],
  ["cinza-medio", "808080"],
  ["amarelo-claro", "fff59d"],
];
for (const [nome, hex] of CORES) {
  console.log(`\n== Cor #${hex} (${nome}) ==`);
  {
    const { ctx, page } = await abrir(BRANCH, `tela=dashboard&menu=${hex}`, DESKTOP);
    const m = await page.evaluate(() => {
      const lateral = document.querySelector('[data-sidebar="sidebar"]');
      const fundo = getComputedStyle(lateral).backgroundColor;
      const botoes = [...lateral.querySelectorAll('[data-sidebar="menu-button"]')];
      const ativo = botoes.find((b) => b.getAttribute("data-active") === "true");
      const normal = botoes.find((b) => b.getAttribute("data-active") !== "true" && b.textContent.trim());
      return {
        fundo,
        texto: getComputedStyle(normal).color,
        ativoFundo: ativo ? getComputedStyle(ativo).backgroundColor : null,
        ativoTexto: ativo ? getComputedStyle(ativo).color : null,
        ativoIcone: ativo ? getComputedStyle(ativo.querySelector("svg")).color : null,
        style: document.documentElement.getAttribute("style"),
      };
    });
    console.log(`     fundo da lateral: ${m.fundo} (escolhida #${hex}; HSL inteiro pode variar ±1 por canal)`);
    ok(contraste(rgb(m.texto), rgb(m.fundo)) >= 4.5, `lateral texto/fundo ${contraste(rgb(m.texto), rgb(m.fundo)).toFixed(2)}`);
    if (m.ativoFundo) {
      ok(contraste(rgb(m.ativoTexto), rgb(m.ativoFundo)) >= 4.5, `lateral item ativo texto ${contraste(rgb(m.ativoTexto), rgb(m.ativoFundo)).toFixed(2)}`);
      ok(contraste(rgb(m.ativoIcone), rgb(m.ativoFundo)) >= 3, `lateral item ativo ícone ${contraste(rgb(m.ativoIcone), rgb(m.ativoFundo)).toFixed(2)}`);
    }
    // hover de verdade num item normal
    const normal = page.locator('[data-sidebar="menu-button"]:not([data-active="true"])').nth(1);
    await normal.hover();
    await page.waitForTimeout(300);
    const h = await normal.evaluate((e) => ({ fundo: getComputedStyle(e).backgroundColor, texto: getComputedStyle(e).color }));
    ok(contraste(rgb(h.texto), rgb(h.fundo)) >= 4.5, `lateral hover ${contraste(rgb(h.texto), rgb(h.fundo)).toFixed(2)}`);
    await page.screenshot({ path: path.join(pasta, `${nome}-desktop.png`) });
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(BRANCH, `tela=dashboard&menu=${hex}`, CELULAR);
    const nav = page.locator("nav.fixed.bottom-0");
    const m = await nav.evaluate((n) => {
      const links = [...n.querySelectorAll("a")];
      const ativo = links.find((a) => a.className.includes("text-sidebar-primary"));
      const inativo = links.find((a) => a !== ativo);
      // fundo efetivo: a cor do menu a 97% sobre o fundo da página
      return { fundo: getComputedStyle(n).backgroundColor, inativo: getComputedStyle(inativo).color, ativo: ativo ? getComputedStyle(ativo).color : null, pagina: getComputedStyle(document.body).backgroundColor };
    });
    const [r, g, b, a = 1] = m.fundo.match(/[\d.]+/g).map(Number);
    const pg = rgb(m.pagina);
    const efetivo = [r, g, b].map((c, i) => c * a + pg[i] * (1 - a));
    ok(contraste(rgb(m.inativo), efetivo) >= 4.5, `inferior texto inativo ${contraste(rgb(m.inativo), efetivo).toFixed(2)}`);
    if (m.ativo) ok(contraste(rgb(m.ativo), efetivo) >= 3, `inferior destaque ativo ${contraste(rgb(m.ativo), efetivo).toFixed(2)}`);
    await page.screenshot({ path: path.join(pasta, `${nome}-celular.png`) });
    await nav.locator("button").last().click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(pasta, `${nome}-celular-menu.png`) });
    await ctx.close();
  }
}

// ------------------------------------------------ 3) funcionário vê a cor da loja
console.log("\n== Funcionário ==");
{
  const { ctx, page } = await abrir(BRANCH, "tela=dashboard&visao=funcionario&menu=4a0e1c", DESKTOP);
  const fundo = await page.locator('[data-sidebar="sidebar"]').evaluate((e) => getComputedStyle(e).backgroundColor);
  ok(fundo === "rgb(74, 14, 28)" || fundo === "rgb(74, 15, 29)" || /^rgb\(7[3-5], 1[3-6], 2[7-9]\)$/.test(fundo), `funcionário: lateral com a cor da loja (${fundo})`);
  await ctx.close();
}

// ------------------------------------------------ 4) cor lembrada antes do banco
console.log("\n== Cor lembrada (localStorage) ==");
{
  const { ctx, page } = await abrir(BRANCH, "tela=dashboard&lembrada=4a0e1c&lento=1", DESKTOP);
  const v = await page.evaluate(() => document.documentElement.style.getPropertyValue("--sidebar-background"));
  ok(v === "346 68% 17%", `banco sem responder: já abre com a cor lembrada (--sidebar-background=${v})`);
  await ctx.close();
}
{
  const { ctx, page } = await abrir(BRANCH, "tela=dashboard&lembrada=4a0e1c", DESKTOP);
  const r = await page.evaluate(() => ({ style: document.documentElement.getAttribute("style"), local: localStorage.getItem("mecapp_cor_menu") }));
  ok(!r.style?.includes("--sidebar") && r.local === null, `banco sem cor: reconcilia para o padrão (style=${r.style}, local=${r.local})`);
  await ctx.close();
}

// ------------------------------------------------ 5) aba Cores: salvar / restaurar / Salvar Cores
console.log("\n== Aba Cores ==");
for (const [vp, sufixo] of [[DESKTOP, "desktop"], [CELULAR, "celular"]]) {
  const { ctx, page } = await abrir(BRANCH, "tela=cores&menu=4a0e1c&filial=1", vp);
  const cartao = page.locator("div.rounded-lg, div.rounded-xl").filter({ has: page.getByText("Cor do menu", { exact: true }) }).last();
  await page.getByText("Cor do menu", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await cartao.screenshot({ path: path.join(pasta, `aba-cores-${sufixo}.png`) });
  if (sufixo === "celular") {
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(largura <= 390, `celular sem rolagem horizontal (scrollWidth=${largura})`);
    await ctx.close();
    continue;
  }
  await page.getByRole("button", { name: "Azul", exact: true }).click();
  await page.getByRole("button", { name: "Salvar cor do menu" }).click();
  await page.waitForTimeout(800);
  let banco = await page.evaluate(() => window.__banco.configuracoes_loja.map((l) => ({ id: l.id, c: l.cores_personalizadas })));
  ok(banco[0].c.menu_cor === "#1d4ed8" && banco[0].c.recibo_cabecalho_cor === "#7f1d1d", `matriz: menu_cor=#1d4ed8 e recibo preservado ${JSON.stringify(banco[0].c)}`);
  ok(banco[1].c.menu_cor === "#1d4ed8" && banco[1].c.tracking_config?.cor_fundo === "#111111", `filial: menu_cor e tracking_config preservados ${JSON.stringify(banco[1].c)}`);
  const v = await page.evaluate(() => document.documentElement.style.getPropertyValue("--sidebar-background"));
  ok(v === "224 76% 48%", `menu mudou na hora (--sidebar-background=${v})`);
  ok(await page.getByText("Cor do menu salva!").first().isVisible(), "toast de sucesso");
  await page.screenshot({ path: path.join(pasta, "aba-cores-salva-azul.png") });

  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  await page.waitForTimeout(800);
  banco = await page.evaluate(() => window.__banco.configuracoes_loja.map((l) => l.cores_personalizadas));
  ok(!("menu_cor" in banco[0]) && banco[0].recibo_cabecalho_cor === "#7f1d1d", `restaurar: só menu_cor saiu da matriz ${JSON.stringify(banco[0])}`);
  ok(!("menu_cor" in banco[1]) && banco[1].tracking_config?.cor_fundo === "#111111", `restaurar: só menu_cor saiu da filial ${JSON.stringify(banco[1])}`);
  const s = await page.evaluate(() => document.documentElement.getAttribute("style") ?? "");
  ok(!s.includes("--sidebar"), "restaurar: variáveis --sidebar-* removidas do <html>");

  // "Salvar Cores" do primeiro cartão (estado carregado com a menu_cor velha) não pode trazê-la de volta
  await page.getByRole("button", { name: "Salvar Cores" }).click();
  await page.waitForTimeout(800);
  banco = await page.evaluate(() => window.__banco.configuracoes_loja.map((l) => l.cores_personalizadas));
  ok(!("menu_cor" in banco[0]) && !("menu_cor" in banco[1]), `Salvar Cores não regrava menu_cor velha ${JSON.stringify(banco[0])}`);
  ok(banco[0].primary_from && banco[0].recibo_cabecalho_cor === "#7f1d1d", "Salvar Cores grava as cores do app e mantém o recibo");
  await ctx.close();
}

await navegador.close();
console.log(`\n${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`} — capturas em ${pasta}`);
process.exit(falhas ? 1 : 0);
