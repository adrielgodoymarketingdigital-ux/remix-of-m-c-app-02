// Estoque baixo, fase 1: main × branch com a MESMA conta fictícia e sem configuração.
// APP DE VERDADE (build de produção) e Supabase simulado; dados 100% fictícios; nada sai da máquina.
//
//   npx vite build && npx vite preview --port 8342 --strictPort --host 127.0.0.1
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-situacao-estoque/estoque.playwright.mjs \
//     <rotulo> <base-url> <pasta-saida>
//   node scripts/testes-situacao-estoque/estoque.playwright.mjs comparar <pasta-a> <pasta-b>
//
// Telas: lista de Produtos/Peças no computador e no celular, PDF "Menor estoque"
// e relatório de produtos vendidos. Para cada uma guarda o texto, a captura (PNG)
// e o HTML das etiquetas de estoque; o PDF é guardado inteiro.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

// PDF do jsPDF sem compressão: só /ID e datas mudam entre execuções.
const normalizarPdf = (buf) =>
  buf.toString("latin1")
    .replace(/\/ID \[[^\]]*\]/g, "/ID []")
    .replace(/\/(CreationDate|ModDate) \([^)]*\)/g, "/$1 ()");

if (acao === "comparar") {
  const [a, b] = args;
  let diferentes = 0;
  const arquivos = [...new Set([...readdirSync(a), ...readdirSync(b)])].sort();
  for (const f of arquivos) {
    if (!existsSync(path.join(a, f)) || !existsSync(path.join(b, f))) { diferentes++; console.log(`FALTA:     ${f}`); continue; }
    let [va, vb] = [a, b].map((p) => readFileSync(path.join(p, f)));
    let obs = "";
    if (f.endsWith(".pdf") && !va.equals(vb)) { va = Buffer.from(normalizarPdf(va)); vb = Buffer.from(normalizarPdf(vb)); obs = " (sem /ID e datas)"; }
    if (va.equals(vb)) console.log(`igual:     ${f}${obs}`);
    else { diferentes++; console.log(`DIFERENTE: ${f}`); }
  }
  console.log(`${diferentes} diferente(s) em ${arquivos.length} arquivo(s)`);
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo = "x", base = "http://127.0.0.1:8342", saidaArg = "coleta-estoque"] = [acao, ...args];
const SAIDA = path.resolve(saidaArg, rotulo);
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-28T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z" } };

// Quantidades que cobrem todas as faixas das 3 regras antigas (vazia = null no banco).
const QTD_PRODUTOS = [-3, -1, 0, 1, 2, 3, 4, 5, 6, 10, null];
const QTD_PECAS = [-2, 0, 1, 3, 4, 5, 9];
const doisDig = (i) => String(i).padStart(2, "0");

function tabelas() {
  const comum = { user_id: USUARIO.id, deleted_at: null, empresa_id: null, created_at: "2026-02-01T12:00:00Z" };
  const produtos = QTD_PRODUTOS.map((q, i) => ({ ...comum, id: `prod-${doisDig(i)}`, nome: `Produto Teste ${doisDig(i)}`, sku: `SKU${doisDig(i)}`, preco: 10, custo: 5, lucro: 5, quantidade: q }));
  const pecas = QTD_PECAS.map((q, i) => ({ ...comum, id: `peca-${doisDig(i)}`, nome: `Peça Teste ${doisDig(i)}`, preco: 20, custo: 8, quantidade: q }));
  const vendas = produtos.map((p, i) => ({
    ...comum, id: `venda-${doisDig(i)}`, tipo: "produto", produto_id: p.id, quantidade: 1, total: 10, data: "2026-10-20T15:00:00Z",
    parcela_numero: null, forma_pagamento: "dinheiro", recebido: true,
    produtos: { nome: p.nome, sku: p.sku, custo: p.custo, preco: p.preco, quantidade: p.quantidade },
  }));
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
    produtos, pecas, vendas,
    clientes: [], servicos: [],
  };
}

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

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
    r = [...r].sort((x, y) => {
      for (const { c, desc } of colunas) {
        const a = String(x[c] ?? ""), b = String(y[c] ?? "");
        if (a !== b) return (a < b ? -1 : 1) * (desc ? -1 : 1);
      }
      return 0;
    });
  }
  const offset = Number(params.get("offset") ?? 0);
  const limite = Math.min(Number(params.get("limit") ?? 1000), 1000);
  return r.slice(offset, offset + limite);
}

async function abrir(navegador, viewport) {
  const estado = { tabelas: tabelas() };
  const ctx = await navegador.newContext({ viewport, timezoneId: "America/Sao_Paulo", locale: "pt-BR", serviceWorkers: "block", acceptDownloads: true });
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

// HTML das etiquetas de estoque (texto + classes), sem ids gerados pelo Radix.
const etiquetas = (pg, seletor) => pg.evaluate((sel) =>
  [...document.querySelectorAll(sel)]
    .filter((el) => /^(Baixo|Sem estoque|Negativo|Em estoque|-?\d+)$/.test(el.textContent.trim()))
    .map((el) => `${el.textContent.trim()} | ${el.className}`)
    .join("\n"), seletor);

async function abrirProdutos(pg) {
  await pg.goto(`${base}/produtos`);
  await pg.waitForLoadState("networkidle");
  await pg.getByText("Produto Teste 00").first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(1000);
}

// PW_EXECUTABLE: caminho de um Chromium já instalado, se o do Playwright não estiver baixado.
const navegador = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const DESKTOP = { width: 1366, height: 900 };
const CELULAR = { width: 390, height: 844 };

const TELAS = {
  async "lista-computador"(pg) {
    await abrirProdutos(pg);
    const texto = await pg.locator("main").first().innerText();
    if (!/Baixo/.test(texto) || !/Sem estoque/.test(texto) || !/Negativo/.test(texto) || !/Em estoque/.test(texto)) falhar("[lista-computador] faltam etiquetas na tela");
    return { texto, html: await etiquetas(pg, "main span, main div.inline-flex") };
  },
  async "lista-celular"(pg) {
    await abrirProdutos(pg);
    const texto = await pg.locator("main").first().innerText();
    if (!/Baixo/.test(texto) || !/Sem estoque/.test(texto) || !/Negativo/.test(texto)) falhar("[lista-celular] faltam etiquetas na tela");
    return { texto, html: await etiquetas(pg, "main div.inline-flex, main span") };
  },
  async "pdf-menor-estoque"(pg) {
    await abrirProdutos(pg);
    await pg.getByRole("button", { name: /Exportar PDF/ }).click();
    const [download] = await Promise.all([
      pg.waitForEvent("download", { timeout: 30000 }),
      pg.getByRole("menuitem", { name: "Menor estoque" }).click(),
    ]);
    const destino = path.join(SAIDA, "pdf-menor-estoque.pdf");
    await download.saveAs(destino);
    const conteudo = readFileSync(destino).toString("latin1");
    if (!conteudo.includes("(ESTOQUE BAIXO) Tj")) falhar("[pdf] cartão 'Estoque Baixo' não encontrado no PDF");
    // Linhas em laranja (180, 100, 0): de 1 a 3 e os negativos. Na massa: 5 produtos + 3 peças.
    const laranjas = (conteudo.match(/0\.706 0\.392 0\. rg/g) ?? []).length;
    if (laranjas !== 8) falhar(`[pdf] ${laranjas} linhas em laranja, esperado 8`);
    await pg.waitForTimeout(500);
    return { texto: "", html: "" };
  },
  async "relatorio-vendidos"(pg) {
    await pg.goto(`${base}/relatorios`);
    await pg.waitForLoadState("networkidle");
    await pg.getByRole("tab", { name: "Produtos" }).click();
    await pg.getByText("Produto Teste 00").first().waitFor({ timeout: 30000 });
    await pg.waitForTimeout(1000);
    const tabela = pg.locator("table", { hasText: "Estoque Atual" }).first();
    const texto = await tabela.innerText();
    const html = await tabela.evaluate((t) => [...t.querySelectorAll("tbody tr")].map((tr) => {
      const celulas = tr.querySelectorAll("td");
      const badge = celulas[3]?.querySelector("div,span");
      return `${celulas[0]?.textContent.trim()} | ${badge?.textContent.trim()} | ${badge?.className}`;
    }).join("\n"));
    if (!/destructive|bg-destructive/.test(html)) falhar("[relatório] nenhuma etiqueta vermelha");
    await pg.mouse.move(0, 0);
    await pg.waitForTimeout(600);
    await tabela.screenshot({ path: path.join(SAIDA, "relatorio-vendidos-tabela.png"), animations: "disabled" });
    return { texto, html };
  },
};

for (const [nomeTela, abrirTela] of Object.entries(TELAS)) {
  const ctx = await abrir(navegador, nomeTela === "lista-celular" ? CELULAR : DESKTOP);
  try {
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => falhar(`[${nomeTela}] erro na página: ${e.message}`));
    const { texto, html } = await abrirTela(pg);
    if (texto) writeFileSync(path.join(SAIDA, `${nomeTela}.txt`), texto);
    if (html) writeFileSync(path.join(SAIDA, `${nomeTela}.etiquetas.txt`), html);
    if (nomeTela !== "pdf-menor-estoque") {
      // Mouse longe da tabela: o destaque de linha tem transição e muda a captura.
      await pg.mouse.move(0, 0);
      await pg.waitForTimeout(600);
      await pg.screenshot({ path: path.join(SAIDA, `${nomeTela}.png`), fullPage: true, animations: "disabled" });
    }
    console.log(`[${nomeTela}] ok`);
  } catch (err) {
    falhar(`[${nomeTela}] ${err.message.split("\n")[0]}`);
    try { await ctx.pages()[0].screenshot({ path: path.join(SAIDA, `${nomeTela}-erro.png`) }); } catch { /* sem página */ }
  } finally {
    await ctx.close();
  }
}

await navegador.close();
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
