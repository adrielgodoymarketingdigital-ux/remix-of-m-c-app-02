// Card "Funil do WhatsApp" de verdade (React + Tailwind) com o Supabase
// SIMULADO: toda chamada a *.supabase.co é respondida aqui com dados
// fictícios; qualquer outro endereço externo é bloqueado. Nada sai da máquina
// e nada é gravado em lugar nenhum.
//
//   npx vite --port 8210 --strictPort --host 127.0.0.1                 (na worktree)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> CHROMIUM_PATH=<chrome> \
//     node scripts/testes-crm-leads/tela/tela.playwright.mjs <pasta-saida>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const SAIDA = path.resolve(process.argv[2] ?? "funil-whatsapp-tela");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8210/scripts/testes-crm-leads/tela/funil.html";
mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const ok = (cond, msg, extra) => {
  if (cond) console.log("  ✓", msg);
  else { falhas++; console.log("  ✗", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 600)); }
};

const FUNIL = {
  conversas: 412, conversas_anuncio: 318, ja_clientes: 14, cadastros: 61, testes: 48, assinantes: 9, opt_outs: 3,
  gasto_meta_centavos: 0, gasto_meta_dias: 0, gasto_manual_centavos: 124000, gasto_manual_lancamentos: 1,
};
const POR_ANUNCIO = [
  { ad_id: "120000000000001", ad_titulo: "Vídeo OS no celular", conversas: 171, cadastros: 29, testes: 23, assinantes: 5, gasto_manual_centavos: 52000 },
  { ad_id: "120000000000002", ad_titulo: "Imagem 14 dias grátis", conversas: 43, cadastros: 6, testes: 4, assinantes: 0, gasto_manual_centavos: 18000 },
  { ad_id: "", ad_titulo: null, conversas: 94, cadastros: 9, testes: 7, assinantes: 1, gasto_manual_centavos: 0 },
];
const GASTOS = [{ id: 7, inicio: "2026-11-01", fim: "2026-11-20", ad_id: null, descricao: "campanhas de novembro", valor: "1240.00", removido_em: null }];

async function abrir(navegador, cenario, { largura = 1280 } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const estado = { rpcs: [], leituras: [], externas: [], consoleApp: [], consoleRede: [] };
  await ctx.route("**/*", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol === "data:") return rota.continue();
    if (url.hostname.endsWith(".supabase.co")) {
      const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
      if (rpc) {
        const nome = rpc[1];
        const corpo = req.postDataJSON();
        estado.rpcs.push({ nome, corpo });
        const r = cenario.rpc(nome, corpo, estado);
        return rota.fulfill({ status: r.status ?? 200, json: r.json });
      }
      const tab = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
      if (tab) {
        estado.leituras.push(`${req.method()} ${tab[1]}?${url.searchParams.toString()}`);
        const r = cenario.tabela?.(tab[1]) ?? { json: [] };
        return rota.fulfill({ status: r.status ?? 200, json: r.json });
      }
      return rota.fulfill({ status: 200, json: {} });
    }
    estado.externas.push(url.href);
    return rota.abort();
  });
  const pg = await ctx.newPage();
  const errosPagina = [];
  pg.on("pageerror", (e) => errosPagina.push(e.message));
  pg.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning" && m.type() !== "log") return;
    const t = m.text();
    // A linha "Failed to load resource" é do próprio navegador para a resposta 404; o app não loga nada.
    if (/Failed to load resource/.test(t)) estado.consoleRede.push(t);
    else if (!/\[vite\]|React DevTools|React Router Future Flag/.test(t)) estado.consoleApp.push(`${m.type()}: ${t}`);
  });
  await pg.goto(BASE, { waitUntil: "networkidle" });
  return { ctx, pg, estado, errosPagina };
}

const foto = (pg, nome) => pg.locator('[data-testid="card-funil-whatsapp"]').screenshot({ path: path.join(SAIDA, `${nome}.png`) });
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const texto = (pg) => pg.locator('[data-testid="card-funil-whatsapp"]').innerText();
const semNbsp = (s) => s.replace(/ /g, " ");

// ── A) SQL ainda não aplicado: a função não existe ───────────────────────────
console.log("A) antes do SQL (admin_crm_funil não existe)");
{
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    rpc: () => ({ status: 404, json: { code: "PGRST202", message: "Could not find the function public.admin_crm_funil(p_fim, p_inicio) in the schema cache", details: null, hint: null } }),
  });
  await pg.waitForSelector('[data-testid="funil-nao-ativado"]');
  await pg.waitForTimeout(1500);
  ok((await texto(pg)).includes("Funil do WhatsApp ainda não ativado"), "mostra 'Funil do WhatsApp ainda não ativado'");
  ok(estado.rpcs.length === 1 && estado.rpcs[0].nome === "admin_crm_funil", "uma única chamada (sem nova tentativa, sem por anúncio)", estado.rpcs.map((r) => r.nome));
  ok(estado.leituras.length === 0, "não lê crm_gasto_manual", estado.leituras);
  ok(await pg.locator("#gasto-valor").count() === 0, "formulário de gasto escondido");
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e o app não loga nada", { errosPagina, app: estado.consoleApp });
  console.log(`    (linhas do navegador para a resposta 404: ${estado.consoleRede.length})`);
  await foto(pg, "a-nao-ativado");
  await ctx.close();
}

// ── B) com dados, gasto informado ───────────────────────────────────────────
for (const largura of [1280, 390]) {
  console.log(`B) com dados, gasto informado (${largura}px)`);
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    rpc: (n) => n === "admin_crm_funil" ? { json: [FUNIL] } : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO } : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  }, { largura });
  await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
  await pg.waitForSelector('[data-testid="lista-gastos"]');
  const t = semNbsp(await texto(pg));
  for (const v of ["412", "61", "48", "9", "R$ 1.240,00", "R$ 3,01", "R$ 20,33", "R$ 137,78", "Gasto informado"]) ok(t.includes(v), `mostra ${v}`);
  ok(!t.includes("Gasto da Meta"), "fonte única: não mostra a Meta junto");
  ok(await pg.locator('[data-testid="aviso-amostra"]').count() === 0, "412 conversas e 9 assinantes: sem aviso geral de amostra pequena");
  const linha0 = semNbsp(await pg.locator('[data-testid="tabela-funil-anuncio"] tbody tr').nth(1).innerText());
  ok(linha0.includes("Amostra pequena: use como indicativo") && /—\s*$/.test(linha0.trim()), "anúncio com 0 assinantes: aviso e custo/assinante '—'", linha0);
  ok(!/Infinity|NaN/.test(t), "nenhum Infinity/NaN");
  ok(!/99000|\+55|@s\.whatsapp/.test(t), "nenhum telefone na tela");
  ok(t.includes("Sem anúncio (orgânico / link direto)"), "linha sem anúncio com rótulo");
  ok(estado.rpcs.map((r) => r.nome).sort().join() === "admin_crm_funil,admin_crm_funil_por_anuncio", "lê só as 2 RPCs de leitura", estado.rpcs.map((r) => r.nome));
  ok(estado.leituras.every((l) => l.startsWith("GET crm_gasto_manual")), "única tabela lida: crm_gasto_manual (GET)", estado.leituras);
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e sem log do app", { errosPagina, app: estado.consoleApp });
  ok(estado.externas.length === 0, "nenhuma chamada externa", estado.externas);
  await foto(pg, `b-dados-${largura}`);
  await ctx.close();
}

// ── C) amostra pequena (29 conversas) e fonte Meta ──────────────────────────
console.log("C) 29 conversas, gasto da Meta (e também informado)");
{
  const { ctx, pg, errosPagina } = await abrir(navegador, {
    rpc: (n) => n === "admin_crm_funil"
      ? { json: [{ ...FUNIL, conversas: 29, cadastros: 4, testes: 3, assinantes: 0, gasto_meta_centavos: 30000, gasto_meta_dias: 12, gasto_manual_centavos: 99900 }] }
      : { json: [] },
  });
  await pg.waitForSelector('[data-testid="aviso-amostra"]');
  const t = semNbsp(await texto(pg));
  ok(t.includes("Amostra pequena: use como indicativo"), "aviso de amostra pequena");
  ok(t.includes("Gasto da Meta (campanhas de WhatsApp) · 12 de 30 dias") && !t.includes("Gasto informado ·"), "fonte Meta com dias cobertos");
  ok(t.includes("R$ 300,00") && !t.includes("R$ 1.299,00") && !t.includes("R$ 999,00"), "gasto = só Meta (nunca soma com o informado)");
  ok(t.includes("R$ 10,34") && /Custo por assinante\s*—/.test(t), "custo por conversa e '—' com 0 assinantes", t.slice(0, 600));
  ok(errosPagina.length === 0, "sem erro na página", errosPagina);
  await foto(pg, "c-amostra-meta");
  await ctx.close();
}

// ── D) gasto informado: recusas e remoção (tudo simulado) ───────────────────
console.log("D) formulário de gasto (respostas simuladas)");
{
  let respostaInformar = { status: 409, json: { code: "23P01", message: "Já existe gasto informado neste período que se sobrepõe a este (mesmo anúncio ou gasto geral). Remova o anterior antes." } };
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    rpc: (n) => n === "admin_crm_funil" ? { json: [FUNIL] }
      : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO }
      : n === "admin_crm_gasto_informar" ? respostaInformar
      : n === "admin_crm_gasto_remover" ? { json: true }
      : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  });
  await pg.waitForSelector("#gasto-valor");
  const enviar = () => pg.getByRole("button", { name: "Informar gasto" }).click();
  await pg.fill("#gasto-inicio", "2026-11-01");
  await pg.fill("#gasto-valor", "0");
  await enviar();
  ok((await pg.locator('[data-testid="erro-gasto"]').innerText()).includes("Valor inválido"), "valor zero recusado na tela, sem chamar a função");
  await pg.fill("#gasto-valor", "10,555");
  await enviar();
  ok((await pg.locator('[data-testid="erro-gasto"]').innerText()).includes("2 casas"), "3 casas recusado na tela");
  ok(!estado.rpcs.some((r) => r.nome === "admin_crm_gasto_informar"), "nenhuma chamada de gravação até aqui");
  await pg.fill("#gasto-valor", "1.240,55");
  await pg.fill("#gasto-anuncio", "120000000000001");
  await enviar();
  await pg.waitForFunction(() => document.querySelector('[data-testid="erro-gasto"]')?.textContent?.includes("sobrepõe"));
  ok(true, "sobreposição: mensagem em português");
  const chamada = estado.rpcs.find((r) => r.nome === "admin_crm_gasto_informar");
  ok(chamada && chamada.corpo.p_valor === "1240.55" && chamada.corpo.p_ad_id === "120000000000001" && chamada.corpo.p_inicio === "2026-11-01",
    "envia valor exato em texto e o anúncio", chamada?.corpo);
  respostaInformar = { status: 400, json: { code: "22023", message: "Período inválido (até 400 dias, sem datas futuras)" } };
  await enviar();
  await pg.waitForFunction(() => document.querySelector('[data-testid="erro-gasto"]')?.textContent?.includes("sem datas futuras"));
  ok(true, "data futura recusada pela função: mensagem em português");
  respostaInformar = { json: 8 };
  await enviar();
  await pg.waitForSelector("text=Gasto informado.");
  ok(await pg.locator('[data-testid="erro-gasto"]').count() === 0, "sucesso: toast e erro some");
  await pg.locator('[data-testid="lista-gastos"] button[aria-label="Remover lançamento"]').first().click();
  await pg.waitForSelector("text=Remover lançamento de gasto?");
  await foto(pg, "d-gasto-confirmar-remocao").catch(() => {});
  await pg.screenshot({ path: path.join(SAIDA, "d-confirmar-remocao-pagina.png") });
  ok(!estado.rpcs.some((r) => r.nome === "admin_crm_gasto_remover"), "remover só depois de confirmar");
  await pg.getByRole("button", { name: "Remover", exact: true }).click();
  await pg.waitForSelector("text=Lançamento removido.");
  ok(JSON.stringify(estado.rpcs.find((r) => r.nome === "admin_crm_gasto_remover")?.corpo) === JSON.stringify({ p_id: 7 }), "remove pelo id via admin_crm_gasto_remover");
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e sem log do app", { errosPagina, app: estado.consoleApp });
  ok(estado.externas.length === 0, "nenhuma chamada externa", estado.externas);
  await ctx.close();
}

await navegador.close();
console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
