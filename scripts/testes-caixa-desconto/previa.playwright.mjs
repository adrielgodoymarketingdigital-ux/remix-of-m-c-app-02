// Prévia REAL do fechamento de caixa (DialogFechamentoCaixa) e o PATCH que o
// fechamento real (useCaixa.fecharCaixa) enviaria, com o Supabase SIMULADO e a
// rede bloqueada (só 127.0.0.1 passa; *.supabase.co responde daqui, nada sai
// da máquina). Dados 100% fictícios (src/dev/caixaFechamento/cenarios.ts).
//
//   npx vite --port 8105 --strictPort --host 127.0.0.1       (na árvore a testar)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> BASE_URL=http://127.0.0.1:8105/dev/caixa-fechamento.html \
//     node scripts/testes-caixa-desconto/previa.playwright.mjs coletar <rotulo> <pasta-saida> [capturas]
//   node scripts/testes-caixa-desconto/previa.playwright.mjs comparar <a.json> <b.json>
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.map((f) => JSON.parse(readFileSync(f, "utf8")));
  const casos = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  let diferentes = 0;
  for (const caso of casos) {
    const partes = ["html", "saldoContado", "patch"].filter((k) => JSON.stringify(a[caso]?.[k]) !== JSON.stringify(b[caso]?.[k]));
    if (partes.length) {
      diferentes++;
      console.log(`DIFERENTE: ${caso} (${partes.join(", ")})`);
    } else console.log(`igual:     ${caso}`);
  }
  console.log(`${casos.length} casos comparados, ${diferentes} diferente(s)`);
  process.exit(0);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo, saidaArg, capturasArg] = args;
const SAIDA = path.resolve(saidaArg ?? "previa-caixa");
const CAPTURAS = capturasArg === "capturas";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8105/dev/caixa-fechamento.html";
mkdirSync(SAIDA, { recursive: true });

const AGORA = "2026-11-16T20:00:00.000Z"; // mesmo de cenarios.ts
const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const TELAS = { "1280": { width: 1280, height: 1800 }, "390": { width: 390, height: 2400 } };
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(new Date(AGORA).getTime() / 1000) + 3600 * 24;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated" } };

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

/** Filtros do PostgREST que importam aqui (eq, is.null, in); o resto (gte/lte/or/order) é ignorado: os cenários só têm linhas da janela. */
function filtrar(linhas, params) {
  return linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset", "or"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
}

/** Devolve só as colunas pedidas no select (como o banco): o código antigo não recebe as colunas de desconto. */
function projetar(linhas, select) {
  if (!select || select.trim() === "*") return linhas;
  const colunas = [];
  let nivel = 0, atual = "";
  for (const ch of select) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) { colunas.push(atual.trim()); atual = ""; } else atual += ch;
  }
  if (atual.trim()) colunas.push(atual.trim());
  const nomes = colunas.map((c) => c.split("(")[0].split(":").pop().replace(/!.*/, "").trim());
  return linhas.map((l) => Object.fromEntries(nomes.filter((n) => n in l).map((n) => [n, l[n]])));
}

const navegador = await chromium.launch();

// Tabelas simuladas: vêm da própria página (cenarios.ts).
const ctx0 = await navegador.newContext({ serviceWorkers: "block" });
await ctx0.route("**/*", (r) => (new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort()));
const pg0 = await ctx0.newPage();
await pg0.goto(`${BASE}?cenario=inexistente`, { waitUntil: "networkidle" });
const CENARIOS = await pg0.evaluate(() => window.__cenariosCaixa);
await ctx0.close();
if (!CENARIOS) throw new Error("página sem window.__cenariosCaixa");

const resultado = {};
for (const cenario of Object.keys(CENARIOS)) {
  for (const lang of ["pt-BR", "es"]) {
    for (const tema of ["claro", "escuro"]) {
      for (const tela of Object.keys(TELAS)) {
        const caso = `${cenario}|${lang}|${tema}|${tela}`;
        try {
          resultado[caso] = await rodarCaso(cenario, lang, tema, tela);
          console.log(`ok ${caso}: esperado=${resultado[caso].saldoContado} patch.total_dinheiro=${resultado[caso].patch?.total_dinheiro}`);
        } catch (erro) {
          falhar(`[${caso}] ${String(erro.message).split("\n")[0]}`);
        }
      }
    }
  }
}

async function rodarCaso(cenario, lang, tema, tela) {
  const tabelas = structuredClone(CENARIOS[cenario]);
  const leituras = [];
  const patches = [];
  const ctx = await navegador.newContext({ viewport: TELAS[tela], timezoneId: "America/Sao_Paulo", locale: lang, serviceWorkers: "block", colorScheme: tema === "escuro" ? "dark" : "light" });
  await ctx.addInitScript(({ sessao }) => {
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
  }, { sessao: SESSAO });
  await ctx.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (url.hostname === "127.0.0.1" || url.protocol === "data:") return rota.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return rota.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return rota.fulfill({ status: 200, json: SESSAO });
      // Hora do servidor (Fase 1 do relógio). MODO_RPC=ausente simula a migration ainda não aplicada.
      if (url.pathname === "/rest/v1/rpc/agora_servidor") {
        return process.env.MODO_RPC === "ausente"
          ? rota.fulfill({ status: 404, json: { code: "PGRST202", message: "função não encontrada" } })
          : rota.fulfill({ status: 200, json: AGORA });
      }
      const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
      if (m && req.method() === "GET") {
        leituras.push(`${m[1]}?select=${url.searchParams.get("select")}`);
        const base = m[1] in tabelas ? tabelas[m[1]] : [];
        const linhas = projetar(filtrar(base, url.searchParams), url.searchParams.get("select"));
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? rota.fulfill({ status: 200, json: linhas[0] }) : rota.fulfill({ status: 406, json: { code: "PGRST116", message: "0 ou várias linhas" } });
        }
        return rota.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      if (m && m[1] === "caixas" && req.method() === "PATCH") {
        // O fechamento real: guarda o corpo e responde como o banco. Nada é gravado em lugar nenhum.
        patches.push({ filtro: url.search, corpo: req.postDataJSON() });
        return rota.fulfill({ status: 200, json: [{ id: "caixa-ficticio-1" }] });
      }
      falhar(`requisição ao Supabase não simulada: ${req.method()} ${url.pathname}`);
      return rota.fulfill({ status: 404, json: {} });
    }
    falhar(`requisição externa bloqueada: ${url.href}`);
    return rota.abort();
  });
  try {
    const pg = await ctx.newPage();
    await pg.clock.setFixedTime(new Date(AGORA));
    await pg.goto(`${BASE}?cenario=${cenario}&lang=${lang}&tema=${tema}`, { waitUntil: "networkidle" });
    const dialogo = pg.locator('[role="dialog"]');
    await dialogo.waitFor();
    // Prévia pronta: o botão de confirmar fica habilitado quando o resumo termina.
    // Botões do rodapé: [Cancelar, Confirmar] (o último button do diálogo é o X do Radix).
    const confirmar = dialogo.locator("button.flex-1").last();
    await pg.waitForFunction(() => {
      const bs = document.querySelectorAll('[role="dialog"] button.flex-1');
      const b = bs[bs.length - 1];
      return b && !b.disabled && document.querySelector("#saldo-contado");
    });
    await pg.waitForTimeout(300);
    const html = await dialogo.evaluate((el) => el.outerHTML);
    const saldoContado = await pg.locator("#saldo-contado").inputValue();
    const textoBotao = await confirmar.innerText();
    if (CAPTURAS) await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-${cenario}-${lang}-${tema}-${tela}.png`), fullPage: true });
    await confirmar.click();
    for (let i = 0; i < 50 && patches.length === 0; i++) await pg.waitForTimeout(100);
    if (patches.length !== 1) throw new Error(`esperava 1 PATCH em caixas, veio ${patches.length}`);
    return { html, saldoContado, textoBotao, patch: patches[0].corpo, filtroPatch: patches[0].filtro, leituras };
  } finally {
    await ctx.close();
  }
}

await navegador.close();
writeFileSync(path.join(SAIDA, `${rotulo}.json`), JSON.stringify(resultado, null, 1));
console.log(`${Object.keys(resultado).length} casos coletados em ${path.join(SAIDA, `${rotulo}.json`)}; ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
