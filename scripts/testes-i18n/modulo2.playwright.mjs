// Etapa 5B do i18n (telas de PDV e Vendas) com o APP DE VERDADE (build de
// produção) e o Supabase simulado. Dados 100% fictícios; nada sai da máquina
// (o resto é bloqueado e registrado). Fluxos reais: venda em dinheiro (troco),
// crédito parcelado, desconto, cancelar, excluir e voltar para pendente.
//
//   npx vite build && npx vite preview --port 8312 --strictPort --host 127.0.0.1   (em cada árvore)
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-i18n/modulo2.playwright.mjs \
//     coletar <rotulo> <base-url> <pasta-saida> [ptbr|es|tudo]
//   node scripts/testes-i18n/modulo2.playwright.mjs comparar <a.json> <b.json>
//
// Cada caso: HTML do <body> ao fim de cada passo, lang, consultas ao Supabase
// (com o corpo de POST/PATCH/DELETE e das RPCs), arquivos JS/CSS pedidos (sem
// hash) e, nos casos em espanhol, os textos visíveis com cara de português e
// os elementos com texto cortado/estourado.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , acao, ...args] = process.argv;

if (acao === "comparar") {
  const [a, b] = args.slice(0, 2).map((f) => JSON.parse(readFileSync(f, "utf8")));
  const casos = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((c) => !c.startsWith("admin-es-")).sort();
  let diferentes = 0;
  const sobra = (x, y) => { const r = [...y]; return x.filter((i) => { const k = r.indexOf(i); if (k < 0) return true; r.splice(k, 1); return false; }); };
  for (const caso of casos) {
    const campos = ["html", "passos", "toasts", "lang", "consultas", "arquivos", "localStorage"].filter((c) => JSON.stringify(a[caso]?.[c]) !== JSON.stringify(b[caso]?.[c]));
    if (!campos.length) { console.log(`igual:     ${caso}`); continue; }
    diferentes++;
    console.log(`DIFERENTE: ${caso} → ${campos.join(", ")}`);
    for (const c of campos) {
      const [va, vb] = [a[caso]?.[c], b[caso]?.[c]];
      if (c === "html" || (c === "passos" && typeof va === "object")) {
        if (c === "passos") {
          for (const p of [...new Set([...Object.keys(va ?? {}), ...Object.keys(vb ?? {})])]) {
            const [xa, xb] = [va?.[p] ?? "", vb?.[p] ?? ""];
            if (xa === xb) continue;
            let i = 0;
            while (i < Math.min(xa.length, xb.length) && xa[i] === xb[i]) i++;
            console.log(`  passo ${p}: a …${JSON.stringify(xa.slice(Math.max(0, i - 120), i + 120))}\n        b …${JSON.stringify(xb.slice(Math.max(0, i - 120), i + 120))}`);
          }
          continue;
        }
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
const SAIDA = path.resolve(saidaArg ?? "coleta-modulo2");
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

const CLIENTE = { nome: "Maria Teste", telefone: "11988887777" };
const venda = (o) => ({
  user_id: USUARIO.id, quantidade: 1, custo_unitario: 0, valor_desconto_manual: 0, valor_desconto_cupom: 0, recebido: true, cancelada: false,
  deleted_at: null, empresa_id: null, parcela_numero: null, total_parcelas: null, segunda_forma_pagamento: null, valor_segunda_forma: null,
  valor_troca: null, grupo_venda: null, data_prevista_recebimento: null, observacoes: null, clientes: CLIENTE, produtos: null, dispositivos: null, pecas: null,
  ...o,
});

function tabelasBase({ admin, idioma }) {
  return {
    user_roles: admin ? [{ user_id: USUARIO.id, role: "admin" }] : [],
    profiles: [{
      id: USUARIO.id, user_id: USUARIO.id, nome: "Ana Loja Teste", email: USUARIO.email, celular: "11999990000", created_at: "2026-01-10T12:00:00Z",
      // Perfil em espanhol = conta do mercado ES_LATAM (México, dólar, fuso da Cidade do México).
      ...(idioma === "es"
        ? { idioma, mercado: "ES_LATAM", pais: "MX", moeda: "USD", fuso_horario: "America/Mexico_City" }
        : { idioma, mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo" }),
      preferencias_os: null,
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
    vendas: [
      venda({ id: "v1", numero_venda: "VD-000101", tipo: "produto", produto_id: "p1", total: 89.9, custo_unitario: 30, data: "2026-10-26T13:00:00Z", forma_pagamento: "dinheiro", produtos: { nome: "Capinha iPhone 13", sku: "CAP13" } }),
      venda({ id: "v2", numero_venda: "VD-000102", tipo: "dispositivo", dispositivo_id: "d1", total: 2500, custo_unitario: 1800, valor_desconto_manual: 100, data: "2026-10-25T18:30:00Z", forma_pagamento: "credito_parcelado", dispositivos: { tipo: "celular", marca: "Apple", modelo: "iPhone 12" } }),
      ...[1, 2, 3].map((n) => venda({ id: `v3-${n}`, numero_venda: "VD-000103", tipo: "produto", produto_id: "p2", total: 400, custo_unitario: 100, data: "2026-10-24T15:00:00Z", forma_pagamento: "a_receber", recebido: false, parcela_numero: n, total_parcelas: 3, data_prevista_recebimento: ["2026-10-20", "2026-10-28", "2026-11-24"][n - 1], produtos: { nome: "Fone Bluetooth", sku: "FONE1" } })),
      venda({ id: "v4", numero_venda: "VD-000104", tipo: "produto", produto_id: "p3", total: 150, data: "2026-10-23T12:00:00Z", forma_pagamento: "a_receber", recebido: true, data_prevista_recebimento: "2026-10-23", produtos: { nome: "Carregador Turbo", sku: "CARR1" } }),
      venda({ id: "v5", numero_venda: "VD-000105", tipo: "produto", produto_id: "p4", total: 59, data: "2026-10-22T12:00:00Z", forma_pagamento: "pix", cancelada: true, produtos: { nome: "Película Vidro", sku: "PEL1" } }),
      venda({ id: "v6", numero_venda: "VD-000106", grupo_venda: "g1", tipo: "produto", produto_id: "p1", total: 89.9, data: "2026-10-21T12:00:00Z", forma_pagamento: "pix", segunda_forma_pagamento: "dinheiro", valor_segunda_forma: 50, produtos: { nome: "Capinha iPhone 13", sku: "CAP13" } }),
      venda({ id: "v7", numero_venda: "VD-000106", grupo_venda: "g1", tipo: "produto", produto_id: "p3", total: 150, quantidade: 2, data: "2026-10-21T12:00:00Z", forma_pagamento: "pix", produtos: { nome: "Carregador Turbo", sku: "CARR1" } }),
    ],
    vendas_avulsas: [{ id: "av1", user_id: USUARIO.id, descricao: "Conserto rápido", valor: 35, forma_pagamento: "transferencia", observacao: null, created_at: "2026-10-26T14:00:00Z", deleted_at: null }],
    ordens_servico: [
      { id: "o1", user_id: USUARIO.id, numero_os: "101", total: 350, status: "entregue", is_teste: false, deleted_at: null, empresa_id: null, created_at: "2026-10-25T13:00:00Z", data_saida: "2026-10-26T12:00:00Z", avarias: {}, clientes: CLIENTE, servicos: { nome: "Troca de tela" } },
    ],
    contas: [],
    produtos: [
      { id: "p1", user_id: USUARIO.id, nome: "Capinha iPhone 13", sku: "CAP13", preco: 89.9, custo: 30, quantidade: 20, tipo: "produto", deleted_at: null, empresa_id: null, created_at: "2026-01-10T12:00:00Z" },
      { id: "p3", user_id: USUARIO.id, nome: "Carregador Turbo", sku: "CARR1", preco: 150, custo: 60, quantidade: 8, tipo: "produto", deleted_at: null, empresa_id: null, created_at: "2026-01-11T12:00:00Z" },
    ],
    clientes: [{ id: "cl1", user_id: USUARIO.id, nome: "Maria Teste", telefone: "11988887777", cpf: "123.456.789-00", deleted_at: null, empresa_id: null, created_at: "2026-02-01T12:00:00Z" }],
    // Aparelho à venda (sem IMEI cadastrado) para o fluxo de troca no PDV.
    dispositivos: [{ id: "d9", user_id: USUARIO.id, tipo: "celular", marca: "Samsung", modelo: "Galaxy A54", preco: 1800, custo: 1200, quantidade: 1, vendido: false, deleted_at: null, empresa_id: null, condicao: "seminovo", tempo_garantia: 3, created_at: "2026-09-01T12:00:00Z", fornecedores: null, dispositivo_imeis: [] }],
    caixas: [{ id: "cx1", user_id: USUARIO.id, status: "aberto", saldo_inicial: 100, data_abertura: "2026-10-26T11:00:00Z", data_fechamento: null, empresa_id: null, created_at: "2026-10-26T11:00:00Z" }],
    caixa_movimentacoes: [],
    taxas_cartao: [],
    formas_pagamento_customizadas: [],
  };
}

// Textos dos dois idiomas para achar os mesmos botões nas duas árvores.
const R = {
  maisAcoes: /^(Mais ações|Más acciones)$/,
  cancelarVenda: /^(Cancelar Venda|Cancelar venta)$/,
  excluirVenda: /^(Excluir Venda|Eliminar venta)$/,
  voltarPendente: /^(Voltar para Pendente|Volver a pendiente)$/,
  editarVenda: /^(Editar Venda|Editar venta)$/,
  alterarData: /^(Alterar data da venda|Cambiar fecha de la venta)$/,
  periodo: /^Período$/,
  formaPagamento: /^(Forma de Pagamento|Forma de pago) \*$/,
  numeroParcelas: /^(Número de Parcelas|Número de cuotas) \*$/,
  dinheiro: /^(Dinheiro|Efectivo)$/,
  pix: /^(PIX|Pix)$/,
  creditoParcelado: /^(Crédito Parcelado|Crédito en cuotas)$/,
  statusCaixa: /^(Status do Caixa|Estado de caja)$/,
  historico: /^(Histórico|Historial)$/,
  sangria: /^(Sangria \/ Suprimento|Retiro \/ Ingreso)$/,
  fecharCaixa: /^(Fechar Caixa|Cerrar caja)$/,
  vendaAvulsa: /^(Venda Avulsa|Venta rápida)$/,
};

// PDV: botão de atalho do topo (Venda Avulsa, Caixa, Histórico...) pelo texto.
const atalho = (pg, rotulo) => pg.locator("main button", { has: pg.locator("span", { hasText: rotulo }) }).first().click();
// PDV: combobox do campo cujo rótulo casa com `rotulo`.
const combo = (pg, rotulo) => pg.locator("div.space-y-2", { has: pg.locator("label", { hasText: rotulo }) }).last().getByRole("combobox").first();
async function escolherForma(pg, opcao) {
  await combo(pg, R.formaPagamento).click();
  await pg.getByRole("option", { name: opcao }).click();
}
// Primeiro produto da aba Produtos (aberta por padrão) e fecha o diálogo.
async function adicionarPrimeiroProduto(pg) {
  await pg.locator("[role=dialog] button", { hasText: /^(Adicionar|Agregar)$/ }).first().click();
  await pg.waitForTimeout(300);
  await pg.keyboard.press("Escape");
}

// Linha (computador) ou cartão (celular) da venda com este item.
const linha = (pg, tela, item) => (tela === "computador" ? pg.locator("tr", { hasText: item }).first() : pg.locator("article", { hasText: item }).first());

async function acaoVenda(pg, tela, item, rotulo) {
  const l = linha(pg, tela, item);
  if (tela === "computador") {
    for (const b of await l.locator("button[title]").all()) if (rotulo.test(await b.getAttribute("title"))) return b.click();
    for (const b of await l.locator("button[title]").all()) if (R.maisAcoes.test(await b.getAttribute("title"))) { await b.click(); break; }
    await pg.waitForTimeout(400);
    return pg.getByRole("menuitem", { name: rotulo }).click();
  }
  for (const b of await l.locator("button[aria-label]").all()) if (rotulo.test(await b.getAttribute("aria-label"))) return b.click();
  throw new Error(`ação ${rotulo} não achada em ${item}`);
}

// Último botão do rodapé do diálogo (a ação principal), sem o "X" de fechar (que tem o texto sr-only).
const ultimoBotaoDoDialogo = (pg) => pg.locator("[role=dialog] button:visible, [role=alertdialog] button:visible").filter({ hasNot: pg.locator(".sr-only") }).last();

// Fluxos: passos nomeados; o HTML do <body> é guardado ao fim de cada um.
const FLUXOS = {
  "pdv-inicial": { rota: "/pdv", passos: {} },
  "pdv-dinheiro": {
    rota: "/pdv",
    passos: {
      seletorItens: async (pg) => pg.locator('[data-walkthrough="pdv-adicionar-item"]').click(),
      adicionarItem: adicionarPrimeiroProduto,
      forma: async (pg) => escolherForma(pg, R.dinheiro),
      finalizar: async (pg) => pg.locator('[data-walkthrough="pdv-finalizar"]').click(),
    },
  },
  "pdv-credito-parcelado": {
    rota: "/pdv",
    passos: {
      adicionarItem: async (pg) => { await pg.locator('[data-walkthrough="pdv-adicionar-item"]').click(); await pg.waitForTimeout(600); await adicionarPrimeiroProduto(pg); },
      forma: async (pg) => escolherForma(pg, R.creditoParcelado),
      parcelas: async (pg) => { await combo(pg, R.numeroParcelas).click(); await pg.getByRole("option", { name: /^3/ }).click(); },
      finalizar: async (pg) => pg.locator('[data-walkthrough="pdv-finalizar"]').click(),
    },
  },
  "pdv-desconto": {
    rota: "/pdv",
    passos: {
      adicionarItem: async (pg) => { await pg.locator('[data-walkthrough="pdv-adicionar-item"]').click(); await pg.waitForTimeout(600); await adicionarPrimeiroProduto(pg); },
      desconto: async (pg) => {
        await pg.getByRole("combobox").filter({ hasText: /^(R\$|US\$)$/ }).click();
        await pg.getByRole("option", { name: "%" }).click();
        await pg.locator("input[type=number].w-20.h-8").fill("10");
      },
      forma: async (pg) => escolherForma(pg, R.pix),
      finalizar: async (pg) => pg.locator('[data-walkthrough="pdv-finalizar"]').click(),
    },
  },
  "pdv-pagamento-duplo": {
    rota: "/pdv",
    passos: {
      adicionarItem: async (pg) => { await pg.locator('[data-walkthrough="pdv-adicionar-item"]').click(); await pg.waitForTimeout(600); await adicionarPrimeiroProduto(pg); },
      forma: async (pg) => escolherForma(pg, R.dinheiro),
      duplo: async (pg) => {
        await pg.locator("#pagamento-duplo").click();
        await pg.waitForTimeout(300);
        await pg.locator("#valor-primeira").fill("50");
        await pg.locator("#segunda-forma").click();
        await pg.getByRole("option", { name: R.pix }).click();
      },
    },
  },
  "pdv-cliente-novo": {
    rota: "/pdv",
    passos: {
      buscar: async (pg) => pg.locator("#busca-cliente").fill("Jo"),
      criar: async (pg) => pg.getByRole("button", { name: /^(Criar cliente|Crear cliente) "Jo"$/ }).first().dispatchEvent("mousedown"),
    },
  },
  "pdv-status-caixa": { rota: "/pdv", passos: { abrir: async (pg) => atalho(pg, R.statusCaixa) } },
  "pdv-historico": { rota: "/pdv", passos: { abrir: async (pg) => atalho(pg, R.historico) } },
  "pdv-sangria": {
    rota: "/pdv",
    passos: {
      abrir: async (pg) => atalho(pg, R.sangria),
      registrar: async (pg) => { await pg.locator("[role=dialog] input[type=number]").fill("20"); await ultimoBotaoDoDialogo(pg).click(); },
    },
  },
  "pdv-fechar-caixa": {
    rota: "/pdv",
    passos: {
      abrir: async (pg) => atalho(pg, R.fecharCaixa),
      confirmar: async (pg) => { await pg.locator("#saldo-contado").fill("150"); await ultimoBotaoDoDialogo(pg).click(); },
    },
  },
  "pdv-venda-avulsa": {
    rota: "/pdv",
    passos: {
      abrir: async (pg) => atalho(pg, R.vendaAvulsa),
      registrar: async (pg) => {
        const d = pg.locator("[role=dialog]");
        await d.locator("input").first().fill("Conserto de conector");
        await d.locator("input[type=number]").fill("45");
        await d.getByRole("combobox").click();
        await pg.getByRole("option", { name: R.dinheiro }).click();
        await d.getByRole("button", { name: /^(Registrar Venda|Registrar venta)$/ }).click();
      },
    },
  },
  "pdv-formas-config": { rota: "/pdv", passos: { abrir: async (pg) => pg.getByRole("button", { name: /^Configurar$/ }).click() } },
  "pdv-troca": {
    rota: "/pdv",
    passos: {
      adicionarAparelho: async (pg) => {
        await pg.locator('[data-walkthrough="pdv-adicionar-item"]').click();
        await pg.waitForTimeout(600);
        await pg.getByRole("tab", { name: /^(Dispositivos|Equipos)$/ }).click();
        await pg.locator("[role=dialog] button", { hasText: /^(Adicionar|Agregar)$/ }).first().click();
      },
      garantia: async (pg) => { await pg.locator("[role=dialog] button", { hasText: /^Confirmar$/ }).last().click(); await pg.waitForTimeout(300); await pg.keyboard.press("Escape"); },
      dialogoTroca: async (pg) => pg.getByRole("button", { name: /^(\+ Dispositivo de Entrada \(Troca\)|\+ Equipo como parte de pago)$/ }).click(),
    },
  },
  "vendas-lista": { rota: "/vendas", passos: {} },
  "vendas-filtro-periodo": { rota: "/vendas", passos: { periodo: async (pg) => pg.getByRole("button", { name: R.periodo }).click() } },
  "vendas-cancelar": {
    rota: "/vendas",
    passos: {
      abrirDialogo: async (pg, c) => acaoVenda(pg, c.tela, "Capinha iPhone 13", R.cancelarVenda),
      confirmar: async (pg) => { await pg.locator("[role=dialog] textarea").fill("Cliente desistiu"); await ultimoBotaoDoDialogo(pg).click(); },
    },
  },
  "vendas-excluir": {
    rota: "/vendas",
    passos: {
      abrirDialogo: async (pg, c) => acaoVenda(pg, c.tela, "Película Vidro", R.excluirVenda),
      confirmar: async (pg) => ultimoBotaoDoDialogo(pg).click(),
    },
  },
  "vendas-voltar-pendente": { rota: "/vendas", passos: { voltar: async (pg, c) => acaoVenda(pg, c.tela, "Carregador Turbo", R.voltarPendente) } },
  "vendas-editar": { rota: "/vendas", passos: { abrirDialogo: async (pg, c) => acaoVenda(pg, c.tela, "iPhone 12", R.editarVenda) } },
  "vendas-alterar-data": { rota: "/vendas", passos: { abrirDialogo: async (pg, c) => acaoVenda(pg, c.tela, "iPhone 12", R.alterarData) } },
};

function casos() {
  const lista = [];
  for (const tela of ["computador", "celular"]) {
    for (const [perfil, admin, idioma] of [["naoadmin-ptbr", false, "pt-BR"], ["admin-ptbr", true, "pt-BR"], ["naoadmin-perfil-es", false, "es"], ["admin-es", true, "es"]]) {
      if (QUAIS === "ptbr" && perfil === "admin-es") continue;
      if (QUAIS === "es" && perfil !== "admin-es") continue;
      // Não-admin com TUDO apontando para espanhol: perfil, ?lang, localStorage e navegador.
      const extras = perfil === "naoadmin-perfil-es" ? { localStorage: { mecapp_idioma: "es" }, locale: "es-MX", query: "?lang=es" } : {};
      for (const [fluxo, def] of Object.entries(FLUXOS)) lista.push({ nome: `${perfil}-${tela}-${fluxo}`, tela, admin, idioma, ...def, ...extras });
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

// Corpo da requisição, com UUIDs e instantes "agora" normalizados (gerados na hora).
const corpo = (req) => {
  const c = req.postData();
  if (!c) return "";
  return ` ${c.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")}`;
};

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
    // Aviso de instalação do PWA (iPhone) cobre a tela: dispensado (data fixa, igual nas duas árvores).
    localStorage.setItem("pwa-install-declined", "2026-10-26T12:00:00.000Z");
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
      if (rpc) { estado.consultas.push(`${req.method()} rpc:${rpc[1]}${corpo(req)}`); return r.fulfill({ status: 200, json: null }); }
      const m = url.pathname.match(/\/rest\/v1\/([a-z_0-9]+)/);
      if (m) {
        const params = [...url.searchParams.entries()].sort().map(([k, v]) => `${k}=${v}`).join("&");
        estado.consultas.push(`${req.method()} ${m[1]}?${params}${corpo(req)}`);
        const umObjeto = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
        if (req.method() === "PATCH") {
          const alteradas = filtrar(estado.tabelas[m[1]] ?? [], url.searchParams);
          for (const l of alteradas) Object.assign(l, req.postDataJSON());
          return umObjeto ? r.fulfill({ status: 200, json: alteradas[0] ?? {} }) : r.fulfill({ status: 200, json: alteradas });
        }
        if (req.method() === "POST") {
          // Eco do que foi inserido (com id), como o PostgREST faz com return=representation.
          const json = req.postDataJSON();
          const linhas = (Array.isArray(json) ? json : [json]).map((l, i) => ({ id: `novo-${m[1]}-${estado.consultas.length}-${i}`, ...l }));
          (estado.tabelas[m[1]] ??= []).push(...linhas);
          return r.fulfill({ status: 201, json: umObjeto ? linhas[0] : linhas });
        }
        if (req.method() === "DELETE") {
          const fora = new Set(filtrar(estado.tabelas[m[1]] ?? [], url.searchParams));
          estado.tabelas[m[1]] = (estado.tabelas[m[1]] ?? []).filter((l) => !fora.has(l));
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

// PW_EXECUTAVEL=<caminho>: usa outro Chromium já baixado (versão do cache diferente da do pacote).
const navegador = await chromium.launch(process.env.PW_EXECUTAVEL ? { executablePath: process.env.PW_EXECUTAVEL } : {});
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
      const passos = { abrir: await pg.evaluate(() => document.body.innerHTML) };
      for (const [nomePasso, passo] of Object.entries(caso.passos)) {
        await passo(pg, caso);
        await assentar(pg);
        passos[nomePasso] = await pg.evaluate(() => document.body.innerHTML);
        if (caso.idioma === "es" && caso.admin) await pg.screenshot({ path: path.join(SAIDA, `${rotulo}-${caso.nome}-${nomePasso}.png`), fullPage: true });
      }
      const foto = {
        html: await pg.evaluate(() => document.body.innerHTML),
        passos,
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
      if (!caso.admin && foto.arquivos.some((a) => a.includes("idioma-"))) erros.push(`não-admin baixou arquivo de idioma: ${foto.arquivos.filter((a) => a.includes("idioma-"))}`);
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
