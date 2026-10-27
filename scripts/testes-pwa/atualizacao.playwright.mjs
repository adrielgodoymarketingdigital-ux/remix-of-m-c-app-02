// Aviso de versão nova do app (PWA) com o APP DE VERDADE (build de produção),
// o service worker ligado e o Supabase simulado. Dados 100% fictícios; nada
// sai da máquina (o resto é bloqueado).
//
// Um servidor local imita a Vercel (arquivo inexistente → index.html com 200)
// e "publica" uma versão nova mudando o conteúdo do /sw.js.
//
//   npx vite build   (em cada árvore)
//   PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 PLAYWRIGHT_PATH=<.../node_modules/playwright> \
//     node scripts/testes-pwa/atualizacao.playwright.mjs <dist> <pasta-saida> [branch|main]
//
// "main" roda só o caso da saída do app (para provar que a main recarrega) e o
// de requisições sem versão nova (para comparar com a branch).
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [distArg, saidaArg, modo = "branch"] = process.argv.slice(2);
const DIST = path.resolve(distArg ?? "dist");
const SAIDA = path.resolve(saidaArg ?? "coleta-pwa");
mkdirSync(SAIDA, { recursive: true });

// ---------- servidor ----------
let versao = 1;
const TIPOS = { ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const servidor = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let arquivo = path.join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname === "/sw.js") {
    const corpo = readFileSync(path.join(DIST, "sw.js"), "utf8") + (versao > 1 ? `\n// versao-${versao}\n` : "");
    res.writeHead(200, { "content-type": TIPOS[".js"], "cache-control": "public, max-age=0, must-revalidate" });
    return res.end(corpo);
  }
  if (!existsSync(arquivo) || statSync(arquivo).isDirectory()) arquivo = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": TIPOS[path.extname(arquivo)] ?? "application/octet-stream" });
  res.end(readFileSync(arquivo));
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

// ---------- Supabase simulado (mesmo modelo de scripts/testes-i18n/modulo1.playwright.mjs) ----------
const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-26T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z", user_metadata: { full_name: "Ana Loja Teste" } } };

const TELAS = {
  computador: { viewport: { width: 1366, height: 900 } },
  celular: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } },
};

const tabelas = () => ({
  user_roles: [],
  profiles: [{ id: USUARIO.id, user_id: USUARIO.id, nome: "Ana Loja Teste", email: USUARIO.email, celular: "11999990000", created_at: "2026-01-10T12:00:00Z", idioma: "pt-BR", mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo", preferencias_os: null }],
  assinaturas: [{ id: "a1", user_id: USUARIO.id, plano_tipo: "profissional_ultra_mensal", status: "active", data_inicio: "2026-01-10T12:00:00Z", data_fim: "2026-11-10T12:00:00Z", data_proxima_cobranca: "2026-11-10T12:00:00Z", trial_with_card: false, payment_provider: "pagarme", created_at: "2026-01-10T12:00:00Z", updated_at: "2026-10-10T12:00:00Z", onboarding_completo: true, trial_canceled: false }],
  configuracoes_loja: [{ id: "c1", user_id: USUARIO.id, nome_loja: "Loja Teste", cnpj: "00.000.000/0001-00", telefone: "11999990000", endereco: "Rua A, 1", logo_url: null, empresa_id: null, cidade: "São Paulo", estado: "SP", cep: "01000-000", created_at: "2026-01-10T12:00:00Z" }],
  user_onboarding: [{ user_id: USUARIO.id, completed: true, onboarding_completed: true, onboarding_obrigatorio_completed: true, step: 99 }],
  produtos: [{ id: "p1", user_id: USUARIO.id, nome: "Capinha Teste", preco: 50, custo: 10, quantidade: 10, deleted_at: null, created_at: "2026-10-01T12:00:00Z" }],
  ordens_servico: [{ id: "o1", user_id: USUARIO.id, numero_os: "101", total: 350, status: "entregue", is_teste: false, deleted_at: null, created_at: "2026-10-25T13:00:00Z", avarias: {} }],
});

function filtrar(linhas, params) {
  return linhas.filter((l) => [...params.entries()].every(([col, cond]) => {
    if (["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"].includes(col) || !(col in l)) return true;
    const v = l[col];
    if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
    if (cond === "is.null") return v == null;
    return true;
  }));
}

const semHash = (p) => p.replace(/-[A-Za-z0-9_-]{8}(\.(js|css))$/, "$1");

async function abrirContexto(navegador, tela, reqs) {
  const ctx = await navegador.newContext({ ...TELAS[tela], timezoneId: "America/Sao_Paulo", locale: "pt-BR", serviceWorkers: "allow" });
  await ctx.clock.install({ time: AGORA });
  await ctx.addInitScript(({ sessao }) => {
    if (localStorage.getItem("__iniciado")) return;
    localStorage.setItem("__iniciado", "1");
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
    localStorage.setItem("mec_notif_banner_dismissed", "true");
    // "Instalar app" só aparece fora do app instalado; aqui o usuário já recusou.
    localStorage.setItem("pwa-install-declined", new Date().toISOString());
  }, { sessao: SESSAO });
  const dados = tabelas();
  await ctx.routeWebSocket(/supabase\.co/, () => {});
  await ctx.route("**/*", async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (url.hostname === "127.0.0.1") {
      reqs?.push(`${req.method()} ${semHash(url.pathname)}`);
      return r.continue();
    }
    if (url.protocol === "data:") return r.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      reqs?.push(`${req.method()} supabase ${url.pathname.replace(/^\/rest\/v1\//, "")}`);
      if (url.pathname.startsWith("/auth/v1/user")) return r.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return r.fulfill({ status: 200, json: SESSAO });
      if (url.pathname.startsWith("/functions/v1/") || url.pathname.startsWith("/rest/v1/rpc/")) return r.fulfill({ status: 200, json: null });
      if (url.pathname.startsWith("/storage/v1/")) return r.fulfill({ status: 200, json: [] });
      const m = url.pathname.match(/\/rest\/v1\/([a-z_0-9]+)/);
      if (m) {
        if (req.method() === "PATCH") return r.fulfill({ status: 204, body: "" });
        if (req.method() !== "GET" && req.method() !== "HEAD") return r.fulfill({ status: 201, json: [] });
        const linhas = filtrar(dados[m[1]] ?? [], url.searchParams);
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? r.fulfill({ status: 200, json: linhas[0] }) : r.fulfill({ status: 406, json: { code: "PGRST116", message: "0 rows" } });
        }
        return r.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      return r.fulfill({ status: 404, json: {} });
    }
    return r.abort();
  });
  return ctx;
}

const resultados = [];
const registrar = (nome, ok, detalhe = "") => {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "OK   " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

// Faixa (celular, no fluxo da página) e flutuante (computador): só um aparece por tela.
const AVISO = "[data-aviso-nova-versao] >> visible=true";
const avisoVisivel = async (pg) => (await pg.locator(AVISO).count()) === 1;

async function assentar(pg) {
  await pg.waitForLoadState("networkidle").catch(() => {});
  await pg.waitForTimeout(1200);
}

// Abre a rota já controlada pelo SW (1ª visita instala; a 2ª é a do dia a dia).
async function abrirControlada(ctx, rota) {
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}${rota}`);
  await pg.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 60000 });
  await pg.reload();
  await assentar(pg);
  await pg.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await pg.evaluate(() => { window.__marcador = "pagina-original"; });
  return pg;
}

// "Volta ao app": o código do app escuta visibilitychange.
const voltarAoApp = (pg) => pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

// Usuário sai do app (WhatsApp, câmera...): visibilityState vira "hidden".
const sairDoApp = (pg) => pg.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new Event("visibilitychange"));
});

async function publicarEsperar(pg) {
  versao++;
  await voltarAoApp(pg);
  await pg.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting), null, { timeout: 90000 });
}

// Elementos fixos visíveis que o aviso cobre (menu de baixo, botões flutuantes...).
const sobreposicoes = (pg) => pg.evaluate((sel) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0);
  if (!el) return [];
  const aviso = el.getBoundingClientRect();
  const cobre = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(sel)) continue;
    const s = getComputedStyle(el);
    if (s.position !== "fixed" || s.visibility === "hidden" || s.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || (!el.childElementCount && !el.textContent.trim())) continue;
    if (r.left < aviso.right && r.right > aviso.left && r.top < aviso.bottom && r.bottom > aviso.top) cobre.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
  }
  return cobre;
}, "[data-aviso-nova-versao]");

const navegador = await chromium.launch();

async function casoSaidaDoApp(tela) {
  const ctx = await abrirContexto(navegador, tela);
  const pg = await abrirControlada(ctx, "/dashboard");
  await publicarEsperar(pg);
  await pg.waitForTimeout(1500);
  await sairDoApp(pg);
  await pg.waitForTimeout(5000);
  const marcador = await pg.evaluate(() => window.__marcador ?? null).catch(() => null);
  await ctx.close();
  return marcador === "pagina-original";
}

if (modo === "main") {
  for (const tela of ["celular", "computador"]) {
    const manteve = await casoSaidaDoApp(tela);
    registrar(`[main] ${tela}: sair do app com versão pendente`, true, manteve ? "NÃO recarregou" : "RECARREGOU a página (o que não foi salvo se perde)");
  }
}

for (const tela of ["celular", "computador"]) {
  // 1. Sem versão nova: nada aparece; requisições registradas para comparar main × branch.
  {
    const reqs = [];
    const ctx = await abrirContexto(navegador, tela, reqs);
    const pg = await abrirControlada(ctx, "/dashboard");
    reqs.length = 0;
    await pg.reload();
    await assentar(pg);
    await voltarAoApp(pg);
    await pg.waitForTimeout(3000);
    writeFileSync(path.join(SAIDA, `reqs-${modo}-${tela}.json`), JSON.stringify(reqs.sort(), null, 1));
    writeFileSync(path.join(SAIDA, `html-${modo}-${tela}.html`), await pg.evaluate(() => document.body.innerHTML));
    if (modo === "branch") registrar(`${tela}: sem versão nova, sem aviso`, (await pg.locator("[data-aviso-nova-versao]").count()) === 0);
    await ctx.close();
  }
  if (modo === "main") continue;

  // 2. Versão nova: aviso aparece ao voltar ao app, sem cobrir nada fixo.
  const ctx = await abrirContexto(navegador, tela);
  const pg = await abrirControlada(ctx, "/dashboard");
  await publicarEsperar(pg);
  await pg.locator(AVISO).waitFor({ timeout: 10000 }).catch(() => {});
  registrar(`${tela}: versão nova → aviso aparece`, await avisoVisivel(pg));
  await pg.screenshot({ path: path.join(SAIDA, `${tela}-1-aviso.png`) });
  const cobre = await sobreposicoes(pg);
  registrar(`${tela}: aviso não cobre elementos fixos`, cobre.length === 0, cobre.join(" | "));

  // 3. Sair do app com versão pendente: NÃO recarrega (antes recarregava).
  await sairDoApp(pg);
  await pg.waitForTimeout(5000);
  registrar(`${tela}: sair do app com versão pendente não recarrega`, (await pg.evaluate(() => window.__marcador)) === "pagina-original");
  await pg.evaluate(() => {
    delete document.visibilityState;
    delete document.hidden;
  });

  // 4. Diálogo aberto. Computador: o aviso flutuante some e volta ao fechar.
  //    Celular: a faixa fica no fluxo da página, e o diálogo fica POR CIMA dela.
  if (tela === "celular") {
    await pg.locator("nav.fixed button").last().click(); // gaveta do menu
  } else {
    await pg.evaluate(() => { window.history.pushState({}, "", "/os"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await assentar(pg);
    await pg.getByRole("button", { name: /Nova OS/i }).first().click();
    await pg.getByRole("menuitem", { name: "Completa" }).click();
  }
  await pg.waitForTimeout(1200);
  const dialogoAberto = await pg.locator('[role="dialog"][data-state="open"]').count();
  await pg.screenshot({ path: path.join(SAIDA, `${tela}-2-dialogo.png`) });
  if (tela === "celular") {
    const porCima = await pg.evaluate(() => {
      const faixa = [...document.querySelectorAll("[data-aviso-nova-versao]")].find((e) => e.getBoundingClientRect().width > 0);
      if (!faixa) return "sem faixa";
      const r = faixa.getBoundingClientRect();
      const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return faixa.contains(topo) ? "faixa por cima do diálogo" : "diálogo por cima";
    });
    registrar(`${tela}: com diálogo aberto o diálogo fica por cima do aviso`, dialogoAberto > 0 && porCima !== "faixa por cima do diálogo", `${porCima}; diálogos: ${dialogoAberto}`);
  } else {
    registrar(`${tela}: com diálogo aberto o aviso some`, dialogoAberto > 0 && !(await avisoVisivel(pg)), `diálogos abertos: ${dialogoAberto}`);
  }
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(1200);
  if (await pg.locator('[role="alertdialog"]').count()) {
    // "Descartar OS?" ao fechar o assistente
    await pg.locator('[role="alertdialog"] button').last().click();
    await pg.waitForTimeout(1000);
  }
  registrar(`${tela}: fechou o diálogo, aviso visível`, await avisoVisivel(pg));

  // 5. "Depois": some; volta depois de 1 hora.
  await pg.getByRole("button", { name: "Depois" }).click();
  await pg.waitForTimeout(500);
  registrar(`${tela}: "Depois" esconde o aviso`, !(await avisoVisivel(pg)));
  await ctx.clock.fastForward("00:59:00");
  await pg.waitForTimeout(500);
  const aos59 = await avisoVisivel(pg);
  await ctx.clock.fastForward("00:02:00");
  await pg.waitForTimeout(800);
  registrar(`${tela}: aviso volta só depois de 1 h`, !aos59 && (await avisoVisivel(pg)));

  // 6. Duas abas (computador): "Atualizar agora" numa recarrega só ela; a outra não perde nada.
  let outra = null;
  if (tela === "computador") {
    outra = await ctx.newPage();
    await outra.goto(`${BASE}/dashboard`);
    await assentar(outra);
    await outra.evaluate(() => { window.__marcador = "outra-aba"; });
  }

  // 7. "Atualizar agora": ativa a versão e recarrega.
  await Promise.all([
    pg.waitForEvent("framenavigated", { timeout: 15000 }),
    pg.getByRole("button", { name: "Atualizar agora" }).click(),
  ]);
  await assentar(pg);
  const depois = await pg.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { marcador: window.__marcador ?? null, esperando: Boolean(reg?.waiting), controlada: Boolean(navigator.serviceWorker.controller) };
  });
  registrar(`${tela}: "Atualizar agora" aplica e recarrega`, depois.marcador === null && !depois.esperando && depois.controlada, JSON.stringify(depois));
  registrar(`${tela}: depois de atualizar, sem aviso`, !(await avisoVisivel(pg)));
  await pg.screenshot({ path: path.join(SAIDA, `${tela}-3-atualizado.png`) });

  if (outra) {
    await outra.waitForTimeout(2000);
    const m = await outra.evaluate(() => window.__marcador ?? null);
    registrar(`${tela}: a outra aba não recarregou e mostra o aviso`, m === "outra-aba" && (await avisoVisivel(outra)));
    await outra.screenshot({ path: path.join(SAIDA, `${tela}-4-outra-aba.png`) });
  }

  // 8. Arquivo do app que não carrega (publicação nova apagou): procura a versão e avisa.
  {
    const pg2 = await ctx.newPage();
    await pg2.goto(`${BASE}/dashboard`);
    await assentar(pg2);
    versao++;
    await pg2.evaluate(() => window.dispatchEvent(new Event("vite:preloadError")));
    await pg2.locator(AVISO).waitFor({ timeout: 90000 }).catch(() => {});
    registrar(`${tela}: falha de arquivo (vite:preloadError) → aviso`, await avisoVisivel(pg2));

    // 9. Página pública (landing) com versão pendente: sem aviso.
    await pg2.evaluate(() => { window.history.pushState({}, "", "/acompanhar/xyz"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await pg2.waitForTimeout(1500);
    registrar(`${tela}: página pública sem aviso`, !(await avisoVisivel(pg2)));
  }
  await ctx.close();
}

// 10. PDV (celular): aviso no topo, no fluxo; rolando até o fim, "Finalizar Venda" livre.
if (modo === "branch") {
  const ctx = await abrirContexto(navegador, "celular");
  const pg = await abrirControlada(ctx, "/pdv");
  await publicarEsperar(pg);
  await pg.locator(AVISO).waitFor({ timeout: 10000 }).catch(() => {});
  await pg.screenshot({ path: path.join(SAIDA, "celular-5-pdv-topo.png") });
  const posicao = await pg.evaluate(() => getComputedStyle([...document.querySelectorAll("[data-aviso-nova-versao]")].find((e) => e.getBoundingClientRect().width > 0)).position);
  registrar("celular PDV: aviso aparece, no fluxo da página (não flutua)", (await avisoVisivel(pg)) && posicao === "static", `position: ${posicao}`);
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.waitForTimeout(800);
  const finalizar = await pg.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Finalizar Venda");
    if (!b) return "sem botão";
    // Comparação de caixas: o botão fica desabilitado (caixa fechado) e não recebe toque.
    const r = b.getBoundingClientRect();
    const fixos = [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).position === "fixed" && e.getBoundingClientRect().width > 0);
    const cobre = fixos.filter((e) => { const f = e.getBoundingClientRect(); return f.left < r.right && f.right > r.left && f.top < r.bottom && f.bottom > r.top; });
    const aviso = [...document.querySelectorAll("[data-aviso-nova-versao]")].find((e) => e.getBoundingClientRect().width > 0)?.getBoundingClientRect();
    const sobAviso = aviso && aviso.left < r.right && aviso.right > r.left && aviso.top < r.bottom && aviso.bottom > r.top;
    return !sobAviso && !cobre.length ? "livre" : `coberto (${sobAviso ? "aviso" : cobre.map((e) => e.tagName).join(",")})`;
  });
  await pg.screenshot({ path: path.join(SAIDA, "celular-6-pdv-fim.png") });
  registrar("celular PDV: \"Finalizar Venda\" não fica coberto", finalizar === "livre", finalizar);
  await ctx.close();
}

await navegador.close();
servidor.close();
writeFileSync(path.join(SAIDA, `resultado-${modo}.json`), JSON.stringify(resultados, null, 1));
const falhas = resultados.filter((r) => !r.ok).length;
console.log(falhas ? `${falhas} falha(s)` : "OK: nenhuma falha");
process.exit(falhas ? 1 : 0);
