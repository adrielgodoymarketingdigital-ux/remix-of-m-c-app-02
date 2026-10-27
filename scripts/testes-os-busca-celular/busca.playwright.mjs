// Busca das listas do Dialog da OS (cliente, Marca, Modelo, Cor, Serviço e
// Produto/Peça) no celular e no computador, com o APP DE VERDADE (build de
// produção) e o Supabase simulado. Dados 100% fictícios; nada sai da máquina.
//
//   npx vite build && npx vite preview --port 8331 --strictPort --host 127.0.0.1
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-os-busca-celular/busca.playwright.mjs \
//     <rotulo> <base-url> <pasta-saida> [aparelhos-separados-por-vírgula]
//   node scripts/testes-os-busca-celular/busca.playwright.mjs comparar <a.json> <b.json>
//
// Formas de digitar:
//   teclado      page.keyboard.type (teclas físicas: keydown/keypress/input/keyup)
//   ime          teclado do Android: cada palavra é composta letra a letra
//                (compositionstart/update + input com isComposing) e confirmada
//   ime-aberta   a última palavra fica em composição, sem confirmar (Gboard com
//                a palavra sublinhada enquanto a pessoa olha a lista)
//   ime-sugestao cada palavra confirmada pela barra de sugestões (vem com espaço no fim)
// Para cada termo anota o texto do campo, se a lista continuou aberta, quantos
// itens sobraram e se o item esperado apareceu.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.slice(0, 2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  let diferentes = 0;
  let total = 0;
  const casos = (x) => Object.entries(x).flatMap(([ap, listas]) => Object.entries(listas).flatMap(([l, modos]) =>
    Object.entries(modos).flatMap(([m, termos]) => Object.keys(termos).map((t) => `${ap}|${l}|${m}|${t}`))));
  for (const caso of [...new Set([...casos(a), ...casos(b)])].sort()) {
    const [ap, l, m, t] = caso.split("|");
    const [va, vb] = [a, b].map((x) => JSON.stringify(x[ap]?.[l]?.[m]?.[t]));
    total++;
    if (va !== vb) { diferentes++; console.log(`DIFERENTE: ${caso}\n  a ${va}\n  b ${vb}`); }
  }
  console.log(`${total} caso(s), ${diferentes} diferente(s)`);
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo = "x", base = "http://127.0.0.1:8331", saidaArg = "coleta-os-busca", soArg] = [acao, ...args];
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
  const produto = (id, nome, preco) => ({ ...comum, id, nome, preco, custo: 5, lucro: 5, quantidade: 3 });
  const peca = (id, nome, preco) => ({ ...comum, id, nome, preco, custo: 8, quantidade: 2 });
  const servico = (id, nome, preco) => ({ ...comum, id, nome, preco, custo: 10, peca_id: null, pecas: null });
  const cliente = (id, nome) => ({ ...comum, id, nome, cpf: null, telefone: "11999990000" });
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
    produtos: [
      produto("prod-tela", "Tela iPhone 11 Incell", 180),
      produto("prod-bat", "Bateria Samsung A10", 90),
      produto("prod-pel", "Película 3D Galaxy A12", 25),
      produto("prod-cabo", "Cabo USB-C", 30),
      ...Array.from({ length: 10 }, (_, i) => produto(`prod-${doisDig(i)}`, `Produto Teste ${doisDig(i)}`, 10 + i)),
    ],
    pecas: [
      peca("peca-cam", "Câmera Traseira iPhone 11", 150),
      peca("peca-con", "Conector de Carga Moto G8", 40),
      peca("peca-tela", "Tela Galaxy A10 Original", 220),
      ...Array.from({ length: 10 }, (_, i) => peca(`peca-${doisDig(i)}`, `Peça Teste ${doisDig(i)}`, 20 + i)),
    ],
    clientes: [
      cliente("cli-maria", "Maria Silva"),
      cliente("cli-joao", "João Pereira"),
      cliente("cli-jose", "José da Silva"),
      ...Array.from({ length: 6 }, (_, i) => cliente(`cli-${doisDig(i)}`, `Cliente Ficticio ${doisDig(i)}`)),
    ],
    servicos: [
      servico("serv-tela", "Troca de Tela", 250),
      servico("serv-limp", "Limpeza Técnica", 80),
      servico("serv-bat", "Troca de Bateria", 150),
      ...Array.from({ length: 12 }, (_, i) => servico(`serv-${doisDig(i)}`, `Serviço Teste ${doisDig(i)}`, 50 + i)),
    ],
  };
}

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

// ilike do PostgREST: sem diferença de maiúscula, COM diferença de acento (como o Postgres).
const ilike = (v, padrao) => {
  const re = new RegExp(`^${padrao.split("%").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "is");
  return re.test(String(v ?? ""));
};
function filtrar(linhas, params) {
  const filtradas = linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset", "on_conflict", "columns", "or"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("ilike.")) return ilike(v, cond.slice(6));
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
  const limite = Number(params.get("limit"));
  return limite ? filtradas.slice(0, limite) : filtradas;
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
  // Sonda dos eventos que chegam no campo de busca (prova de que a composição aconteceu).
  await ctx.addInitScript(() => {
    window.__eventosCampo = [];
    for (const tipo of ["keydown", "compositionstart", "compositionend", "input"]) {
      window.addEventListener(tipo, (e) => {
        if (e.target instanceof HTMLInputElement) window.__eventosCampo.push(tipo === "input" && e.isComposing ? "input(compondo)" : tipo);
      }, true);
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

const CMDK = { lista: "[data-radix-popper-content-wrapper] [cmdk-list]", item: "[cmdk-item]", campo: "[data-radix-popper-content-wrapper] [cmdk-input]" };
const SUGESTAO_CLIENTE = { lista: "[role=dialog] div.absolute.z-50.overflow-y-auto", item: "button", campo: "[role=dialog] input[name^=clienteNome]" };

const MODOS = ["teclado", "ime", "ime-aberta", "ime-sugestao"];

async function compor(cdp, palavra) {
  for (let i = 1; i <= palavra.length; i++) {
    const parcial = palavra.slice(0, i);
    await cdp.send("Input.imeSetComposition", { text: parcial, selectionStart: parcial.length, selectionEnd: parcial.length });
    await new Promise((r) => setTimeout(r, 35));
  }
}

async function digitar(pg, modo, texto) {
  if (modo === "teclado") return pg.keyboard.type(texto, { delay: 40 });
  const cdp = await pg.context().newCDPSession(pg);
  const palavras = texto.split(" ");
  for (const [i, palavra] of palavras.entries()) {
    const ultima = i === palavras.length - 1;
    await compor(cdp, palavra);
    if (modo === "ime-aberta" && ultima) break; // fica sublinhada, sem confirmar
    await cdp.send("Input.insertText", { text: modo === "ime-sugestao" ? `${palavra} ` : palavra });
    if (modo !== "ime-sugestao" && !ultima) await cdp.send("Input.insertText", { text: " " });
  }
  await cdp.detach();
}

const medir = (pg, tipo) => pg.evaluate(({ lista: sl, item: si, campo: sc }) => {
  const lista = document.querySelector(sl);
  const campo = document.querySelector(sc);
  const itens = lista ? [...lista.querySelectorAll(si)].map((i) => i.textContent.replace(/\s+/g, " ").trim()) : [];
  return { aberta: !!lista, valor: campo?.value ?? null, focado: document.activeElement === campo, itens };
}, tipo);

const sem = (s) => s.toLowerCase();

// Abre a lista uma vez e testa cada termo em cada forma de digitar, limpando o campo entre eles.
async function testarBusca(pg, toque, nome, abrirLista, termos, saida, tipo = CMDK, { rolarAntes = false } = {}) {
  const r = {};
  await abrirLista();
  await pg.locator(tipo.campo).first().waitFor({ timeout: 10000 });
  await pg.waitForTimeout(400);
  if (rolarAntes) {
    const lista = pg.locator(tipo.lista).first();
    const caixa = await lista.boundingBox();
    const cdp = await pg.context().newCDPSession(pg);
    await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(caixa.x + caixa.width / 2), y: Math.round(caixa.y + caixa.height * 0.75), yDistance: -Math.round(caixa.height * 0.5), gestureSourceType: "touch", speed: 600 });
    await cdp.detach();
    await pg.waitForTimeout(500);
  }
  for (const modo of MODOS) {
    r[modo] = {};
    for (const [termo, esperado] of termos) {
      const campo = pg.locator(tipo.campo).first();
      if (!(await campo.isVisible())) { await abrirLista(); await campo.waitFor({ timeout: 5000 }); }
      if (toque) await campo.tap(); else await campo.click();
      await campo.fill("");
      await pg.waitForTimeout(tipo === SUGESTAO_CLIENTE ? 500 : 150);
      await pg.evaluate(() => { window.__eventosCampo = []; });
      await digitar(pg, modo, termo);
      await pg.waitForTimeout(tipo === SUGESTAO_CLIENTE ? 700 : 300);
      const m = await medir(pg, tipo);
      const eventos = [...new Set(await pg.evaluate(() => window.__eventosCampo))].sort().join(",");
      const achou = m.itens.some((t) => sem(t).includes(sem(esperado)));
      r[modo][termo] = { valor: m.valor, aberta: m.aberta, n: m.itens.length, primeiro: m.itens[0] ?? null, achou };
      console.log(`  ${nome.padEnd(16)} ${modo.padEnd(12)} ${JSON.stringify(termo).padEnd(14)} → ${achou ? "ACHOU " : "NÃO ACHOU"} n=${m.itens.length} campo=${JSON.stringify(m.valor)} aberta=${m.aberta} 1º=${JSON.stringify(m.itens[0] ?? null)} eventos=${eventos}`);
      if (termo === termos[0][0]) await pg.screenshot({ path: path.join(saida, `${nome}-${modo}.png`) });
    }
  }
  return r;
}

// Digita, toca no item esperado e confere que a lista fechou.
async function escolher(pg, toque, abrirLista, termo, esperado, tipo = CMDK) {
  const campo = pg.locator(tipo.campo).first();
  if (!(await campo.isVisible())) { await abrirLista(); await campo.waitFor({ timeout: 5000 }); }
  if (toque) await campo.tap(); else await campo.click();
  await campo.fill("");
  await digitar(pg, toque ? "ime" : "teclado", termo);
  await pg.waitForTimeout(tipo === SUGESTAO_CLIENTE ? 700 : 300);
  const item = pg.locator(`${tipo.lista} ${tipo.item}`, { hasText: esperado }).first();
  if (toque) await item.tap(); else await item.click();
  await pg.waitForTimeout(500);
  return { fechou: !(await medir(pg, tipo)).aberta };
}

const navegador = await chromium.launch();
const resultado = {};
const escolhas = {};
const so = soArg?.split(",") ?? Object.keys(APARELHOS);

for (const aparelho of so) {
  const estado = { tabelas: tabelas() };
  const { ctx, toque } = await abrir(navegador, aparelho, estado);
  const pasta = path.join(SAIDA, `${rotulo}-${aparelho}`);
  mkdirSync(pasta, { recursive: true });
  console.log(`[${aparelho}]`);
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
    const tocar = (loc) => (toque ? loc.tap() : loc.click());
    const r = {};
    const e = {};
    resultado[aparelho] = r;
    escolhas[aparelho] = e;

    // Etapa 2: sugestão de cliente (consulta ao Supabase a cada letra)
    await proxima();
    await pg.waitForTimeout(400);
    const abrirCliente = async () => { /* o campo já está na tela */ };
    r.cliente = await testarBusca(pg, toque, "cliente", abrirCliente, [["maria", "Maria Silva"], ["MARIA", "Maria Silva"], ["joão", "João Pereira"], ["joao", "João Pereira"], ["maria silva", "Maria Silva"]], pasta, SUGESTAO_CLIENTE);
    e.cliente = await escolher(pg, toque, abrirCliente, "maria", "Maria Silva", SUGESTAO_CLIENTE);
    e.cliente.nome = await dialogo.locator("input[name^=clienteNome]").inputValue();
    await proxima();
    await pg.waitForTimeout(600);

    // Etapa 3: Tipo → Marca → Modelo → Cor (filtro local do cmdk)
    await dialogo.getByRole("combobox").filter({ hasText: "Selecione o tipo" }).click();
    await pg.getByRole("listbox").waitFor();
    await pg.keyboard.type("Celular", { delay: 40 });
    await pg.keyboard.press("Enter");
    await pg.waitForTimeout(400);
    const abrirMarca = () => tocar(dialogo.locator("#dispositivoMarca"));
    r.marca = await testarBusca(pg, toque, "marca", abrirMarca, [["sams", "Samsung"], ["SAMSUNG", "Samsung"], ["moto", "Motorola"], ["Apple", "Apple"]], pasta);
    e.marca = await escolher(pg, toque, abrirMarca, "sams", "Samsung");
    e.marca.botao = (await dialogo.locator("#dispositivoMarca").textContent()).trim();
    const abrirModelo = () => tocar(dialogo.locator("#dispositivoModelo"));
    r.modelo = await testarBusca(pg, toque, "modelo", abrirModelo, [["a10", "Galaxy A10"], ["galaxy a1", "Galaxy A1"], ["GALAXY", "Galaxy"]], pasta);
    e.modelo = await escolher(pg, toque, abrirModelo, "a10", "Galaxy A10");
    e.modelo.botao = (await dialogo.locator("#dispositivoModelo").textContent()).trim();
    const abrirCor = () => tocar(dialogo.locator("#dispositivoCor"));
    r.cor = await testarBusca(pg, toque, "cor", abrirCor, [["preto", "Preto"], ["PRE", "Preto"]], pasta);
    e.cor = await escolher(pg, toque, abrirCor, "preto", "Preto");
    e.cor.botao = (await dialogo.locator("#dispositivoCor").textContent()).trim();
    await proxima();
    await pg.waitForTimeout(600);
    await dialogo.locator("#defeitoRelatado").fill("Não liga");
    await proxima();
    await pg.waitForTimeout(600);
    await proxima();
    await pg.waitForTimeout(800);

    // Etapa 6: Serviço e Produto/Peça
    const gatilhoServico = dialogo.getByRole("combobox").filter({ hasText: "buscar serviço" });
    const abrirServico = () => tocar(gatilhoServico);
    r.servico = await testarBusca(pg, toque, "servico", abrirServico, [["troca", "Troca de Tela"], ["TROCA DE TELA", "Troca de Tela"], ["técnica", "Limpeza Técnica"], ["tecnica", "Limpeza Técnica"], ["bat", "Troca de Bateria"]], pasta);
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(300);
    const gatilhoProduto = dialogo.getByRole("combobox").filter({ hasText: "buscar produto" });
    const abrirProduto = () => tocar(gatilhoProduto);
    const termosProduto = [["tela", "Tela iPhone 11"], ["TELA", "Tela"], ["tela ip", "Tela iPhone 11"], ["iphone 11", "iPhone 11"], ["película", "Película 3D"], ["pelicula", "Película 3D"], ["câmera", "Câmera Traseira"], ["camera", "Câmera Traseira"], ["a10", "A10"]];
    r.produto = await testarBusca(pg, toque, "produto", abrirProduto, termosProduto, pasta);
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(300);
    if (toque) {
      // Depois de rolar a lista por toque (o que o commit de hoje liberou)
      r.produtoDepoisDeRolar = await testarBusca(pg, toque, "produto-rolada", abrirProduto, [["tela", "Tela iPhone 11"], ["conector", "Conector de Carga"]], pasta, CMDK, { rolarAntes: true });
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(300);
    }
    e.servico = await escolher(pg, toque, abrirServico, "troca de tela", "Troca de Tela");
    e.servico.adicionado = await dialogo.getByText("Troca de Tela").count() > 0;
    e.produto = await escolher(pg, toque, abrirProduto, "câmera", "Câmera Traseira");
    e.produto.adicionado = await dialogo.getByText("Câmera Traseira iPhone 11").count() > 0;
    await pg.screenshot({ path: path.join(pasta, "etapa6-itens-adicionados.png") });
    console.log(`  escolhas: ${JSON.stringify(e)}`);
  } catch (err) {
    falhar(`[${aparelho}] ${err.message.split("\n")[0]}`);
    try { await ctx.pages()[0].screenshot({ path: path.join(pasta, "erro.png") }); } catch { /* sem página */ }
  } finally {
    await ctx.close();
  }
}

await navegador.close();
writeFileSync(path.join(SAIDA, `coleta-${rotulo}.json`), JSON.stringify(resultado, null, 1));
writeFileSync(path.join(SAIDA, `escolhas-${rotulo}.json`), JSON.stringify(escolhas, null, 1));
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
