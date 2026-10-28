// Estoque baixo: telas de sempre (fase 1) e limite da loja (fase 2).
// APP DE VERDADE (build de produção) e Supabase simulado; dados 100% fictícios; nada sai da máquina.
//
//   npx vite build && npx vite preview --port 8342 --strictPort --host 127.0.0.1
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-situacao-estoque/estoque.playwright.mjs \
//     <rotulo> <base-url> <pasta-saida> [cenario] [papel] [limite] [telas]
//   node scripts/testes-situacao-estoque/estoque.playwright.mjs comparar <pasta-a> <pasta-b>
//
//   cenario  padrao      tabela configuracao_estoque existe, sem linha (= padrão de cada tela)
//            ausente     tabela ainda não existe (PostgREST responde PGRST205)
//            configurado linha do dono com limite_baixo = <limite>
//   papel    dono | funcionario | gerente (gerente de filial; dados com empresa_id da filial)
//   telas    lista separada por vírgula; padrão: as 4 telas de estoque. Extras:
//            configuracoes            Configurações do menu lateral não tem mais aba Estoque
//            produtos-config(-celular) Produtos e Peças > Configurações > aba Estoque (só o dono):
//                                     grava 7, 0 e vazio pelo simulador; lista, PDF e relatório
//                                     mudam sem recarregar; 2000 é recusado sem enviar
//
// Toda rodada confere as etiquetas contra o limite esperado (contado aqui, à parte do app).
// Para cada tela guarda texto, captura (PNG) e etiquetas; o PDF é guardado inteiro.
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
const [
  rotulo = "x", base = "http://127.0.0.1:8342", saidaArg = "coleta-estoque",
  cenario = "padrao", papel = "dono", limiteArg = "", telasArg = "",
] = [acao, ...args];
const LIMITE = cenario === "configurado" ? Number(limiteArg) : null;
if (cenario === "configurado" && !Number.isInteger(LIMITE)) throw new Error("cenario configurado precisa de <limite>");
const SAIDA = path.resolve(saidaArg, rotulo);
mkdirSync(SAIDA, { recursive: true });

const IDS = {
  dono: "00000000-0000-4000-8000-0000000000aa",
  funcionario: "00000000-0000-4000-8000-0000000000bb",
  gerente: "00000000-0000-4000-8000-0000000000cc",
};
const FILIAL = "00000000-0000-4000-8000-0000000000f1";
const DONO = IDS.dono;
const USUARIO = { id: IDS[papel], email: `${papel}.teste@exemplo.test` };
const AGORA = new Date("2026-10-28T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z" } };

// Quantidades que cobrem todas as faixas (vazia = null no banco).
const QTD_PRODUTOS = [-3, -1, 0, 1, 2, 3, 4, 5, 6, 10, null];
const QTD_PECAS = [-2, 0, 1, 3, 4, 5, 9];
const doisDig = (i) => String(i).padStart(2, "0");
// Funcionário de teste com todos os módulos (Relatórios também confere "vendas").
const MODULOS_FUNCIONARIO = Object.fromEntries([
  "dashboard", "pdv", "ordem_servico", "produtos_pecas", "servicos", "dispositivos", "catalogo", "fornecedores",
  "clientes", "orcamentos", "pedidos", "contas", "vendas", "relatorios", "financeiro", "configuracoes",
].map((m) => [m, true]));

// "Rede parada" nem sempre chega (o gerente tem consultas que se repetem); espera curta e segue.
const esperarRede = (pg) => pg.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

function tabelas() {
  const comum = { user_id: DONO, deleted_at: null, empresa_id: papel === "gerente" ? FILIAL : null, created_at: "2026-02-01T12:00:00Z" };
  const produtos = QTD_PRODUTOS.map((q, i) => ({ ...comum, id: `prod-${doisDig(i)}`, nome: `Produto Teste ${doisDig(i)}`, sku: `SKU${doisDig(i)}`, preco: 10, custo: 5, lucro: 5, quantidade: q }));
  const pecas = QTD_PECAS.map((q, i) => ({ ...comum, id: `peca-${doisDig(i)}`, nome: `Peça Teste ${doisDig(i)}`, preco: 20, custo: 8, quantidade: q }));
  const vendas = produtos.map((p, i) => ({
    ...comum, id: `venda-${doisDig(i)}`, tipo: "produto", produto_id: p.id, quantidade: 1, total: 10, data: "2026-10-20T15:00:00Z",
    parcela_numero: null, forma_pagamento: "dinheiro", recebido: true,
    produtos: { nome: p.nome, sku: p.sku, custo: p.custo, preco: p.preco, quantidade: p.quantidade },
  }));
  const assinatura = (uid) => ({
    id: `a-${uid.slice(-2)}`, user_id: uid, plano_tipo: "profissional_ultra_mensal", status: "active", data_inicio: "2026-01-10T12:00:00Z",
    data_fim: "2026-12-10T12:00:00Z", data_proxima_cobranca: "2026-11-10T12:00:00Z", trial_with_card: false, payment_provider: "pagarme",
    created_at: "2026-01-10T12:00:00Z", updated_at: "2026-10-10T12:00:00Z", onboarding_completo: true, trial_canceled: false,
  });
  const perfil = (uid, nome) => ({ id: `p-${uid.slice(-2)}`, user_id: uid, nome, email: `${nome.toLowerCase()}@exemplo.test`, celular: "11999990000", created_at: "2026-01-10T12:00:00Z", idioma: "pt-BR", mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo", preferencias_os: null });
  return {
    user_roles: [],
    profiles: [perfil(DONO, "Dono"), perfil(IDS.funcionario, "Funcionario"), perfil(IDS.gerente, "Gerente")],
    assinaturas: [assinatura(DONO), assinatura(IDS.funcionario), assinatura(IDS.gerente)],
    // Linha também do gerente: sem ela a tela de Configurações do gerente fica em "Carregando..." no simulador (igual na main).
    configuracoes_loja: [DONO, IDS.gerente].map((uid, i) => ({ id: `c${i + 1}`, user_id: uid, nome_loja: "Loja Teste", cnpj: "00.000.000/0001-00", telefone: "11999990000", endereco: "Rua A, 1", logo_url: null, empresa_id: null })),
    user_onboarding: [DONO, IDS.funcionario, IDS.gerente].map((uid) => ({ user_id: uid, completed: true, onboarding_completed: true, step: 99 })),
    loja_funcionarios: papel === "funcionario" ? [{
      id: "lf1", loja_user_id: DONO, funcionario_user_id: IDS.funcionario, ativo: true, empresa_id: null, nome: "Funcionario", email: "funcionario@exemplo.test",
      permissoes: { modulos: MODULOS_FUNCIONARIO, recursos: { ver_custos: true, ver_lucros: true, editar_produtos: true, ver_total_vendas: true } },
    }] : [],
    empresa_usuarios: papel === "gerente" ? [{ id: "eu1", empresa_id: FILIAL, proprietario_id: DONO, gerente_id: IDS.gerente, ativa: true, permissoes: null }] : [],
    empresas: papel === "gerente" ? [{ id: FILIAL, proprietario_id: DONO, nome: "Filial Teste", tipo: "filial", ativa: true }] : [],
    configuracao_estoque: cenario === "configurado" ? [{ user_id: DONO, limite_baixo: LIMITE, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z" }] : [],
    produtos, pecas, vendas,
    clientes: [], servicos: [],
  };
}

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };
const conferir = (cond, m) => { if (!cond) falhar(m); };

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

async function abrir(navegador, viewport, estado) {
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
        const tabela = m[1];
        if (tabela === "configuracao_estoque") {
          estado.consultasConfig.push({ metodo: req.method(), user_id: url.searchParams.get("user_id") });
          if (cenario === "ausente") {
            return r.fulfill({ status: 404, json: { code: "PGRST205", details: null, hint: null, message: "Could not find the table 'public.configuracao_estoque' in the schema cache" } });
          }
          if (req.method() === "POST") {
            const corpo = JSON.parse(req.postData() ?? "{}");
            for (const linha of Array.isArray(corpo) ? corpo : [corpo]) {
              estado.gravacoes.push(linha);
              const i = estado.tabelas.configuracao_estoque.findIndex((l) => l.user_id === linha.user_id);
              if (i >= 0) estado.tabelas.configuracao_estoque[i] = { ...estado.tabelas.configuracao_estoque[i], ...linha };
              else estado.tabelas.configuracao_estoque.push(linha);
            }
            return r.fulfill({ status: 201, json: [] });
          }
        }
        if (req.method() !== "GET" && req.method() !== "HEAD") return r.fulfill({ status: 201, json: [] });
        const linhas = filtrar(estado.tabelas[tabela] ?? [], url.searchParams);
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          if (linhas.length === 1) return r.fulfill({ status: 200, json: linhas[0] });
          // maybeSingle sem linha: o PostgREST responde 406 e o supabase-js devolve data = null
          return r.fulfill({ status: 406, json: { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" } });
        }
        return r.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      return r.fulfill({ status: 404, json: {} });
    }
    return r.abort();
  });
  return ctx;
}

// Etiquetas de estoque (texto + classes), sem ids gerados pelo Radix.
const etiquetas = (pg, seletor) => pg.evaluate((sel) =>
  [...document.querySelectorAll(sel)]
    .filter((el) => /^(Baixo|Sem estoque|Negativo|Em estoque|-?\d+)$/.test(el.textContent.trim()))
    .map((el) => `${el.textContent.trim()} | ${el.className}`)
    .join("\n"), seletor);
const contar = (html, rotuloEtiqueta) => html.split("\n").filter((l) => l.startsWith(`${rotuloEtiqueta} |`)).length;
const toastsAbertos = (pg) => pg.locator("[data-sonner-toast], li[role=status][data-state=open]").count();

// Contas esperadas, feitas aqui à parte do app.
const TODAS = [...QTD_PRODUTOS, ...QTD_PECAS].map((q) => q ?? 0);
const limiteDaTela = (padrao) => (LIMITE === null ? padrao : LIMITE);
const esperadoLista = () => {
  const L = limiteDaTela(4);
  return {
    baixo: TODAS.filter((q) => q >= 1 && q <= L).length,
    emEstoque: TODAS.filter((q) => q > L).length,
    semEstoque: TODAS.filter((q) => q === 0).length,
    negativo: TODAS.filter((q) => q < 0).length,
  };
};

async function abrirProdutos(pg) {
  await pg.goto(`${base}/produtos`);
  await esperarRede(pg);
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
    const html = await etiquetas(pg, "main span, main div.inline-flex");
    const e = esperadoLista();
    const achado = { baixo: contar(html, "Baixo"), emEstoque: contar(html, "Em estoque"), semEstoque: contar(html, "Sem estoque"), negativo: contar(html, "Negativo") };
    conferir(JSON.stringify(achado) === JSON.stringify(e), `[lista-computador] etiquetas ${JSON.stringify(achado)}, esperado ${JSON.stringify(e)}`);
    return { texto, html };
  },
  async "lista-celular"(pg) {
    await abrirProdutos(pg);
    const texto = await pg.locator("main").first().innerText();
    const html = await etiquetas(pg, "main div.inline-flex, main span");
    const e = esperadoLista();
    const achado = { baixo: contar(html, "Baixo"), semEstoque: contar(html, "Sem estoque"), negativo: contar(html, "Negativo") };
    const esperado = { baixo: e.baixo, semEstoque: e.semEstoque, negativo: e.negativo };
    conferir(JSON.stringify(achado) === JSON.stringify(esperado), `[lista-celular] etiquetas ${JSON.stringify(achado)}, esperado ${JSON.stringify(esperado)}`);
    return { texto, html };
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
    const L = limiteDaTela(3);
    const sub = L === 0 ? "aviso desligado" : L === 1 ? "quantidade 1" : `quantidade 1 a ${L}`;
    conferir(conteudo.includes("(ESTOQUE BAIXO) Tj"), "[pdf] cartão 'Estoque Baixo' não encontrado");
    conferir(conteudo.includes(`(${sub}) Tj`), `[pdf] subtítulo '${sub}' não encontrado`);
    // Linhas em laranja (180, 100, 0): baixo e negativos.
    const laranjas = (conteudo.match(/0\.706 0\.392 0\. rg/g) ?? []).length;
    const esperado = TODAS.filter((q) => q < 0 || (q >= 1 && q <= L)).length;
    conferir(laranjas === esperado, `[pdf] ${laranjas} linhas em laranja, esperado ${esperado}`);
    await pg.waitForTimeout(500);
    return { texto: "", html: "" };
  },
  async "relatorio-vendidos"(pg) {
    await pg.goto(`${base}/relatorios`);
    await esperarRede(pg);
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
    const vermelhos = html.split("\n").filter((l) => l.includes("bg-destructive")).length;
    const L = limiteDaTela(4);
    const esperado = QTD_PRODUTOS.map((q) => q ?? 0).filter((q) => q <= L).length;
    conferir(vermelhos === esperado, `[relatório] ${vermelhos} vermelhos, esperado ${esperado}`);
    await pg.mouse.move(0, 0);
    await pg.waitForTimeout(600);
    await tabela.screenshot({ path: path.join(SAIDA, "relatorio-vendidos-tabela.png"), animations: "disabled" });
    return { texto, html };
  },
  // Configurações do menu lateral: a aba Estoque saiu de lá (agora fica em Produtos e Peças).
  async configuracoes(pg) {
    await pg.goto(`${base}/configuracoes`);
    await esperarRede(pg);
    await pg.getByRole("tab", { name: "Perfil" }).waitFor({ timeout: 30000 });
    await pg.waitForTimeout(1500);
    const abas = (await pg.locator("[role=tablist]").first().innerText()).trim();
    conferir((await pg.getByRole("tab", { name: "Estoque" }).count()) === 0, `[configuracoes] ainda tem aba Estoque: ${abas}`);
    conferir((await toastsAbertos(pg)) === 0, "[configuracoes] apareceu toast ao abrir");
    return { texto: abas, html: "" };
  },
  // Produtos e Peças > Configurações > aba Estoque (só o dono), no computador e no celular.
  async "produtos-config"(pg, estado) { return configEmProdutos(pg, estado, "computador"); },
  async "produtos-config-celular"(pg, estado) { return configEmProdutos(pg, estado, "celular"); },
};

// Conta "Baixo" na lista (com o diálogo fechado) e compara com o limite esperado.
async function conferirLista(pg, L, quando) {
  await pg.waitForTimeout(800);
  const html = await etiquetas(pg, "main span, main div.inline-flex");
  const esperado = TODAS.filter((q) => q >= 1 && q <= L).length;
  const achado = contar(html, "Baixo");
  conferir(achado === esperado, `[produtos-config] ${quando}: ${achado} "Baixo" na lista, esperado ${esperado}`);
}

async function configEmProdutos(pg, estado, tela) {
  const rotuloTela = `produtos-config-${tela}`;
  await abrirProdutos(pg);
  await pg.evaluate(() => { window.__semRecarga = "sim"; });
  const abrirDialogo = async () => {
    await pg.locator("main").getByRole("button", { name: "Configurações" }).first().click();
    await pg.getByRole("dialog").waitFor({ timeout: 10000 });
    await pg.waitForTimeout(600);
  };
  const fecharDialogo = async () => {
    await pg.keyboard.press("Escape");
    await pg.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 });
  };
  await abrirDialogo();
  const dialogo = pg.getByRole("dialog");
  const aba = dialogo.getByRole("tab", { name: "Estoque" });
  const temAba = (await aba.count()) > 0;
  const deveTer = papel === "dono" && cenario !== "ausente";
  conferir(temAba === deveTer, `[${rotuloTela}] aba Estoque ${temAba ? "aparece" : "não aparece"} (esperado: ${deveTer ? "aparece" : "não aparece"})`);
  conferir((await dialogo.getByRole("tab").count()) === (deveTer ? 4 : 3), `[${rotuloTela}] número de abas do diálogo`);
  conferir((await toastsAbertos(pg)) === 0, `[${rotuloTela}] apareceu toast ao abrir`);
  if (!temAba) {
    await dialogo.screenshot({ path: path.join(SAIDA, `${rotuloTela}-sem-aba.png`), animations: "disabled" });
    return { texto: (await dialogo.getByRole("tablist").innerText()).trim(), html: "" };
  }

  const situacao = pg.getByTestId("estoque-situacao-atual");
  const textoSituacao = async (esperado) => {
    await pg.waitForFunction(([sel, alvo]) => document.querySelector(sel)?.textContent?.includes(alvo),
      ["[data-testid=estoque-situacao-atual]", esperado], { timeout: 10000 }).catch(() => {});
    return (await situacao.innerText()).trim();
  };
  const irParaAba = async () => { await dialogo.getByRole("tab", { name: "Estoque" }).click(); await pg.waitForTimeout(400); };
  await irParaAba();
  const inicial = LIMITE === null ? "Hoje: padrão do app" : LIMITE === 0 ? "Hoje: não avisa estoque baixo." : `Hoje: avisa quando restar ${LIMITE} ou menos.`;
  const t0 = await textoSituacao(inicial);
  conferir(t0.startsWith(inicial), `[${rotuloTela}] situação inicial '${t0}', esperado '${inicial}'`);
  await pg.mouse.move(0, 0);
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SAIDA, `${rotuloTela}-aba-estoque.png`), animations: "disabled" });

  const campo = () => pg.getByLabel("Quantidade para avisar estoque baixo");
  const chave = () => pg.locator("#naoAvisarEstoqueBaixo");
  const salvar = async (toast) => {
    await pg.getByRole("dialog").getByRole("button", { name: /^(Salvar|Salvando\.\.\.)$/ }).click();
    await pg.getByText(toast).first().waitFor({ timeout: 10000 });
    await pg.waitForTimeout(800);
  };
  const ultima = () => JSON.stringify(estado.gravacoes.at(-1) ?? null);

  // 1) Salva 7: lista, PDF e relatório mudam sem recarregar a página.
  if ((await chave().getAttribute("data-state")) === "checked") await chave().click();
  await campo().fill("7");
  await salvar("Limite de estoque baixo salvo");
  conferir(ultima() === JSON.stringify({ user_id: DONO, limite_baixo: 7 }), `[${rotuloTela}] gravou ${ultima()} (esperado limite 7)`);
  const t1 = await textoSituacao("restar 7 ou menos");
  conferir(t1 === "Hoje: avisa quando restar 7 ou menos.", `[${rotuloTela}] depois de salvar 7: '${t1}'`);
  await fecharDialogo();
  await conferirLista(pg, 7, "depois de salvar 7");
  if (tela === "computador") {
    await pg.getByRole("button", { name: /Exportar PDF/ }).click();
    const [download] = await Promise.all([
      pg.waitForEvent("download", { timeout: 30000 }),
      pg.getByRole("menuitem", { name: "Menor estoque" }).click(),
    ]);
    const destino = path.join(SAIDA, "pdf-depois-de-salvar-7.pdf");
    await download.saveAs(destino);
    conferir(readFileSync(destino).toString("latin1").includes("(quantidade 1 a 7) Tj"), `[${rotuloTela}] PDF não mostra 'quantidade 1 a 7' depois de salvar`);
    // Relatório pela navegação do próprio app (sem recarregar).
    await pg.evaluate(() => { window.history.pushState({}, "", "/relatorios"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await pg.getByRole("tab", { name: "Produtos" }).click({ timeout: 30000 });
    await pg.getByText("Produto Teste 00").first().waitFor({ timeout: 30000 });
    await pg.waitForTimeout(800);
    const vermelhos = await pg.locator("table", { hasText: "Estoque Atual" }).first().locator("tbody tr td:nth-child(4) .bg-destructive").count();
    const esperado = QTD_PRODUTOS.map((q) => q ?? 0).filter((q) => q <= 7).length;
    conferir(vermelhos === esperado, `[${rotuloTela}] relatório depois de salvar 7: ${vermelhos} vermelhos, esperado ${esperado}`);
    await pg.evaluate(() => { window.history.pushState({}, "", "/produtos"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await pg.getByText("Produto Teste 00").first().waitFor({ timeout: 30000 });
    await pg.waitForTimeout(800);
  }

  // 2) "Não avisar" (0): nenhum "Baixo" na lista.
  await abrirDialogo();
  await irParaAba();
  await chave().click();
  await salvar("Limite de estoque baixo salvo");
  conferir(ultima() === JSON.stringify({ user_id: DONO, limite_baixo: 0 }), `[${rotuloTela}] 'não avisar' gravou ${ultima()}`);
  const t2 = await textoSituacao("não avisa");
  conferir(t2 === "Hoje: não avisa estoque baixo.", `[${rotuloTela}] depois de 'não avisar': '${t2}'`);
  await fecharDialogo();
  await conferirLista(pg, 0, "depois de 'não avisar'");

  // 3) Vazio: volta ao padrão da lista (1 a 4).
  await abrirDialogo();
  await irParaAba();
  await chave().click();
  await campo().fill("");
  await salvar("Limite de estoque baixo salvo");
  conferir(ultima() === JSON.stringify({ user_id: DONO, limite_baixo: null }), `[${rotuloTela}] campo vazio gravou ${ultima()}`);
  const t3 = await textoSituacao("padrão do app");
  conferir(t3.startsWith("Hoje: padrão do app"), `[${rotuloTela}] depois de limpar: '${t3}'`);

  // 4) 2000 é recusado sem enviar nada.
  const antes = estado.gravacoes.length;
  await campo().fill("2000");
  await pg.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await pg.getByText("Digite um número inteiro de 0 a 1000, ou deixe em branco.").first().waitFor({ timeout: 10000 });
  await pg.waitForTimeout(500);
  conferir(estado.gravacoes.length === antes, `[${rotuloTela}] valor 2000 chegou a ser enviado`);
  await fecharDialogo();
  await conferirLista(pg, 4, "depois de voltar ao padrão");

  conferir((await pg.evaluate(() => window.__semRecarga)) === "sim", `[${rotuloTela}] a página recarregou`);
  return { texto: "", html: "" };
}

const telas = telasArg ? telasArg.split(",") : ["lista-computador", "lista-celular", "pdf-menor-estoque", "relatorio-vendidos"];
const resumoConsultas = [];
for (const nomeTela of telas) {
  const estado = { tabelas: tabelas(), gravacoes: [], consultasConfig: [] };
  const ctx = await abrir(navegador, nomeTela.endsWith("celular") ? CELULAR : DESKTOP, estado);
  try {
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => falhar(`[${nomeTela}] erro na página: ${e.message}`));
    const { texto, html } = await TELAS[nomeTela](pg, estado);
    if (texto) writeFileSync(path.join(SAIDA, `${nomeTela}.txt`), texto);
    if (html) writeFileSync(path.join(SAIDA, `${nomeTela}.etiquetas.txt`), html);
    if (["lista-computador", "lista-celular", "relatorio-vendidos"].includes(nomeTela)) {
      // Mouse longe da tabela: o destaque de linha tem transição e muda a captura.
      await pg.mouse.move(0, 0);
      await pg.waitForTimeout(600);
      await pg.screenshot({ path: path.join(SAIDA, `${nomeTela}.png`), fullPage: true, animations: "disabled" });
      conferir((await toastsAbertos(pg)) === 0, `[${nomeTela}] apareceu toast`);
    }
    // A leitura do limite tem de ser sempre pelo id do DONO (funcionário e gerente herdam).
    const outrosIds = estado.consultasConfig.filter((c) => c.metodo === "GET" && c.user_id !== `eq.${DONO}`);
    conferir(outrosIds.length === 0, `[${nomeTela}] limite lido por outro id: ${JSON.stringify(outrosIds)}`);
    resumoConsultas.push(`${nomeTela}: ${estado.consultasConfig.filter((c) => c.metodo === "GET").length} leitura(s) do limite`);
    console.log(`[${nomeTela}] ok`);
  } catch (err) {
    falhar(`[${nomeTela}] ${err.message.split("\n")[0]}`);
    try { await ctx.pages()[0].screenshot({ path: path.join(SAIDA, `${nomeTela}-erro.png`) }); } catch { /* sem página */ }
  } finally {
    await ctx.close();
  }
}

await navegador.close();
console.log(`cenário=${cenario} papel=${papel} limite=${LIMITE ?? "(nenhum)"} | ${resumoConsultas.join("; ")}`);
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
