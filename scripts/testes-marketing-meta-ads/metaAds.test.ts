// deno test --no-check --allow-read scripts/testes-marketing-meta-ads/
// Painel Marketing — Meta Ads (src/lib/marketing/metaAds.ts): leitura de
// actions/action_values, dinheiro em centavos inteiros, métricas sem
// divisão por zero, agrupamento por campanha/dia, validade do cache em
// meta_ads_sync, limite de 90 dias e tradução dos erros da Meta.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { calcularPeriodos } from "../../src/lib/marketing/cadastrosPorDia.ts";
import {
  agruparPorCampanha,
  agruparPorDia,
  calcularMetricas,
  centavosParaDecimal,
  compararPeriodos,
  decidirAtualizacao,
  decimalParaCentavos,
  deLinhaCache,
  type EstadoSyncMeta,
  erroTemporario,
  extrairConversoes,
  formatarAtualizadoHa,
  type InsightMetaBruto,
  lerUsoApiMeta,
  type LinhaInsightDia,
  normalizarInsightMeta,
  paraLinhaBanco,
  somarTotaisMeta,
  traduzirErroMeta,
  validadeDoDiaMin,
  validarPeriodo,
} from "../../src/lib/marketing/metaAds.ts";

// ---------------------------------------------------------------------------
// Respostas de exemplo no formato da API de Insights (level=campaign,
// time_increment=1). Números e tipos copiados do formato real da Meta.
// ---------------------------------------------------------------------------

const CAMPANHA_CONVERSAO: InsightMetaBruto = {
  campaign_id: "120211234567890123",
  campaign_name: "[CONV] Cadastro - Lookalike 1%",
  objective: "OUTCOME_LEADS",
  spend: "87.53",
  impressions: "12450",
  reach: "9310",
  clicks: "301",
  inline_link_clicks: "214",
  account_currency: "BRL",
  date_start: "2026-10-20",
  date_stop: "2026-10-20",
  actions: [
    { action_type: "link_click", value: "214" },
    { action_type: "landing_page_view", value: "180" },
    { action_type: "post_engagement", value: "260" },
    { action_type: "page_engagement", value: "262" },
    { action_type: "video_view", value: "1022" },
    { action_type: "lead", value: "7" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "5" },
    { action_type: "complete_registration", value: "12" },
    { action_type: "offsite_conversion.fb_pixel_complete_registration", value: "12" },
    { action_type: "purchase", value: "2" },
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
    { action_type: "omni_purchase", value: "2" },
  ],
  action_values: [
    { action_type: "purchase", value: "99.800000" },
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "99.800000" },
    { action_type: "omni_purchase", value: "99.800000" },
  ],
};

const CAMPANHA_SO_PIXEL: InsightMetaBruto = {
  campaign_id: "120211234567890999",
  campaign_name: "[TRAF] Remarketing",
  objective: "OUTCOME_TRAFFIC",
  spend: "10.123456",
  impressions: "3000",
  reach: "2100",
  clicks: "45",
  inline_link_clicks: "40",
  account_currency: "BRL",
  date_start: "2026-10-20",
  date_stop: "2026-10-20",
  actions: [
    { action_type: "link_click", value: "40" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
    { action_type: "offsite_conversion.fb_pixel_complete_registration", value: "1" },
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "1" },
  ],
  action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "49.9" }],
};

// Campanha pausada no meio do dia: a Meta devolve a linha sem actions.
const CAMPANHA_SEM_ACOES: InsightMetaBruto = {
  campaign_id: "120211234567890555",
  campaign_name: "[RECONHEC] Marca",
  objective: "OUTCOME_AWARENESS",
  spend: "0",
  impressions: "0",
  reach: "0",
  clicks: "0",
  inline_link_clicks: "0",
  account_currency: "BRL",
  date_start: "2026-10-20",
  date_stop: "2026-10-20",
};

function linha(parcial: Partial<LinhaInsightDia> & { campaign_id: string; dia: string }): LinhaInsightDia {
  return {
    campaign_name: null,
    objetivo: null,
    gastoCentavos: 0,
    moeda: "BRL",
    impressoes: 0,
    alcance: 0,
    cliques: 0,
    cliquesLink: 0,
    leads: 0,
    cadastros: 0,
    compras: 0,
    valorComprasCentavos: 0,
    acoes: null,
    ...parcial,
  };
}

const semInfinitoOuNaN = (obj: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") assert(Number.isFinite(v), `${k} = ${v}`);
  }
};

// ---------------------------------------------------------------------------
// actions / action_values
// ---------------------------------------------------------------------------

Deno.test("actions com vários tipos: lead agregado não soma o fb_pixel_lead", () => {
  assertEquals(extrairConversoes(CAMPANHA_CONVERSAO.actions, CAMPANHA_CONVERSAO.action_values), {
    leads: 7,
    cadastros: 12,
    compras: 2,
    valorComprasCentavos: 9980,
  });
});

Deno.test("só eventos do pixel: usa offsite_conversion.fb_pixel_*", () => {
  assertEquals(extrairConversoes(CAMPANHA_SO_PIXEL.actions, CAMPANHA_SO_PIXEL.action_values), {
    leads: 3,
    cadastros: 1,
    compras: 1,
    valorComprasCentavos: 4990,
  });
});

Deno.test("sem actions, actions nulo ou malformado: tudo zero", () => {
  const zero = { leads: 0, cadastros: 0, compras: 0, valorComprasCentavos: 0 };
  assertEquals(extrairConversoes(undefined, undefined), zero);
  assertEquals(extrairConversoes(null, null), zero);
  assertEquals(extrairConversoes("erro", { a: 1 }), zero);
  assertEquals(extrairConversoes([{ action_type: "lead" }, { value: "3" }, null, 7], []), zero);
});

Deno.test("mesmo tipo repetido no array conta uma vez", () => {
  const acoes = [{ action_type: "lead", value: "4" }, { action_type: "lead", value: "4" }];
  assertEquals(extrairConversoes(acoes, []).leads, 4);
});

Deno.test("valor de compra só no tipo do pixel enquanto a contagem é do agregado: cai no disponível", () => {
  const r = extrairConversoes(
    [{ action_type: "purchase", value: "1" }],
    [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "29.90" }],
  );
  assertEquals(r.compras, 1);
  assertEquals(r.valorComprasCentavos, 2990);
});

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

Deno.test("texto decimal da Meta vira centavos exatos (2 e 6 casas)", () => {
  assertEquals(decimalParaCentavos("123.45"), 12345);
  assertEquals(decimalParaCentavos("1234"), 123400);
  assertEquals(decimalParaCentavos("0.123456"), 12);
  assertEquals(decimalParaCentavos("10.123456"), 1012);
  assertEquals(decimalParaCentavos("99.800000"), 9980);
  assertEquals(decimalParaCentavos("0.125"), 13); // meio para cima, como numeric
  assertEquals(decimalParaCentavos("0.124999"), 12);
  assertEquals(decimalParaCentavos("0.005"), 1);
  assertEquals(decimalParaCentavos("0.004999"), 0);
  assertEquals(decimalParaCentavos("999999999999.99"), 99999999999999); // teto de numeric(14,2)
  assertEquals(decimalParaCentavos(" 7.5 "), 750);
  assertEquals(decimalParaCentavos(12.3), 1230);
  assertEquals(decimalParaCentavos(1.005), 101);
});

Deno.test("valores inválidos ou negativos viram null", () => {
  for (const v of ["", "abc", "-1", "-0.01", "1,50", "1e3", "1.2.3", null, undefined, NaN, Infinity, -5]) {
    assertEquals(decimalParaCentavos(v as string | number | null | undefined), null, String(v));
  }
});

Deno.test("soma em centavos não acumula erro de float", () => {
  const dez = Array.from({ length: 10 }, () => decimalParaCentavos("0.10") ?? 0).reduce((a, b) => a + b, 0);
  assertEquals(dez, 100);
  assertEquals(centavosParaDecimal(dez), "1.00");
  // Em float: 0.1 * 10 somados = 0.9999999999999999
  assert(Array.from({ length: 10 }, () => 0.1).reduce((a, b) => a + b, 0) !== 1);
});

Deno.test("centavosParaDecimal", () => {
  assertEquals(centavosParaDecimal(0), "0.00");
  assertEquals(centavosParaDecimal(5), "0.05");
  assertEquals(centavosParaDecimal(12345), "123.45");
  assertEquals(centavosParaDecimal(99999999999999), "999999999999.99");
});

// ---------------------------------------------------------------------------
// Linha da API -> cache -> banco
// ---------------------------------------------------------------------------

Deno.test("normalizarInsightMeta lê todos os campos", () => {
  const l = normalizarInsightMeta(CAMPANHA_CONVERSAO);
  assertEquals(l?.gastoCentavos, 8753);
  assertEquals(l?.impressoes, 12450);
  assertEquals(l?.alcance, 9310);
  assertEquals(l?.cliques, 301);
  assertEquals(l?.cliquesLink, 214);
  assertEquals(l?.leads, 7);
  assertEquals(l?.dia, "2026-10-20");
  assertEquals(l?.objetivo, "OUTCOME_LEADS");
  assertEquals(l?.acoes?.length, 12);
});

Deno.test("normalizarInsightMeta descarta linha sem campanha ou sem data", () => {
  assertEquals(normalizarInsightMeta({ ...CAMPANHA_CONVERSAO, campaign_id: undefined }), null);
  assertEquals(normalizarInsightMeta({ ...CAMPANHA_CONVERSAO, date_start: "20/10/2026" }), null);
});

Deno.test("campanha sem gasto e sem actions: zeros e acoes null", () => {
  const l = normalizarInsightMeta(CAMPANHA_SEM_ACOES);
  assertEquals(l?.gastoCentavos, 0);
  assertEquals(l?.leads, 0);
  assertEquals(l?.acoes, null);
});

Deno.test("paraLinhaBanco grava dinheiro como texto decimal exato", () => {
  const l = normalizarInsightMeta(CAMPANHA_SO_PIXEL);
  assert(l);
  const r = paraLinhaBanco(l, "1234567890", "2026-10-22T12:00:00.000Z");
  assertEquals(r.gasto, "10.12");
  assertEquals(r.valor_compras, "49.90");
  assertEquals(r.ad_account_id, "1234567890");
  assertEquals(r.cliques_link, 40);
});

Deno.test("deLinhaCache aceita numeric/bigint como string ou número (PostgREST)", () => {
  const l = deLinhaCache({
    campaign_id: "1",
    campaign_name: "C",
    objetivo: null,
    dia: "2026-10-20",
    gasto: "87.53",
    moeda: "BRL",
    impressoes: "12450",
    alcance: 9310,
    cliques: "301",
    cliques_link: null,
    leads: 7,
    cadastros: "12",
    compras: null,
    valor_compras: 99.8,
  });
  assertEquals(l.gastoCentavos, 8753);
  assertEquals(l.impressoes, 12450);
  assertEquals(l.cliquesLink, 0);
  assertEquals(l.compras, 0);
  assertEquals(l.valorComprasCentavos, 9980);
});

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

Deno.test("custo por lead/cadastro, CTR, CPC e ROAS", () => {
  const t = somarTotaisMeta([normalizarInsightMeta(CAMPANHA_CONVERSAO)!]);
  const m = calcularMetricas(t);
  assertEquals(m.custoPorLeadCentavos, 1250); // 87,53 / 7 = 12,504 -> R$ 12,50
  assertEquals(m.custoPorCadastroCentavos, 729); // 87,53 / 12 = 7,294
  assertEquals(m.cpcCentavos, 29); // 87,53 / 301 = 0,2908
  assertEquals(Math.round(m.ctr! * 100) / 100, 2.42); // 301 / 12450
  assertEquals(Math.round(m.roas! * 100) / 100, 1.14); // 99,80 / 87,53
});

Deno.test("divisão por zero devolve null, nunca Infinity/NaN", () => {
  const zero = somarTotaisMeta([]);
  assertEquals(calcularMetricas(zero), {
    custoPorLeadCentavos: null,
    custoPorCadastroCentavos: null,
    ctr: null,
    cpcCentavos: null,
    roas: null,
  });
  // Gasto sem nenhum lead/clique/impressão
  const gastou = calcularMetricas({ ...zero, gastoCentavos: 5000 });
  assertEquals(gastou.custoPorLeadCentavos, null);
  assertEquals(gastou.cpcCentavos, null);
  assertEquals(gastou.ctr, null);
  assertEquals(gastou.roas, 0);
  // Compras sem gasto (ex.: atribuição orgânica): ROAS null
  assertEquals(calcularMetricas({ ...zero, valorComprasCentavos: 1000, compras: 1 }).roas, null);
  // Leads sem gasto: custo 0
  assertEquals(calcularMetricas({ ...zero, leads: 3 }).custoPorLeadCentavos, 0);
});

// ---------------------------------------------------------------------------
// Agrupamentos e comparação
// ---------------------------------------------------------------------------

const LINHAS: LinhaInsightDia[] = [
  linha({ campaign_id: "A", campaign_name: "Cadastro v1", dia: "2026-09-29", gastoCentavos: 1000, leads: 2, impressoes: 500, cliques: 10 }),
  linha({ campaign_id: "A", campaign_name: "Cadastro v2", dia: "2026-10-01", gastoCentavos: 3000, leads: 1, impressoes: 900, cliques: 20 }),
  linha({ campaign_id: "B", campaign_name: "Remarketing", dia: "2026-10-01", gastoCentavos: 5000, leads: 0, impressoes: 100, cliques: 5 }),
  linha({ campaign_id: "C", campaign_name: "Fora do período", dia: "2026-08-01", gastoCentavos: 99999 }),
];

Deno.test("agruparPorCampanha soma, usa o nome mais recente e ordena por gasto", () => {
  const r = agruparPorCampanha(LINHAS, { inicio: "2026-09-29", fim: "2026-10-02" });
  assertEquals(r.map((c) => [c.campaign_id, c.campaign_name, c.gastoCentavos, c.leads]), [
    ["B", "Remarketing", 5000, 0],
    ["A", "Cadastro v2", 4000, 3],
  ]);
  assertEquals(r[0].metricas.custoPorLeadCentavos, null);
  assertEquals(r[1].metricas.custoPorLeadCentavos, 1333);
  for (const c of r) semInfinitoOuNaN({ ...c.metricas });
});

Deno.test("agruparPorDia preenche zeros na virada de mês", () => {
  const r = agruparPorDia(LINHAS, { inicio: "2026-09-29", fim: "2026-10-02" });
  assertEquals(r.map((d) => [d.dia, d.gastoCentavos, d.leads]), [
    ["2026-09-29", 1000, 2],
    ["2026-09-30", 0, 0],
    ["2026-10-01", 8000, 1],
    ["2026-10-02", 0, 0],
  ]);
});

Deno.test("compararPeriodos com o período anterior de mesmo tamanho", () => {
  const periodos = calcularPeriodos("7d", "2026-10-21");
  const linhas = [
    linha({ campaign_id: "A", dia: "2026-10-20", gastoCentavos: 20000, leads: 10 }),
    linha({ campaign_id: "A", dia: "2026-10-10", gastoCentavos: 10000, leads: 10 }),
  ];
  const c = compararPeriodos(linhas, periodos);
  assertEquals(c.atual.totais.gastoCentavos, 20000);
  assertEquals(c.anterior.totais.gastoCentavos, 10000);
  assertEquals(c.variacao.gasto, { tipo: "percentual", valor: 100 });
  assertEquals(c.variacao.leads, { tipo: "percentual", valor: 0 });
  assertEquals(c.variacao.custoPorLead, { tipo: "percentual", valor: 100 });
  assertEquals(c.variacao.compras, { tipo: "sem_dados" });
});

Deno.test("comparação sem leads no anterior vira 'novo'; sem leads no atual vira 'sem_dados'", () => {
  const periodos = calcularPeriodos("7d", "2026-10-21");
  const soAtual = compararPeriodos([linha({ campaign_id: "A", dia: "2026-10-20", gastoCentavos: 100, leads: 1 })], periodos);
  assertEquals(soAtual.variacao.leads, { tipo: "novo" });
  assertEquals(soAtual.variacao.custoPorLead, { tipo: "novo" });
  const soAnterior = compararPeriodos([linha({ campaign_id: "A", dia: "2026-10-10", gastoCentavos: 100, leads: 1 })], periodos);
  assertEquals(soAnterior.variacao.custoPorLead, { tipo: "sem_dados" });
  assertEquals(soAnterior.variacao.gasto, { tipo: "percentual", valor: -100 });
});

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

Deno.test("limite de 90 dias: 90 passa, 91 não", () => {
  assertEquals(validarPeriodo({ inicio: "2026-07-25", fim: "2026-10-22" }, "2026-10-22"), { ok: true });
  const r = validarPeriodo({ inicio: "2026-07-24", fim: "2026-10-22" }, "2026-10-22");
  assertEquals(r.ok === false && r.codigo, "periodo_longo");
});

Deno.test("período invertido, data inexistente e futuro", () => {
  const cod = (inicio: string, fim: string) => {
    const r = validarPeriodo({ inicio, fim }, "2026-10-22");
    return r.ok ? "ok" : r.codigo;
  };
  assertEquals(cod("2026-10-10", "2026-10-01"), "periodo_invertido");
  assertEquals(cod("2026-02-30", "2026-03-01"), "data_invalida");
  assertEquals(cod("2026-10-01", "2026-10-23"), "periodo_futuro");
  assertEquals(cod("2026-10-22", "2026-10-22"), "ok");
});

// ---------------------------------------------------------------------------
// Validade do cache
// ---------------------------------------------------------------------------

// 2026-10-22 12:00 em São Paulo (UTC-3)
const AGORA = new Date("2026-10-22T15:00:00Z");
const minAtras = (min: number, base = AGORA) => new Date(base.getTime() - min * 60_000).toISOString();

function sync(parcial: Partial<EstadoSyncMeta> = {}): EstadoSyncMeta {
  return {
    status: "ok",
    ultima_atualizacao: null,
    periodo_inicio: null,
    periodo_fim: null,
    em_andamento_desde: null,
    pausado_ate: null,
    ...parcial,
  };
}

Deno.test("validade por idade do dia", () => {
  assertEquals(validadeDoDiaMin("2026-10-22", "2026-10-22"), 60);
  assertEquals(validadeDoDiaMin("2026-10-21", "2026-10-22"), 60);
  assertEquals(validadeDoDiaMin("2026-10-20", "2026-10-22"), 360);
  assertEquals(validadeDoDiaMin("2026-10-16", "2026-10-22"), 360);
  assertEquals(validadeDoDiaMin("2026-10-15", "2026-10-22"), 1440);
  assertEquals(validadeDoDiaMin("2026-09-24", "2026-10-22"), 1440); // 28 dias
  assertEquals(validadeDoDiaMin("2026-09-23", "2026-10-22"), Infinity); // 29 dias
});

Deno.test("sem histórico nenhum: busca o período inteiro", () => {
  const intervalo = { inicio: "2026-10-16", fim: "2026-10-22" };
  assertEquals(decidirAtualizacao({ sync: null, diasEmCache: [], intervalo, agora: AGORA }), {
    acao: "atualizar",
    motivo: "sem_historico",
    intervalo,
  });
});

Deno.test("hoje e ontem: 60 min de validade", () => {
  const intervalo = { inicio: "2026-10-21", fim: "2026-10-22" };
  const s = (min: number) => sync({ ultima_atualizacao: minAtras(min), periodo_inicio: "2026-10-21", periodo_fim: "2026-10-22" });
  const valido = decidirAtualizacao({ sync: s(30), diasEmCache: [], intervalo, agora: AGORA });
  assertEquals(valido.acao === "usar_cache" && valido.motivo, "valido");
  assertEquals(valido.acao === "usar_cache" && valido.proximaTentativaEm?.toISOString(), minAtras(-30));
  assertEquals(decidirAtualizacao({ sync: s(61), diasEmCache: [], intervalo, agora: AGORA }), {
    acao: "atualizar",
    motivo: "expirado",
    intervalo,
  });
});

Deno.test("últimos 7 dias: 6 h; busca só o trecho vencido", () => {
  const intervalo = { inicio: "2026-10-16", fim: "2026-10-22" };
  const s = sync({ ultima_atualizacao: minAtras(30), periodo_inicio: "2026-10-21", periodo_fim: "2026-10-22" });
  const dias = (min: number) =>
    ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"].map((dia) => ({ dia, atualizado_em: minAtras(min) }));
  const ok = decidirAtualizacao({ sync: s, diasEmCache: dias(5 * 60), intervalo, agora: AGORA });
  assertEquals(ok.acao, "usar_cache");
  assertEquals(decidirAtualizacao({ sync: s, diasEmCache: dias(7 * 60), intervalo, agora: AGORA }), {
    acao: "atualizar",
    motivo: "expirado",
    intervalo: { inicio: "2026-10-16", fim: "2026-10-20" },
  });
});

Deno.test("mais de 28 dias atrás não vence; só busca se faltar linha", () => {
  const intervalo = { inicio: "2026-08-01", fim: "2026-08-03" };
  const antigo = "2026-08-05T10:00:00Z";
  const s = sync({ ultima_atualizacao: minAtras(10), periodo_inicio: "2026-10-16", periodo_fim: "2026-10-22" });
  const completo = ["2026-08-01", "2026-08-02", "2026-08-03"].map((dia) => ({ dia, atualizado_em: antigo }));
  const r = decidirAtualizacao({ sync: s, diasEmCache: completo, intervalo, agora: AGORA });
  assertEquals(r, { acao: "usar_cache", motivo: "valido", proximaTentativaEm: null });
  assertEquals(decidirAtualizacao({ sync: s, diasEmCache: completo.slice(0, 2), intervalo, agora: AGORA }), {
    acao: "atualizar",
    motivo: "faltam_dias",
    intervalo: { inicio: "2026-08-03", fim: "2026-08-03" },
  });
});

Deno.test("dia sem linha mas coberto pela última atualização conta como buscado (nenhuma campanha veiculou)", () => {
  const intervalo = { inicio: "2026-08-01", fim: "2026-08-03" };
  const s = sync({ ultima_atualizacao: "2026-09-10T10:00:00Z", periodo_inicio: "2026-08-01", periodo_fim: "2026-08-31" });
  const r = decidirAtualizacao({ sync: s, diasEmCache: [], intervalo, agora: AGORA });
  assertEquals(r.acao, "usar_cache");
});

Deno.test("trava em_andamento por 2 min; depois disso é ignorada", () => {
  const intervalo = { inicio: "2026-10-22", fim: "2026-10-22" };
  const r1 = decidirAtualizacao({
    sync: sync({ status: "em_andamento", em_andamento_desde: minAtras(1) }),
    diasEmCache: [],
    intervalo,
    agora: AGORA,
    forcar: true,
  });
  assertEquals(r1.acao === "usar_cache" && r1.motivo, "em_andamento");
  const r2 = decidirAtualizacao({
    sync: sync({ status: "em_andamento", em_andamento_desde: minAtras(3) }),
    diasEmCache: [],
    intervalo,
    agora: AGORA,
  });
  assertEquals(r2.acao, "atualizar");
});

Deno.test("forçar respeita 5 min desde a última tentativa", () => {
  const intervalo = { inicio: "2026-10-22", fim: "2026-10-22" };
  const s = (min: number) => sync({ ultima_atualizacao: minAtras(min), periodo_inicio: "2026-10-22", periodo_fim: "2026-10-22" });
  const r1 = decidirAtualizacao({ sync: s(4), diasEmCache: [], intervalo, agora: AGORA, forcar: true });
  assertEquals(r1.acao === "usar_cache" && r1.motivo, "intervalo_minimo");
  assertEquals(r1.acao === "usar_cache" && r1.proximaTentativaEm?.toISOString(), minAtras(-1));
  assertEquals(decidirAtualizacao({ sync: s(5), diasEmCache: [], intervalo, agora: AGORA, forcar: true }), {
    acao: "atualizar",
    motivo: "forcado",
    intervalo,
  });
});

Deno.test("forçar dentro dos 5 min ainda busca dias que faltam", () => {
  const intervalo = { inicio: "2026-10-01", fim: "2026-10-22" };
  const s = sync({ ultima_atualizacao: minAtras(2), periodo_inicio: "2026-10-16", periodo_fim: "2026-10-22" });
  const r = decidirAtualizacao({ sync: s, diasEmCache: [], intervalo, agora: AGORA, forcar: true });
  assertEquals(r, { acao: "atualizar", motivo: "faltam_dias", intervalo: { inicio: "2026-10-01", fim: "2026-10-15" } });
});

Deno.test("pausa por limite da Meta segura até pausado_ate, mesmo forçado", () => {
  const intervalo = { inicio: "2026-10-22", fim: "2026-10-22" };
  const r = decidirAtualizacao({
    sync: sync({ status: "erro", pausado_ate: minAtras(-10), em_andamento_desde: minAtras(20) }),
    diasEmCache: [],
    intervalo,
    agora: AGORA,
    forcar: true,
  });
  assertEquals(r.acao === "usar_cache" && r.motivo, "pausado");
});

Deno.test("depois de um erro, a atualização automática espera 5 min", () => {
  const intervalo = { inicio: "2026-10-22", fim: "2026-10-22" };
  const s = (min: number) => sync({ status: "erro", em_andamento_desde: minAtras(min) });
  const r = decidirAtualizacao({ sync: s(2), diasEmCache: [], intervalo, agora: AGORA });
  assertEquals(r.acao === "usar_cache" && r.motivo, "erro_recente");
  assertEquals(decidirAtualizacao({ sync: s(6), diasEmCache: [], intervalo, agora: AGORA }).acao, "atualizar");
});

Deno.test("período de 91 dias é recusado antes de qualquer coisa", () => {
  const r = decidirAtualizacao({ sync: null, diasEmCache: [], intervalo: { inicio: "2026-07-24", fim: "2026-10-22" }, agora: AGORA });
  assertEquals(r.acao === "periodo_invalido" && r.codigo, "periodo_longo");
});

Deno.test("meia-noite em São Paulo: 'hoje' muda às 03:00 UTC", () => {
  const antes = new Date("2026-10-22T02:59:59Z"); // 21/10 23:59:59 em SP
  const depois = new Date("2026-10-22T03:00:00Z"); // 22/10 00:00:00 em SP
  const hojeSP = { inicio: "2026-10-22", fim: "2026-10-22" };
  const r1 = decidirAtualizacao({ sync: null, diasEmCache: [], intervalo: hojeSP, agora: antes });
  assertEquals(r1.acao === "periodo_invalido" && r1.codigo, "periodo_futuro");
  assertEquals(decidirAtualizacao({ sync: null, diasEmCache: [], intervalo: hojeSP, agora: depois }).acao, "atualizar");

  // 20/10 buscado 2 h antes: às 23:59 de 21/10 ainda é "ontem" (60 min, vencido);
  // à 00:00 de 22/10 vira anteontem (6 h, válido).
  const dia20 = { inicio: "2026-10-20", fim: "2026-10-20" };
  const cache = [{ dia: "2026-10-20", atualizado_em: "2026-10-22T01:00:00Z" }];
  assertEquals(decidirAtualizacao({ sync: null, diasEmCache: cache, intervalo: dia20, agora: antes }).acao, "atualizar");
  assertEquals(decidirAtualizacao({ sync: null, diasEmCache: cache, intervalo: dia20, agora: depois }).acao, "usar_cache");
});

// ---------------------------------------------------------------------------
// "Atualizado há X min"
// ---------------------------------------------------------------------------

Deno.test("formatarAtualizadoHa em português", () => {
  assertEquals(formatarAtualizadoHa(null, AGORA), "Ainda não atualizado");
  assertEquals(formatarAtualizadoHa("lixo", AGORA), "Ainda não atualizado");
  assertEquals(formatarAtualizadoHa(minAtras(0.5), AGORA), "Atualizado agora");
  assertEquals(formatarAtualizadoHa(minAtras(-3), AGORA), "Atualizado agora"); // relógio adiantado
  assertEquals(formatarAtualizadoHa(minAtras(1), AGORA), "Atualizado há 1 minuto");
  assertEquals(formatarAtualizadoHa(minAtras(12), AGORA), "Atualizado há 12 minutos");
  assertEquals(formatarAtualizadoHa(minAtras(90), AGORA), "Atualizado há 1 hora");
  assertEquals(formatarAtualizadoHa(new Date(minAtras(3 * 24 * 60)), AGORA), "Atualizado há 3 dias");
});

// ---------------------------------------------------------------------------
// Erros da Meta
// ---------------------------------------------------------------------------

const erroMeta = (code: number, subcode?: number, extra: Record<string, unknown> = {}) => ({
  tipo: "resposta" as const,
  corpo: {
    error: {
      message: "Error validating access token: Session has expired on Tuesday, 20-Oct-26 (segredo interno act_123)",
      type: "OAuthException",
      code,
      error_subcode: subcode,
      fbtrace_id: "AbCdEf123",
      ...extra,
    },
  },
});

Deno.test("190 (subcódigos 463 e 460): token inválido, mantém cache", () => {
  for (const sub of [463, 460, undefined]) {
    const e = traduzirErroMeta(erroMeta(190, sub));
    assertEquals(e, {
      codigo: "token_invalido",
      mensagemPtBr: "Conexão com a Meta expirou: gere um novo token.",
      mantemCache: true,
      pausaMinutos: 0,
    });
  }
});

Deno.test("limite (17, 4, 613, 80000, 80004): pausa 15 min ou o tempo estimado", () => {
  for (const code of [17, 4, 613, 80000, 80004]) {
    const e = traduzirErroMeta(erroMeta(code));
    assertEquals([e.codigo, e.pausaMinutos, e.mantemCache], ["limite_atingido", 15, true], String(code));
    assertEquals(e.mensagemPtBr, "Limite da Meta atingido; tente de novo em 15 min.");
  }
  assertEquals(traduzirErroMeta({ ...erroMeta(80000), minutosParaRecuperarAcesso: 42 }).pausaMinutos, 42);
  assertEquals(traduzirErroMeta({ ...erroMeta(80000), minutosParaRecuperarAcesso: 0 }).pausaMinutos, 15);
  assertEquals(traduzirErroMeta({ ...erroMeta(80000), minutosParaRecuperarAcesso: 99999 }).pausaMinutos, 1440);
  assertEquals(
    traduzirErroMeta(erroMeta(17), { ultimaAtualizacao: minAtras(12), agora: AGORA }).mensagemPtBr,
    "Limite da Meta atingido; dados de 12 minutos atrás.",
  );
  assertEquals(
    traduzirErroMeta(erroMeta(17), { ultimaAtualizacao: minAtras(0.2), agora: AGORA }).mensagemPtBr,
    "Limite da Meta atingido; dados de menos de 1 minuto atrás.",
  );
});

Deno.test("sem permissão (10, 200, 294, 272)", () => {
  for (const code of [10, 200, 294, 272]) {
    const e = traduzirErroMeta(erroMeta(code));
    assertEquals(e.codigo, "sem_permissao", String(code));
    assertEquals(e.mensagemPtBr, "O usuário do sistema não tem acesso à conta de anúncios.");
  }
});

Deno.test("100: ID da conta inválido; code como string também vale", () => {
  assertEquals(traduzirErroMeta(erroMeta(100, 33)).codigo, "conta_invalida");
  assertEquals(traduzirErroMeta({ tipo: "resposta", corpo: { error: { code: "100" } } }).codigo, "conta_invalida");
});

Deno.test("1, 2, is_transient e rede: Meta indisponível, merece nova tentativa", () => {
  for (const f of [erroMeta(1), erroMeta(2), erroMeta(999, undefined, { is_transient: true }), { tipo: "rede" as const }]) {
    const e = traduzirErroMeta(f);
    assertEquals(e.codigo, "meta_indisponivel");
    assertEquals(e.mensagemPtBr, "Meta indisponível, tente em instantes.");
    assert(erroTemporario(e));
  }
  assert(!erroTemporario(traduzirErroMeta(erroMeta(190, 463))));
});

Deno.test("segredo ausente: estado vazio, não mantém cache", () => {
  assertEquals(traduzirErroMeta({ tipo: "segredo_ausente" }), {
    codigo: "nao_configurado",
    mensagemPtBr: "Conta de anúncios não conectada.",
    mantemCache: false,
    pausaMinutos: 0,
  });
});

Deno.test("código desconhecido ou corpo não-JSON: mensagem genérica, nunca o texto da Meta", () => {
  const casos = [erroMeta(12345), { tipo: "resposta" as const, corpo: "<html>502 Bad Gateway</html>" }, {
    tipo: "resposta" as const,
    corpo: null,
  }];
  for (const f of casos) {
    const e = traduzirErroMeta(f);
    assertEquals(e.codigo, "erro_desconhecido");
    assert(!e.mensagemPtBr.includes("act_123") && !e.mensagemPtBr.includes("fbtrace"));
  }
  for (const code of [190, 17, 10, 100, 1]) {
    const msg = traduzirErroMeta(erroMeta(code)).mensagemPtBr;
    assert(!msg.includes("segredo interno") && !msg.includes("AbCdEf123"), msg);
  }
});

Deno.test("cabeçalho X-Business-Use-Case-Usage", () => {
  const h = JSON.stringify({
    "1234567890": [
      { type: "ads_insights", call_count: 28, total_cputime: 61, total_time: 40, estimated_time_to_regain_access: 0 },
      { type: "ads_management", call_count: 3, total_cputime: 1, total_time: 1, estimated_time_to_regain_access: 7 },
    ],
  });
  assertEquals(lerUsoApiMeta(h), { usoPct: 61, minutosParaRecuperarAcesso: 7 });
  assertEquals(lerUsoApiMeta(null), { usoPct: null, minutosParaRecuperarAcesso: null });
  assertEquals(lerUsoApiMeta("não é json"), { usoPct: null, minutosParaRecuperarAcesso: null });
  assertEquals(lerUsoApiMeta("[]"), { usoPct: null, minutosParaRecuperarAcesso: null });
});
