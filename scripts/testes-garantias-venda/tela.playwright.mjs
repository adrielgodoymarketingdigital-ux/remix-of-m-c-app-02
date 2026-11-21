// Fase B de "Minhas garantias": a tela de verdade (dev/garantias-venda.html) com o
// Supabase simulado. Dados 100% fictícios; rede externa bloqueada; NADA é gravado
// (qualquer POST/PATCH/DELETE ao Supabase é falha).
//
//   npx vite --port 8205 --strictPort --host 127.0.0.1            (na árvore a testar)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> CHROMIUM_PATH=<chrome> \
//     node scripts/testes-garantias-venda/tela.playwright.mjs <pasta-saida> <rotulo> [so-nao-admin]
//   node scripts/testes-garantias-venda/tela.playwright.mjs comparar <a.json> <b.json>
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...resto] = process.argv;
if (acao === "comparar") {
  const [a, b] = resto.map((f) => JSON.parse(readFileSync(f, "utf8")));
  // Compara só os casos que existem dos dois lados (a main roda só os não admin).
  const casos = Object.keys(a).filter((c) => c in b).sort();
  const soDeUmLado = [...Object.keys(a), ...Object.keys(b)].filter((c) => !(c in a && c in b));
  if (soDeUmLado.length) console.log(`(fora da comparação, só de um lado: ${[...new Set(soDeUmLado)].sort().join(", ")})`);
  let dif = 0;
  for (const c of casos) {
    const iguais = JSON.stringify(a[c]) === JSON.stringify(b[c]);
    console.log(`${iguais ? "IGUAL    " : "DIFERENTE"} ${c}`);
    if (!iguais) { dif++; console.log("   main:  ", JSON.stringify(a[c])); console.log("   branch:", JSON.stringify(b[c])); }
  }
  console.log(`${casos.length} casos, ${dif} diferente(s)`);
  process.exit(dif ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const SAIDA = path.resolve(acao ?? "garantias-venda-tela");
const ROTULO = resto[0] ?? "branch";
const SO_NAO_ADMIN = resto[1] === "so-nao-admin";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8205/dev/garantias-venda.html";
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated" } };

let falhas = 0;
const ok = (c, m, x) => { if (c) console.log("  ✓", m); else { falhas++; console.log("  ✗", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };

const disp = (id, modelo, garantia, tempo) => ({
  id, marca: "Marca", modelo, tipo: "celular", cor: "Preto", capacidade_gb: 128, imei: null, imei2: null, garantia, tempo_garantia: tempo,
  condicao: "semi_novo", custo: 2000, preco: 3000, vendido: false, quantidade: 1, created_at: "2026-11-01T10:00:00Z", user_id: USUARIO.id,
  dispositivo_imeis: [], fornecedores: null, exibir_no_catalogo: true, deleted_at: null,
});
const DISPOSITIVOS = [disp("disp-a", "Modelo A", true, 6), disp("disp-b", "Modelo B", true, 9), disp("disp-c", "Modelo C", false, null)];
const gar = (id, nome, meses, ordem, extra = {}) => ({ id, user_id: USUARIO.id, empresa_id: null, nome, meses, texto: `TERMO ${nome} {{garantia_meses}} {{cliente}}`, ativo: true, ordem, revisar: false, origem: "manual", origem_ref: null, deleted_at: null, ...extra });
const GARANTIAS_LOJA = [
  gar("g-sem", "Sem garantia", 0, 0), gar("g-3", "Garantia 3 meses", 3, 10), gar("g-6a", "Garantia 6 meses A", 6, 20),
  gar("g-6b", "Garantia 6 meses B", 6, 30), gar("g-12", "Garantia 1 ano", 12, 40, { ativo: false }),
];
const TIPOS_GARANTIA = [{ id: "t3", user_id: USUARIO.id, nome: "3 meses", meses: 3, ativo: true }, { id: "t6", user_id: USUARIO.id, nome: "6 meses", meses: 6, ativo: true }];

async function abrir(navegador, { admin, garantias, tela, query }) {
  const ctx = await navegador.newContext({
    ...(tela === "390" ? { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 900 } }),
    locale: "pt-BR", timezoneId: "America/Sao_Paulo",
  });
  await ctx.addInitScript(({ sessao }) => localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao)), { sessao: SESSAO });
  const estado = { escritas: [], externas: [], leituras: [] };
  const tabelas = {
    user_roles: admin ? [{ role: "admin" }] : [], loja_funcionarios: [], empresa_usuarios: [], empresas: [],
    configuracoes_loja: [{ id: "cfg", user_id: USUARIO.id, empresa_id: null, nome_loja: "Loja Exemplo" }],
    garantias_loja: garantias, dispositivos: DISPOSITIVOS, tipos_garantia: TIPOS_GARANTIA,
  };
  await ctx.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "data:") return rota.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.startsWith("/auth/v1/user")) return rota.fulfill({ status: 200, json: SESSAO.user });
      if (url.pathname.startsWith("/auth/v1/token")) return rota.fulfill({ status: 200, json: SESSAO });
      const m = url.pathname.match(/\/rest\/v1\/(?:rpc\/)?([a-z_]+)/);
      if (req.method() !== "GET" && !(url.pathname.includes("/rpc/") && req.method() === "POST")) {
        estado.escritas.push(`${req.method()} ${url.pathname}`);
        return rota.fulfill({ status: 403, json: { message: "escrita bloqueada no teste" } });
      }
      const t = m?.[1] ?? "?";
      estado.leituras.push(t);
      const linhas = tabelas[t] ?? [];
      if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) {
        return linhas.length === 1 ? rota.fulfill({ status: 200, json: linhas[0] }) : rota.fulfill({ status: 406, json: { code: "PGRST116", message: "0 linhas" } });
      }
      return rota.fulfill({ status: 200, json: linhas, headers: { "content-range": `0-${Math.max(0, linhas.length - 1)}/${linhas.length}` } });
    }
    estado.externas.push(url.href);
    return rota.abort();
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on("pageerror", (e) => erros.push(e.message));
  await pg.goto(`${BASE}?${query}`, { waitUntil: "load" });
  await pg.waitForTimeout(1500);
  return { ctx, pg, estado, erros };
}

/** Tela parada 2 s: tempo de script quase zero (sem ciclo de renders). */
async function semCicloDeRender(pg, rotulo) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send("Performance.enable");
  const medir = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const a = await medir();
  await pg.waitForTimeout(2000);
  const b = await medir();
  const script = b.ScriptDuration - a.ScriptDuration;
  ok(script < 0.2, `${rotulo}: parada 2 s gasta ${(script * 1000).toFixed(0)} ms de script (sem ciclo de renders)`);
}

const capturas = async (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__capturas)));
const foto = (pg, nome) => pg.screenshot({ path: path.join(SAIDA, `${ROTULO}-${nome}.png`) });
const resultado = {};
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

/** PDV: escolhe o aparelho, (opcional) mexe no seletor, confirma; devolve o item capturado. */
async function casoPDV({ admin, garantias, tela, modelo, nome, mexer }) {
  const { ctx, pg, estado, erros } = await abrir(navegador, { admin, garantias, tela, query: "tela=pdv" });
  try {
  await pg.getByRole("tab", { name: /Dispositivos/ }).click();
  const linhaDisp = pg.locator("div.border", { hasText: `Marca ${modelo}` }).last();
  await linhaDisp.getByRole("button", { name: "Adicionar" }).click();
  await pg.waitForSelector(admin ? "[data-seletor-garantia='novo']" : "text=Tempo de garantia para o recibo");
  await pg.waitForTimeout(500);
  if (admin) await semCicloDeRender(pg, `[${tela}/pdv/${nome}]`);
  if (mexer) await mexer(pg);
  await foto(pg, `${tela}-pdv-${nome}`);
  await pg.getByRole("button", { name: "Confirmar", exact: true }).last().click();
  await pg.waitForTimeout(400);
  const cap = await capturas(pg);
  ok(estado.escritas.length === 0 && estado.externas.length === 0 && erros.length === 0, `[${tela}/pdv/${nome}] nada gravado, sem rede externa, sem erro`, { e: estado.escritas, x: estado.externas, erros });
  await ctx.close();
  return cap;
  } catch (e) {
    await foto(pg, `${tela}-pdv-${nome}-ERRO`).catch(() => {});
    ok(false, `[${tela}/pdv/${nome}] ${e.message.split("\n")[0]}`, { leituras: [...new Set(estado.leituras)], escritas: estado.escritas, erros });
    await ctx.close();
    return [];
  }
}

/** Cartão: clica "Vender no PDV", (opcional) mexe, confirma; devolve o state capturado em /pdv. */
async function casoCartao({ admin, garantias, tela, nome, query = "", mexer }) {
  const { ctx, pg, estado, erros } = await abrir(navegador, { admin, garantias, tela, query: `tela=cartao${query}` });
  await pg.getByRole("button", { name: /Vender no PDV/ }).first().click();
  await pg.waitForSelector("text=Garantia para o Recibo");
  if (admin) await pg.waitForSelector("[data-seletor-garantia='novo']");
  else await pg.waitForSelector("text=Selecione o tempo de garantia");
  await pg.waitForTimeout(500);
  if (admin) await semCicloDeRender(pg, `[${tela}/cartao/${nome}]`);
  if (mexer) await mexer(pg);
  await foto(pg, `${tela}-cartao-${nome}`);
  await pg.getByRole("button", { name: "Ir para o PDV" }).click();
  await pg.waitForSelector("#state-pdv");
  const cap = await capturas(pg);
  ok(estado.escritas.length === 0 && estado.externas.length === 0 && erros.length === 0, `[${tela}/cartao/${nome}] nada gravado, sem rede externa, sem erro`, { e: estado.escritas, x: estado.externas, erros });
  await ctx.close();
  return cap;
}

const escolherOpcao = (rotulo) => async (pg) => {
  await pg.locator("#seletor-garantia").click();
  await pg.getByRole("option", { name: rotulo }).click();
  await pg.waitForTimeout(300);
};

for (const tela of ["1280", "390"]) {
  console.log(`== ${tela} px: não admin (seletor antigo) ==`);
  for (const [modelo, nome] of [["Modelo A", "a-6m"], ["Modelo B", "b-9m"], ["Modelo C", "c-sem"]]) {
    const cap = await casoPDV({ admin: false, garantias: GARANTIAS_LOJA, tela, modelo, nome: `naoadmin-${nome}` });
    resultado[`${tela}/pdv/naoadmin/${nome}`] = cap;
    ok(cap.length === 1 && !("garantia_escolhida" in cap[0]), `[${tela}] PDV não admin ${nome}: item sem garantia_escolhida`, cap);
  }
  for (const [q, nome] of [["", "6m"], ["&sem=1", "sem"]]) {
    const cap = await casoCartao({ admin: false, garantias: GARANTIAS_LOJA, tela, nome: `naoadmin-${nome}`, query: q });
    resultado[`${tela}/cartao/naoadmin/${nome}`] = cap;
    ok(cap.length >= 1 && !("garantiaEscolhida" in cap[cap.length - 1]), `[${tela}] cartão não admin ${nome}: state sem garantiaEscolhida`, cap);
  }
  if (SO_NAO_ADMIN) continue;

  console.log(`== ${tela} px: admin (seletor novo) ==`);
  {
    const cap = await casoPDV({ admin: true, garantias: GARANTIAS_LOJA, tela, modelo: "Modelo A", nome: "admin-com-garantia" });
    const e = cap[0]?.garantia_escolhida;
    ok(e?.garantia_id === "g-6a" && e?.meses === 6 && cap[0].tempo_garantia === 6 && cap[0].modelo_termo_garantia_id === undefined,
      `[${tela}] PDV admin: aparelho de 6 meses → 1ª garantia de 6 meses pela ordem (A), prazo legado 6`, cap[0]);
    resultado[`${tela}/pdv/admin/com-garantia`] = cap;
  }
  {
    const cap = await casoPDV({ admin: true, garantias: GARANTIAS_LOJA, tela, modelo: "Modelo B", nome: "admin-personalizada" });
    const e = cap[0]?.garantia_escolhida;
    ok(e?.tipo === "personalizada" && e?.meses === 9 && e?.garantia_id === null && e?.nome === "Personalizada (9 meses)" && cap[0].tempo_garantia === 9,
      `[${tela}] PDV admin: 9 meses sem garantia igual → Personalizada (9 meses)`, cap[0]);
  }
  {
    const cap = await casoPDV({ admin: true, garantias: GARANTIAS_LOJA, tela, modelo: "Modelo A", nome: "admin-sem-garantia", mexer: escolherOpcao(/Sem garantia/) });
    const e = cap[0]?.garantia_escolhida;
    ok(e?.garantia_id === "g-sem" && e?.meses === 0 && cap[0].tempo_garantia === undefined, `[${tela}] PDV admin: escolheu "Sem garantia" → 0 meses, sem prazo legado`, cap[0]);
    resultado[`${tela}/pdv/admin/sem-garantia`] = cap;
  }
  {
    const cap = await casoPDV({ admin: true, garantias: [], tela, modelo: "Modelo A", nome: "admin-virtual" });
    const e = cap[0]?.garantia_escolhida;
    ok(e?.tipo === "virtual" && e?.garantia_id === null && e?.meses === 6 && e?.nome === "Garantia 6 meses", `[${tela}] PDV admin, loja sem garantias: padrão virtual de 6 meses`, cap[0]);
  }
  {
    const cap = await casoCartao({ admin: true, garantias: GARANTIAS_LOJA, tela, nome: "admin-com-garantia" });
    const s = cap[cap.length - 1];
    ok(s?.garantiaEscolhida?.garantia_id === "g-6a" && s?.dispositivoSelecionado?.tempo_garantia === 6, `[${tela}] cartão admin: state leva a garantia escolhida`, s);
  }
  {
    const cap = await casoCartao({ admin: true, garantias: GARANTIAS_LOJA, tela, nome: "admin-sem-garantia", mexer: escolherOpcao(/Sem garantia/) });
    const s = cap[cap.length - 1];
    ok(s?.garantiaEscolhida?.meses === 0 && s?.dispositivoSelecionado?.tempo_garantia === undefined, `[${tela}] cartão admin: "Sem garantia" → 0 meses`, s);
  }
}

await navegador.close();
writeFileSync(path.join(SAIDA, `${ROTULO}.json`), JSON.stringify(resultado, null, 2));
console.log(falhas === 0 ? `\nOK (${ROTULO})` : `\nFALHAS: ${falhas}`);
process.exit(falhas === 0 ? 0 : 1);
