// Recibo / termo de garantia de dispositivo em HTML A4 (DialogReimprimirReciboVenda
// real, página dev/recibos-dialogos.html, Supabase simulado, dados fictícios):
// mede a altura do conteúdo (mm), gera o PDF do Chromium (A4, CSS de página do
// próprio documento) e diz em que folha ficam as assinaturas.
//
//   npx vite --port 8197 --strictPort --host 127.0.0.1         (na árvore a testar)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> PDFINFO=<binário pdfinfo> \
//     node scripts/testes-assinaturas-termo-garantia/html.playwright.mjs <rotulo> <pasta-saida>
//
// Caminhos: 1280 = janela (computador; o iframe do Android recebe o MESMO documento),
// 390ios = #print-root (iOS pelo Safari). O PDF do iOS instalado é medido em medirPdf.ts.
// SO_TERMO / SO_N / SO_LUGAR / SO_TELA / SO_ADMIN limitam a rodada (separados por vírgula).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TERMOS, linhasFixasDoTermo } from "./termosTeste.ts";

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo = "arvore", saidaArg = "saida-html"] = process.argv.slice(2);
const SAIDA = path.resolve(saidaArg);
mkdirSync(SAIDA, { recursive: true });
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8197/dev/recibos-dialogos.html";
const PDFINFO = process.env.PDFINFO ?? path.join(process.env.HOME, "Downloads/harness-os-a4/pdfinfo");
const so = (nome, todos) => (process.env[nome] ? process.env[nome].split(",") : todos);

const TELAS = {
  "1280": { viewport: { width: 1280, height: 900 } },
  "390ios": { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
};
const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated" } };

const EXTRAS = [
  { id: "disp-2", tipo: "Celular", marca: "Samsung", modelo: "Galaxy S24", cor: "Preto", capacidade_gb: 256, condicao: "novo", imei: "350000000000024", imei2: null, numero_serie: null, garantia: true, tempo_garantia: 12, fotos: [], foto_url: null, checklist: null },
  { id: "disp-3", tipo: "Celular", marca: "Motorola", modelo: "Edge 50", cor: "Verde", capacidade_gb: 256, condicao: "usado", imei: "350000000000050", imei2: null, numero_serie: null, garantia: true, tempo_garantia: 6, fotos: [], foto_url: null, checklist: null },
];

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

/** Tabelas do cenário "simples" com o termo da loja trocado e 1 a 3 aparelhos no grupo. */
function montarTabelas(base, termo, n, admin) {
  const t = structuredClone(base);
  t.user_roles = admin ? [{ user_id: USUARIO.id, role: "admin" }] : [];
  t.configuracoes_loja = t.configuracoes_loja.map((c) => ({ ...c, termo_garantia_dispositivo_config: { modo: "livre", termo_com_garantia: TERMOS[termo], termo_sem_garantia: "Venda sem garantia contratual." } }));
  const vendaDisp = t.vendas.find((v) => v.tipo === "dispositivo");
  t.vendas = [vendaDisp, ...EXTRAS.slice(0, n - 1).map((d, i) => ({ ...vendaDisp, id: `00000000-0000-4000-8000-00000000010${i}`, dispositivo_id: d.id, imei_dispositivo: d.imei, imei: d.imei, total: 1000 * (i + 2), tempo_garantia: d.tempo_garantia }))];
  t.dispositivos = [...t.dispositivos, ...EXTRAS.slice(0, n - 1)];
  return t;
}

async function contexto(navegador, tela, tabelas) {
  const ctx = await navegador.newContext({ ...TELAS[tela], timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
  await ctx.addInitScript(({ sessao }) => {
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
    window.__impressoes = [];
    window.open = () => ({ document: { write: (h) => window.__impressoes.push(`JANELA:${h}`), close: () => {} }, focus: () => {}, print: () => {}, close: () => {} });
    const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "srcdoc");
    Object.defineProperty(HTMLIFrameElement.prototype, "srcdoc", {
      set(v) { window.__impressoes.push(`IFRAME:${v}`); return desc.set.call(this, "<html><body></body></html>"); },
      get() { return desc.get.call(this); },
    });
    window.print = () => {
      const pr = document.getElementById("print-root");
      if (pr && pr.innerHTML) window.__impressoes.push(`PRINTROOT:${pr.innerHTML}`);
    };
  }, { sessao: SESSAO });
  await ctx.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "data:") return rota.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return rota.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return rota.fulfill({ status: 200, json: SESSAO });
      const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
      if (m && req.method() === "GET") {
        const linhas = m[1] in tabelas ? filtrar(tabelas[m[1]], url.searchParams) : [];
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? rota.fulfill({ status: 200, json: linhas[0] }) : rota.fulfill({ status: 406, json: { code: "PGRST116", message: "0 ou várias linhas" } });
        }
        return rota.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
      }
      return rota.fulfill({ status: 404, json: {} });
    }
    return rota.abort();
  });
  return ctx;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();

/** Altura do conteúdo (mm) na largura útil da folha + PDF A4 do Chromium com o CSS de página do documento. */
async function pdfDaPagina(pg, seletor, larguraUtilMm, arqPdf) {
  await pg.emulateMedia({ media: "print" });
  await pg.setViewportSize({ width: Math.round((larguraUtilMm * 96) / 25.4), height: 1100 });
  await pg.waitForTimeout(150);
  const alturaMm = await pg.evaluate((sel) => ((document.querySelector(sel) ?? document.body).getBoundingClientRect().height * 25.4) / 96, seletor);
  writeFileSync(arqPdf, await pg.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  return Math.round(alturaMm * 10) / 10;
}

/**
 * Documento capturado → folhas, folha das assinaturas e linhas do termo junto.
 * Janela/iframe: o documento sozinho numa página nova. #print-root: a própria
 * página do app (index.css de verdade), enquanto o #print-root está preenchido.
 */
async function medirDocumento(navegador, capturado, termo, prefixo, paginaApp) {
  const tipo = capturado.split(":")[0];
  const corpo = capturado.slice(tipo.length + 1);
  const larguraUtilMm = corpo.includes('class="rvn"') ? 190 : 186;
  const arqPdf = path.join(SAIDA, `${prefixo}.pdf`);
  let alturaMm;
  if (tipo === "PRINTROOT") {
    alturaMm = await pdfDaPagina(paginaApp, "#print-root", larguraUtilMm, arqPdf);
  } else {
    const ctx = await navegador.newContext({ viewport: { width: 800, height: 1100 } });
    await ctx.addInitScript(() => { window.print = () => {}; window.close = () => {}; });
    await ctx.route("**/*", (r) => (["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) || r.request().url().startsWith("data:") ? r.continue() : r.abort()));
    const pg = await ctx.newPage();
    await pg.setContent(corpo, { waitUntil: "load" });
    await pg.waitForTimeout(300);
    alturaMm = await pdfDaPagina(pg, "body", larguraUtilMm, arqPdf);
    await ctx.close();
  }
  const info = JSON.parse(execFileSync(PDFINFO, [arqPdf, "-"]).toString());
  const textos = info.textos.map(norm);
  const folhaAss = textos.findIndex((t) => t.includes("Assinatura do Vendedor")) + 1;
  const fixas = linhasFixasDoTermo(termo).map((l) => norm(l).slice(0, 24));
  const linhasJunto = folhaAss ? fixas.filter((l) => textos[folhaAss - 1].includes(l)).length : 0;
  // Folha depois da das assinaturas = só o rodapé do recibo novo (ou nada).
  const folhaDepois = info.paginas > folhaAss ? textos.slice(folhaAss).join(" ").slice(0, 80) : "";
  return { caminho: tipo, alturaMm, folhas: info.paginas, folhaAssinaturas: folhaAss, linhasTermoJunto: linhasJunto, assinaturaSozinha: folhaAss > 0 && linhasJunto === 0, folhaDepoisDasAssinaturas: folhaDepois };
}

const navegador = await chromium.launch();
const ctx0 = await navegador.newContext();
await ctx0.route("**/*", (r) => (["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.fulfill({ status: 404, json: {} })));
const pg0 = await ctx0.newPage();
await pg0.goto(`${BASE}?lugar=pdv&cenario=simples`, { waitUntil: "networkidle" });
const BASE_TABELAS = (await pg0.evaluate(() => window.__cenariosDialogos)).simples;
await ctx0.close();

const linhas = [];
const falhas = [];
for (const tela of so("SO_TELA", ["1280", "390ios"])) {
  for (const lugar of so("SO_LUGAR", ["recibo", "garantia"])) {
    for (const admin of so("SO_ADMIN", ["0", "1"])) {
      if (lugar === "garantia" && admin === "1") continue; // termo de garantia sempre no recibo antigo
      for (const termo of so("SO_TERMO", ["curto", "medio", "longo"])) {
        for (const n of so("SO_N", ["1", "2", "3"]).map(Number)) {
          const id = `${tela}-${lugar}-${admin === "1" ? "novo" : "antigo"}-${termo}-${n}ap`;
          const ctx = await contexto(navegador, tela, montarTabelas(BASE_TABELAS, termo, n, admin === "1"));
          try {
            const pg = await ctx.newPage();
            await pg.goto(`${BASE}?lugar=dispositivos${lugar === "garantia" ? "&modo=garantia" : ""}&cenario=simples`, { waitUntil: "networkidle" });
            await pg.waitForSelector("[role=dialog]");
            const botao = pg.getByRole("button", { name: "A4", exact: true });
            await botao.waitFor();
            await pg.waitForFunction(() => [...document.querySelectorAll("button")].every((b) => !b.disabled || b.textContent.trim() !== "A4"), null, { timeout: 15000 });
            await pg.waitForTimeout(600);
            await botao.click();
            await pg.waitForFunction(() => window.__impressoes.length > 0, null, { timeout: 10000 });
            await pg.waitForTimeout(200);
            const capturado = (await pg.evaluate(() => window.__impressoes))[0];
            const r = await medirDocumento(navegador, capturado, termo, `${rotulo}-${id}`, pg);
            const layout = capturado.includes('class="rvn"') ? "novo" : "antigo";
            if (layout !== (admin === "1" ? "novo" : "antigo")) falhas.push(`${id}: layout ${layout}`);
            linhas.push({ id, layout, ...r });
            writeFileSync(path.join(SAIDA, `${rotulo}-${id}.html`), capturado);
            console.log(`${id}: ${r.caminho} ${r.alturaMm} mm, ${r.folhas} folha(s), assinatura na ${r.folhaAssinaturas}, termo junto ${r.linhasTermoJunto}${r.assinaturaSozinha ? "  <- SOZINHA" : ""}${r.folhaDepoisDasAssinaturas ? `  <- FOLHA DEPOIS: ${r.folhaDepoisDasAssinaturas}` : ""}`);
          } catch (e) {
            falhas.push(`${id}: ${e.message.split("\n")[0]}`);
            console.log(`${id}: ERRO ${e.message.split("\n")[0]}`);
          } finally {
            await ctx.close();
          }
        }
      }
    }
  }
}
await navegador.close();
writeFileSync(path.join(SAIDA, `resumo-${rotulo}.json`), JSON.stringify({ linhas, falhas }, null, 1));
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK");
process.exit(falhas.length ? 1 : 0);
