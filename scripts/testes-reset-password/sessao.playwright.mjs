// /reset-password com o APP DE VERDADE (build de produção) e o Auth simulado.
// Dados 100% fictícios; nada sai da máquina (o resto é bloqueado).
//
// Cenário K: com o formulário aberto, o link já usado é aberto em outra aba e
// volta com #error. O auth-js apaga a sessão do localStorage compartilhado, e
// salvar a senha dava "Auth session missing!".
//
//   npx vite build
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> CHROMIUM_PATH=<executável, opcional> \
//     node scripts/testes-reset-password/sessao.playwright.mjs <dist>
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const DIST = path.resolve(process.argv[2] ?? "dist");

// ---------- servidor (imita a Vercel: arquivo inexistente → index.html) ----------
const TIPOS = { ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const servidor = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let arquivo = path.join(DIST, decodeURIComponent(url.pathname));
  if (!existsSync(arquivo) || statSync(arquivo).isDirectory()) arquivo = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": TIPOS[path.extname(arquivo)] ?? "application/octet-stream" });
  res.end(readFileSync(arquivo));
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${servidor.address().port}`;

// ---------- Auth simulado ----------
const agora = () => Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sessao) => `${b64({ alg: "HS256" })}.${b64({ sub: "u1", session_id: sessao, exp: agora() + 3600, role: "authenticated" })}.assinatura`;
const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", aud: "authenticated", role: "authenticated", email: "loja.teste@exemplo.test" };
const sessaoDoToken = (h) => { try { return JSON.parse(Buffer.from(h.split(" ")[1].split(".")[1], "base64url")).session_id; } catch { return null; } };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

const LINK_VALIDO = () => `#access_token=${jwt("recuperacao")}&expires_at=${agora() + 3600}&expires_in=3600&refresh_token=rt-recuperacao&token_type=bearer&type=recovery&sb=`;
const LINK_USADO = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=";

const executablePath = process.env.CHROMIUM_PATH;
const navegador = await chromium.launch(executablePath ? { executablePath } : {});

let falhas = 0;
const confere = (condicao, nome) => {
  console.log(`${condicao ? "ok   " : "FALHA"} ${nome}`);
  if (!condicao) falhas++;
};

async function abrirFormulario() {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const estado = { put: [], sessaoMorta: false, redeFora: false };
  await contexto.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === "127.0.0.1") return route.continue();
    if (url.pathname !== "/auth/v1/user") return route.abort();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: CORS });
    await new Promise((r) => setTimeout(r, 150)); // latência de rede
    if (estado.redeFora) return route.abort();
    const sessao = sessaoDoToken(req.headers()["authorization"] ?? "");
    if (req.method() === "PUT") estado.put.push(sessao);
    if (estado.sessaoMorta) {
      return route.fulfill({ status: 403, headers: CORS, json: { code: 403, error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" } });
    }
    return route.fulfill({ status: 200, headers: CORS, json: USUARIO });
  });
  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/reset-password${LINK_VALIDO()}`, { waitUntil: "domcontentloaded" });
  await pagina.locator("#confirm-password").waitFor({ timeout: 15000 });
  return { contexto, pagina, estado };
}

async function abrirLinkUsadoEmOutraAba(contexto, pagina) {
  const outra = await contexto.newPage();
  await outra.goto(`${BASE}/reset-password${LINK_USADO}`, { waitUntil: "domcontentloaded" });
  await outra.waitForTimeout(2500);
  await pagina.bringToFront();
}

const temSessaoGuardada = (pagina) =>
  pagina.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token")));

async function salvar(pagina) {
  await pagina.locator("#password").fill("NovaSenha123");
  await pagina.locator("#confirm-password").fill("NovaSenha123");
  await pagina.getByRole("button", { name: "Atualizar Senha" }).click();
  await pagina.waitForTimeout(1300);
  return pagina.evaluate(() => document.body.innerText);
}

// ---------- caminho normal ----------
{
  const { contexto, pagina, estado } = await abrirFormulario();
  const texto = await salvar(pagina);
  confere(/Senha atualizada/.test(texto), "link válido: senha atualizada");
  confere(estado.put.length === 1 && estado.put[0] === "recuperacao", "link válido: PUT com a sessão do link");
  await contexto.close();
}

// ---------- cenário K ----------
{
  const { contexto, pagina, estado } = await abrirFormulario();
  await abrirLinkUsadoEmOutraAba(contexto, pagina);
  confere(!(await temSessaoGuardada(pagina)), "K: a outra aba apagou a sessão guardada (pré-condição)");
  const texto = await salvar(pagina);
  confere(!/Auth session missing/.test(texto), "K: não mostra 'Auth session missing!'");
  confere(/Senha atualizada/.test(texto), "K: senha atualizada");
  confere(estado.put.length === 1 && estado.put[0] === "recuperacao", "K: PUT enviado com a sessão restaurada");
  await contexto.close();
}

// ---------- sessão morta no servidor, sem nada apagado no navegador ----------
{
  const { contexto, pagina, estado } = await abrirFormulario();
  estado.sessaoMorta = true;
  const texto = await salvar(pagina);
  confere(!/Auth session missing/.test(texto), "sessão morta: não mostra a mensagem crua");
  confere(!/Senha atualizada/.test(texto), "sessão morta: não finge sucesso");
  confere(/Este link não vale mais/.test(texto), "sessão morta: pede um novo link");
  await pagina.getByRole("button", { name: "Pedir novo link" }).click();
  await pagina.getByRole("button", { name: "Esqueceu a senha?" }).waitFor({ timeout: 10000 });
  confere(new URL(pagina.url()).pathname === "/auth", "sessão morta: botão volta para /auth");
  await contexto.close();
}

// ---------- cenário K com a sessão também morta no servidor ----------
{
  const { contexto, pagina, estado } = await abrirFormulario();
  await abrirLinkUsadoEmOutraAba(contexto, pagina);
  estado.sessaoMorta = true;
  const texto = await salvar(pagina);
  confere(/Este link não vale mais/.test(texto), "K + sessão morta: pede um novo link");
  confere(estado.put.length === 0, "K + sessão morta: restauração falha antes do PUT");
  await contexto.close();
}

// ---------- falha de rede não é sessão encerrada ----------
{
  const { contexto, pagina, estado } = await abrirFormulario();
  await abrirLinkUsadoEmOutraAba(contexto, pagina);
  estado.redeFora = true;
  const texto = await salvar(pagina);
  confere(!/Este link não vale mais/.test(texto), "sem rede: não diz que o link acabou");
  confere(await pagina.locator("#confirm-password").isVisible(), "sem rede: formulário segue na tela");
  estado.redeFora = false;
  await pagina.getByRole("button", { name: "Atualizar Senha" }).click();
  await pagina.waitForTimeout(1300);
  confere(/Senha atualizada/.test(await pagina.evaluate(() => document.body.innerText)), "sem rede: nova tentativa funciona quando a rede volta");
  await contexto.close();
}

await navegador.close();
servidor.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo ok");
process.exit(falhas ? 1 : 0);
