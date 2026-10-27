// Rolagem das listas de busca dentro do Dialog da OS, com o APP DE VERDADE
// (build de produção) e o Supabase simulado. Dados 100% fictícios; nada sai da
// máquina (o resto é bloqueado e registrado como falha).
//
//   npx vite build && npx vite preview --port 8331 --strictPort --host 127.0.0.1   (em cada árvore)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-os-lista-scroll/listas.playwright.mjs \
//     <rotulo> <base-url> <pasta-saida> [aparelhos-separados-por-vírgula]
//   node scripts/testes-os-lista-scroll/listas.playwright.mjs comparar <a.json> <b.json>
//
// Aparelhos: android (Pixel 5, toque), iphone (iPhone 13, toque), computador
// (1366x900, roda do mouse). Para cada lista (Marca, Produto/Peça, Serviço):
// abre, arrasta/rola, e anota se a LISTA rolou, se o FUNDO do Dialog rolou, se
// a lista continuou aberta e se o toque/clique no item visível selecionou.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.slice(0, 2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  let diferentes = 0;
  for (const caso of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const [va, vb] = [JSON.stringify(a[caso]), JSON.stringify(b[caso])];
    if (va === vb) console.log(`igual:     ${caso}`);
    else { diferentes++; console.log(`DIFERENTE: ${caso}\n  a ${va}\n  b ${vb}`); }
  }
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo = "x", base = "http://127.0.0.1:8331", saidaArg = "coleta-os-lista", soArg] = [acao, ...args];
const SAIDA = path.resolve(saidaArg);
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-27T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z" } };

const doisDig = (i) => String(i).padStart(2, "0");
function tabelas() {
  const comum = { user_id: USUARIO.id, deleted_at: null, empresa_id: null, created_at: "2026-02-01T12:00:00Z" };
  return {
    user_roles: [],
    profiles: [{ id: "p1", user_id: USUARIO.id, nome: "Loja Teste", email: USUARIO.email, celular: "11999990000", created_at: "2026-01-10T12:00:00Z", idioma: "pt-BR", mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo", preferencias_os: null }],
    assinaturas: [{
      id: "a1", user_id: USUARIO.id, plano_tipo: "profissional_ultra_mensal", status: "active", data_inicio: "2026-01-10T12:00:00Z",
      data_fim: "2026-12-10T12:00:00Z", data_proxima_cobranca: "2026-11-10T12:00:00Z", trial_with_card: false, payment_provider: "pagarme",
      created_at: "2026-01-10T12:00:00Z", updated_at: "2026-10-10T12:00:00Z", onboarding_completo: true, trial_canceled: false,
    }],
    configuracoes_loja: [{ id: "c1", user_id: USUARIO.id, nome_loja: "Loja Teste", cnpj: "00.000.000/0001-00", telefone: "11999990000", endereco: "Rua A, 1", logo_url: null, empresa_id: null }],
    user_onboarding: [{ user_id: USUARIO.id, completed: true, onboarding_completed: true, step: 99 }],
    produtos: Array.from({ length: 10 }, (_, i) => ({ ...comum, id: `prod-${doisDig(i)}`, nome: `Produto Teste ${doisDig(i)}`, preco: 10 + i, custo: 5, lucro: 5, quantidade: 3 })),
    pecas: Array.from({ length: 10 }, (_, i) => ({ ...comum, id: `peca-${doisDig(i)}`, nome: `Peça Teste ${doisDig(i)}`, preco: 20 + i, custo: 8, quantidade: 2 })),
    clientes: Array.from({ length: 16 }, (_, i) => ({ ...comum, id: `cli-${doisDig(i)}`, nome: `Cliente Ficticio ${doisDig(i)}`, cpf: null, telefone: `1199999${doisDig(i)}00` })),
    servicos: Array.from({ length: 18 }, (_, i) => ({ ...comum, id: `serv-${doisDig(i)}`, nome: `Serviço Teste ${doisDig(i)}`, preco: 50 + i, custo: 10, peca_id: null, pecas: null })),
  };
}

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

function filtrar(linhas, params) {
  return linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset", "on_conflict", "columns", "or"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
}

const APARELHOS = {
  android: { ...devices["Pixel 5"], toque: true },
  iphone: { ...devices["iPhone 13"], toque: true },
  computador: { viewport: { width: 1366, height: 900 }, toque: false },
};

async function abrir(navegador, aparelho, estado) {
  const { toque, defaultBrowserType, ...opcoes } = APARELHOS[aparelho];
  const ctx = await navegador.newContext({ ...opcoes, timezoneId: "America/Sao_Paulo", locale: "pt-BR", serviceWorkers: "block" });
  await ctx.clock.setFixedTime(AGORA);
  await ctx.addInitScript(({ sessao }) => {
    if (sessionStorage.getItem("__iniciado")) return;
    sessionStorage.setItem("__iniciado", "1");
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
  }, { sessao: SESSAO });
  // Sonda: wheel/touchmove que nascem na lista e se alguém chamou preventDefault.
  await ctx.addInitScript(() => {
    window.__eventos = [];
    for (const tipo of ["wheel", "touchmove"]) {
      window.addEventListener(tipo, (e) => {
        if (e.target instanceof Element && e.target.closest("[cmdk-list]")) window.__eventos.push(`${tipo}:${e.defaultPrevented ? "cancelado" : "livre"}`);
      }, { passive: false });
    }
  });
  await ctx.routeWebSocket(/supabase\.co/, () => { /* realtime: fica mudo */ });
  await ctx.route("**/*", async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (url.hostname === "127.0.0.1" || url.protocol === "data:") return r.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return r.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return r.fulfill({ status: 200, json: SESSAO });
      if (url.pathname.startsWith("/functions/v1/")) return r.fulfill({ status: 200, json: {} });
      if (/\/rest\/v1\/rpc\//.test(url.pathname)) return r.fulfill({ status: 200, json: null });
      const m = url.pathname.match(/\/rest\/v1\/([a-z_0-9]+)/);
      if (m) {
        if (req.method() !== "GET" && req.method() !== "HEAD") return r.fulfill({ status: 201, json: [] });
        const linhas = filtrar(estado.tabelas[m[1]] ?? [], url.searchParams);
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? r.fulfill({ status: 200, json: linhas[0] }) : r.fulfill({ status: 406, json: { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" } });
        }
        return r.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      return r.fulfill({ status: 404, json: {} });
    }
    return r.abort();
  });
  return { ctx, toque };
}

// Listas testadas: cmdk em portal (Popover) e a lista própria de sugestões de
// cliente (div absoluta dentro do Dialog).
const CMDK = { lista: "[data-radix-popper-content-wrapper] [cmdk-list]", item: "[cmdk-item]" };
const SUGESTAO_CLIENTE = { lista: "[role=dialog] div.absolute.z-50.overflow-y-auto", item: "button" };

// Estado de rolagem: lista aberta, corpo do Dialog.
const medir = (pg, tipo) => pg.evaluate((sel) => {
  const lista = document.querySelector(sel);
  const corpo = document.querySelector("[role=dialog] .flex-1.min-h-0.overflow-y-auto");
  return {
    aberta: !!lista,
    listaTopo: lista ? Math.round(lista.scrollTop) : null,
    listaCabe: lista ? lista.scrollHeight <= lista.clientHeight : null,
    listaEstilo: lista ? (() => { const s = getComputedStyle(lista); return `${s.overflowY}|${s.maxHeight}|${s.touchAction}|${s.overscrollBehaviorY}`; })() : null,
    corpoTopo: corpo ? Math.round(corpo.scrollTop) : null,
    janelaTopo: Math.round(window.scrollY),
  };
}, tipo.lista);

async function arrastar(pg, toque, alvo, sentido = 1) {
  const caixa = await alvo.boundingBox();
  const x = Math.round(caixa.x + caixa.width / 2);
  const y = Math.round(caixa.y + caixa.height * 0.75);
  if (toque) {
    // Gesto de toque de verdade (touchstart/touchmove/touchend + rolagem do compositor).
    const cdp = await pg.context().newCDPSession(pg);
    await cdp.send("Input.synthesizeScrollGesture", { x, y, yDistance: -sentido * Math.round(caixa.height * 0.5), gestureSourceType: "touch", speed: 600, repeatCount: 1 });
    await cdp.detach();
  } else {
    await pg.mouse.move(x, y);
    await pg.mouse.wheel(0, sentido * 240);
  }
  await pg.waitForTimeout(500);
}

async function testarLista(pg, toque, nome, abrirLista, saida, tipo = CMDK) {
  await abrirLista();
  const lista = pg.locator(tipo.lista).first();
  await lista.waitFor({ timeout: 10000 });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { window.__eventos = []; });
  const antes = await medir(pg, tipo);
  await pg.screenshot({ path: path.join(saida, `${nome}-1-aberta.png`) });
  await arrastar(pg, toque, lista);
  const depois = await medir(pg, tipo);
  const eventos = [...new Set(await pg.evaluate(() => window.__eventos))].sort();
  await pg.screenshot({ path: path.join(saida, `${nome}-2-depois-de-rolar.png`) });
  // De volta e além do topo (borda): nada atrás da lista pode rolar.
  await arrastar(pg, toque, lista, -1);
  await arrastar(pg, toque, lista, -1);
  const borda = await medir(pg, tipo);
  await arrastar(pg, toque, lista);
  // item visível mais abaixo: toque/clique nele seleciona e fecha
  const item = await pg.evaluate(({ lista: sl, item: si }) => {
    const l = document.querySelector(sl);
    if (!l) return null;
    const lr = l.getBoundingClientRect();
    const visiveis = [...l.querySelectorAll(si)].filter((i) => { const r = i.getBoundingClientRect(); return r.top >= lr.top && r.bottom <= lr.bottom; });
    const ultimo = visiveis.at(-1);
    return ultimo ? ultimo.textContent.trim() : null;
  }, tipo);
  if (item) {
    const loc = pg.locator(`${tipo.lista} ${tipo.item}`, { hasText: item }).first();
    if (toque) await loc.tap(); else await loc.click();
    await pg.waitForTimeout(500);
  }
  const fechou = !(await medir(pg, tipo)).aberta;
  return {
    antes, depois, eventos,
    listaRolou: (depois.listaTopo ?? 0) > (antes.listaTopo ?? 0),
    fundoRolou: depois.corpoTopo !== antes.corpoTopo || depois.janelaTopo !== antes.janelaTopo,
    voltouAoTopo: borda.listaTopo === 0,
    fundoRolouNaBorda: borda.corpoTopo !== antes.corpoTopo || borda.janelaTopo !== antes.janelaTopo,
    continuouAbertaNaBorda: borda.aberta,
    continuouAberta: depois.aberta,
    itemTocado: item,
    selecionouEFechou: fechou,
  };
}

const navegador = await chromium.launch();
const resultado = {};
const so = soArg?.split(",") ?? Object.keys(APARELHOS);

for (const aparelho of so) {
  const estado = { tabelas: tabelas() };
  const { ctx, toque } = await abrir(navegador, aparelho, estado);
  const pasta = path.join(SAIDA, `${rotulo}-${aparelho}`);
  mkdirSync(pasta, { recursive: true });
  try {
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => falhar(`[${aparelho}] erro na página: ${e.message}`));
    await pg.goto(`${base}/os`);
    await pg.waitForLoadState("networkidle");
    const nova = pg.getByRole("button", { name: "Nova OS" }).first();
    await nova.waitFor({ timeout: 30000 });
    await pg.waitForTimeout(1000);
    await nova.click();
    await pg.getByRole("menuitem", { name: /Completa/ }).click();
    const dialogo = pg.getByRole("dialog");
    await dialogo.waitFor();
    await pg.waitForTimeout(800);
    const proxima = () => dialogo.getByRole("button", { name: /Próxim|Avançar|Continuar/ }).last().click();

    const r = {};
    const registrar = (nome, v) => { r[nome] = v; console.log(`[${aparelho}] ${nome}: rolou=${v.listaRolou} fundo=${v.fundoRolou} aberta=${v.continuouAberta} topo=${v.voltouAoTopo} fundoBorda=${v.fundoRolouNaBorda} item=${v.itemTocado} selecionou=${v.selecionouEFechou} eventos=${v.eventos.join(",")}`); };

    // Etapa 1 (origem) → 2 (cliente): sugestões de cliente (lista própria, dentro do Dialog)
    await proxima();
    await pg.waitForTimeout(400);
    const nome = dialogo.locator("input[name^=clienteNome]");
    registrar("cliente", await testarLista(pg, toque, "cliente", async () => { await nome.click(); await nome.pressSequentially("Cliente", { delay: 30 }); }, pasta, SUGESTAO_CLIENTE));
    await proxima();
    await pg.waitForTimeout(600);
    // Etapa 3 (aparelho): Tipo (Select) → Marca (lista com busca)
    await dialogo.getByRole("combobox").filter({ hasText: "Selecione o tipo" }).click();
    await pg.getByRole("listbox").waitFor();
    await pg.keyboard.type("Celular", { delay: 40 });
    await pg.keyboard.press("Enter");
    await pg.waitForTimeout(400);
    registrar("marca", await testarLista(pg, toque, "marca", () => dialogo.getByRole("combobox").filter({ hasText: /marca/i }).first().click(), pasta));
    const modelo = dialogo.locator("#dispositivoModelo");
    if ((await modelo.evaluate((el) => el.tagName)) === "BUTTON") registrar("modelo", await testarLista(pg, toque, "modelo", () => modelo.click(), pasta));
    else await modelo.fill("Modelo Ficticio");
    await proxima();
    await pg.waitForTimeout(600);
    // Etapa 4 (informações) → 5 (checklist) → 6 (serviços, produtos e peças)
    await dialogo.locator("#defeitoRelatado").fill("Não liga");
    await proxima();
    await pg.waitForTimeout(600);
    await proxima();
    await pg.waitForTimeout(800);
    registrar("servico", await testarLista(pg, toque, "servico", () => dialogo.getByRole("combobox").filter({ hasText: "buscar serviço" }).click(), pasta));
    await pg.waitForTimeout(400);
    registrar("produto", await testarLista(pg, toque, "produto", () => dialogo.getByRole("combobox").filter({ hasText: "buscar produto" }).click(), pasta));
    if (!toque) {
      // Computador: outras formas de rolar a lista (setas do teclado e arrastar a barra de rolagem).
      const gatilho = dialogo.getByRole("combobox").filter({ hasText: "buscar produto" });
      await gatilho.click();
      const lista = pg.locator(CMDK.lista);
      await lista.waitFor();
      for (let i = 0; i < 12; i++) await pg.keyboard.press("ArrowDown");
      await pg.waitForTimeout(300);
      const teclado = (await medir(pg, CMDK)).listaTopo;
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(400);
      await gatilho.click();
      await lista.waitFor();
      await pg.waitForTimeout(300);
      const cx = await lista.boundingBox();
      await pg.mouse.move(cx.x + cx.width - 3, cx.y + 15);
      await pg.mouse.down();
      await pg.mouse.move(cx.x + cx.width - 3, cx.y + 120, { steps: 8 });
      await pg.mouse.up();
      await pg.waitForTimeout(300);
      const barra = (await medir(pg, CMDK)).listaTopo;
      await pg.screenshot({ path: path.join(pasta, "produto-3-barra-de-rolagem.png") });
      await pg.keyboard.press("Escape");
      r.computadorOutrasFormas = { tecladoTopo: teclado, barraTopo: barra };
      console.log(`[${aparelho}] outras formas: ${JSON.stringify(r.computadorOutrasFormas)}`);
    }
    resultado[aparelho] = r;
  } catch (e) {
    falhar(`[${aparelho}] ${e.message.split("\n")[0]}`);
    try { await ctx.pages()[0].screenshot({ path: path.join(pasta, "erro.png") }); } catch { /* sem página */ }
  } finally {
    await ctx.close();
  }
}

await navegador.close();
writeFileSync(path.join(SAIDA, `coleta-${rotulo}.json`), JSON.stringify(resultado, null, 1));
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
