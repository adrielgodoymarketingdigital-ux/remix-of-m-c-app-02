// deno test --no-check --allow-read scripts/testes-crm-leads/
// Ação "relatorio_marketing" da Edge Function crm-leads com banco FALSO (sem
// rede, sem Supabase). Prova: segredo, validação do período, semana_anterior e
// mes_anterior calculados em Brasília (relógio simulado perto da meia-noite),
// resposta só com os campos do contrato (nada de nome, e-mail, telefone ou
// id de pessoa, mesmo que o banco devolva) e log só com contagens.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { criarHandler, type RpcCliente } from "../../supabase/functions/crm-leads/handler.ts";
import { periodoRelatorio } from "../../supabase/functions/crm-leads/relatorio.ts";
import { dataBrasiliaISO } from "../../supabase/functions/_shared/dataBrasilia.ts";

const SEGREDO = "r".repeat(40);

/** O que crm_relatorio_marketing devolve (formato do jsonb), com lixo de propósito. */
function respostaBanco(inicio: string, fim: string): Record<string, unknown> {
  return {
    periodo: { inicio, fim, dias: 7 },
    periodo_anterior: { inicio: "2026-11-09", fim: "2026-11-15" },
    cadastros: { total: 12, com_utm: 9, vindos_meta: 7, anterior: { total: 10, com_utm: 8, vindos_meta: 5 },
      lista: ["fulano@exemplo.com"] },
    funil_whatsapp: { conversas_iniciadas: 40, cadastros: 8, em_teste_agora: 5, teste_acabou_sem_pagar: 2, assinantes_pagos: 1,
      anterior: { conversas_iniciadas: 35, cadastros: 6, em_teste_agora: 0, teste_acabou_sem_pagar: 4, assinantes_pagos: 2 },
      telefones: ["+5511999990000"] },
    gasto: { total_centavos: 50000, meta_centavos: 48000, manual_centavos: 2000, fonte: "automatico",
      dias_com_gasto_meta: 7, dias_no_periodo: 7, atualizado_em: "2026-11-22T12:00:00+00:00" },
    custos: { por_conversa_centavos: 1250, por_cadastro_centavos: 6250, por_assinante_centavos: 50000 },
    receita_estimada_centavos: 3990,
    amadurecendo: { cadastros_em_teste: 6, user_ids: ["00000000-0000-0000-0000-000000000001"] },
    por_anuncio: [
      { ad_id: "120000000000001", rotulo: "Anúncio A", conversas: 30, cadastros: 6, teste: 6, assinantes: 1,
        gasto_centavos: 45000, custo_por_conversa_centavos: 1500, telefone: "+5511999990001", nome: "Fulano", user_id: "00000000-0000-0000-0000-000000000002" },
      { ad_id: null, rotulo: "Sem anúncio (orgânico / link direto)", conversas: 10, cadastros: 2, teste: 2, assinantes: 0,
        gasto_centavos: null, custo_por_conversa_centavos: null },
    ],
    email: "fulano@exemplo.com",
  };
}

function montar({ hoje, agora, erroBanco }: { hoje?: string; agora?: string; erroBanco?: string } = {}) {
  const chamadas: { fn: string; args?: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const erros: string[] = [];
  const db: RpcCliente = {
    rpc(fn, args) {
      chamadas.push({ fn, args });
      if (erroBanco) return Promise.resolve({ data: null, error: { code: erroBanco } });
      if (fn !== "crm_relatorio_marketing") return Promise.resolve({ data: null, error: { code: "42883" } });
      return Promise.resolve({ data: respostaBanco(String(args?.p_inicio), String(args?.p_fim)), error: null });
    },
  };
  const original = console.error;
  console.error = (...a: unknown[]) => { erros.push(a.map(String).join(" ")); };
  const hojeBrasilia = () => hoje ?? dataBrasiliaISO(new Date(agora ?? Date.now()));
  const handler = criarHandler({ segredo: SEGREDO, db: () => db, hojeBrasilia, log: (m, d) => logs.push(m + " " + JSON.stringify(d)) });
  const pedir = async (corpo: unknown, segredo = SEGREDO) => {
    const r = await handler(new Request("http://local/crm-leads", {
      method: "POST", headers: { "x-crm-secret": segredo }, body: JSON.stringify(corpo),
    }));
    return { status: r.status, corpo: await r.json() as Record<string, unknown> };
  };
  const fim = () => { console.error = original; };
  return { pedir, chamadas, logs, erros, fim };
}

Deno.test("relatorio_marketing: segredo errado = 401 e o banco não é chamado", async () => {
  const t = montar({ hoje: "2026-11-23" });
  assertEquals((await t.pedir({ acao: "relatorio_marketing", periodo: "semana_anterior" }, "errado")).status, 401);
  assertEquals(t.chamadas.length, 0);
  t.fim();
});

Deno.test("relatorio_marketing: validação do período (400 e o banco não é chamado)", async () => {
  const t = montar({ hoje: "2026-11-23" });
  const casos: [Record<string, unknown>, string][] = [
    [{}, "periodo_invalido"],
    [{ periodo: "ontem" }, "periodo_invalido"],
    [{ periodo: 7 }, "periodo_invalido"],
    [{ periodo: "personalizado" }, "datas_obrigatorias"],
    [{ periodo: "personalizado", inicio: "2026-11-01" }, "datas_obrigatorias"],
    [{ periodo: "personalizado", inicio: "2026-02-30", fim: "2026-03-01" }, "data_invalida"],
    [{ periodo: "personalizado", inicio: "2026-11-01", fim: "22/11/2026" }, "data_invalida"],
    [{ periodo: "personalizado", inicio: 20261101, fim: "2026-11-02" }, "data_invalida"],
    [{ periodo: "personalizado", inicio: "2026-11-10", fim: "2026-11-09" }, "periodo_invertido"],
    [{ periodo: "personalizado", inicio: "2026-11-20", fim: "2026-11-24" }, "data_futura"],
    [{ periodo: "personalizado", inicio: "2025-10-18", fim: "2026-11-23" }, "periodo_longo"], // 401 dias de diferença
    [{ periodo: "semana_anterior", inicio: "2026-11-01", fim: "2026-11-07" }, "datas_so_no_personalizado"],
    [{ periodo: "mes_anterior", fim: "2026-10-31" }, "datas_so_no_personalizado"],
  ];
  for (const [params, erro] of casos) {
    const r = await t.pedir({ acao: "relatorio_marketing", ...params });
    assertEquals([r.status, r.corpo.erro], [400, erro], JSON.stringify(params));
  }
  assertEquals(t.chamadas.length, 0);
  const ok = await t.pedir({ acao: "relatorio_marketing", periodo: "personalizado", inicio: "2025-10-19", fim: "2026-11-23" });
  assertEquals(ok.status, 200, "fim − início = 400 é aceito (como no card), fim = hoje é aceito");
  assertEquals(t.chamadas[0], { fn: "crm_relatorio_marketing", args: { p_inicio: "2025-10-19", p_fim: "2026-11-23" } });
  t.fim();
});

Deno.test("semana_anterior: última semana COMPLETA, segunda a domingo", () => {
  const casos: [string, string, string][] = [
    ["2026-11-23", "2026-11-16", "2026-11-22"], // segunda: a semana que acabou ontem
    ["2026-11-22", "2026-11-09", "2026-11-15"], // domingo: a semana de hoje ainda não acabou
    ["2026-11-25", "2026-11-16", "2026-11-22"], // quarta
    ["2026-11-28", "2026-11-16", "2026-11-22"], // sábado
    ["2026-01-07", "2025-12-29", "2026-01-04"], // virada de ano
    ["2026-03-02", "2026-02-23", "2026-03-01"], // virada de mês
    ["2028-03-01", "2028-02-21", "2028-02-27"], // ano bissexto (29/02/2028 é terça)
  ];
  for (const [hoje, inicio, fim] of casos) {
    assertEquals(periodoRelatorio({ periodo: "semana_anterior" }, hoje), { ok: true, periodo: "semana_anterior", inicio, fim }, hoje);
    assertEquals(new Date(`${inicio}T00:00:00Z`).getUTCDay(), 1, `${inicio} é segunda`);
    assertEquals(new Date(`${fim}T00:00:00Z`).getUTCDay(), 0, `${fim} é domingo`);
  }
});

Deno.test("mes_anterior: último mês de calendário completo", () => {
  const casos: [string, string, string][] = [
    ["2026-12-01", "2026-11-01", "2026-11-30"],
    ["2026-11-30", "2026-10-01", "2026-10-31"],
    ["2026-01-15", "2025-12-01", "2025-12-31"], // virada de ano
    ["2026-03-01", "2026-02-01", "2026-02-28"],
    ["2028-03-10", "2028-02-01", "2028-02-29"], // bissexto
  ];
  for (const [hoje, inicio, fim] of casos) {
    assertEquals(periodoRelatorio({ periodo: "mes_anterior" }, hoje), { ok: true, periodo: "mes_anterior", inicio, fim }, hoje);
  }
});

Deno.test("relatório no relógio de Brasília perto da meia-noite (nunca o dia UTC)", async () => {
  const casos: [string, string, string, string][] = [
    // instante UTC              período           início        fim
    ["2026-11-23T02:59:59Z", "semana_anterior", "2026-11-09", "2026-11-15"], // dom 22/11 23:59:59 em Brasília (UTC já é segunda)
    ["2026-11-23T03:00:00Z", "semana_anterior", "2026-11-16", "2026-11-22"], // seg 23/11 00:00 em Brasília
    ["2026-12-01T02:59:59Z", "mes_anterior", "2026-10-01", "2026-10-31"],    // 30/11 23:59:59 em Brasília (UTC já é dezembro)
    ["2026-12-01T03:00:00Z", "mes_anterior", "2026-11-01", "2026-11-30"],
    ["2027-01-01T02:30:00Z", "mes_anterior", "2026-11-01", "2026-11-30"],    // réveillon: ainda 31/12 em Brasília
    ["2027-01-01T03:00:00Z", "mes_anterior", "2026-12-01", "2026-12-31"],
  ];
  for (const [agora, periodo, inicio, fim] of casos) {
    const t = montar({ agora });
    const r = await t.pedir({ acao: "relatorio_marketing", periodo });
    assertEquals(r.status, 200, agora);
    assertEquals(t.chamadas, [{ fn: "crm_relatorio_marketing", args: { p_inicio: inicio, p_fim: fim } }], `${agora} ${periodo}`);
    t.fim();
  }
  // personalizado com fim = "hoje" de Brasília às 23:30 (UTC já é o dia seguinte): aceito; o dia seguinte é futuro
  const t = montar({ agora: "2026-11-23T02:30:00Z" });
  assertEquals((await t.pedir({ acao: "relatorio_marketing", periodo: "personalizado", inicio: "2026-11-16", fim: "2026-11-22" })).status, 200);
  assertEquals((await t.pedir({ acao: "relatorio_marketing", periodo: "personalizado", inicio: "2026-11-16", fim: "2026-11-23" })).corpo.erro, "data_futura");
  t.fim();
});

Deno.test("resposta: só os campos do contrato, nenhum dado pessoal (mesmo se o banco mandar)", async () => {
  const t = montar({ hoje: "2026-11-23" });
  const r = await t.pedir({ acao: "relatorio_marketing", periodo: "semana_anterior" });
  assertEquals(r.status, 200);
  const texto = JSON.stringify(r.corpo);
  for (const proibido of ["@", "+5511", "00000000-0000", "Fulano", "telefone", "email", "nome", "user_id", "lista"]) {
    assert(!texto.includes(proibido), `resposta não pode ter "${proibido}"`);
  }
  assertEquals(Object.keys(r.corpo).sort(), ["amadurecendo", "cadastros", "custos", "funil_whatsapp", "gasto", "ok", "periodo",
    "periodo_anterior", "por_anuncio", "receita_estimada_centavos"]);
  assertEquals(r.corpo.cadastros, { total: 12, com_utm: 9, vindos_meta: 7, anterior: { total: 10, com_utm: 8, vindos_meta: 5 } });
  assertEquals(r.corpo.funil_whatsapp, { conversas_iniciadas: 40, cadastros: 8, em_teste_agora: 5, teste_acabou_sem_pagar: 2,
    assinantes_pagos: 1, anterior: { conversas_iniciadas: 35, cadastros: 6, em_teste_agora: 0, teste_acabou_sem_pagar: 4, assinantes_pagos: 2 } });
  assertEquals(r.corpo.amadurecendo, { cadastros_em_teste: 6 });
  assertEquals(r.corpo.gasto, { total_centavos: 50000, meta_centavos: 48000, manual_centavos: 2000, fonte: "automatico",
    dias_com_gasto_meta: 7, dias_no_periodo: 7, atualizado_em: "2026-11-22T12:00:00.000Z" });
  assertEquals(r.corpo.periodo, { inicio: "2026-11-16", fim: "2026-11-22", dias: 7 });
  assertEquals(r.corpo.por_anuncio, [
    { ad_id: "120000000000001", rotulo: "Anúncio A", conversas: 30, cadastros: 6, teste: 6, assinantes: 1, gasto_centavos: 45000, custo_por_conversa_centavos: 1500 },
    { ad_id: null, rotulo: "Sem anúncio (orgânico / link direto)", conversas: 10, cadastros: 2, teste: 2, assinantes: 0, gasto_centavos: null, custo_por_conversa_centavos: null },
  ]);
  // log: só o tipo de período e contagens
  assertEquals(t.logs, ['[crm-leads] relatorio_marketing {"periodo":"semana_anterior","dias":7,"anuncios":2}']);
  t.fim();
});

Deno.test("resposta: valor estranho do banco não passa (negativo, quebrado, texto, fonte desconhecida, ad_id inválido)", async () => {
  const { montarRelatorioMarketing } = await import("../../supabase/functions/crm-leads/relatorio.ts");
  const r = montarRelatorioMarketing({
    cadastros: { total: -1, com_utm: 2.5, vindos_meta: "3" },
    gasto: { total_centavos: -10, fonte: "planilha", atualizado_em: "ontem" },
    custos: { por_conversa_centavos: null, por_cadastro_centavos: 1.5, por_assinante_centavos: 10 },
    por_anuncio: [{ ad_id: "x y", rotulo: "  ", conversas: 1 }, "lixo"],
  });
  assertEquals(r.cadastros, { total: 0, com_utm: 0, vindos_meta: 0, anterior: { total: 0, com_utm: 0, vindos_meta: 0 } });
  assertEquals([r.gasto.total_centavos, r.gasto.fonte, r.gasto.atualizado_em], [null, "nenhum", null]);
  assertEquals(r.custos, { por_conversa_centavos: null, por_cadastro_centavos: null, por_assinante_centavos: 10 });
  assertEquals(r.por_anuncio[0].ad_id, null);
  assertEquals(r.por_anuncio[0].rotulo, "Sem anúncio (orgânico / link direto)");
  assertEquals(r.por_anuncio[1].conversas, 0);
  assertEquals(montarRelatorioMarketing(null).por_anuncio, []);
});

Deno.test("relatorio_marketing: erro do banco = 500 só com o código, sem payload no log", async () => {
  const t = montar({ hoje: "2026-11-23", erroBanco: "PGRST202" });
  const r = await t.pedir({ acao: "relatorio_marketing", periodo: "mes_anterior" });
  assertEquals([r.status, r.corpo], [500, { erro: "interno", codigo: "PGRST202" }]);
  assertEquals(t.erros, ["[crm-leads] erro relatorio_marketing PGRST202"]);
  assertEquals(t.logs, []);
  t.fim();
});
