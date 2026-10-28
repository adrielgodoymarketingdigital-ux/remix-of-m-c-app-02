// Exclusão de serviço / tipo de serviço / produto / peça bloqueada por OS ou
// venda JÁ EXCLUÍDA (deleted_at). APP DE VERDADE (build de produção) e
// Supabase simulado; dados 100% fictícios; nada sai da máquina.
//
//   npx vite build && npx vite preview --port 8341 --strictPort --host 127.0.0.1
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-servico-vinculo-os/exclusao.playwright.mjs \
//     coletar <rotulo> <base-url> <pasta-saida>
//   node scripts/testes-servico-vinculo-os/exclusao.playwright.mjs conferir <branch.json>
//   node scripts/testes-servico-vinculo-os/exclusao.playwright.mjs comparar <main.json> <branch.json>
//
// coletar: para cada caso, clica em excluir e guarda os avisos (toasts), as
// escritas que chegaram ao banco (DELETE/PATCH) e uma captura.
// conferir: o que a correção promete (OS/venda excluída libera; OS cancelada,
// OS ativa e venda cancelada continuam bloqueando; aviso lista os números).
// comparar: casos marcados `igual` têm de sair idênticos na main e na branch.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

const SERVICO = "serv-0001";
const TIPO = "tipo-0001";
const PRODUTO = "prod-0001";
const PECA = "peca-0001";
const EXCLUIDA = "2026-10-20T10:00:00Z";

function os(extra) {
  return {
    id: "os-0001", numero_os: "101", status: "em_andamento",
    servico_id: SERVICO, tipo_servico_id: null, deleted_at: null, created_at: "2026-10-01T12:00:00Z",
    avarias: { servicos_realizados: [{ id: SERVICO, nome: "Troca de Tela", preco: 300 }] },
    ...extra,
  };
}
function venda(extra) {
  return { id: "v-0001", tipo: "produto", produto_id: null, peca_id: null, quantidade: 1, total: 50, cancelada: false, deleted_at: null, data: "2026-10-10T12:00:00Z", ...extra };
}

// 12 OS em andamento + 1 cancelada + 1 excluída: o aviso conta 13 e lista as 10 menores.
const VARIAS = [
  ...Array.from({ length: 12 }, (_, i) => os({ id: `os-v${i}`, numero_os: String(120 - i) })),
  os({ id: "os-vc", numero_os: "200", status: "cancelada" }),
  os({ id: "os-vx", numero_os: "5", deleted_at: EXCLUIDA }),
];

// igual: o resultado não pode mudar entre main e branch.
// espera: { apaga, aviso (regex) } conferido na branch.
const CASOS = {
  "servico-os-ativa": { alvo: "servico", ordens: [os({})], espera: { apaga: false, aviso: /usado em 1 ordem de serviço \(OS 101\)/ } },
  "servico-os-excluida": { alvo: "servico", ordens: [os({ deleted_at: EXCLUIDA })], espera: { apaga: true, aviso: /Serviço excluído com sucesso/ } },
  "servico-os-excluida-so-json": { alvo: "servico", ordens: [os({ servico_id: null, deleted_at: EXCLUIDA })], espera: { apaga: true, aviso: /Serviço excluído com sucesso/ } },
  "servico-os-cancelada": { alvo: "servico", ordens: [os({ status: "cancelada" })], espera: { apaga: false, aviso: /usado em 1 ordem de serviço \(OS 101\)/ } },
  "servico-os-apagada": { alvo: "servico", ordens: [], igual: true, espera: { apaga: true, aviso: /Serviço excluído com sucesso/ } },
  "servico-varias-os": { alvo: "servico", ordens: VARIAS, espera: { apaga: false, aviso: /usado em 13 ordens de serviço \(OS 109, 110, 111, 112, 113, 114, 115, 116, 117, 118 e mais 3\)/ } },
  "servico-es": { alvo: "servico", ordens: [os({})], idioma: "es", espera: { apaga: false, aviso: /No es posible eliminar este servicio.*se usa en 1 orden de servicio \(OS 101\)/ } },
  "tipo-os-excluida": { alvo: "tipo", ordens: [os({ servico_id: null, tipo_servico_id: TIPO, avarias: null, deleted_at: EXCLUIDA })], espera: { apaga: true, aviso: /Tipo de serviço excluído/ } },
  "tipo-os-ativa": { alvo: "tipo", ordens: [os({ servico_id: null, tipo_servico_id: TIPO, avarias: null })], espera: { apaga: false, aviso: /Está vinculado a 1 ordem\(ns\) de serviço \(OS 101\)/ } },
  "tipo-os-cancelada": { alvo: "tipo", ordens: [os({ servico_id: null, tipo_servico_id: TIPO, avarias: null, status: "cancelada" })], espera: { apaga: false, aviso: /Está vinculado a 1 ordem\(ns\) de serviço \(OS 101\)/ } },
  "tipo-so-servicos": { alvo: "tipo", ordens: [], servicoDoTipo: true, igual: true, espera: { apaga: false, aviso: /Está vinculado a 1 serviço\(s\) do catálogo\. Use/ } },
  "produto-venda-ativa": { alvo: "produto", vendas: [venda({ produto_id: PRODUTO })], igual: true, espera: { apaga: false, aviso: /possui vendas registradas/ } },
  "produto-venda-cancelada": { alvo: "produto", vendas: [venda({ produto_id: PRODUTO, cancelada: true })], igual: true, espera: { apaga: false, aviso: /possui vendas registradas/ } },
  "produto-venda-excluida": { alvo: "produto", vendas: [venda({ produto_id: PRODUTO, deleted_at: EXCLUIDA })], espera: { apaga: true, aviso: /Produto excluído com sucesso/ } },
  "produto-sem-venda": { alvo: "produto", vendas: [], igual: true, espera: { apaga: true, aviso: /Produto excluído com sucesso/ } },
  "peca-venda-ativa": { alvo: "peca", vendas: [venda({ tipo: "peca", peca_id: PECA })], igual: true, espera: { apaga: false, aviso: /possui vendas ou serviços vinculados/ } },
  "peca-venda-excluida": { alvo: "peca", vendas: [venda({ tipo: "peca", peca_id: PECA, deleted_at: EXCLUIDA })], espera: { apaga: true, aviso: /Peça excluído com sucesso/ } },
  "peca-ligada-a-servico": { alvo: "peca", vendas: [venda({ tipo: "peca", peca_id: PECA, deleted_at: EXCLUIDA })], servicoDaPeca: true, igual: true, espera: { apaga: false, aviso: /possui vendas ou serviços vinculados/ } },
  "peca-sem-vinculo": { alvo: "peca", vendas: [], igual: true, espera: { apaga: true, aviso: /Peça excluído com sucesso/ } },
  // em massa: produto com venda ativa, produto com venda excluída, peça com venda excluída
  "massa": {
    alvo: "massa",
    vendas: [venda({ produto_id: PRODUTO }), venda({ id: "v-2", produto_id: "prod-0002", deleted_at: EXCLUIDA }), venda({ id: "v-3", tipo: "peca", peca_id: PECA, deleted_at: EXCLUIDA })],
    espera: { apaga: true, aviso: /^(?=.*2 itens excluídos com sucesso)(?=.*1 item não pôde ser excluído)/ },
  },
};

if (acao === "conferir") {
  const r = JSON.parse(readFileSync(args[0], "utf8"));
  let falhas = 0;
  for (const [nome, caso] of Object.entries(CASOS)) {
    const x = r[nome];
    const ok = x && x.apagou === caso.espera.apaga && caso.espera.aviso.test(x.avisos.join(" | "));
    if (!ok) falhas++;
    console.log(`${ok ? "ok    " : "FALHA "} ${nome.padEnd(28)} ${x ? `${x.apagou ? "apagou   " : "bloqueou "}| ${x.avisos.join(" | ")}` : "(sem resultado)"}`);
  }
  console.log(`${Object.keys(CASOS).length} casos, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
}

if (acao === "comparar") {
  const [a, b] = args.slice(0, 2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  let diferentes = 0;
  for (const [nome, caso] of Object.entries(CASOS)) {
    if (!caso.igual) continue;
    for (const campo of ["avisos", "escritas", "telaAntes"]) {
      const [va, vb] = [a, b].map((x) => JSON.stringify(x[nome]?.[campo]));
      if (va === vb) console.log(`igual:     ${nome}.${campo}`);
      else { diferentes++; console.log(`DIFERENTE: ${nome}.${campo}\n  main:   ${va?.slice(0, 300)}\n  branch: ${vb?.slice(0, 300)}`); }
    }
  }
  console.log(`${diferentes} diferente(s)`);
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo = "x", base = "http://127.0.0.1:8341", saidaArg = "coleta-servico-vinculo-os"] = args;
const SAIDA = path.resolve(saidaArg);
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-28T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z" } };

function tabelas(caso) {
  const comum = { user_id: USUARIO.id, empresa_id: null, created_at: "2026-02-01T12:00:00Z" };
  const item = { ...comum, deleted_at: null, preco: 50, custo: 20, lucro: 30, quantidade: 7, fotos: [] };
  const servicos = [];
  if (caso.alvo === "servico") servicos.push({ ...comum, id: SERVICO, nome: "Troca de Tela", preco: 300, custo: 120, lucro: 180, quantidade: 0, peca_id: null, tipo_servico_id: null });
  if (caso.servicoDoTipo) servicos.push({ ...comum, id: "serv-0002", nome: "Tela iPhone", preco: 300, custo: 120, lucro: 180, quantidade: 0, peca_id: null, tipo_servico_id: TIPO });
  if (caso.servicoDaPeca) servicos.push({ ...comum, id: "serv-0003", nome: "Troca de Bateria", preco: 200, custo: 80, lucro: 120, quantidade: 0, peca_id: PECA, tipo_servico_id: null });
  const produtos = ["produto", "massa"].includes(caso.alvo)
    ? [{ ...item, id: PRODUTO, nome: "Capa Silicone" }, ...(caso.alvo === "massa" ? [{ ...item, id: "prod-0002", nome: "Película 3D" }] : [])]
    : [];
  const pecas = ["peca", "massa"].includes(caso.alvo) ? [{ ...item, id: PECA, nome: "Bateria A10" }] : [];
  const es = caso.idioma === "es";
  return {
    user_roles: es ? [{ user_id: USUARIO.id, role: "admin" }] : [],
    profiles: [{
      id: "p1", user_id: USUARIO.id, nome: "Loja Teste", email: USUARIO.email, celular: "11999990000", created_at: "2026-01-10T12:00:00Z", preferencias_os: null,
      ...(es ? { idioma: "es", mercado: "ES_LATAM", pais: "MX", moeda: "USD", fuso_horario: "America/Mexico_City" } : { idioma: "pt-BR", mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo" }),
    }],
    assinaturas: [{
      id: "a1", user_id: USUARIO.id, plano_tipo: "profissional_ultra_mensal", status: "active", data_inicio: "2026-01-10T12:00:00Z",
      data_fim: "2026-12-10T12:00:00Z", data_proxima_cobranca: "2026-11-10T12:00:00Z", trial_with_card: false, payment_provider: "pagarme",
      created_at: "2026-01-10T12:00:00Z", updated_at: "2026-10-10T12:00:00Z", onboarding_completo: true, trial_canceled: false,
    }],
    configuracoes_loja: [{ id: "c1", user_id: USUARIO.id, nome_loja: "Loja Teste", cnpj: "00.000.000/0001-00", telefone: "11999990000", endereco: "Rua A, 1", logo_url: null, empresa_id: null }],
    user_onboarding: [{ user_id: USUARIO.id, completed: true, onboarding_completed: true, step: 99 }],
    servicos,
    tipos_servico: caso.alvo === "tipo" ? [{ ...comum, id: TIPO, nome: "Tela" }] : [],
    ordens_servico: (caso.ordens ?? []).map((o) => ({ ...comum, ...o })),
    vendas: (caso.vendas ?? []).map((v) => ({ ...comum, ...v })),
    produtos,
    pecas,
  };
}

// json @> json (o "cs." do PostgREST em coluna jsonb)
function contem(a, b) {
  if (Array.isArray(b)) return Array.isArray(a) && b.every((y) => a.some((x) => contem(x, y)));
  if (b && typeof b === "object") return !!a && typeof a === "object" && Object.entries(b).every(([k, v]) => contem(a[k], v));
  return a === b;
}

function filtrar(linhas, params) {
  return linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset", "on_conflict", "columns", "or"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("cs.")) return contem(v, JSON.parse(cond.slice(3)));
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
}

async function abrir(navegador, estado, escritas) {
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
        const tabela = estado.tabelas[m[1]] ?? [];
        const alvo = new Set(filtrar(tabela, url.searchParams));
        if (req.method() === "DELETE") {
          escritas.push({ metodo: "DELETE", tabela: m[1], ids: [...alvo].map((l) => l.id).sort() });
          estado.tabelas[m[1]] = tabela.filter((l) => !alvo.has(l));
          return r.fulfill({ status: 204, body: "" });
        }
        if (req.method() === "PATCH" && ["produtos", "pecas", "servicos", "tipos_servico"].includes(m[1])) {
          const corpo = req.postDataJSON() ?? {};
          escritas.push({ metodo: "PATCH", tabela: m[1], ids: [...alvo].map((l) => l.id).sort(), campos: Object.keys(corpo).sort() });
          for (const l of alvo) Object.assign(l, corpo);
          return r.fulfill({ status: 204, body: "" });
        }
        if (req.method() !== "GET" && req.method() !== "HEAD") return r.fulfill({ status: 201, json: [] });
        const linhas = [...alvo];
        // count: "exact" lê o total do content-range; sem o expose o navegador esconde o cabeçalho (CORS)
        const faixa = {
          "content-range": linhas.length ? `0-${linhas.length - 1}/${linhas.length}` : `*/0`,
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range",
        };
        if (req.method() === "HEAD") return r.fulfill({ status: 200, body: "", headers: faixa });
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? r.fulfill({ status: 200, json: linhas[0] }) : r.fulfill({ status: 406, json: { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" } });
        }
        return r.fulfill({ status: 200, json: linhas, headers: faixa });
      }
      return r.fulfill({ status: 404, json: {} });
    }
    return r.abort();
  });
  return ctx;
}

const confirmar = (pg, nome) => pg.getByRole("alertdialog").getByRole("button", { name: nome }).click();

const ACOES = {
  async servico(pg) {
    await pg.goto(`${base}/servicos`);
    const linha = pg.getByRole("row").filter({ hasText: "Troca de Tela" }).first();
    await linha.waitFor({ timeout: 30000 });
    return { linha, excluir: async () => { await linha.getByRole("button").last().click(); await confirmar(pg, /^(Excluir|Eliminar)$/); } };
  },
  async tipo(pg) {
    await pg.goto(`${base}/servicos`);
    // só dentro do cartão "Tipos de Serviço": o nome do tipo também aparece na tabela de serviços
    const cartao = pg.getByText("Tipos de Serviço", { exact: true }).locator("xpath=ancestor::div[contains(@class,'bg-card')][1]");
    const item = cartao.getByText("Tela", { exact: true }).first();
    await item.waitFor({ timeout: 30000 });
    const linha = item.locator("xpath=ancestor::div[.//button][2]");
    return { linha, excluir: async () => { await linha.getByRole("button").last().click(); await confirmar(pg, "Excluir"); } };
  },
  async produto(pg, nome = "Capa Silicone") {
    await pg.goto(`${base}/produtos`);
    const linha = pg.getByRole("row").filter({ hasText: nome }).first();
    await linha.waitFor({ timeout: 30000 });
    return { linha, excluir: async () => { await linha.getByTitle("Excluir").click(); await confirmar(pg, "Excluir"); } };
  },
  async peca(pg) { return ACOES.produto(pg, "Bateria A10"); },
  async massa(pg) {
    await pg.goto(`${base}/produtos`);
    const tabela = pg.locator("table").filter({ hasText: "Capa Silicone" }).first();
    await tabela.getByText("Bateria A10").waitFor({ timeout: 30000 });
    return {
      linha: tabela,
      excluir: async () => {
        await tabela.locator("thead").getByRole("checkbox").click();
        await pg.getByRole("button", { name: /^Excluir \(3\)$/ }).click();
        await confirmar(pg, /^Excluir 3 itens$/);
      },
    };
  },
};

const navegador = await chromium.launch();
const resultado = {};

for (const [nome, caso] of Object.entries(CASOS)) {
  const estado = { tabelas: tabelas(caso) };
  const escritas = [];
  const ctx = await abrir(navegador, estado, escritas);
  const pg = await ctx.newPage();
  const { linha, excluir } = await ACOES[caso.alvo](pg);
  await pg.waitForLoadState("networkidle");
  if (caso.idioma === "es") await pg.waitForFunction(() => document.documentElement.lang === "es", null, { timeout: 15000 });
  const telaAntes = (await linha.innerText()).replace(/\s+/g, " ").trim();
  await excluir();
  await pg.locator("[data-sonner-toast]").first().waitFor({ timeout: 10000 });
  await pg.waitForTimeout(1200);
  const avisos = (await pg.locator("[data-sonner-toast]").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).sort();
  await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-${nome}.png`) });
  resultado[nome] = { apagou: escritas.length > 0, avisos, escritas, telaAntes };
  console.log(`${nome.padEnd(28)} ${escritas.length ? "apagou   " : "bloqueou "}| ${avisos.join(" | ")}`);
  await ctx.close();
}

await navegador.close();
writeFileSync(path.join(SAIDA, `${rotulo}.json`), JSON.stringify(resultado, null, 2));
