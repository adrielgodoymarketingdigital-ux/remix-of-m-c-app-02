// Reprodução: "não deixa excluir o serviço porque está vinculado a uma OS,
// mas a OS já foi excluída". APP DE VERDADE (build de produção) e Supabase
// simulado; dados 100% fictícios; nada sai da máquina. Só registra o
// comportamento atual (não falha por isso): para cada caso mostra o aviso
// exibido e se o DELETE chegou ao banco.
//
//   npx vite build && npx vite preview --port 8341 --strictPort --host 127.0.0.1
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-servico-vinculo-os/exclusao.playwright.mjs \
//     [base-url] [pasta-saida]
//
// Casos (serviço "Troca de Tela" / tipo "Tela"):
//   ativa         OS em andamento usando o serviço (coluna e JSON)
//   lixeira       a mesma OS "excluída" pela tela de OS (deleted_at preenchido)
//   lixeira-json  OS excluída que usa o serviço só em avarias.servicos_realizados
//   definitiva    a linha da OS não existe mais (Zerar meus dados / DELETE físico)
//   cancelada     OS com status cancelada, não excluída
//   tipo-lixeira  Tipo de Serviço usado só por OS excluída
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [, , base = "http://127.0.0.1:8341", saidaArg = "coleta-servico-vinculo-os"] = process.argv;
const SAIDA = path.resolve(saidaArg);
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-28T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z" } };

const SERVICO = "serv-0001";
const TIPO = "tipo-0001";
const EXCLUIDA = "2026-10-20T10:00:00Z";

function os(extra) {
  return {
    id: "os-0001", numero_os: 101, user_id: USUARIO.id, empresa_id: null, cliente_id: null, status: "em_andamento",
    servico_id: SERVICO, tipo_servico_id: null, deleted_at: null, created_at: "2026-10-01T12:00:00Z",
    avarias: { servicos_realizados: [{ id: SERVICO, nome: "Troca de Tela", preco: 300 }] },
    ...extra,
  };
}

const CASOS = {
  ativa: { alvo: "servico", ordens: [os({})] },
  lixeira: { alvo: "servico", ordens: [os({ deleted_at: EXCLUIDA })] },
  "lixeira-json": { alvo: "servico", ordens: [os({ servico_id: null, deleted_at: EXCLUIDA })] },
  definitiva: { alvo: "servico", ordens: [] },
  cancelada: { alvo: "servico", ordens: [os({ status: "cancelada" })] },
  "tipo-lixeira": { alvo: "tipo", ordens: [os({ servico_id: null, tipo_servico_id: TIPO, avarias: null, deleted_at: EXCLUIDA })] },
};

function tabelas(caso) {
  const comum = { user_id: USUARIO.id, empresa_id: null, created_at: "2026-02-01T12:00:00Z" };
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
    servicos: caso.alvo === "servico"
      ? [{ ...comum, id: SERVICO, nome: "Troca de Tela", preco: 300, custo: 120, lucro: 180, quantidade: 0, peca_id: null, tipo_servico_id: null }]
      : [],
    tipos_servico: caso.alvo === "tipo" ? [{ ...comum, id: TIPO, nome: "Tela" }] : [],
    ordens_servico: caso.ordens,
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
        const tabela = estado.tabelas[m[1]] ?? [];
        if (req.method() === "DELETE") {
          const apagar = new Set(filtrar(tabela, url.searchParams));
          registro.push({ metodo: "DELETE", tabela: m[1], linhas: apagar.size });
          estado.tabelas[m[1]] = tabela.filter((l) => !apagar.has(l));
          return r.fulfill({ status: 204, body: "" });
        }
        if (req.method() !== "GET" && req.method() !== "HEAD") return r.fulfill({ status: 201, json: [] });
        const linhas = filtrar(tabela, url.searchParams);
        if (m[1] === "ordens_servico" || m[1] === "servicos" || m[1] === "tipos_servico") {
          registro.push({ metodo: req.method(), tabela: m[1], consulta: url.search, linhas: linhas.length });
        }
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

const navegador = await chromium.launch();
const resultado = {};

for (const [nome, caso] of Object.entries(CASOS)) {
  const estado = { tabelas: tabelas(caso) };
  const registro = [];
  const ctx = await abrir(navegador, estado, registro);
  const pg = await ctx.newPage();
  await pg.goto(`${base}/servicos`);
  await pg.waitForLoadState("networkidle");

  if (caso.alvo === "servico") {
    const linha = pg.getByRole("row").filter({ hasText: "Troca de Tela" }).first();
    await linha.waitFor({ timeout: 30000 });
    await linha.getByRole("button").last().click();
    await pg.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  } else {
    const item = pg.getByText("Tela", { exact: true }).first();
    await item.waitFor({ timeout: 30000 });
    // lixeira do item: último botão da linha do tipo
    await item.locator("xpath=ancestor::div[.//button][2]").getByRole("button").last().click();
    await pg.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  }

  const toast = pg.locator("[data-sonner-toast]").first();
  await toast.waitFor({ timeout: 10000 });
  await pg.waitForTimeout(500);
  const aviso = (await toast.innerText()).replace(/\s+/g, " ").trim();
  const apagou = registro.some((x) => x.metodo === "DELETE");
  await pg.screenshot({ path: path.join(SAIDA, `${nome}.png`) });
  resultado[nome] = { aviso, apagou, consultas: registro.filter((x) => x.metodo !== "DELETE" && x.tabela === "ordens_servico") };
  console.log(`${nome.padEnd(13)} ${apagou ? "EXCLUIU  " : "BLOQUEOU "} | ${aviso}`);
  await ctx.close();
}

await navegador.close();
writeFileSync(path.join(SAIDA, "resultado.json"), JSON.stringify(resultado, null, 2));
