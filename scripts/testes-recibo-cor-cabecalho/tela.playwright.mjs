// Cor do cabeçalho dos recibos: componentes REAIS na página de dev
// (dev/recibo-cor-cabecalho.html) com o Supabase simulado. Dados 100% fictícios;
// nada sai da máquina (fora do localhost = falha); as "gravações" (PATCH) só
// mudam a tabela em memória do teste.
//
//   npx vite --port 8211 --strictPort --host 127.0.0.1   (na árvore a testar; a main numa cópia, porta 8212)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-recibo-cor-cabecalho/tela.playwright.mjs coletar <rotulo> <pasta> [capturas]
//   node scripts/testes-recibo-cor-cabecalho/tela.playwright.mjs comparar <main.json> <branch.json>
//   PLAYWRIGHT_PATH=... node scripts/testes-recibo-cor-cabecalho/tela.playwright.mjs verificar <pasta> [capturas]   (só na branch)
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.map((f) => JSON.parse(readFileSync(f, "utf8")));
  const casos = Object.keys(a).sort();
  let dif = 0;
  for (const c of casos) {
    const iguais = c in b && a[c] === b[c];
    console.log(`${iguais ? "IGUAL    " : "DIFERENTE"} ${c}`);
    if (!iguais) dif++;
  }
  console.log(`${casos.length} casos, ${dif} diferente(s)`);
  process.exit(dif || !casos.length ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8211/dev/recibo-cor-cabecalho.html";

const DONO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const FUNC = { id: "00000000-0000-4000-8000-0000000000cc", email: "funcionario.teste@exemplo.test" };
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400;
const sessao = (u) => ({
  access_token: `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`,
  token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "refresh-ficticio",
  user: { id: u.id, email: u.email, aud: "authenticated", role: "authenticated" },
});

let falhas = 0;
const ok = (c, m, x) => { if (c) console.log("  ✓", m); else { falhas++; console.log("  ✗", m, x === undefined ? "" : JSON.stringify(x).slice(0, 700)); } };

function filtrar(linhas, params) {
  return linhas.filter((l) => [...params.entries()].every(([col, cond]) => {
    if (["select", "order", "limit", "offset"].includes(col)) return true;
    const v = l[col];
    if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
    if (cond === "is.null") return v == null;
    return true;
  }));
}
const projetar = (l, sel) => (!sel || sel === "*" ? l : Object.fromEntries(sel.split(",").map((c) => c.trim()).map((c) => [c, l[c] ?? null])));

/** Contexto com Supabase simulado. tabelas é mutável (PATCH grava nela). */
async function contexto(navegador, { usuario = DONO, tabelas = {}, erro500 = [], tela = "1280" } = {}) {
  const ctx = await navegador.newContext({
    ...(tela === "390" ? { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 900 } }),
    locale: "pt-BR", timezoneId: "America/Sao_Paulo",
  });
  const s = sessao(usuario);
  await ctx.addInitScript((x) => localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(x)), s);
  const estado = { escritas: [], externas: [], semMock: [], leituras: [] };
  await ctx.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "data:") return rota.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return rota.fulfill({ status: 200, json: s.user });
      if (url.pathname.startsWith("/auth/v1/token")) return rota.fulfill({ status: 200, json: s });
      const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
      if (!m) { estado.semMock.push(url.pathname); return rota.fulfill({ status: 404, json: {} }); }
      const t = m[1];
      if (erro500.includes(t)) return rota.fulfill({ status: 500, json: { message: "erro simulado" } });
      if (req.method() === "GET") {
        estado.leituras.push(`${t}?${url.searchParams.toString()}`);
        if (!(t in tabelas)) estado.semMock.push(t);
        const linhas = filtrar(tabelas[t] ?? [], url.searchParams).map((l) => projetar(l, url.searchParams.get("select")));
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? rota.fulfill({ status: 200, json: linhas[0] }) : rota.fulfill({ status: 406, json: { code: "PGRST116", message: "0 ou várias linhas" } });
        }
        return rota.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      if (req.method() === "PATCH" && t === "configuracoes_loja") {
        const corpo = JSON.parse(req.postData() ?? "{}");
        const alvo = filtrar(tabelas[t] ?? [], url.searchParams);
        estado.escritas.push({ filtro: url.searchParams.toString(), corpo, linhas: alvo.map((l) => l.id) });
        for (const l of alvo) Object.assign(l, corpo);
        return rota.fulfill({ status: 204, body: "" });
      }
      estado.escritas.push({ inesperada: `${req.method()} ${t}` });
      return rota.fulfill({ status: 404, json: {} });
    }
    estado.externas.push(url.href);
    return rota.abort();
  });
  return { ctx, estado };
}

const COR_ESCURA = "#7f1d1d";
const COR_CLARA = "#fde68a";
// Lojas "sem cor escolhida": todas têm de sair IGUAIS à main.
const SEM_COR = {
  "ausente": null,
  "nulo": "null",
  "vazio": "{}",
  "so-app-e-tracking": JSON.stringify({ primary_from: "#1e3a8a", primary_via: "#2563eb", primary_to: "#3b82f6", tracking_config: { mostrar_fotos: true } }),
  "invalida-texto": JSON.stringify({ recibo_cabecalho_cor: "azul" }),
  "invalida-curta": JSON.stringify({ recibo_cabecalho_cor: "#12" }),
  "invalida-numero": JSON.stringify({ recibo_cabecalho_cor: 123 }),
  "invalida-rgb": JSON.stringify({ recibo_cabecalho_cor: "rgb(0,0,0)" }),
  "invalida-lista": JSON.stringify([1, 2]),
};
const TELAS = [["os", ""], ["venda", "&cenario=item-unico"], ["venda", "&cenario=sem-redes"], ["venda", "&cenario=com-troca"], ["miniatura", ""]];

async function alvoHTML(pg, url) {
  await pg.goto(url, { waitUntil: "networkidle" });
  await pg.waitForSelector("#alvo");
  await pg.waitForTimeout(150);
  return pg.locator("#alvo").evaluate((el) => el.outerHTML);
}

const navegador = await chromium.launch();

/**
 * Impressão isolada: só o HTML do recibo (com o <style> dele) num documento
 * novo, sem o CSS do app — como a janela/iframe de impressão. Tela "print" + PDF A4.
 */
async function imprimirIsolado(html, arquivoBase) {
  const ctx = await navegador.newContext({ viewport: { width: 794, height: 1123 } });
  await ctx.route("**/*", (r) => (r.request().url().startsWith("data:") ? r.continue() : r.abort()));
  const pg = await ctx.newPage();
  await pg.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>`, { waitUntil: "load" });
  await pg.emulateMedia({ media: "print" });
  await pg.screenshot({ path: `${arquivoBase}-impressao.png`, fullPage: true });
  const pdf = await pg.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  writeFileSync(`${arquivoBase}.pdf`, pdf);
  await ctx.close();
  return pdf;
}

if (acao === "coletar") {
  const [rotulo, pasta, capt] = args;
  mkdirSync(pasta, { recursive: true });
  const saida = {};
  const { ctx, estado } = await contexto(navegador);
  const pg = await ctx.newPage();
  for (const [tela, extra] of TELAS) {
    for (const [nome, cores] of Object.entries(SEM_COR)) {
      const url = `${BASE}?tela=${tela}${extra}${cores === null ? "" : `&cores=${encodeURIComponent(cores)}`}`;
      saida[`${tela}${extra}|${nome}`] = await alvoHTML(pg, url);
    }
    // Impressão (print + PDF) do recibo sem cor, para comparar também o que sai na folha.
    if (capt === "capturas" && tela !== "miniatura") {
      const html = await alvoHTML(pg, `${BASE}?tela=${tela}${extra}&impressao=1`);
      await imprimirIsolado(html, path.join(pasta, `${rotulo}-${tela}${extra.replace(/[&=]/g, "-")}-padrao`));
    }
  }
  ok(!estado.externas.length, "nenhuma requisição externa", estado.externas);
  writeFileSync(path.join(pasta, `coleta-${rotulo}.json`), JSON.stringify(saida));
  console.log(`${Object.keys(saida).length} casos → ${path.join(pasta, `coleta-${rotulo}.json`)}`);
  await ctx.close();
}

if (acao === "verificar") {
  const [pasta, capt] = args;
  const CAPT = capt === "capturas";
  mkdirSync(pasta, { recursive: true });

  // ── 1. Recibos com cor: cabeçalho, contraste, destaque, impressão e PDF ──
  console.log("Recibos com cor escolhida");
  {
    const { ctx, estado } = await contexto(navegador);
    const pg = await ctx.newPage();
    const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
    for (const [nome, cor, textoEsperado] of [["escura", COR_ESCURA, "rgb(255, 255, 255)"], ["clara", COR_CLARA, "rgb(15, 23, 42)"], ["maiuscula", "#7F1D1D", "rgb(255, 255, 255)"]]) {
      const cores = encodeURIComponent(JSON.stringify({ recibo_cabecalho_cor: cor, tracking_config: { mostrar_fotos: true } }));
      // OS
      await pg.goto(`${BASE}?tela=os&cores=${cores}`, { waitUntil: "networkidle" });
      const os = await pg.evaluate(() => {
        const h = document.querySelector(".osr-header");
        const cs = getComputedStyle(h);
        return { bg: cs.backgroundImage, texto: getComputedStyle(document.querySelector(".osr-titulo")).color, numero: getComputedStyle(document.querySelector(".osr-numero")).color, estilos: document.querySelectorAll("#alvo style").length, printAdjust: cs.printColorAdjust ?? cs.webkitPrintColorAdjust };
      });
      ok(os.bg.includes(rgb(cor.toLowerCase())), `OS ${nome}: degradê começa na cor escolhida`, os.bg);
      ok(os.texto === textoEsperado, `OS ${nome}: título ${textoEsperado}`, os.texto);
      ok(os.numero !== "rgb(96, 165, 250)", `OS ${nome}: número não fica no azul claro fixo`, os.numero);
      ok(os.estilos === 2, `OS ${nome}: exatamente 1 <style> a mais`, os.estilos);
      ok(os.printAdjust === "exact", `OS ${nome}: print-color-adjust exact`, os.printAdjust);
      if (CAPT) {
        await pg.locator("#alvo").screenshot({ path: path.join(pasta, `os-${nome}-tela.png`) });
        await imprimirIsolado(await pg.locator("#alvo").evaluate((el) => el.outerHTML), path.join(pasta, `os-${nome}`));
      }
      // Venda
      await pg.goto(`${BASE}?tela=venda&cenario=item-unico&cores=${cores}`, { waitUntil: "networkidle" });
      const v = await pg.evaluate(() => {
        const h = document.querySelector(".rvn-cab");
        return {
          bg: getComputedStyle(h).backgroundImage, cor: getComputedStyle(h).color, attr: h.getAttribute("data-rvn-cor"),
          icone: getComputedStyle(document.querySelector(".rvn-cab .rvn-contato .rvn-icone")).color,
          onda: document.querySelector(".rvn-cab-curva path").getAttribute("fill"),
          titulo: getComputedStyle(document.querySelector(".rvn-titulo h1")).color,
          navy: getComputedStyle(document.querySelector(".rvn")).getPropertyValue("--rvn-navy").trim(),
          ultimoFilho: h.lastElementChild.tagName,
        };
      });
      ok(v.bg.includes(rgb(cor.toLowerCase())), `venda ${nome}: degradê começa na cor escolhida`, v.bg);
      ok(v.cor === textoEsperado, `venda ${nome}: texto do cabeçalho ${textoEsperado}`, v.cor);
      ok(v.icone !== "rgb(124, 196, 255)", `venda ${nome}: ícone de contato não fica no azul fixo`, v.icone);
      ok(v.onda !== "#2b6cf0", `venda ${nome}: onda acompanha a cor`, v.onda);
      ok(v.titulo === "rgb(11, 20, 41)" && v.navy === "#0b1429", `venda ${nome}: título do corpo e --rvn-navy intactos`, v);
      ok(v.ultimoFilho === "STYLE" && v.attr === cor.slice(1).toLowerCase(), `venda ${nome}: data-rvn-cor e <style> no fim do cabeçalho`, v);
      if (CAPT) {
        await pg.locator("#alvo").screenshot({ path: path.join(pasta, `venda-${nome}-tela.png`) });
        await imprimirIsolado(await alvoHTML(pg, `${BASE}?tela=venda&cenario=item-unico&impressao=1&cores=${cores}`), path.join(pasta, `venda-${nome}`));
        await pg.goto(`${BASE}?tela=miniatura&cores=${cores}`, { waitUntil: "networkidle" });
        await pg.locator("#alvo").screenshot({ path: path.join(pasta, `miniatura-${nome}.png`) });
      }
    }
    if (CAPT) {
      for (const [t, e] of [["os", ""], ["venda", "&cenario=item-unico"], ["miniatura", ""]]) {
        await pg.goto(`${BASE}?tela=${t}${e}`, { waitUntil: "networkidle" });
        await pg.locator("#alvo").screenshot({ path: path.join(pasta, `${t}-padrao-tela.png`) });
        if (t !== "miniatura") await imprimirIsolado(await alvoHTML(pg, `${BASE}?tela=${t}${e}&impressao=1`), path.join(pasta, `${t}-padrao`));
      }
    }
    ok(!estado.externas.length && !estado.escritas.length, "recibos: nada externo, nada gravado", estado);
    await ctx.close();
  }

  // ── 2. Funcionário usa a cor do dono; erro de leitura cai no azul ──
  console.log("Funcionário e erro de leitura (useConfiguracaoLoja real)");
  const linhaDono = (cores) => ({ id: "cfg-matriz", user_id: DONO.id, empresa_id: null, nome_loja: "Loja Exemplo", created_at: "2026-01-01T00:00:00Z", cores_personalizadas: cores });
  for (const [nome, opcoes, esperaCor] of [
    ["funcionário → cor do dono", { usuario: FUNC, tabelas: { loja_funcionarios: [{ funcionario_user_id: FUNC.id, loja_user_id: DONO.id, ativo: true }], configuracoes_loja: [linhaDono({ recibo_cabecalho_cor: COR_ESCURA })] } }, true],
    ["dono com cor", { tabelas: { loja_funcionarios: [], configuracoes_loja: [linhaDono({ recibo_cabecalho_cor: COR_ESCURA })] } }, true],
    ["erro 500 ao ler configuracoes_loja → azul", { tabelas: { loja_funcionarios: [] }, erro500: ["configuracoes_loja"] }, false],
    ["dono com cor inválida → azul", { tabelas: { loja_funcionarios: [], configuracoes_loja: [linhaDono({ recibo_cabecalho_cor: "#zzzzzz" })] } }, false],
  ]) {
    const { ctx, estado } = await contexto(navegador, opcoes);
    const pg = await ctx.newPage();
    const erros = [];
    pg.on("pageerror", (e) => erros.push(e.message));
    await pg.goto(`${BASE}?tela=os-sessao`, { waitUntil: "networkidle" });
    await pg.waitForSelector("#alvo", { timeout: 10000 }).catch(() => {});
    const r = await pg.evaluate(() => ({ alvo: !!document.querySelector("#alvo"), estilos: document.querySelectorAll("#alvo style").length, bg: document.querySelector(".osr-header") ? getComputedStyle(document.querySelector(".osr-header")).backgroundImage : null }));
    ok(r.alvo && !erros.length, `${nome}: recibo aparece sem erro`, { r, erros });
    ok(esperaCor ? r.estilos === 2 && r.bg.includes("rgb(127, 29, 29)") : r.estilos === 1 && r.bg.includes("rgb(10, 26, 63)"), `${nome}: ${esperaCor ? "cor escolhida" : "azul padrão"}`, r);
    ok(!estado.externas.length && !estado.escritas.length, `${nome}: nada externo, nada gravado`, estado);
    await ctx.close();
  }

  // ── 3. Tela de Configurações: gravação linha a linha ──
  console.log("Configurações → Cores (dono com matriz + filial)");
  const TRACK_M = { cor_fundo: "#000000", mostrar_fotos: true };
  const TRACK_F = { cor_fundo: "#111111" };
  const APP = { primary_from: "#064e3b", primary_via: "#059669", primary_to: "#10b981", card_faturamento_from: "#064e3b", card_faturamento_via: "#059669", card_faturamento_to: "#10b981" };
  const linhas = () => [
    { id: "cfg-matriz", user_id: DONO.id, empresa_id: null, cores_personalizadas: { ...APP, tracking_config: TRACK_M } },
    { id: "cfg-filial", user_id: DONO.id, empresa_id: "emp-1", cores_personalizadas: { tracking_config: TRACK_F } },
  ];
  {
    const tabelas = { configuracoes_loja: linhas() };
    const { ctx, estado } = await contexto(navegador, { tabelas });
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}?tela=config`, { waitUntil: "networkidle" });
    await pg.getByText("Cor do cabeçalho dos recibos").first().waitFor();
    if (CAPT) await pg.screenshot({ path: path.join(pasta, "config-1280-padrao.png"), fullPage: true });
    const secao = pg.locator("div.rounded-lg.border", { hasText: "Cor do cabeçalho dos recibos" }).last();
    // Escolhe a paleta "Vermelho Carmim" (primeira cor #991b1b) e salva.
    await secao.getByRole("button", { name: "Vermelho Carmim" }).click();
    await pg.waitForTimeout(300); // transição de 0,2 s do botão
    if (CAPT) await pg.screenshot({ path: path.join(pasta, "config-1280-escura.png"), fullPage: true });
    await secao.getByRole("button", { name: "Salvar cor dos recibos" }).click();
    await pg.waitForFunction(() => document.body.innerText.includes("Cor dos recibos salva!"), null, { timeout: 8000 }).catch(() => {});
    const [m, f] = tabelas.configuracoes_loja.map((l) => l.cores_personalizadas);
    ok(JSON.stringify(m) === JSON.stringify({ ...APP, tracking_config: TRACK_M, recibo_cabecalho_cor: "#991b1b" }), "salvar cor do recibo: matriz mantém cores do app e tracking_config", m);
    ok(JSON.stringify(f) === JSON.stringify({ tracking_config: TRACK_F, recibo_cabecalho_cor: "#991b1b" }), "salvar cor do recibo: filial mantém tracking_config", f);
    ok(estado.escritas.every((e) => /^id=eq\./.test(e.filtro)) && estado.escritas.length === 2, "gravou por id, uma vez em cada linha", estado.escritas);

    // Cor clara pelo código hex.
    estado.escritas.length = 0;
    await secao.getByLabel("Código da cor").fill("#FDE68A");
    await pg.waitForTimeout(300); // transição de 0,2 s do botão
    if (CAPT) await pg.screenshot({ path: path.join(pasta, "config-1280-clara.png"), fullPage: true });
    await secao.getByRole("button", { name: "Salvar cor dos recibos" }).click();
    await pg.waitForTimeout(800);
    ok(tabelas.configuracoes_loja.every((l) => l.cores_personalizadas.recibo_cabecalho_cor === "#fde68a"), "código hex em maiúsculas grava normalizado", tabelas.configuracoes_loja);
    // Código inválido: avisa e não habilita salvar outra coisa.
    await secao.getByLabel("Código da cor").fill("#12");
    ok(await secao.getByText("Use o formato #RRGGBB").isVisible(), "código inválido mostra o aviso");

    // Salvar cores do APP (outra paleta) não apaga a cor do recibo nem tracking_config.
    estado.escritas.length = 0;
    await pg.locator("button[title='Violeta']").first().click();
    await pg.getByRole("button", { name: "Salvar Cores" }).click();
    await pg.waitForTimeout(800);
    const [m2, f2] = tabelas.configuracoes_loja.map((l) => l.cores_personalizadas);
    ok(m2.recibo_cabecalho_cor === "#fde68a" && JSON.stringify(m2.tracking_config) === JSON.stringify(TRACK_M) && m2.primary_from === "#4c1d95", "salvar cores do app: matriz mantém recibo e tracking", m2);
    ok(f2.recibo_cabecalho_cor === "#fde68a" && JSON.stringify(f2.tracking_config) === JSON.stringify(TRACK_F) && f2.primary_from === "#4c1d95", "salvar cores do app: filial mantém recibo e tracking", f2);

    // Resetar cores do app: tira só as 6 chaves do app.
    await pg.getByRole("button", { name: "Resetar para Padrão" }).click();
    await pg.waitForTimeout(800);
    const [m3, f3] = tabelas.configuracoes_loja.map((l) => l.cores_personalizadas);
    ok(JSON.stringify(m3) === JSON.stringify({ tracking_config: TRACK_M, recibo_cabecalho_cor: "#fde68a" }), "resetar cores do app: matriz fica com tracking + recibo", m3);
    ok(JSON.stringify(f3) === JSON.stringify({ tracking_config: TRACK_F, recibo_cabecalho_cor: "#fde68a" }), "resetar cores do app: filial fica com tracking + recibo", f3);

    // Voltar ao azul padrão: REMOVE a chave (não grava azul) e mantém o resto.
    await secao.getByRole("button", { name: "Voltar ao azul padrão" }).click();
    await pg.waitForTimeout(800);
    const [m4, f4] = tabelas.configuracoes_loja.map((l) => l.cores_personalizadas);
    ok(JSON.stringify(m4) === JSON.stringify({ tracking_config: TRACK_M }) && JSON.stringify(f4) === JSON.stringify({ tracking_config: TRACK_F }), "voltar ao azul: remove só a chave do recibo", [m4, f4]);
    ok(!estado.externas.length && !estado.semMock.length, "config: nada externo, toda tabela simulada", estado);
    await ctx.close();
  }
  // Tela no celular, com cor escolhida já gravada (mostra a da matriz).
  {
    const t = { configuracoes_loja: [{ id: "cfg-matriz", user_id: DONO.id, empresa_id: null, cores_personalizadas: { recibo_cabecalho_cor: COR_ESCURA } }, { id: "cfg-filial", user_id: DONO.id, empresa_id: "emp-1", cores_personalizadas: { recibo_cabecalho_cor: "#000000" } }] };
    const { ctx } = await contexto(navegador, { tabelas: t, tela: "390" });
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}?tela=config`, { waitUntil: "networkidle" });
    await pg.getByText("Cor do cabeçalho dos recibos").first().waitFor();
    const previa = await pg.locator("[data-previa-cor]").getAttribute("data-previa-cor");
    ok(previa === COR_ESCURA, "com filial, a tela mostra a cor gravada na matriz", previa);
    const largura = await pg.evaluate(() => document.documentElement.scrollWidth);
    ok(largura <= 390, "390 px sem rolagem horizontal", largura);
    if (CAPT) await pg.screenshot({ path: path.join(pasta, "config-390-escura.png"), fullPage: true });
    await ctx.close();
  }
}

await navegador.close();
console.log(falhas ? `\n${falhas} falha(s)` : "\nOK: nenhuma falha");
process.exit(falhas ? 1 : 0);
