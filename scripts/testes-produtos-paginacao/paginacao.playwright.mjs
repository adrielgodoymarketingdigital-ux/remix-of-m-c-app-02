// Paginação do useProdutos.carregarTodos (produtos e peças de 1000 em 1000)
// nas 4 telas que usam o hook: seletor de Produto/Peça da OS, Produtos, PDV
// (Adicionar Item) e Catálogo. APP DE VERDADE (build de produção) e Supabase
// simulado; dados 100% fictícios; nada sai da máquina.
//
//   npx vite build && npx vite preview --port 8331 --strictPort --host 127.0.0.1
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-produtos-paginacao/paginacao.playwright.mjs \
//     <rotulo> <base-url> <pasta-saida> <unicos|repetidos> <semente>
//   node scripts/testes-produtos-paginacao/paginacao.playwright.mjs comparar <a.json> <b.json>
//
// O PostgREST simulado aplica order (várias colunas), offset/limit e corta em
// 1000 linhas. Em empate na ordem pedida o Postgres não garante a ordem; aqui
// os empatados são embaralhados a cada consulta (pior caso, com <semente>),
// que é o que faz um item sumir ou repetir na divisa entre páginas.
//
// Massa: 1340 produtos + 3 peças (a maior loja de produção hoje, 1343 itens).
//   unicos    todos os nomes diferentes
//   repetidos 31 produtos chamados "Produto 0985" ocupando as posições 985-1015
//             da ordem por nome (a divisa de 1000 cai no meio) e 5 "Capa Silicone" no começo
// Cada item tem quantidade = número próprio, então "(Est: N)" identifica o item
// na lista da OS mesmo com nome repetido.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.slice(0, 2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  let diferentes = 0;
  for (const tela of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    for (const campo of ["ids", "tela"]) {
      const [va, vb] = [a, b].map((x) => JSON.stringify(x[tela]?.[campo]));
      if (va === vb) console.log(`igual:     ${tela}.${campo} (${a[tela]?.[campo]?.length ?? 0} itens)`);
      else {
        diferentes++;
        const la = a[tela]?.[campo] ?? [];
        const lb = b[tela]?.[campo] ?? [];
        const i = la.findIndex((v, k) => v !== lb[k]);
        console.log(`DIFERENTE: ${tela}.${campo} (${la.length} x ${lb.length}) 1ª diferença na posição ${i}: ${JSON.stringify(la[i])} x ${JSON.stringify(lb[i])}`);
      }
    }
  }
  console.log(`${diferentes} diferente(s)`);
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo = "x", base = "http://127.0.0.1:8331", saidaArg = "coleta-paginacao", massa = "unicos", sementeArg = "1"] = [acao, ...args];
const SAIDA = path.resolve(saidaArg);
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-27T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z" } };

const quatroDig = (i) => String(i).padStart(4, "0");
function tabelas() {
  const comum = { user_id: USUARIO.id, deleted_at: null, empresa_id: null, created_at: "2026-02-01T12:00:00Z" };
  // ids embaralhados em relação ao nome, para o desempate por id não coincidir com a ordem do nome
  const id = (prefixo, i) => `${prefixo}-${quatroDig((i * 7919) % 10007)}`;
  const nomeProduto = (i) => {
    if (massa === "repetidos" && i >= 985 && i <= 1015) return "Produto 0985";
    if (massa === "repetidos" && i < 5) return "Capa Silicone";
    return `Produto ${quatroDig(i)}`;
  };
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
    produtos: Array.from({ length: 1340 }, (_, i) => ({ ...comum, id: id("prod", i), nome: nomeProduto(i), preco: 10, custo: 5, lucro: 5, quantidade: 10000 + i })),
    pecas: Array.from({ length: 3 }, (_, i) => ({ ...comum, id: id("peca", i), nome: `Peça ${quatroDig(i)}`, preco: 20, custo: 8, quantidade: 20000 + i })),
    clientes: [],
    servicos: [],
  };
}

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

// Aleatório com semente (mulberry32): mesma semente, mesmo embaralhamento.
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let consultas = 0;
function filtrar(linhas, params) {
  let r = linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset", "on_conflict", "columns", "or"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
  const ordem = params.get("order");
  if (ordem) {
    const colunas = ordem.split(",").map((o) => { const [c, d] = o.split("."); return { c, desc: d === "desc" }; });
    const cmp = (x, y) => {
      for (const { c, desc } of colunas) {
        const a = String(x[c] ?? ""), b = String(y[c] ?? "");
        if (a !== b) return (a < b ? -1 : 1) * (desc ? -1 : 1);
      }
      return 0;
    };
    // empate na ordem pedida: ordem livre a cada consulta
    const sorteio = aleatorio(Number(sementeArg) * 100003 + ++consultas);
    r = r.map((l) => ({ l, s: sorteio() })).sort((x, y) => cmp(x.l, y.l) || x.s - y.s).map((x) => x.l);
  }
  const offset = Number(params.get("offset") ?? 0);
  const limite = Math.min(Number(params.get("limit") ?? 1000), 1000); // max_rows padrão
  return r.slice(offset, offset + limite);
}

async function abrir(navegador, estado, registro) {
  const ctx = await navegador.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: "America/Sao_Paulo", locale: "pt-BR", serviceWorkers: "block" });
  await ctx.clock.setFixedTime(AGORA);
  await ctx.addInitScript(({ sessao }) => {
    if (sessionStorage.getItem("__iniciado")) return;
    sessionStorage.setItem("__iniciado", "1");
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
  }, { sessao: SESSAO });
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
        if ((m[1] === "produtos" || m[1] === "pecas") && url.searchParams.get("select") === "*") {
          registro.push({ tabela: m[1], offset: Number(url.searchParams.get("offset") ?? 0), order: url.searchParams.get("order"), ids: linhas.map((l) => l.id) });
        }
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? r.fulfill({ status: 200, json: linhas[0] }) : r.fulfill({ status: 406, json: { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" } });
        }
        return r.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      return r.fulfill({ status: 404, json: {} });
    }
    return r.abort();
  });
  return ctx;
}

// Carga do useProdutos (consulta ordenada por nome) de cada tabela: a última
// página recebida em cada offset (a tela de OS chega a carregar duas vezes ao mesmo tempo).
function ultimaCarga(registro) {
  const ids = [];
  const ordens = new Set();
  for (const tabela of ["produtos", "pecas"]) {
    const porOffset = new Map();
    for (const x of registro) if (x.tabela === tabela && x.order?.startsWith("nome")) porOffset.set(x.offset, x);
    for (const offset of [...porOffset.keys()].sort((a, b) => a - b)) { const x = porOffset.get(offset); ids.push(...x.ids); ordens.add(x.order); }
  }
  return { ids, ordens: [...ordens] };
}

// Itens do teste em ordem de tela: nome e, quando aparece, "(Est: N)".
const ITEM = /(Produto \d{4}|Peça \d{4}|Capa Silicone)(?:[^\n(]*\(Est: (\d+)\))?/g;
const naTela = (texto) => [...texto.matchAll(ITEM)].map((m) => (m[2] ? `${m[1]} #${m[2]}` : m[1]));

const TOTAL = 1343;
const navegador = await chromium.launch();
const resultado = {};

const TELAS = {
  async os(pg) {
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
    await proxima();
    await pg.waitForTimeout(400);
    const nome = dialogo.locator("input[name^=clienteNome]");
    await nome.fill("Cliente Teste");
    await proxima();
    await pg.waitForTimeout(600);
    await dialogo.getByRole("combobox").filter({ hasText: "Selecione o tipo" }).click();
    await pg.getByRole("listbox").waitFor();
    await pg.keyboard.type("Celular", { delay: 40 });
    await pg.keyboard.press("Enter");
    await pg.waitForTimeout(400);
    await dialogo.locator("#dispositivoMarca").click();
    await pg.locator("[cmdk-input]").fill("Samsung");
    await pg.locator("[cmdk-item]", { hasText: "Samsung" }).first().click();
    await pg.waitForTimeout(300);
    const modelo = dialogo.locator("#dispositivoModelo");
    if ((await modelo.evaluate((el) => el.tagName)) === "BUTTON") {
      await modelo.click();
      await pg.locator("[cmdk-item]").nth(1).click();
    } else await modelo.fill("Modelo Ficticio");
    await proxima();
    await pg.waitForTimeout(600);
    await dialogo.locator("#defeitoRelatado").fill("Não liga");
    await proxima();
    await pg.waitForTimeout(600);
    await proxima();
    await pg.waitForTimeout(800);
    await dialogo.getByRole("combobox").filter({ hasText: "buscar produto" }).click();
    await pg.locator("[data-radix-popper-content-wrapper] [cmdk-list]").waitFor({ timeout: 15000 });
    await pg.waitForTimeout(800);
    return pg.evaluate(() => [...document.querySelectorAll("[data-radix-popper-content-wrapper] [cmdk-item]")].map((i) => i.textContent.replace(/\s+/g, " ")).join("\n"));
  },
  async produtos(pg) {
    await pg.goto(`${base}/produtos`);
    await pg.waitForLoadState("networkidle");
    await pg.getByText(/Produto \d{4}|Capa Silicone/).first().waitFor({ timeout: 30000 });
    await pg.waitForTimeout(800);
    return pg.locator("main").first().innerText();
  },
  async pdv(pg) {
    await pg.goto(`${base}/pdv`);
    await pg.waitForLoadState("networkidle");
    const botao = pg.locator("[data-walkthrough=pdv-adicionar-item]");
    await botao.waitFor({ timeout: 30000 });
    await pg.waitForTimeout(800);
    await botao.click();
    const dialogo = pg.getByRole("dialog");
    await dialogo.waitFor();
    await dialogo.getByText(/Produto \d{4}|Capa Silicone/).first().waitFor({ timeout: 30000 });
    await pg.waitForTimeout(800);
    return dialogo.innerText();
  },
  async catalogo(pg) {
    await pg.goto(`${base}/catalogo`);
    await pg.waitForLoadState("networkidle");
    await pg.getByText(/Produto \d{4}|Capa Silicone/).first().waitFor({ timeout: 30000 });
    await pg.waitForTimeout(800);
    return pg.locator("body").innerText();
  },
};

for (const [nomeTela, abrirTela] of Object.entries(TELAS)) {
  const estado = { tabelas: tabelas() };
  const registro = [];
  const ctx = await abrir(navegador, estado, registro);
  const pasta = path.join(SAIDA, `${rotulo}-${massa}`);
  mkdirSync(pasta, { recursive: true });
  try {
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => falhar(`[${nomeTela}] erro na página: ${e.message}`));
    const texto = await abrirTela(pg);
    await pg.screenshot({ path: path.join(pasta, `${nomeTela}.png`) });
    const { ids, ordens } = ultimaCarga(registro);
    const unicos = new Set(ids).size;
    const esperados = [...estado.tabelas.produtos, ...estado.tabelas.pecas].map((l) => l.id);
    const faltando = esperados.filter((i) => !ids.includes(i)).length;
    const repetidos = ids.length - unicos;
    const tela = naTela(texto);
    resultado[nomeTela] = { total: ids.length, unicos, faltando, repetidos, ordens, ids, tela };
    console.log(`[${nomeTela}] ordem=${ordens.join(" | ")} carregados=${ids.length} ids únicos=${unicos} faltando=${faltando} repetidos=${repetidos} itens na tela=${tela.length}`);
    if (unicos !== TOTAL || ids.length !== TOTAL) falhar(`[${nomeTela}] ${TOTAL} cadastrados, ${ids.length} carregados, ${unicos} únicos`);
  } catch (err) {
    falhar(`[${nomeTela}] ${err.message.split("\n")[0]}`);
    try { await ctx.pages()[0].screenshot({ path: path.join(pasta, `${nomeTela}-erro.png`) }); } catch { /* sem página */ }
  } finally {
    await ctx.close();
  }
}

await navegador.close();
writeFileSync(path.join(SAIDA, `coleta-${rotulo}-${massa}.json`), JSON.stringify(resultado));
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
