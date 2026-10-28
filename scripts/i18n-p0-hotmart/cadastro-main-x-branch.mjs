// Cadastro do Auth.tsx: compara o pedido de signUp de duas versões do app
// (main × branch), byte a byte depois de tirar o code_challenge (aleatório
// a cada cadastro, gerado pelo supabase-js).
//
// Nada sai da máquina: o Turnstile é trocado por um falso, o /auth/v1/signup
// é respondido localmente com "e-mail já cadastrado" (o app para ali, sem
// webhook nem tracking) e qualquer outro pedido fora de localhost é abortado.
//
// Rodar (playwright-core não é dependência do projeto):
//   npm i --prefix /tmp/pw playwright-core@1.56.1
//   (vite da main em 5191 e da branch em 5192)
//   PW_DIR=/tmp/pw CHROMIUM=<caminho do chrome-headless-shell> \
//     node scripts/i18n-p0-hotmart/cadastro-main-x-branch.mjs http://localhost:5191 http://localhost:5192
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(join(resolve(process.env.PW_DIR ?? "."), "noop.js"));
const { chromium } = require("playwright-core");

const [MAIN, BRANCH] = process.argv.slice(2);
if (!MAIN || !BRANCH) throw new Error("uso: node cadastro-main-x-branch.mjs <url main> <url branch>");

const TURNSTILE_FALSO = `window.turnstile = {
  render(el, o) { setTimeout(() => o.callback("token-turnstile-falso"), 50); return "w1"; },
  reset() {}, remove() {}
};`;

const CENARIOS = [
  { nome: "BR /auth sem parâmetros", caminho: "/auth", celular: "11987654321", intl: false },
  { nome: "BR /auth com utm", caminho: "/auth?utm_source=teste&utm_medium=cpc&utm_campaign=c1&utm_content=a1&utm_term=t1", celular: "(21) 3456-7890", intl: false },
  { nome: "BR /auth?intl=0", caminho: "/auth?intl=0", celular: "11987654321", intl: false },
  { nome: "BR /cadastro-trial", caminho: "/cadastro-trial?plan=basico_mensal", celular: "11987654321", intl: false },
  { nome: "INTL /auth?intl=1", caminho: "/auth?intl=1", celular: "+52 55 1234 5678", intl: true },
  { nome: "INTL /auth?intl=1 com utm", caminho: "/auth?intl=1&utm_source=teste&utm_campaign=es1", celular: "+57 300 123 4567", intl: true },
];

async function capturarSignup(navegador, base, cenario) {
  const contexto = await navegador.newContext();
  await contexto.addCookies([
    { name: "_fbp", value: "fb.1.1700000000000.123456", url: base },
    { name: "_fbc", value: "fb.1.1700000000000.abc", url: base },
  ]);
  const pagina = await contexto.newPage();
  const foraDaMaquina = [];
  let corpo = null;

  await pagina.route("**/*", async (rota) => {
    const url = rota.request().url();
    if (url.startsWith("https://challenges.cloudflare.com/turnstile/")) {
      return rota.fulfill({ status: 200, contentType: "application/javascript", body: TURNSTILE_FALSO });
    }
    if (url.includes("/auth/v1/signup")) {
      corpo = rota.request().postData();
      return rota.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", email: "teste@exemplo.com", identities: [] }),
      });
    }
    if (url.startsWith(base)) return rota.continue();
    foraDaMaquina.push(url.split("?")[0]);
    return rota.abort();
  });

  await pagina.goto(base + cenario.caminho);
  await pagina.getByRole("button", { name: /Cadastre-se/ }).click();
  await pagina.locator("#nome").fill("Loja Teste");
  await pagina.locator("#celular").pressSequentially(cenario.celular);
  await pagina.locator("#email").fill("teste@exemplo.com");
  await pagina.locator("#password").fill("senha1234");
  await pagina.waitForFunction(() => !!window.turnstile);
  await pagina.waitForTimeout(300); // callback do Turnstile falso
  await pagina.locator('button[type="submit"]').click();
  for (let i = 0; i < 100 && corpo === null; i++) await pagina.waitForTimeout(100);
  await contexto.close();
  if (corpo === null) throw new Error(`${cenario.nome} em ${base}: o signUp não foi enviado`);
  return { corpo, foraDaMaquina };
}

// code_challenge muda a cada cadastro; o resto tem de ser idêntico
const normalizar = (bruto) => {
  const j = JSON.parse(bruto);
  if (typeof j.code_challenge === "string" && j.code_challenge.length > 20) j.code_challenge = "<aleatorio>";
  return JSON.stringify(j);
};

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
let falhas = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log("  ✓", msg);
  else { falhas++; console.log("  ✗", msg, extra === undefined ? "" : extra); }
};

for (const c of CENARIOS) {
  console.log(`\n== ${c.nome} ==`);
  const a = await capturarSignup(navegador, MAIN, c);
  const b = await capturarSignup(navegador, BRANCH, c);
  const na = normalizar(a.corpo);
  const nb = normalizar(b.corpo);
  const dadosA = JSON.parse(na).data;
  const dadosB = JSON.parse(nb).data;
  console.log("  main  :", JSON.stringify(dadosA));
  console.log("  branch:", JSON.stringify(dadosB));
  if (!c.intl) {
    ok(na === nb, `pedido de signUp idêntico byte a byte (${nb.length} bytes, fora o code_challenge)`, { main: na, branch: nb });
    ok(!("mercado" in dadosB) && !("idioma" in dadosB), "sem mercado/idioma no options.data");
  } else {
    const { mercado, idioma, ...restoB } = dadosB;
    ok(mercado === "ES_LATAM" && idioma === "es", "branch manda mercado ES_LATAM e idioma es");
    ok(!("mercado" in dadosA) && !("idioma" in dadosA), "main não mandava mercado/idioma (o bug)");
    ok(JSON.stringify(restoB) === JSON.stringify(dadosA), "fora mercado/idioma, options.data igual ao da main");
    const { data: _a, ...foraA } = JSON.parse(na);
    const { data: _b, ...foraB } = JSON.parse(nb);
    ok(JSON.stringify(foraA) === JSON.stringify(foraB), "resto do pedido (e-mail, senha, captcha) igual");
    ok(!("pais" in dadosB) && !("moeda" in dadosB), "país e moeda não são enviados (continuam pelo DEFAULT)");
  }
  ok(JSON.stringify(a.foraDaMaquina) === JSON.stringify(b.foraDaMaquina),
    `mesmos pedidos para fora da máquina (todos abortados: ${b.foraDaMaquina.length})`, { main: a.foraDaMaquina, branch: b.foraDaMaquina });
}

await navegador.close();
console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
