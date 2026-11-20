// "Minhas garantias" (fase A): a tela de verdade (dev/minhas-garantias.html) com
// o Supabase simulado. Dados 100% fictícios; rede externa bloqueada; nada sai da máquina.
//
//   npx vite --port 8204 --strictPort --host 127.0.0.1          (na worktree)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/minhas-garantias/tela.playwright.mjs <pasta-saida>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const SAIDA = path.resolve(process.argv[2] ?? "minhas-garantias-tela");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8204/dev/minhas-garantias.html";
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated" } };

let falhas = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log("  ✓", msg);
  else { falhas++; console.log("  ✗", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 500)); }
};

const linha = (p) => ({
  id: p.id, user_id: USUARIO.id, empresa_id: null, nome: "G", meses: 3, texto: "Texto {{garantia_meses}}", ativo: true, ordem: 10,
  revisar: false, origem: "manual", origem_ref: null, created_at: "2026-11-20T10:00:00Z", updated_at: "2026-11-20T10:00:00Z", deleted_at: null, ...p,
});

async function abrir(navegador, { admin, garantias, tela = "1280" }) {
  const ctx = await navegador.newContext({
    ...(tela === "390" ? { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 900 } }),
    locale: "pt-BR", timezoneId: "America/Sao_Paulo",
  });
  await ctx.addInitScript(({ sessao }) => localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao)), { sessao: SESSAO });
  const estado = { garantias: [...garantias], gravacoes: [], leituras: [], externas: [] };
  const tabelas = () => ({
    user_roles: admin ? [{ role: "admin" }] : [],
    loja_funcionarios: [],
    empresa_usuarios: [],
    empresas: [],
    configuracoes_loja: [{ id: "cfg", user_id: USUARIO.id, empresa_id: null, nome_loja: "Loja Exemplo", cnpj: "00.000.000/0001-00", telefone: "(00) 0000-0000" }],
    garantias_loja: estado.garantias,
  });
  await ctx.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "data:") return rota.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return rota.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return rota.fulfill({ status: 200, json: SESSAO });
      const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
      if (m) {
        const t = m[1];
        if (req.method() === "GET") {
          estado.leituras.push(`${t}?${url.searchParams.toString()}`);
          const linhas = tabelas()[t] ?? [];
          if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
            return linhas.length === 1 ? rota.fulfill({ status: 200, json: linhas[0] }) : rota.fulfill({ status: 406, json: { code: "PGRST116", message: "0 linhas" } });
          }
          return rota.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
        }
        const corpo = req.postDataJSON();
        estado.gravacoes.push({ metodo: req.method(), tabela: t, filtros: url.searchParams.toString(), corpo });
        if (t === "garantias_loja" && req.method() === "POST") {
          for (const [i, c] of (Array.isArray(corpo) ? corpo : [corpo]).entries()) estado.garantias.push(linha({ id: `novo-${estado.garantias.length}-${i}`, ...c }));
        }
        if (t === "garantias_loja" && req.method() === "PATCH") {
          const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
          estado.garantias = estado.garantias.map((g) => (g.id === id ? { ...g, ...corpo } : g));
        }
        return rota.fulfill({ status: 201, json: [] });
      }
    }
    estado.externas.push(url.href);
    return rota.abort();
  });
  const pg = await ctx.newPage();
  const errosPagina = [];
  pg.on("pageerror", (e) => errosPagina.push(e.message));
  await pg.goto(BASE, { waitUntil: "networkidle" });
  return { ctx, pg, estado, errosPagina };
}

const foto = (pg, nome) => pg.screenshot({ path: path.join(SAIDA, `${nome}.png`), fullPage: false });
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// ── A) usuário comum: não vê nada ───────────────────────────────────────────
console.log("A) usuário comum (dono, não admin)");
{
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, { admin: false, garantias: [] });
  await pg.click("#menu-configuracoes");
  await pg.waitForSelector("text=Tipos de Garantia");
  await pg.waitForTimeout(800);
  ok(await pg.locator("text=Minhas garantias").count() === 0, "item 'Minhas garantias' NÃO aparece no menu");
  await foto(pg, "a-comum-menu");
  ok(!estado.leituras.some((l) => l.startsWith("garantias_loja")), "nenhuma leitura de garantias_loja", estado.leituras);
  ok(estado.gravacoes.length === 0 && errosPagina.length === 0, "nada gravado, sem erro na página", { g: estado.gravacoes, errosPagina });
  await ctx.close();
}

// ── B) admin, loja sem nada: padrões virtuais; editar grava as 4 ────────────
for (const tela of ["1280", "390"]) {
  console.log(`B) admin, loja sem garantias (${tela})`);
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, { admin: true, garantias: [], tela });
  await pg.click("#menu-configuracoes");
  await pg.click("text=Minhas garantias");
  await pg.waitForSelector("text=Estas são as garantias padrão");
  await pg.locator('li:has-text("Garantia 12 meses")').waitFor();
  await pg.waitForTimeout(400); // fim da animação de abertura
  for (const n of ["Sem garantia", "Garantia 3 meses", "Garantia 6 meses", "Garantia 12 meses"]) {
    ok(await pg.locator(`li:has-text("${n}")`).count() >= 1, `lista mostra "${n}"`);
  }
  ok(estado.gravacoes.length === 0, "abrir não grava nada (padrões são virtuais)");
  await foto(pg, `b-${tela}-lista-virtual`);

  await pg.locator('li:has-text("Garantia 3 meses")').getByRole("button", { name: "Editar" }).click();
  await pg.waitForSelector("text=Prévia com dados de exemplo");
  const previa = await pg.locator("pre").innerText();
  ok(previa.includes("1. GARANTIA CONTRATUAL (3 meses)") && previa.includes("Maria Exemplo") && !previa.includes("{{"), "prévia com dados de exemplo e prazo trocado", previa.slice(0, 300));
  await foto(pg, `b-${tela}-editar`);

  const area = pg.locator("#garantia-texto");
  await area.fill("Garantia de 6 meses para {{cliente}}.");
  await pg.waitForSelector("text=O texto fala em");
  await foto(pg, `b-${tela}-alerta-prazo`);
  await pg.getByRole("button", { name: "Salvar", exact: true }).click();
  await pg.waitForSelector("text=Prazo diferente no texto");
  await pg.getByRole("button", { name: "Salvar mesmo assim" }).click();
  await pg.waitForSelector("text=Minhas garantias >> nth=0");
  await pg.waitForTimeout(600);
  const posts = estado.gravacoes.filter((g) => g.tabela === "garantias_loja" && g.metodo === "POST");
  const corpo = posts[0]?.corpo ?? [];
  ok(posts.length === 1 && corpo.length === 4, "1 INSERT com as 4 padrão", estado.gravacoes);
  ok(corpo.map((c) => c.origem_ref).join() === "padrao:0,padrao:3,padrao:6,padrao:12" && corpo.every((c) => c.origem === "padrao" && c.user_id === USUARIO.id),
    "origem 'padrao' com origem_ref e dono certos", corpo.map((c) => [c.origem, c.origem_ref, c.user_id]));
  ok(corpo[1]?.texto === "Garantia de 6 meses para {{cliente}}." && corpo[1]?.meses === 3, "a editada vai com o texto novo", corpo[1]);
  ok(!estado.gravacoes.some((g) => g.tabela !== "garantias_loja"), "nenhuma outra tabela gravada", estado.gravacoes.map((g) => g.tabela));
  ok(estado.externas.length === 0 && errosPagina.length === 0, "sem rede externa e sem erro na página", { externas: estado.externas, errosPagina });
  await foto(pg, `b-${tela}-depois-de-salvar`);
  await ctx.close();
}

// ── C) admin, loja com garantias (importada para revisar, desativada) ───────
console.log("C) admin, loja com garantias");
{
  const garantias = [
    linha({ id: "g0", nome: "Sem garantia", meses: 0, ordem: 0, origem: "termo_global", origem_ref: "sem" }),
    linha({ id: "g1", nome: "Garantia 3 meses", meses: 3, ordem: 10, origem: "tipos_garantia", origem_ref: "t1" }),
    linha({ id: "g2", nome: "Seminovo vitrine", meses: 3, ordem: 101, revisar: true, origem: "modelo", origem_ref: "m_x:com" }),
    linha({ id: "g3", nome: "Garantia 1 ano", meses: 12, ordem: 30, ativo: false, origem: "tipos_garantia", origem_ref: "t2" }),
    linha({ id: "g9", nome: "Apagada", meses: 3, ordem: 5, deleted_at: "2026-11-01T00:00:00Z" }),
  ];
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, { admin: true, garantias });
  await pg.click("#menu-configuracoes");
  await pg.click("text=Minhas garantias");
  await pg.waitForSelector('li:has-text("Seminovo vitrine")');
  ok(await pg.locator("text=Estas são as garantias padrão").count() === 0, "sem aviso de padrão (a loja tem linhas)");
  ok(await pg.locator('li:has-text("Apagada")').count() === 0, "apagada não aparece");
  ok(await pg.locator('li:has-text("Seminovo vitrine") >> text=Revise o prazo').count() === 1, "selo 'Revise o prazo'");
  ok(await pg.locator('li:has-text("Garantia 1 ano") >> text=Desativada').count() === 1, "selo 'Desativada'");
  const ordem = await pg.locator("li span.font-medium").allInnerTexts();
  ok(ordem.join("|") === "Sem garantia|Garantia 3 meses|Garantia 1 ano|Seminovo vitrine", "ordem da lista", ordem);
  await foto(pg, "c-1280-lista");

  await pg.locator('li:has-text("Garantia 3 meses")').getByRole("button", { name: "Duplicar" }).click();
  await pg.waitForTimeout(600);
  await pg.getByRole("button", { name: "Excluir Seminovo vitrine" }).click();
  await pg.getByRole("button", { name: "Excluir", exact: true }).click();
  await pg.waitForTimeout(600);
  const g = estado.gravacoes;
  ok(g[0]?.metodo === "POST" && g[0].corpo.length === 1 && g[0].corpo[0].nome === "Garantia 3 meses (cópia)" && g[0].corpo[0].origem === "manual",
    "duplicar: 1 INSERT 'Garantia 3 meses (cópia)'", g[0]);
  ok(g[1]?.metodo === "PATCH" && g[1].filtros.includes("id=eq.g2") && typeof g[1].corpo.deleted_at === "string" && Object.keys(g[1].corpo).join() === "deleted_at",
    "excluir: só preenche deleted_at da g2", g[1]);
  ok(errosPagina.length === 0 && estado.externas.length === 0, "sem erro e sem rede externa", { errosPagina, externas: estado.externas });
  await foto(pg, "c-1280-depois");
  await ctx.close();
}

await navegador.close();
writeFileSync(path.join(SAIDA, "resultado.txt"), falhas === 0 ? "OK\n" : `FALHAS: ${falhas}\n`);
console.log(falhas === 0 ? "\nOK: tela conferida" : `\nFALHAS: ${falhas}`);
process.exit(falhas === 0 ? 0 : 1);
