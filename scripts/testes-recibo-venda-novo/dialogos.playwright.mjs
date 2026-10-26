// Diálogos REAIS de recibo (PDV, reimpressão em Vendas, Dispositivos vendidos)
// com o Supabase simulado. Coleta, para cada caso, o HTML do diálogo e o HTML
// que vai para a impressão (window.open, iframe ou #print-root), para comparar
// main × branch. Dados 100% fictícios; nada sai da máquina.
//
//   npx vite --port 8197 --strictPort --host 127.0.0.1         (na árvore a testar)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-recibo-venda-novo/dialogos.playwright.mjs \
//     coletar <rotulo> <admin 0|1> <pasta-saida> [capturas]
//   node scripts/testes-recibo-venda-novo/dialogos.playwright.mjs comparar <a.json> <b.json>
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.map((f) => JSON.parse(readFileSync(f, "utf8")));
  const casos = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  let diferentes = 0;
  for (const caso of casos) {
    const iguais = JSON.stringify(a[caso]) === JSON.stringify(b[caso]);
    if (!iguais) {
      diferentes++;
      console.log(`DIFERENTE: ${caso}`);
    }
  }
  console.log(`${casos.length} casos comparados, ${diferentes} diferente(s)`);
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo, adminArg, saidaArg, capturasArg] = args;
const ADMIN = adminArg === "1";
const SAIDA = path.resolve(saidaArg ?? "dialogos-recibo");
const CAPTURAS = capturasArg === "capturas";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8197/dev/recibos-dialogos.html";
mkdirSync(SAIDA, { recursive: true });

// SO_CENARIO / SO_LUGAR / SO_TELA (separados por vírgula) limitam a rodada.
const so = (nome, todos) => (process.env[nome] ? process.env[nome].split(",") : todos);
const CENARIOS = so("SO_CENARIO", ["simples", "troca", "parcelada", "duplo", "desconto", "garantia", "sem-logo", "imagem-quebrada"]);
const LUGARES = so("SO_LUGAR", ["pdv", "vendas", "dispositivos", "dispositivos-garantia"]);
const FORMATOS = ["A4", "80mm", "58mm"];
const TELAS = {
  "1280": { viewport: { width: 1280, height: 900 } },
  "390": { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
  "390ios": { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
};
const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
// PERFIL=funcionario: a sessão é de um funcionário ativo; a configuração da loja é do dono.
const PERFIL = process.env.PERFIL ?? "dono";
const DONO_ID = "00000000-0000-4000-8000-0000000000bb";
// FALHA=kit (o chunk do recibo novo não carrega) | FALHA=banco (a leitura da venda do recibo novo dá erro 500).
const FALHA = process.env.FALHA ?? "";

function tabelasDoPerfil(base) {
  if (PERFIL !== "funcionario") return base;
  return {
    ...base,
    configuracoes_loja: base.configuracoes_loja.map((c) => ({ ...c, user_id: DONO_ID })),
    loja_funcionarios: [...base.loja_funcionarios, { id: "func-self", nome: "Funcionário Teste", funcionario_user_id: USUARIO.id, loja_user_id: DONO_ID, ativo: true }],
  };
}

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated" } };

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

function filtrar(linhas, params) {
  return linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset"].includes(col)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
}

async function prepararContexto(navegador, tela, tabelas, registro) {
  const ctx = await navegador.newContext({ ...TELAS[tela], timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
  await ctx.addInitScript(({ sessao }) => {
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
    window.__impressoes = [];
    window.__copias = [];
    // "Copiar Texto": guarda o que iria para a área de transferência.
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { window.__copias.push(t); } }, configurable: true });
    // Janela de impressão (PDV, Vendas, Dispositivos no computador): guarda o HTML escrito.
    window.open = () => {
      const doc = { write: (h) => window.__impressoes.push(`JANELA:${h}`), close: () => {} };
      return { document: doc, focus: () => {}, print: () => {}, close: () => {} };
    };
    // iframe (Android): guarda o srcdoc.
    const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "srcdoc");
    Object.defineProperty(HTMLIFrameElement.prototype, "srcdoc", {
      set(v) { window.__impressoes.push(`IFRAME:${v}`); return desc.set.call(this, "<html><body></body></html>"); },
      get() { return desc.get.call(this); },
    });
    // #print-root (iOS fora do app instalado): guarda o que está no #print-root ao imprimir.
    window.print = () => {
      const pr = document.getElementById("print-root");
      if (pr && pr.innerHTML) window.__impressoes.push(`PRINTROOT:${pr.innerHTML}`);
    };
  }, { sessao: SESSAO });
  await ctx.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (FALHA === "kit" && url.pathname.includes("kitReciboNovo")) return rota.abort();
    if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "data:") return rota.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return rota.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return rota.fulfill({ status: 200, json: SESSAO });
      const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
      if (m && req.method() === "GET") {
        registro.push(m[1]);
        // Leitura da venda pelo recibo novo (carregarReciboVenda é a única que pede valor_troca + funcionario_id).
        if (FALHA === "banco" && m[1] === "vendas" && (url.searchParams.get("select") ?? "").includes("funcionario_id")) {
          return rota.fulfill({ status: 500, json: { message: "erro simulado" } });
        }
        const linhas = m[1] in tabelas ? filtrar(tabelas[m[1]], url.searchParams) : (falhar(`tabela sem mock: ${m[1]}`), []);
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? rota.fulfill({ status: 200, json: linhas[0] }) : rota.fulfill({ status: 406, json: { code: "PGRST116", message: "0 ou várias linhas" } });
        }
        return rota.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      falhar(`requisição ao Supabase não simulada: ${req.method()} ${url.pathname}`);
      return rota.fulfill({ status: 404, json: {} });
    }
    falhar(`requisição externa bloqueada: ${url.href}`);
    return rota.abort();
  });
  return ctx;
}

async function documentoParaCapturas(navegador, html, prefixo) {
  const doc = html.replace(/^(JANELA|IFRAME|PRINTROOT):/, "");
  const ctx = await navegador.newContext({ viewport: { width: 718, height: 1047 } });
  await ctx.addInitScript(() => { window.print = () => {}; window.close = () => {}; });
  await ctx.route("**/*", (r) => (["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) || r.request().url().startsWith("data:") ? r.continue() : r.abort()));
  const pg = await ctx.newPage();
  await pg.setContent(doc.startsWith("<!DOCTYPE") ? doc : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${doc}</body></html>`, { waitUntil: "load" });
  await pg.waitForTimeout(500);
  await pg.emulateMedia({ media: "print" });
  await pg.screenshot({ path: path.join(SAIDA, `${prefixo}-impressao.png`), fullPage: true });
  const pdf = await pg.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  writeFileSync(path.join(SAIDA, `${prefixo}-a4.pdf`), pdf);
  const paginas = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  await ctx.close();
  return paginas;
}

const navegador = await chromium.launch();
const resultado = {};
const resumo = [];

// Tabelas simuladas: vêm da própria página (cenariosDialogos.ts).
const ctx0 = await navegador.newContext();
await ctx0.route("**/*", (r) => (["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.fulfill({ status: 404, json: {} })));
const pg0 = await ctx0.newPage();
await pg0.goto(`${BASE}?lugar=pdv&cenario=simples`, { waitUntil: "networkidle" });
const TABELAS = await pg0.evaluate(() => window.__cenariosDialogos);
await ctx0.close();

for (const tela of so("SO_TELA", ["1280", "390", "390ios"])) {
  for (const lugar of LUGARES) {
    // iOS só muda o caminho de impressão de Dispositivos (#print-root); PDV e Vendas usam a mesma janela.
    if (tela === "390ios" && !lugar.startsWith("dispositivos")) continue;
    for (const cenario of CENARIOS) {
      // Máquina carregada às vezes atrasa um clique ou a página: cada caso tem 2 tentativas.
      for (let tentativa = 1; tentativa <= 2; tentativa++) {
        const falhasCaso = [];
        try {
          await rodarCaso(tela, lugar, cenario, falhasCaso);
        } catch (erro) {
          falhasCaso.push(`[${tela}/${lugar}/${cenario}] ${erro.message.split("\n")[0]}`);
        }
        if (!falhasCaso.length) break;
        if (tentativa === 2) falhasCaso.forEach(falhar);
        else console.log(`  nova tentativa: ${tela}/${lugar}/${cenario} (${falhasCaso[0]})`);
      }
    }
  }
}

async function rodarCaso(tela, lugar, cenario, falhasCaso) {
  const falharCaso = (m) => falhasCaso.push(m);
  const tabelas = { ...tabelasDoPerfil(TABELAS[cenario]), user_roles: ADMIN ? [{ user_id: USUARIO.id, role: "admin" }] : [] };
  const registro = [];
  const ctx = await prepararContexto(navegador, tela, tabelas, registro);
  try {
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => falharCaso(`[${tela}/${lugar}/${cenario}] erro na página: ${e.message}`));
    const lugarUrl = lugar === "dispositivos-garantia" ? "dispositivos&modo=garantia" : lugar;
    await pg.goto(`${BASE}?lugar=${lugarUrl}&cenario=${cenario}`, { waitUntil: "networkidle" });
    await pg.waitForSelector("[role=dialog]");
    await pg.waitForTimeout(400);
    await pg.getByRole("button", { name: "A4", exact: true }).waitFor();
    await pg.waitForFunction(() => [...document.querySelectorAll("button")].every((b) => !b.disabled || !/^(A4|80mm|58mm)$/.test(b.textContent.trim())), null, { timeout: 15000 }).catch(() => falharCaso(`[${tela}/${lugar}/${cenario}] botões continuaram desabilitados`));
    await pg.waitForTimeout(300);
    const caso = `${tela}|${lugar}|${cenario}`;
    const dialogo = await pg.locator("[role=dialog]").evaluate((el) => el.outerHTML);
    if (CAPTURAS) await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-${ADMIN ? "admin" : "naoadmin"}-${tela}-${lugar}-${cenario}-dialogo.png`), fullPage: true });
    const impressoes = {};
    for (const formato of FORMATOS) {
      await pg.evaluate(() => { window.__impressoes = []; });
      await pg.getByRole("button", { name: formato, exact: true }).click();
      // Espera algo ir para a impressão (máquina carregada atrasa o clique), e mais um pouco.
      await pg.waitForFunction(() => window.__impressoes.length > 0, null, { timeout: 10000 }).catch(() => {});
      await pg.waitForTimeout(300);
      impressoes[formato] = await pg.evaluate(() => window.__impressoes.slice());
      if (!impressoes[formato].length) falharCaso(`[${caso}] ${formato}: nada foi para a impressão`);
    }
    // "Copiar Texto" (PDV e Vendas): o texto copiado também tem de ser o de sempre.
    let copia = null;
    const botaoCopiar = pg.getByRole("button", { name: "Copiar Texto" });
    if (await botaoCopiar.count()) {
      await pg.evaluate(() => { window.__copias = []; });
      await botaoCopiar.click();
      await pg.waitForFunction(() => window.__copias.length > 0, null, { timeout: 10000 }).catch(() => falharCaso(`[${caso}] Copiar Texto não copiou nada`));
      copia = await pg.evaluate(() => window.__copias[0] ?? null);
    }
    if (falhasCaso.length) return;
    resultado[caso] = { dialogo, impressoes, copia, // user_roles fica de fora: no app o cache de admin já vem do menu (aqui não há menu).
      consultas: [...new Set(registro)].filter((t) => t !== "user_roles").sort() };
    const a4 = impressoes.A4[0] ?? "";
    const novo = a4.includes('class="rvn"');
    resumo.push({ caso, a4: novo ? "novo" : "antigo", caminho: a4.split(":")[0], termico: impressoes["80mm"].some((h) => h.includes('class="rvn"')) ? "NOVO(!)" : "antigo" });
    if (CAPTURAS && a4 && tela !== "390ios") {
      const paginas = await documentoParaCapturas(navegador, a4, `${rotulo}-${ADMIN ? "admin" : "naoadmin"}-${tela}-${lugar}-${cenario}`);
      resumo.at(-1).paginasA4 = paginas;
    }
  } finally {
    await ctx.close();
  }
}
await navegador.close();

const arquivo = path.join(SAIDA, `coleta-${rotulo}-${ADMIN ? "admin" : "naoadmin"}.json`);
writeFileSync(arquivo, JSON.stringify(resultado));
writeFileSync(path.join(SAIDA, `resumo-${rotulo}-${ADMIN ? "admin" : "naoadmin"}.json`), JSON.stringify({ resumo, falhas }, null, 1));
console.log(`${Object.keys(resultado).length} casos → ${arquivo}`);
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
