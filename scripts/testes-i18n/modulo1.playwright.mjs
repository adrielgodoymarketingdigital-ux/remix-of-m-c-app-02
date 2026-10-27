// Etapa 5A do i18n (menu do celular, Dashboard e Configurações) com o APP DE
// VERDADE (build de produção) e o Supabase simulado. Dados 100% fictícios;
// nada sai da máquina (o resto é bloqueado e registrado).
//
//   npx vite build && npx vite preview --port 8312 --strictPort --host 127.0.0.1   (em cada árvore)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-i18n/modulo1.playwright.mjs \
//     coletar <rotulo> <base-url> <pasta-saida> [ptbr|es|tudo]
//   node scripts/testes-i18n/modulo1.playwright.mjs comparar <a.json> <b.json>
//
// Cada caso: HTML do <body>, lang, consultas ao Supabase, arquivos JS/CSS
// pedidos (sem hash) e, nos casos em espanhol, os textos visíveis com cara de
// português e os elementos com texto cortado/estourado.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.slice(0, 2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  const casos = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((c) => !c.includes("-es-")).sort();
  let diferentes = 0;
  const sobra = (x, y) => { const r = [...y]; return x.filter((i) => { const k = r.indexOf(i); if (k < 0) return true; r.splice(k, 1); return false; }); };
  for (const caso of casos) {
    const campos = ["html", "lang", "consultas", "arquivos", "localStorage"].filter((c) => JSON.stringify(a[caso]?.[c]) !== JSON.stringify(b[caso]?.[c]));
    if (!campos.length) { console.log(`igual:     ${caso}`); continue; }
    diferentes++;
    console.log(`DIFERENTE: ${caso} → ${campos.join(", ")}`);
    for (const c of campos) {
      const [va, vb] = [a[caso]?.[c], b[caso]?.[c]];
      if (c === "html") {
        // primeiro trecho diferente
        let i = 0;
        while (i < Math.min(va.length, vb.length) && va[i] === vb[i]) i++;
        console.log(`  html: a …${JSON.stringify(va.slice(Math.max(0, i - 120), i + 120))}\n        b …${JSON.stringify(vb.slice(Math.max(0, i - 120), i + 120))}`);
      } else if (Array.isArray(va) && Array.isArray(vb)) {
        console.log(`  ${c}: só em a ${JSON.stringify(sobra(va, vb))}; só em b ${JSON.stringify(sobra(vb, va))}`);
      } else console.log(`  ${c}: a ${JSON.stringify(va)}; b ${JSON.stringify(vb)}`);
    }
  }
  console.log(`${casos.length} casos comparados, ${diferentes} diferente(s)`);
  process.exit(diferentes ? 1 : 0);
}

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [rotulo, base, saidaArg, quaisArg] = args;
const BASE = base ?? "http://127.0.0.1:8312";
const SAIDA = path.resolve(saidaArg ?? "coleta-modulo1");
const QUAIS = quaisArg ?? "tudo";
mkdirSync(SAIDA, { recursive: true });

const USUARIO = { id: "00000000-0000-4000-8000-0000000000aa", email: "loja.teste@exemplo.test" };
const AGORA = new Date("2026-10-26T15:00:00-03:00");
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(AGORA.getTime() / 1000) + 3600 * 24 * 365;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USUARIO.id, email: USUARIO.email, role: "authenticated", aud: "authenticated", exp })}.assinatura-ficticia`;
const SESSAO = { access_token: JWT, token_type: "bearer", expires_in: 86400 * 365, expires_at: exp, refresh_token: "refresh-ficticio", user: { id: USUARIO.id, email: USUARIO.email, aud: "authenticated", role: "authenticated", created_at: "2026-01-10T12:00:00Z", user_metadata: { full_name: "Ana Loja Teste" } } };

const TELAS = {
  computador: { viewport: { width: 1366, height: 900 } },
  celular: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } },
};

function tabelasBase({ admin, idioma }) {
  return {
    user_roles: admin ? [{ user_id: USUARIO.id, role: "admin" }] : [],
    profiles: [{
      id: USUARIO.id, user_id: USUARIO.id, nome: "Ana Loja Teste", email: USUARIO.email, celular: "11999990000", created_at: "2026-01-10T12:00:00Z",
      idioma, mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo", preferencias_os: null,
    }],
    assinaturas: [{
      id: "a1", user_id: USUARIO.id, plano_tipo: "profissional_ultra_mensal", status: "active", data_inicio: "2026-01-10T12:00:00Z",
      data_fim: "2026-11-10T12:00:00Z", data_proxima_cobranca: "2026-11-10T12:00:00Z", trial_with_card: false, payment_provider: "pagarme",
      created_at: "2026-01-10T12:00:00Z", updated_at: "2026-10-10T12:00:00Z", onboarding_completo: true, trial_canceled: false,
    }],
    configuracoes_loja: [{
      id: "c1", user_id: USUARIO.id, nome_loja: "Loja Teste", cnpj: "00.000.000/0001-00", telefone: "11999990000", endereco: "Rua A, 1",
      logo_url: null, empresa_id: null, cidade: "São Paulo", estado: "SP", cep: "01000-000", created_at: "2026-01-10T12:00:00Z",
    }],
    user_onboarding: [{ user_id: USUARIO.id, completed: true, onboarding_completed: true, onboarding_obrigatorio_completed: true, step: 99 }],
    // Movimento para os cartões do Dashboard terem valores (filtros de data não são simulados).
    vendas: [
      { id: "v1", user_id: USUARIO.id, tipo: "produto", total: 1234.5, custo_unitario: 400, quantidade: 1, data: "2026-10-26T13:00:00Z", forma_pagamento: "dinheiro", recebido: true, cancelada: false, deleted_at: null, produtos: { nome: "Capinha", preco: 1234.5, custo: 400 } },
      { id: "v2", user_id: USUARIO.id, tipo: "dispositivo", total: 2500, custo_unitario: 1800, quantidade: 1, data: "2026-10-20T13:00:00Z", forma_pagamento: "pix", recebido: true, cancelada: false, deleted_at: null, dispositivos: { marca: "Apple", modelo: "iPhone 12", preco: 2500, custo: 1800 } },
    ],
    ordens_servico: [
      { id: "o1", user_id: USUARIO.id, numero_os: "101", total: 350, status: "entregue", is_teste: false, deleted_at: null, created_at: "2026-10-25T13:00:00Z", data_saida: "2026-10-26T12:00:00Z", avarias: {} },
    ],
    contas: [
      { id: "ct1", user_id: USUARIO.id, tipo: "pagar", status: "pendente", valor: 89.9, data_vencimento: "2026-10-26", nome: "Luz", deleted_at: null },
      { id: "ct2", user_id: USUARIO.id, tipo: "receber", status: "pendente", valor: 150, data_vencimento: "2026-10-26", nome: "OS 100", deleted_at: null },
    ],
  };
}

const ABAS = ["Perfil", "Logo", "Aparência", "Cores", "Numeração", "Notificações", "Permissões", "Preview", "Exportação"];
const ABAS_ES = ["Perfil", "Logo", "Apariencia", "Colores", "Numeración", "Notificaciones", "Permisos", "Vista previa", "Exportación"];

// Casos: tela + rota + o que fazer depois de abrir.
function casos() {
  const lista = [];
  for (const tela of ["computador", "celular"]) {
    for (const [perfil, admin, idioma] of [["naoadmin-ptbr", false, "pt-BR"], ["admin-ptbr", true, "pt-BR"], ["naoadmin-perfil-es", false, "es"], ["admin-es", true, "es"]]) {
      if (QUAIS === "ptbr" && perfil === "admin-es") continue;
      if (QUAIS === "es" && perfil !== "admin-es") continue;
      const extras = perfil === "naoadmin-perfil-es" ? { localStorage: { mecapp_idioma: "es" }, locale: "es-MX", query: "?lang=es" } : {};
      const abas = perfil === "admin-es" ? ABAS_ES : ABAS;
      lista.push({ nome: `${perfil}-${tela}-dashboard`, tela, admin, idioma, rota: "/dashboard", ...extras });
      abas.forEach((aba, i) => lista.push({ nome: `${perfil}-${tela}-configuracoes-${ABAS[i].normalize("NFD").replace(/[^\w]/g, "").toLowerCase()}`, tela, admin, idioma, rota: "/configuracoes", aba, ...extras }));
      if (tela === "celular") {
        lista.push({ nome: `${perfil}-${tela}-menu-gaveta`, tela, admin, idioma, rota: "/dashboard", gaveta: true, ...extras });
        lista.push({ nome: `${perfil}-${tela}-menu-personalizar`, tela, admin, idioma, rota: "/dashboard", gaveta: true, personalizar: true, ...extras });
      }
    }
  }
  // SO_CASO=trecho1,trecho2 limita a rodada aos casos cujo nome contém um dos trechos.
  const so = process.env.SO_CASO?.split(",");
  return so ? lista.filter((c) => so.some((s) => c.nome.includes(s))) : lista;
}

const falhas = [];
const falhar = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };

function filtrar(linhas, params) {
  return linhas.filter((l) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"].includes(col)) return true;
      if (!(col in l)) return true;
      const v = l[col];
      if (cond.startsWith("eq.")) return String(v) === cond.slice(3);
      if (cond === "is.null") return v == null;
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
      return true;
    }));
}

const semHash = (p) => p.replace(/-[A-Za-z0-9_-]{8}(\.(js|css))$/, "$1");

async function abrir(navegador, caso, estado) {
  const ctx = await navegador.newContext({ ...TELAS[caso.tela], timezoneId: "America/Sao_Paulo", locale: caso.locale ?? "pt-BR", serviceWorkers: "block" });
  await ctx.clock.setFixedTime(AGORA);
  await ctx.addInitScript(({ sessao, extras }) => {
    if (sessionStorage.getItem("__iniciado")) return;
    sessionStorage.setItem("__iniciado", "1");
    localStorage.setItem("sb-qztuzcchknptrvkdmdph-auth-token", JSON.stringify(sessao));
    // Não abrir tutorial/onboarding automático (mesmo estado nas duas árvores).
    localStorage.setItem("mec_notif_banner_dismissed", "true");
    for (const [k, v] of Object.entries(extras)) localStorage.setItem(k, v);
  }, { sessao: SESSAO, extras: caso.localStorage ?? {} });
  await ctx.routeWebSocket(/supabase\.co/, () => {});
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
      if (url.pathname.startsWith("/functions/v1/")) { estado.consultas.push(`${req.method()} fn:${url.pathname.slice(14)}`); return r.fulfill({ status: 200, json: {} }); }
      if (url.pathname.startsWith("/storage/v1/")) { estado.consultas.push(`${req.method()} storage`); return r.fulfill({ status: 200, json: [] }); }
      const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
      if (rpc) { estado.consultas.push(`${req.method()} rpc:${rpc[1]}`); return r.fulfill({ status: 200, json: null }); }
      const m = url.pathname.match(/\/rest\/v1\/([a-z_0-9]+)/);
      if (m) {
        const params = [...url.searchParams.entries()].sort().map(([k, v]) => `${k}=${v}`).join("&");
        estado.consultas.push(`${req.method()} ${m[1]}?${params}`);
        if (req.method() === "PATCH") {
          for (const l of filtrar(estado.tabelas[m[1]] ?? [], url.searchParams)) Object.assign(l, req.postDataJSON());
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

async function assentar(pg) {
  await pg.waitForLoadState("networkidle");
  await pg.waitForTimeout(1500);
  await pg.waitForLoadState("networkidle");
  await pg.waitForTimeout(500);
}

// Textos visíveis com cara de português (só para os casos em espanhol).
const PISTAS_PT = /\b(não|você|são|ção|ções|ões|ã|õ|ç|lh|nh|Configurações|Salvar|Selecione|Carregando|Faturamento|Lucro|Hoje|Mês|Estoque|Peças|Notificações|Exportar|Adicionar|Enviar|Excluir|Cancelar|Voltar|Fechar|Ver detalhes|Plano|Loja|Endereço|Bairro|Cidade|Número)\b|[ãõç]/i;

async function analisarTela(pg) {
  return pg.evaluate((pistas) => {
    const re = new RegExp(pistas.source, pistas.flags);
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const textos = new Set();
    const caminho = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = caminho.nextNode())) {
      const t = n.textContent.trim();
      if (t.length < 2 || !n.parentElement || !visivel(n.parentElement)) continue;
      if (["SCRIPT", "STYLE"].includes(n.parentElement.tagName)) continue;
      textos.add(t);
    }
    for (const el of document.querySelectorAll("[placeholder],[title],[aria-label]")) {
      if (!visivel(el)) continue;
      for (const a of ["placeholder", "title", "aria-label"]) if (el.getAttribute(a)) textos.add(`[${a}] ${el.getAttribute(a)}`);
    }
    // Texto cortado: elemento folha com texto cujo conteúdo passa da caixa (sem ser rolagem de propósito).
    const cortados = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visivel(el) || el.children.length > 0) continue;
      const t = el.textContent.trim();
      if (!t) continue;
      const s = getComputedStyle(el);
      if (["auto", "scroll"].includes(s.overflowX)) continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && (s.overflow !== "visible" || s.textOverflow === "ellipsis")) cortados.push(t.slice(0, 60));
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 1) cortados.push(`(fora da tela) ${t.slice(0, 60)}`);
    }
    return {
      textos: [...textos],
      suspeitosPt: [...textos].filter((t) => re.test(t)),
      cortados,
      rolagemHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, { source: PISTAS_PT.source, flags: PISTAS_PT.flags });
}

const navegador = await chromium.launch();
const resultado = {};

for (const caso of casos()) {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const estado = { tabelas: tabelasBase(caso), consultas: [], arquivos: [], externos: [] };
    const ctx = await abrir(navegador, caso, estado);
    const erros = [];
    try {
      const pg = await ctx.newPage();
      pg.on("pageerror", (e) => erros.push(`erro na página: ${e.message}`));
      await pg.goto(`${BASE}${caso.rota}${caso.query ?? ""}`);
      await assentar(pg);
      if (!new URL(pg.url()).pathname.startsWith(caso.rota)) erros.push(`redirecionou para ${pg.url()}`);
      if (caso.aba) {
        await pg.getByRole("tab", { name: caso.aba, exact: true }).click();
        await assentar(pg);
      }
      if (caso.gaveta) {
        await pg.locator("nav.fixed button").last().click();
        await pg.waitForTimeout(800);
        if (caso.personalizar) {
          await pg.locator("[role=dialog] button", { hasText: /Personalizar/ }).first().click();
          await pg.waitForTimeout(800);
        }
      }
      const foto = {
        html: await pg.evaluate(() => document.body.innerHTML),
        lang: await pg.evaluate(() => document.documentElement.lang),
        localStorage: await pg.evaluate(() => localStorage.getItem("mecapp_idioma")),
        consultas: [...estado.consultas].sort(),
        arquivos: [...new Set(estado.arquivos)].sort(),
        externos: [...new Set(estado.externos)].sort(),
      };
      if (caso.idioma === "es" && caso.admin) Object.assign(foto, await analisarTela(pg));
      else foto.analisePt = await analisarTela(pg).then((a) => ({ cortados: a.cortados, rolagemHorizontal: a.rolagemHorizontal }));
      await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-${caso.nome}.png`), fullPage: true });
      if (erros.length && tentativa === 1) { await ctx.close(); continue; }
      erros.forEach((e) => falhar(`[${caso.nome}] ${e}`));
      resultado[caso.nome] = foto;
      const extra = foto.suspeitosPt ? ` suspeitos=${foto.suspeitosPt.length} cortados=${foto.cortados.length}${foto.rolagemHorizontal ? " ROLAGEM-H" : ""}` : "";
      console.log(`${caso.nome}: lang=${foto.lang}${extra}`);
      await ctx.close();
      break;
    } catch (e) {
      await ctx.close();
      if (tentativa === 2) falhar(`[${caso.nome}] ${e.message.split("\n")[0]}`);
    }
  }
}

await navegador.close();
const arquivo = path.join(SAIDA, `coleta-${rotulo}.json`);
writeFileSync(arquivo, JSON.stringify(resultado, null, 1));
writeFileSync(path.join(SAIDA, `falhas-${rotulo}.json`), JSON.stringify(falhas, null, 1));
console.log(`${Object.keys(resultado).length} casos → ${arquivo}`);
console.log(falhas.length ? `${falhas.length} falha(s)` : "OK: nenhuma falha");
process.exit(falhas.length ? 1 : 0);
