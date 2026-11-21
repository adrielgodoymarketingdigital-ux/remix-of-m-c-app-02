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
const FORA = [{ loja_chamou_primeiro: 14, loja_chamou_primeiro_com_cadastro: 12, direcao_desconhecida: 0 }];
// 1D: situação do teste (61 cadastros, 48 com teste)
const TESTE = [{ teste_ativo_agora: 37, teste_acabou_sem_pagar: 11, teste_cancelado: 2, assinantes: 9 }];
const AUSENTE = (fn) => ({ status: 404, json: { code: "PGRST202", message: `Could not find the function public.${fn}(p_fim, p_inicio) in the schema cache`, details: null, hint: null } });
// 2A: nos cenários antigos (A–F) o SQL da 2A ainda não foi aplicado: as 2
// funções novas respondem "não existe". Só o cenário G (com2A) as responde.
const FUNCOES_2A = ["admin_crm_funil_gasto", "admin_crm_funil_gasto_por_anuncio"];
const etapas = async (pg) => (await pg.locator('[data-testid="funil-etapas"] > div').allInnerTexts()).map((x) => x.replace(/ /g, " ").replace(/\s+/g, " ").trim());
const GASTOS = [{ id: 7, inicio: "2026-11-01", fim: "2026-11-20", ad_id: null, descricao: "campanhas de novembro", valor: "1240.00", removido_em: null }];

async function abrir(navegador, cenario, { largura = 1280 } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo",
    permissions: ["clipboard-read", "clipboard-write"] });
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
        const r = !cenario.com2A && FUNCOES_2A.includes(nome) ? AUSENTE(nome) : cenario.rpc(nome, corpo, estado);
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
    rpc: (n) => n === "admin_crm_funil" ? { json: [FUNIL] } : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO }
      : n === "admin_crm_funil_excluidos" ? { json: FORA } : n === "admin_crm_funil_teste" ? { json: TESTE } : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  }, { largura });
  await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
  await pg.waitForSelector('[data-testid="lista-gastos"]');
  await pg.waitForSelector('[data-testid="etapa-em-teste"]');
  const t = semNbsp(await texto(pg));
  // 1D: degraus do teste e ajuda dos 14 dias
  const e = await etapas(pg);
  ok(JSON.stringify(e) === JSON.stringify([
    "Conversas iniciadas 412 318 de anúncio · 14 já eram clientes",
    "Cadastraram 61 14,8% das conversas",
    "Em teste agora 37 60,7% dos cadastros · 48 com teste no total",
    "Teste acabou sem pagar 11 2 cancelaram o teste",
    "Assinantes pagos 9 14,8% dos cadastros",
  ]), "5 degraus: conversas, cadastros, em teste agora, teste acabou sem pagar, assinantes", e);
  ok(!t.includes("Iniciaram teste"), "degrau antigo 'Iniciaram teste' não aparece com a função nova");
  ok(semNbsp(await pg.locator('[data-testid="ajuda-teste"]').innerText()) === "Todo cadastro novo recebe 14 dias de teste; o retorno do anúncio só aparece quando o teste acaba.", "ajuda dos 14 dias");
  const caixas = await pg.locator('[data-testid="funil-etapas"] > div').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; }));
  const linhasGrade = new Set(caixas.map((c) => c[1])).size;
  ok(largura === 1280 ? linhasGrade === 1 : linhasGrade === 3 && caixas[0][2] > caixas[1][2] * 1.9,
     largura === 1280 ? "1280px: 5 degraus numa linha" : "390px: conversas na largura toda, depois 2 + 2", caixas);
  for (const v of ["412", "61", "48", "9", "R$ 1.240,00", "R$ 3,01", "R$ 20,33", "R$ 137,78", "Gasto informado"]) ok(t.includes(v), `mostra ${v}`);
  ok(!t.includes("Gasto da Meta"), "fonte única: não mostra a Meta junto");
  ok(await pg.locator('[data-testid="aviso-amostra"]').count() === 0, "412 conversas e 9 assinantes: sem aviso geral de amostra pequena");
  const linha0 = semNbsp(await pg.locator('[data-testid="tabela-funil-anuncio"] tbody tr').nth(1).innerText());
  ok(linha0.includes("Amostra pequena: use como indicativo") && /—\s*$/.test(linha0.trim()), "anúncio com 0 assinantes: aviso e custo/assinante '—'", linha0);
  ok(!/Infinity|NaN/.test(t), "nenhum Infinity/NaN");
  ok(!/99000|\+55|@s\.whatsapp/.test(t), "nenhum telefone na tela");
  ok(t.includes("Sem anúncio (orgânico / link direto)"), "linha sem anúncio com rótulo");
  ok(t.includes("(o gasto da Meta é por campanha)"), "2A ausente: rodapé antigo");
  ok(estado.rpcs.map((r) => r.nome).filter((n) => !FUNCOES_2A.includes(n)).sort().join() === "admin_crm_funil,admin_crm_funil_excluidos,admin_crm_funil_por_anuncio,admin_crm_funil_teste", "lê só as 4 RPCs de leitura (fora as da 2A)", estado.rpcs.map((r) => r.nome));
  // 2A ausente: uma chamada a cada função nova, nada da 2A na tela
  ok(FUNCOES_2A.every((f) => estado.rpcs.filter((r) => r.nome === f).length === 1), "2A ausente: uma única chamada a cada função nova (sem nova tentativa)", estado.rpcs.map((r) => r.nome));
  ok(!/atualizado há|A Meta contou|Conversas \(Meta\)|Gasto da Meta por anúncio|minutos a algumas horas/.test(t)
     && await pg.locator('[data-testid="ajuda-gasto-meta"], [data-testid="gasto-atualizado"], [data-testid="conversas-meta"], [data-testid="aviso-informado-ignorado"], [data-testid="origem-gasto"]').count() === 0,
     "2A ausente: nenhuma linha nova (atualizado, conversas da Meta, ajuda, origem)");
  ok(JSON.stringify(estado.rpcs.find((r) => r.nome === "admin_crm_funil_teste")?.corpo) === JSON.stringify(estado.rpcs.find((r) => r.nome === "admin_crm_funil")?.corpo), "função nova com o mesmo período do funil");
  // 1C: ajuda, linha "Fora do funil", ID do anúncio com copiar, sem rolagem lateral na página
  ok(t.includes("Conversa iniciada = o cliente escreveu primeiro."), "ajuda: conversa iniciada = o cliente escreveu primeiro");
  const fora = semNbsp(await pg.locator('[data-testid="fora-do-funil"]').innerText());
  ok(fora === "Fora do funil: 14 começaram por mensagem da loja (boas-vindas automáticas), 0 desconhecidos", "linha 'Fora do funil'", fora);
  ok((await pg.locator('[data-testid="fora-do-funil"]').getAttribute("title")).includes("12 já tinham cadastro"), "detalhe com os ligados a cadastro");
  const ids = await pg.locator('[data-testid="id-anuncio"]').allInnerTexts();
  ok(ids.length === 2 && ids[0].includes("ID 120000000000001") && ids[1].includes("ID 120000000000002"), "ID nas 2 linhas com anúncio (e não na sem anúncio)", ids);
  await pg.getByRole("button", { name: "Copiar ID do anúncio 120000000000002" }).click();
  await pg.waitForSelector("text=ID do anúncio copiado.");
  ok(await pg.evaluate(() => navigator.clipboard.readText()) === "120000000000002", "botão copiar põe o ID na área de transferência");
  const larg = await pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, tela: window.innerWidth }));
  ok(larg.doc <= larg.tela, `sem rolagem lateral na página (${larg.doc} <= ${larg.tela})`, larg);
  const cel = pg.locator('[data-testid="tabela-funil-anuncio"] tbody tr').first().locator("td").first();
  const [bCel, bId] = [await cel.boundingBox(), await cel.locator('[data-testid="id-anuncio"]').boundingBox()];
  ok(bCel && bId && bId.x >= bCel.x && bId.x + bId.width <= bCel.x + bCel.width + 0.5,
    `ID e botão copiar cabem dentro da célula do anúncio (célula ${bCel?.width}px, ID ${bId?.width}px)`);
  // ID de 64 caracteres (o máximo aceito) não alarga a coluna: o texto é cortado com reticências
  const largo = await pg.evaluate(() => {
    const el = document.querySelector('[data-testid="id-anuncio"] .font-mono');
    const td = el.closest("td");
    const antes = td.getBoundingClientRect().width;
    const original = el.textContent;
    el.textContent = "ID " + "1".repeat(64);
    const r = { antes, depois: td.getBoundingClientRect().width, corta: el.scrollWidth > el.clientWidth };
    el.textContent = original;
    return r;
  });
  ok(Math.abs(largo.depois - largo.antes) < 1 && largo.corta, `ID de 64 caracteres não alarga a coluna (${largo.antes} → ${largo.depois}px, cortado: ${largo.corta})`, largo);
  ok(estado.leituras.every((l) => l.startsWith("GET crm_gasto_manual")), "única tabela lida: crm_gasto_manual (GET)", estado.leituras);
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e sem log do app", { errosPagina, app: estado.consoleApp });
  ok(estado.externas.length === 0, "nenhuma chamada externa", estado.externas);
  await foto(pg, `b-dados-${largura}`);
  await ctx.close();
}

// ── E) código da 1C publicado antes do SQL: admin_crm_funil_excluidos não existe ──
for (const largura of [1280, 390]) {
  console.log(`E) função nova ainda não existe (${largura}px)`);
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    rpc: (n) => n === "admin_crm_funil" ? { json: [FUNIL] } : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO }
      : n === "admin_crm_funil_excluidos" || n === "admin_crm_funil_teste" ? AUSENTE(n)
        : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  }, { largura });
  await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
  await pg.waitForSelector('[data-testid="lista-gastos"]');
  await pg.waitForTimeout(1500);
  const t = semNbsp(await texto(pg));
  ok(await pg.locator('[data-testid="fora-do-funil"]').count() === 0, "linha 'Fora do funil' escondida");
  ok(!/não ativado|indisponível|Tentar novamente|Erro/i.test(t), "nenhum aviso de erro no card", t.slice(0, 300));
  ok(t.includes("412") && t.includes("R$ 3,01") && await pg.locator('[data-testid="id-anuncio"]').count() === 2, "resto do card normal (funil, custos, ID)");
  ok(estado.rpcs.filter((r) => r.nome === "admin_crm_funil_excluidos").length === 1, "uma única chamada à função nova (sem nova tentativa)");
  ok(estado.rpcs.filter((r) => r.nome === "admin_crm_funil_teste").length === 1, "uma única chamada à função da 1D (sem nova tentativa)");
  const e = await etapas(pg);
  ok(e.length === 4 && e[2] === "Iniciaram teste 48 78,7% dos cadastros", "4 degraus, 'Iniciaram teste' como antes", e);
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e o app não loga nada", { errosPagina, app: estado.consoleApp });
  console.log(`    (linhas do navegador para a resposta 404: ${estado.consoleRede.length})`);
  await foto(pg, `e-sem-funcao-nova-${largura}`);
  await ctx.close();
}

// ── F) código da 1D publicado antes do SQL da 1D (1C aplicada): só admin_crm_funil_teste não existe ──
for (const largura of [1280, 390]) {
  console.log(`F) função da 1D ainda não existe (${largura}px)`);
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    rpc: (n) => n === "admin_crm_funil" ? { json: [FUNIL] } : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO }
      : n === "admin_crm_funil_excluidos" ? { json: FORA } : n === "admin_crm_funil_teste" ? AUSENTE(n) : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  }, { largura });
  await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
  await pg.waitForSelector('[data-testid="fora-do-funil"]');
  await pg.waitForTimeout(1500);
  const t = semNbsp(await texto(pg));
  const e = await etapas(pg);
  ok(JSON.stringify(e) === JSON.stringify([
    "Conversas iniciadas 412 318 de anúncio · 14 já eram clientes",
    "Cadastraram 61 14,8% das conversas",
    "Iniciaram teste 48 78,7% dos cadastros",
    "Assinantes pagos 9 14,8% dos cadastros",
  ]), "4 degraus exatamente como na 1C", e);
  ok(!/Em teste agora|Teste acabou sem pagar|não ativado|indisponível|Tentar novamente|Erro/i.test(t), "sem degraus novos e sem aviso de erro");
  ok(t.includes("Todo cadastro novo recebe 14 dias de teste"), "ajuda dos 14 dias continua");
  ok(await pg.locator('[data-testid="fora-do-funil"]').count() === 1 && t.includes("R$ 3,01") && await pg.locator('[data-testid="id-anuncio"]').count() === 2,
     "resto do card normal (fora do funil, custos, ID)");
  ok(estado.rpcs.filter((r) => r.nome === "admin_crm_funil_teste").length === 1, "uma única chamada à função da 1D (sem nova tentativa)");
  const larg = await pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, tela: window.innerWidth }));
  ok(larg.doc <= larg.tela, `sem rolagem lateral na página (${larg.doc} <= ${larg.tela})`, larg);
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e o app não loga nada", { errosPagina, app: estado.consoleApp });
  console.log(`    (linhas do navegador para a resposta 404: ${estado.consoleRede.length})`);
  await foto(pg, `f-sem-funcao-1d-${largura}`);
  await ctx.close();
}

// ── G) SQL da 2A aplicado: gasto da Meta por anúncio ───────────────────────
// O card abre em "Últimos 7 dias": a Meta cobre 6 dos 7.
const MIN = 60_000;
const GASTO = (atrasoMin) => [{
  gasto_auto_centavos: 98000, dias_auto: 6, anuncios_auto: 2, conversas_meta: 455, impressoes: 120000, cliques: 3100,
  gasto_manual_efetivo_centavos: 8000, lancamentos_manuais_efetivos: 1, // +30 s: o relógio da página é lido na montagem, um pouco antes desta resposta
  atualizado_em: new Date(Date.now() - atrasoMin * MIN - 30_000).toISOString(),
}];
const GASTO_ANUNCIO = [
  { ad_id: "120000000000001", gasto_auto_centavos: 70000, dias_auto: 6, conversas_meta: 190, impressoes: 80000, cliques: 2000, gasto_manual_efetivo_centavos: 0, atualizado_em: new Date().toISOString() },
  { ad_id: "120000000000002", gasto_auto_centavos: 28000, dias_auto: 6, conversas_meta: 60, impressoes: 40000, cliques: 1100, gasto_manual_efetivo_centavos: 0, atualizado_em: new Date().toISOString() },
  { ad_id: "120000000000003", gasto_auto_centavos: 0, dias_auto: 0, conversas_meta: 0, impressoes: 0, cliques: 0, gasto_manual_efetivo_centavos: 8000, atualizado_em: null },
];
for (const [largura, atraso] of [[1280, 23], [390, 23], [1280, 8 * 60]]) {
  console.log(`G) com a 2A: gasto da Meta por anúncio (${largura}px, sincronizado há ${atraso} min)`);
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    com2A: true,
    rpc: (n) => n === "admin_crm_funil" ? { json: [{ ...FUNIL, gasto_meta_centavos: 555500, gasto_meta_dias: 30 }] }
      : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO }
      : n === "admin_crm_funil_excluidos" ? { json: FORA } : n === "admin_crm_funil_teste" ? { json: TESTE }
      : n === "admin_crm_funil_gasto" ? { json: GASTO(atraso) } : n === "admin_crm_funil_gasto_por_anuncio" ? { json: GASTO_ANUNCIO }
      : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  }, { largura });
  await pg.waitForSelector('[data-testid="conversas-meta-linha"]');
  await pg.waitForSelector('[data-testid="gasto-atualizado"]');
  await pg.waitForSelector('[data-testid="lista-gastos"]');
  const t = semNbsp(await texto(pg));
  const fonte = semNbsp(await pg.locator('[data-testid="fonte-gasto"]').innerText());
  ok(fonte === "Gasto da Meta por anúncio · 6 de 7 dias + R$ 80,00 informado nos dias sem dado da Meta", "selo: Meta por anúncio + informado efetivo", fonte);
  const at = await pg.locator('[data-testid="gasto-atualizado"]').innerText();
  ok(at === (atraso < 60 ? "atualizado há 23 min" : "atualizado há 8 h"), `'${at}'`);
  const cor = await pg.locator('[data-testid="gasto-atualizado"]').getAttribute("class");
  ok(atraso < 60 ? cor.includes("text-muted-foreground") : cor.includes("text-amber-700"), atraso < 60 ? "sincronização recente: cor normal" : "mais de 6 h sem sincronizar: destaque âmbar");
  ok((await pg.locator('[data-testid="gasto-atualizado"]').getAttribute("title")).includes("última sincronização"), "detalhe: é a hora da última sincronização");
  ok(semNbsp(await pg.locator('[data-testid="conversas-meta"]').innerText()) === "A Meta contou 455 conversas (aqui: 412 em que o cliente escreveu primeiro)", "conversas da Meta ao lado das nossas");
  const custos = semNbsp(await pg.locator('[data-testid="funil-custos"]').innerText()).replace(/\s+/g, " ");
  ok(custos === "Gasto no período R$ 1.060,00 Custo por conversa R$ 2,57 Custo por cadastro R$ 17,38 Custo por assinante R$ 117,78",
     "custos = (980 Meta + 80 informado) ÷ conversas/cadastros/assinantes; Meta por campanha (R$ 5.555) ignorada", custos);
  ok(!t.includes("5.555") && !t.includes("campanhas de WhatsApp) ·") && !fonte.includes("1.240"), "nunca soma a Meta por campanha nem o informado bruto", t.slice(0, 400));
  const ajuda = semNbsp(await pg.locator('[data-testid="ajuda-gasto-meta"]').innerText());
  ok(ajuda.includes("minutos a algumas horas") && ajuda.includes("últimos 3 dias são recalculados") && ajuda.includes("última sincronização"), "ajuda do atraso da Meta");
  const cab = (await pg.locator('[data-testid="tabela-funil-anuncio"] thead th').allInnerTexts()).map((x) => x.trim());
  ok(JSON.stringify(cab) === JSON.stringify(["Anúncio", "Conversas", "Conversas (Meta)", "Cadastros", "Teste", "Assinantes", "Gasto", "Custo/conversa", "Custo/assinante"]), "colunas com 'Conversas (Meta)' e 'Gasto'", cab);
  const linhas = (await pg.locator('[data-testid="tabela-funil-anuncio"] tbody tr').allInnerTexts()).map((x) => semNbsp(x).replace(/\s+/g, " ").trim());
  ok(linhas.length === 4, "4 linhas: 3 do funil + anúncio com gasto e sem conversa", linhas);
  ok(linhas[0].includes("171 190 29 23 5 R$ 700,00 Meta R$ 4,09 R$ 140,00"), "anúncio 1: conversas, Meta, gasto automático e custos", linhas[0]);
  ok(linhas[2].includes("94 — 9 7 1 — —"), "sem anúncio: sem conversa da Meta e sem gasto", linhas[2]);
  ok(linhas[3].startsWith("Anúncio 120000000000003") && linhas[3].includes("0 0 0 0 0 R$ 80,00 informado — —"), "anúncio sem conversa entra com o gasto informado", linhas[3]);
  ok(semNbsp(await pg.locator('[data-testid="rodape-anuncio"]').innerText()).includes("o informado com o ID do anúncio só vale nos dias sem dado da Meta"), "rodapé explica a regra por anúncio");
  ok(await pg.locator('[data-testid="aviso-informado-ignorado"]').count() === 1, "formulário avisa que o informado é ignorado nos dias com dado da Meta");
  ok(JSON.stringify(estado.rpcs.find((r) => r.nome === "admin_crm_funil_gasto")?.corpo) === JSON.stringify(estado.rpcs.find((r) => r.nome === "admin_crm_funil")?.corpo)
     && JSON.stringify(estado.rpcs.find((r) => r.nome === "admin_crm_funil_gasto_por_anuncio")?.corpo) === JSON.stringify(estado.rpcs.find((r) => r.nome === "admin_crm_funil")?.corpo),
     "funções da 2A com o mesmo período do funil");
  ok(estado.rpcs.findIndex((r) => r.nome === "admin_crm_funil_gasto") > estado.rpcs.findIndex((r) => r.nome === "admin_crm_funil"), "funções da 2A só depois do funil");
  const larg = await pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, tela: window.innerWidth }));
  ok(larg.doc <= larg.tela, `sem rolagem lateral na página (${larg.doc} <= ${larg.tela})`, larg);
  ok(!/Infinity|NaN/.test(t) && !/99000|\+55|@s\.whatsapp/.test(t), "nenhum Infinity/NaN nem telefone");
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e sem log do app", { errosPagina, app: estado.consoleApp });
  ok(estado.externas.length === 0, "nenhuma chamada externa", estado.externas);
  await foto(pg, `g-gasto-meta-${largura}${atraso >= 60 ? "-atrasado" : ""}`);
  await ctx.close();
}

// ── I) SQL da 2A aplicado, n8n ainda não ligado (tabela automática vazia) ──
for (const largura of [1280, 390]) {
  console.log(`I) 2A aplicada, sem nenhuma sincronização ainda (${largura}px)`);
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    com2A: true,
    rpc: (n) => n === "admin_crm_funil" ? { json: [FUNIL] } : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO }
      : n === "admin_crm_funil_excluidos" ? { json: FORA } : n === "admin_crm_funil_teste" ? { json: TESTE }
      : n === "admin_crm_funil_gasto" ? { json: [{ gasto_auto_centavos: 0, dias_auto: 0, anuncios_auto: 0, conversas_meta: 0, impressoes: 0, cliques: 0,
          gasto_manual_efetivo_centavos: 124000, lancamentos_manuais_efetivos: 1, atualizado_em: null }] }
      : n === "admin_crm_funil_gasto_por_anuncio" ? { json: [] }
      : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  }, { largura });
  await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
  await pg.waitForSelector('[data-testid="aviso-informado-ignorado"]');
  await pg.waitForTimeout(800);
  const t = semNbsp(await texto(pg));
  ok(semNbsp(await pg.locator('[data-testid="fonte-gasto"]').innerText()) === "Gasto informado (sem dado da Meta no período)", "selo: só o informado");
  const custos = semNbsp(await pg.locator('[data-testid="funil-custos"]').innerText()).replace(/\s+/g, " ");
  ok(custos === "Gasto no período R$ 1.240,00 Custo por conversa R$ 3,01 Custo por cadastro R$ 20,33 Custo por assinante R$ 137,78", "custos iguais aos de antes da 2A", custos);
  ok(await pg.locator('[data-testid="gasto-atualizado"], [data-testid="conversas-meta"], [data-testid="ajuda-gasto-meta"], [data-testid="conversas-meta-linha"], [data-testid="origem-gasto"]').count() === 0,
     "sem 'atualizado há', conversas da Meta, ajuda do atraso ou origem por linha");
  const cab = (await pg.locator('[data-testid="tabela-funil-anuncio"] thead th').allInnerTexts()).map((x) => x.trim());
  ok(cab.includes("Gasto informado") && !cab.includes("Conversas (Meta)"), "tabela por anúncio como antes", cab);
  ok(semNbsp(await pg.locator('[data-testid="rodape-anuncio"]').innerText()).includes("ainda sem dado da Meta no período") && !t.includes("é por campanha"), "rodapé não fala mais de Meta por campanha");
  ok(!/Infinity|NaN|indisponível|Tentar novamente/.test(t), "sem Infinity/NaN nem aviso de erro");
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e sem log do app", { errosPagina, app: estado.consoleApp });
  await foto(pg, `i-2a-sem-sincronizacao-${largura}`);
  await ctx.close();
}

// ── H) 2A aplicada só em parte (gasto por anúncio falha): tabela como antes ──
console.log("H) 2A: gasto por anúncio com erro, gasto do período ok (1280px)");
{
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    com2A: true,
    rpc: (n) => n === "admin_crm_funil" ? { json: [FUNIL] } : n === "admin_crm_funil_por_anuncio" ? { json: POR_ANUNCIO }
      : n === "admin_crm_funil_excluidos" ? { json: FORA } : n === "admin_crm_funil_teste" ? { json: TESTE }
      : n === "admin_crm_funil_gasto" ? { json: GASTO(5) } : n === "admin_crm_funil_gasto_por_anuncio" ? { status: 500, json: { code: "XX000", message: "falha" } }
      : { json: null },
    tabela: (t) => t === "crm_gasto_manual" ? { json: GASTOS } : { json: [] },
  });
  await pg.waitForSelector('[data-testid="gasto-atualizado"]');
  await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
  await pg.waitForTimeout(1500);
  const t = semNbsp(await texto(pg));
  const cab = (await pg.locator('[data-testid="tabela-funil-anuncio"] thead th').allInnerTexts()).map((x) => x.trim());
  ok(cab.includes("Gasto informado") && !cab.includes("Conversas (Meta)"), "tabela por anúncio volta ao formato antigo", cab);
  ok(!/indisponível|Tentar novamente|Erro/i.test(t), "nenhum aviso de erro");
  ok(t.includes("R$ 1.060,00"), "custos do período continuam com o gasto da 2A");
  ok(estado.rpcs.filter((r) => r.nome === "admin_crm_funil_gasto_por_anuncio").length <= 2, "no máximo 1 nova tentativa em falha comum (mesma regra das outras)");
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e sem log do app", { errosPagina, app: estado.consoleApp });
  await foto(pg, "h-gasto-anuncio-falhou");
  await ctx.close();
}

// ── C) amostra pequena (29 conversas) e fonte Meta ──────────────────────────
console.log("C) 29 conversas, gasto da Meta (e também informado)");
{
  const { ctx, pg, errosPagina } = await abrir(navegador, {
    rpc: (n) => n === "admin_crm_funil"
      ? { json: [{ ...FUNIL, conversas: 29, cadastros: 4, testes: 3, assinantes: 0, gasto_meta_centavos: 30000, gasto_meta_dias: 5, gasto_manual_centavos: 99900 }] }
      : { json: [] },
  });
  await pg.waitForSelector('[data-testid="aviso-amostra"]');
  const t = semNbsp(await texto(pg));
  ok(t.includes("Amostra pequena: use como indicativo"), "aviso de amostra pequena");
  ok(t.includes("Gasto da Meta (campanhas de WhatsApp) · 5 de 7 dias") && !t.includes("Gasto informado ·"), "fonte Meta com dias cobertos");
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

// ── P) filtro de período: Hoje, Ontem e padrão "Últimos 7 dias" ────────────
const isoBrasilia = (deltaDias) => {
  const d = new Date(Date.now() + deltaDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};
const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const OPCOES = ["Hoje", "Ontem", "Últimos 7 dias", "Últimos 14 dias", "Últimos 30 dias", "Personalizado"];
for (const largura of [1280, 390]) {
  console.log(`P) filtro de período: 6 opções, Hoje e Ontem (${largura}px)`);
  const hojeBR = isoBrasilia(0);
  const { ctx, pg, estado, errosPagina } = await abrir(navegador, {
    com2A: true,
    rpc: (n, corpo) => {
      const umDia = corpo?.p_inicio === corpo?.p_fim;
      const dias = umDia ? 1 : 6;
      if (n === "admin_crm_funil") return { json: [FUNIL] };
      if (n === "admin_crm_funil_por_anuncio") return { json: POR_ANUNCIO };
      if (n === "admin_crm_funil_excluidos") return { json: FORA };
      if (n === "admin_crm_funil_teste") return { json: TESTE };
      if (n === "admin_crm_funil_gasto") return { json: [{ ...GASTO(23)[0], dias_auto: dias, gasto_manual_efetivo_centavos: 0, lancamentos_manuais_efetivos: 0 }] };
      if (n === "admin_crm_funil_gasto_por_anuncio") return { json: GASTO_ANUNCIO.map((g) => ({ ...g, dias_auto: g.dias_auto ? dias : 0 })) };
      return { json: null };
    },
    tabela: (t) => t === "crm_gasto_manual" ? { json: [] } : { json: [] },
  }, { largura });
  await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
  await pg.waitForSelector('[data-testid="conversas-meta-linha"]');
  const gatilho = pg.getByRole("combobox", { name: "Período do funil" });
  ok((await gatilho.innerText()).trim() === "Últimos 7 dias", "abre em 'Últimos 7 dias'", await gatilho.innerText());
  const primeira = estado.rpcs.find((r) => r.nome === "admin_crm_funil")?.corpo;
  ok(primeira?.p_inicio === isoBrasilia(-6) && primeira?.p_fim === hojeBR, "padrão consulta hoje-6..hoje (Brasília)", primeira);
  ok(semNbsp(await pg.locator('[data-testid="fonte-gasto"]').innerText()) === "Gasto da Meta por anúncio · 6 de 7 dias", "selo com 7 dias");
  const linhas7d = await pg.locator('[data-testid="tabela-funil-anuncio"] tbody tr').count();
  ok(linhas7d >= POR_ANUNCIO.length, `tabela por anúncio em 7 dias (${linhas7d} linhas)`);
  await gatilho.click();
  await pg.waitForSelector('[role="option"]');
  const opcoes = (await pg.getByRole("option").allInnerTexts()).map((x) => x.trim());
  ok(JSON.stringify(opcoes) === JSON.stringify(OPCOES), "6 opções na ordem", opcoes);
  await foto(pg, `p-periodo-select-${largura}`).catch(() => {});
  await pg.screenshot({ path: path.join(SAIDA, `p-periodo-select-pagina-${largura}.png`) });

  for (const [rotulo, iso] of [["Hoje", hojeBR], ["Ontem", isoBrasilia(-1)]]) {
    if (await pg.getByRole("option").count() === 0) { await gatilho.click(); await pg.waitForSelector('[role="option"]'); }
    const antes = estado.rpcs.length;
    await pg.getByRole("option", { name: rotulo, exact: true }).click();
    await pg.waitForFunction((d) => document.querySelector('[data-testid="ajuda-funil"]')?.textContent?.includes(`em ${d}`), dataBR(iso));
    await pg.waitForSelector('[data-testid="tabela-funil-anuncio"]');
    await pg.waitForFunction(() => /1 de 1 dia$/.test(document.querySelector('[data-testid="fonte-gasto"]')?.textContent ?? ""));
    const novas = estado.rpcs.slice(antes);
    const nomes = [...new Set(novas.map((r) => r.nome))].sort();
    ok(nomes.length >= 6 && novas.every((r) => r.corpo.p_inicio === iso && r.corpo.p_fim === iso),
      `${rotulo}: todas as consultas com início = fim = ${iso}`, novas.map((r) => [r.nome, r.corpo]));
    ok((await gatilho.innerText()).trim() === rotulo, `${rotulo}: Select mostra '${rotulo}'`);
    const selo = semNbsp(await pg.locator('[data-testid="fonte-gasto"]').innerText());
    ok(selo === "Gasto da Meta por anúncio · 1 de 1 dia", `${rotulo}: selo '1 de 1 dia'`, selo);
    const ajuda = semNbsp(await pg.locator('[data-testid="ajuda-funil"]').innerText());
    ok(ajuda.includes(`Pessoas cujo 1º contato foi em ${dataBR(iso)}; cadastros`) && !ajuda.includes(" a " + dataBR(iso)), `${rotulo}: ajuda 'em ${dataBR(iso)}'`, ajuda);
    ok(await pg.locator('[data-testid="tabela-funil-anuncio"] tbody tr').count() === linhas7d, `${rotulo}: tabela por anúncio com as mesmas ${linhas7d} linhas`);
    ok(!/não ativado|indisponível|Tentar novamente|Escolha as duas datas/i.test(await texto(pg)), `${rotulo}: sem aviso de erro no card`);
    await foto(pg, `p-${rotulo.toLowerCase()}-${largura}`);
  }
  // Personalizado começa nos mesmos 7 dias do padrão
  await gatilho.click();
  await pg.getByRole("option", { name: "Personalizado", exact: true }).click();
  ok(await pg.locator('input[aria-label="Início"]').inputValue() === isoBrasilia(-6) && await pg.locator('input[aria-label="Fim"]').inputValue() === hojeBR, "Personalizado começa em hoje-6..hoje");
  ok(errosPagina.length === 0 && estado.consoleApp.length === 0, "sem erro na página e nenhum log do app no console", { errosPagina, app: estado.consoleApp });
  ok(estado.externas.length === 0, "nenhuma chamada externa", estado.externas);
  await ctx.close();
}

await navegador.close();
console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
