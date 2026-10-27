// Etapa 4 do i18n com o APP DE VERDADE (build de produção) e o Supabase
// simulado. Dados 100% fictícios; nada sai da máquina (o resto é bloqueado e
// registrado como falha).
//
//   npx vite build && npx vite preview --port 8302 --strictPort --host 127.0.0.1   (em cada árvore)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-i18n/menu.playwright.mjs \
//     coletar <rotulo> <base-url> <pasta-saida>
//   node scripts/testes-i18n/menu.playwright.mjs comparar <a.json> <b.json> [casos-separados-por-vírgula]
//
// Cada caso: HTML do <body>, lang do <html>, consultas ao Supabase (método +
// tabela + parâmetros) e arquivos JS/CSS pedidos (sem o hash). Casos com
// "fluxo" (admin trocando o idioma) só existem na branch.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.slice(0, 2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  const so = args[2]?.split(",");
  const casos = (so ?? [...new Set([...Object.keys(a), ...Object.keys(b)])]).sort();
  let diferentes = 0;
  for (const caso of casos) {
    const campos = ["html", "lang", "consultas", "arquivos", "localStorage"].filter((c) => JSON.stringify(a[caso]?.[c]) !== JSON.stringify(b[caso]?.[c]));
    if (campos.length) {
      diferentes++;
      console.log(`DIFERENTE: ${caso} → ${campos.join(", ")}`);
      for (const c of campos.filter((x) => x !== "html")) {
        const [va, vb] = [a[caso]?.[c], b[caso]?.[c]];
        if (Array.isArray(va) && Array.isArray(vb)) {
          // multiconjunto: o que sobra de cada lado
          const sobra = (x, y) => { const r = [...y]; return x.filter((i) => { const k = r.indexOf(i); if (k < 0) return true; r.splice(k, 1); return false; }); };
          console.log(`  ${c}: só em a ${JSON.stringify(sobra(va, vb))}; só em b ${JSON.stringify(sobra(vb, va))}`);
        } else console.log(`  ${c}: a ${JSON.stringify(va)}; b ${JSON.stringify(vb)}`);
      }
    } else console.log(`igual:     ${caso}`);
  }
  console.log(`${casos.length} casos comparados, ${diferentes} diferente(s)`);
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo, base, saidaArg] = args;
const BASE = base ?? "http://127.0.0.1:8302";
const SAIDA = path.resolve(saidaArg ?? "coleta-i18n");
mkdirSync(SAIDA, { recursive: true });
const FLUXO = process.env.FLUXO === "1";

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-26T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z" } };

function tabelasBase({ admin, idioma }) {
  return {
    user_roles: admin ? [{ user_id: USUARIO.id, role: "admin" }] : [],
    profiles: [{
      id: "p1", user_id: USUARIO.id, nome: "Loja Teste", email: USUARIO.email, celular: "11999990000", created_at: "2026-01-10T12:00:00Z",
      idioma, mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo", preferencias_os: null,
    }],
    assinaturas: [{
      id: "a1", user_id: USUARIO.id, plano_tipo: "profissional_ultra_mensal", status: "active", data_inicio: "2026-01-10T12:00:00Z",
      data_fim: "2026-12-10T12:00:00Z", data_proxima_cobranca: "2026-11-10T12:00:00Z", trial_with_card: false, payment_provider: "pagarme",
      created_at: "2026-01-10T12:00:00Z", updated_at: "2026-10-10T12:00:00Z", onboarding_completo: true, trial_canceled: false,
    }],
    configuracoes_loja: [{ id: "c1", user_id: USUARIO.id, nome_loja: "Loja Teste", cnpj: "00.000.000/0001-00", telefone: "11999990000", endereco: "Rua A, 1", logo_url: null, empresa_id: null }],
    user_onboarding: [{ user_id: USUARIO.id, completed: true, onboarding_completed: true, step: 99 }],
  };
}

// Casos: rota, admin, idioma do perfil, extras no navegador antes de abrir.
const CASOS = [
  { nome: "naoadmin-ptbr-configuracoes", rota: "/configuracoes", admin: false, idioma: "pt-BR" },
  { nome: "naoadmin-ptbr-dashboard", rota: "/dashboard", admin: false, idioma: "pt-BR" },
  { nome: "naoadmin-ptbr-aparencia", rota: "/configuracoes", admin: false, idioma: "pt-BR", aba: "Aparência" },
  { nome: "admin-ptbr-configuracoes", rota: "/configuracoes", admin: true, idioma: "pt-BR" },
  { nome: "admin-ptbr-dashboard", rota: "/dashboard", admin: true, idioma: "pt-BR" },
  // Não-admin com tudo apontando para espanhol: tem de continuar 100% pt-BR.
  { nome: "naoadmin-es-configuracoes", rota: "/configuracoes?lang=es", admin: false, idioma: "es", localStorage: { mecapp_idioma: "es" }, locale: "es-MX" },
  { nome: "naoadmin-es-aparencia", rota: "/configuracoes?lang=es", admin: false, idioma: "es", localStorage: { mecapp_idioma: "es" }, locale: "es-MX", aba: "Aparência" },
  { nome: "admin-es-configuracoes", rota: "/configuracoes", admin: true, idioma: "es" },
];

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

function filtrar(linhas, params) {
  return linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
}

const semHash = (p) => p.replace(/-[A-Za-z0-9_-]{8}(\.(js|css))$/, "$1");

async function abrir(navegador, caso, estado) {
  const ctx = await navegador.newContext({
    viewport: { width: 1366, height: 900 }, timezoneId: "America/Sao_Paulo", locale: caso.locale ?? "pt-BR", serviceWorkers: "block",
  });
  await ctx.clock.setFixedTime(AGORA);
  await ctx.addInitScript(({ sessao, extras }) => {
    if (sessionStorage.getItem("__iniciado")) return; // recarregar mantém o que a página gravou
    sessionStorage.setItem("__iniciado", "1");
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
    for (const [k, v] of Object.entries(extras)) localStorage.setItem(k, v);
  }, { sessao: SESSAO, extras: caso.localStorage ?? {} });
  await ctx.routeWebSocket(/supabase\.co/, () => { /* realtime: fica mudo */ });
  await ctx.route("**/*", async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (url.hostname === "127.0.0.1") {
      if (/\/assets\/.+\.(js|css)$/.test(url.pathname)) estado.arquivos.push(semHash(url.pathname));
      return r.continue();
    }
    if (url.protocol === "data:") return r.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return r.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return r.fulfill({ status: 200, json: SESSAO });
      if (url.pathname.startsWith("/functions/v1/")) {
        estado.consultas.push(`${req.method()} fn:${url.pathname.slice(14)}`);
        return r.fulfill({ status: 200, json: {} });
      }
      const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
      if (rpc) {
        estado.consultas.push(`${req.method()} rpc:${rpc[1]}`);
        return r.fulfill({ status: 200, json: null });
      }
      const m = url.pathname.match(/\/rest\/v1\/([a-z_0-9]+)/);
      if (m) {
        const params = [...url.searchParams.entries()].sort().map(([k, v]) => `${k}=${v}`).join("&");
        estado.consultas.push(`${req.method()} ${m[1]}?${params}`);
        if (req.method() === "PATCH") {
          const corpo = req.postDataJSON();
          estado.gravacoes.push({ tabela: m[1], params, corpo });
          for (const l of filtrar(estado.tabelas[m[1]] ?? [], url.searchParams)) Object.assign(l, corpo);
          return r.fulfill({ status: 204, body: "" });
        }
        if (req.method() !== "GET" && req.method() !== "HEAD") return r.fulfill({ status: 201, json: [] });
        const linhas = filtrar(estado.tabelas[m[1]] ?? [], url.searchParams);
        const headers = { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` };
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? r.fulfill({ status: 200, json: linhas[0] }) : r.fulfill({ status: 406, json: { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" } });
        }
        return r.fulfill({ status: 200, json: linhas, headers });
      }
      falhar(`[${caso.nome}] Supabase não simulado: ${req.method()} ${url.pathname}`);
      return r.fulfill({ status: 404, json: {} });
    }
    estado.externos.push(url.hostname);
    return r.abort();
  });
  return ctx;
}

async function esperarAssentar(pg) {
  await pg.waitForLoadState("networkidle");
  await pg.locator("[data-sidebar=sidebar]").first().waitFor({ timeout: 20000 });
  await pg.waitForTimeout(1500);
  await pg.waitForLoadState("networkidle");
  await pg.waitForTimeout(500);
}

async function foto(pg, estado) {
  return {
    html: await pg.evaluate(() => document.body.innerHTML),
    lang: await pg.evaluate(() => document.documentElement.lang),
    menu: await pg.locator("[data-sidebar=sidebar]").first().innerText(),
    localStorage: await pg.evaluate(() => localStorage.getItem("mecapp_idioma")),
    consultas: [...estado.consultas].sort(),
    arquivos: [...new Set(estado.arquivos)].sort(),
    gravacoes: estado.gravacoes,
    externos: [...new Set(estado.externos)].sort(),
  };
}

const novoEstado = (caso) => ({ tabelas: tabelasBase(caso), consultas: [], arquivos: [], gravacoes: [], externos: [] });

const navegador = await chromium.launch();
const resultado = {};

for (const caso of CASOS) {
  const estado = novoEstado(caso);
  const ctx = await abrir(navegador, caso, estado);
  try {
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => falhar(`[${caso.nome}] erro na página: ${e.message}`));
    await pg.goto(`${BASE}${caso.rota}`);
    await esperarAssentar(pg);
    if (!new URL(pg.url()).pathname.startsWith(caso.rota.split("?")[0])) falhar(`[${caso.nome}] redirecionou para ${pg.url()}`);
    if (caso.aba) {
      await pg.getByRole("tab", { name: caso.aba }).click();
      await pg.waitForTimeout(800);
      await pg.waitForLoadState("networkidle");
    }
    resultado[caso.nome] = await foto(pg, estado);
    await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-${caso.nome}.png`) });
    console.log(`${caso.nome}: lang=${resultado[caso.nome].lang} menu="${resultado[caso.nome].menu.split("\n").slice(0, 6).join(" | ")}"`);
  } catch (e) {
    falhar(`[${caso.nome}] ${e.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

// Fluxo do admin (só na branch): começa em pt-BR, troca para Español em
// Configurações > Aparência, o menu muda, o chunk "idioma-es-*" só é baixado
// nesse momento, e recarregar mantém a escolha.
if (FLUXO) {
  const caso = { nome: "fluxo-admin-troca", admin: true, idioma: "pt-BR" };
  const estado = novoEstado(caso);
  const ctx = await abrir(navegador, caso, estado);
  try {
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => falhar(`[fluxo] erro na página: ${e.message}`));
    await pg.goto(`${BASE}/configuracoes`);
    await esperarAssentar(pg);
    await pg.getByRole("tab", { name: "Aparência" }).click();
    await pg.waitForTimeout(800);
    const antes = await foto(pg, estado);
    await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-fluxo-1-antes.png`), fullPage: true });
    if (antes.arquivos.some((a) => a.includes("idioma-"))) falhar("[fluxo] chunk de idioma baixado ANTES da troca");
    await pg.getByRole("combobox", { name: "Idioma" }).click();
    const nPedidosAntes = estado.arquivos.length;
    await pg.getByRole("option", { name: "Español" }).click();
    await pg.waitForFunction(() => document.documentElement.lang === "es", null, { timeout: 10000 });
    await pg.waitForTimeout(800);
    const depois = await foto(pg, estado);
    await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-fluxo-2-depois.png`), fullPage: true });
    const baixadosNaTroca = estado.arquivos.slice(nPedidosAntes);
    await pg.reload();
    await esperarAssentar(pg);
    const recarregado = await foto(pg, estado);
    await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-fluxo-3-recarregado.png`) });
    resultado[caso.nome] = { antes, depois, recarregado, baixadosNaTroca };
    console.log(`fluxo: gravações=${JSON.stringify(depois.gravacoes)} baixados na troca=${JSON.stringify(baixadosNaTroca)}`);
    console.log(`fluxo: depois lang=${depois.lang} menu="${depois.menu.split("\n").slice(0, 6).join(" | ")}"`);
    console.log(`fluxo: recarregado lang=${recarregado.lang} menu="${recarregado.menu.split("\n").slice(0, 6).join(" | ")}"`);
  } catch (e) {
    falhar(`[fluxo] ${e.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

await navegador.close();
const arquivo = path.join(SAIDA, `coleta-${rotulo}.json`);
writeFileSync(arquivo, JSON.stringify(resultado, null, 1));
writeFileSync(path.join(SAIDA, `falhas-${rotulo}.json`), JSON.stringify(falhas, null, 1));
console.log(`${Object.keys(resultado).length} casos → ${arquivo}`);
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
