/**
 * Testes das correções ESTRUTURAIS do bug "lucro negativo em recebimento de
 * parcela de pagamento duplo" (caso wesleyarestides@gmail.com, jul–set/2026):
 *
 *  1. cancelarVenda em cascata (parcelas pendentes) — cancelarSecundariasEmCascata.core.ts
 *  2. cancelamento com parcela JÁ recebida → cancela as pendentes; a recebida fica de fora (sinalizada)
 *  3. recebimento de parcela cuja principal foi cancelada/removida → "custo não confirmado"
 *  4. fallback perigoso do relatório (custo ATUAL do item) removido
 *  5. todos os caminhos de baixa passam pelo mesmo reconhecimento
 *  6. caso SAMSUNG A55 (conta recebida, venda pendente) sincroniza e fecha
 *
 * Executa as FUNÇÕES REAIS de src/lib (cascata, reconhecimento, vendasFinanceiras)
 * contra um banco em memória com semântica SQL de NULL (neq/eq descartam NULL,
 * como o PostgREST). Os hooks React não rodam em Node: para eles há verificações
 * estáticas do código-fonte (que o caminho chama a função compartilhada).
 *
 *   node scripts/investigacao-lucro-vendas/testes-cancelamento-recebimento.mjs
 */
import { readFileSync } from "node:fs";
import {
  getVendaReceitaLiquida,
  getVendaCustoTotal,
  shouldIncludeVendaInFinancialTotals,
  isPagamentoDuploSecundario,
  deveContarSecundarioNoLucro,
  isCustoNaoConfirmado,
  isVendaLinhaParcial,
  resolverCustoVendaParaLucro,
} from "../../src/lib/vendasFinanceiras.ts";
import {
  reconhecerRecebimentoVendaVinculadaCore,
  propagarStatusContaParaVendaCore,
  normalizarDataRecebimento,
} from "../../src/lib/vendas/reconhecerSegundaForma.core.ts";
import { cancelarSecundariasEmCascataCore } from "../../src/lib/vendas/cancelarSecundariasEmCascata.core.ts";

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------
const brl = (n) => (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toFixed(2);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
let falhas = 0;
let total = 0;
const check = (nome, cond, detalhe = "") => {
  const ok = !!cond;
  total++;
  if (!ok) falhas++;
  console.log(`   [${ok ? "PASS" : "FALHA"}] ${nome}${detalhe ? "  — " + detalhe : ""}`);
};
const secao = (t) => console.log(`\n${t}\n`);

// silencia console.warn/error esperados dos módulos sob teste (mantém contagem)
const avisos = [];
const _warn = console.warn;
console.warn = (...a) => avisos.push(a);

// ---------------------------------------------------------------------------
// Banco em memória — subset do supabase-js usado pelas funções sob teste.
// Semântica SQL: comparação com NULL nunca é verdadeira (eq/neq/in).
// ---------------------------------------------------------------------------
class QB {
  constructor(db, tabela) {
    this.db = db; this.tabela = tabela; this.filtros = []; this.op = "select"; this.payload = null;
  }
  select() { return this; }
  eq(c, v) { this.filtros.push((r) => r[c] != null && r[c] === v); return this; }
  neq(c, v) { this.filtros.push((r) => r[c] != null && r[c] !== v); return this; }
  in(c, arr) { this.filtros.push((r) => r[c] != null && arr.includes(r[c])); return this; }
  limit() { return this; }
  update(p) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  maybeSingle() { return Promise.resolve(this._exec(true)); }
  then(res, rej) { return Promise.resolve(this._exec(false)).then(res, rej); }
  _exec(single) {
    const linhas = this.db.tabelas[this.tabela];
    const alvo = linhas.filter((r) => this.filtros.every((f) => f(r)));
    if (this.op === "update") {
      this.db.log.push({ op: "update", tabela: this.tabela, ids: alvo.map((r) => r.id), payload: this.payload });
      alvo.forEach((r) => Object.assign(r, this.payload));
      return { data: null, error: null };
    }
    if (this.op === "delete") {
      this.db.log.push({ op: "delete", tabela: this.tabela, ids: alvo.map((r) => r.id) });
      this.db.tabelas[this.tabela] = linhas.filter((r) => !alvo.includes(r));
      return { data: null, error: null };
    }
    const data = alvo.map((r) => ({ ...r }));
    return { data: single ? data[0] ?? null : data, error: null };
  }
}
class FakeDB {
  constructor(tabelas) { this.tabelas = structuredClone(tabelas); this.log = []; }
  from(t) { return new QB(this, t); }
  snapshot() { return JSON.stringify(this.tabelas); }
  venda(id) { return this.tabelas.vendas.find((v) => v.id === id); }
  conta(id) { return this.tabelas.contas.find((c) => c.id === id); }
}

const U = "user-wesley";
const SEC = "pagamento_duplo_secundario";

// linha de venda "completa" (todas as colunas que as funções leem)
const venda = (o) => ({
  user_id: U, tipo: "dispositivo", quantidade: 1, custo_unitario: 0, cancelada: false, deleted_at: null,
  recebido: false, data_recebimento: null, valor_desconto_manual: 0, valor_desconto_cupom: 0,
  segunda_forma_pagamento: null, valor_segunda_forma: null, parcela_numero: null, total_parcelas: null,
  observacoes: null, produto_id: null, peca_id: null, ...o,
});
const conta = (o) => ({ user_id: U, tipo: "receber", status: "pendente", valor_pago: 0, data_pagamento: null, ...o });

/**
 * Pipeline real do relatório (mesmas funções de useRelatorios.ts): gate financeiro
 * + gate de secundária + resolverCustoVendaParaLucro. `refCusto` = custo ATUAL do
 * item (dispositivos.custo) — o que o fallback antigo usava.
 */
const lucroRelatorioNovo = (linhas, refCusto = {}) => {
  let receita = 0, custo = 0; const naoConfirmadas = [];
  for (const v of linhas) {
    if (!shouldIncludeVendaInFinancialTotals(v)) continue;
    if (isPagamentoDuploSecundario(v) && !deveContarSecundarioNoLucro(v)) { if (isCustoNaoConfirmado(v)) naoConfirmadas.push(v.id); continue; }
    const c = resolverCustoVendaParaLucro(v, refCusto[v.dispositivo_id] ?? 0);
    if (c.naoConfirmado) { naoConfirmadas.push(v.id); continue; }
    receita += getVendaReceitaLiquida(v);
    custo += c.custo;
  }
  return { receita, custo, lucro: receita - custo, naoConfirmadas };
};
/** Pipeline ANTIGO (antes da correção): sem isCustoNaoConfirmado, com fallback custo ATUAL do item. */
const lucroRelatorioAntigo = (linhas, refCusto = {}) => {
  let receita = 0, custo = 0;
  for (const v of linhas) {
    if (!shouldIncludeVendaInFinancialTotals(v)) continue;
    const deveContarAntigo = v.observacoes === SEC && (v.forma_pagamento === "a_receber" || v.forma_pagamento === "a_prazo") && v.recebido === true;
    if (v.observacoes === SEC && !deveContarAntigo) continue;
    receita += getVendaReceitaLiquida(v);
    custo += Number(v.custo_unitario) > 0 ? getVendaCustoTotal(v) : (refCusto[v.dispositivo_id] ?? 0) * Number(v.quantidade || 1);
  }
  return { receita, custo, lucro: receita - custo };
};

console.log("=".repeat(78));
console.log("TESTES — cancelamento em cascata / custo não confirmado / caminhos de baixa");
console.log("=".repeat(78));

// ===========================================================================
// FIXTURE: venda do tipo Wesley — iPhone 7.790 (pix 2.000 + 3 × 1.930 a receber), custo 6.720
// ===========================================================================
const G = "grupo-iphone";
const D = "disp-iphone";
const fixtureWesley = ({ principalCancelada = false, comAVista = false } = {}) => ({
  vendas: [
    venda({ id: "P", grupo_venda: G, dispositivo_id: D, forma_pagamento: "pix", total: 7790, custo_unitario: 6720, recebido: true,
            segunda_forma_pagamento: "a_receber", valor_segunda_forma: 5790, observacoes: "APPLE IPHONE 17 PRO MAX", cancelada: principalCancelada }),
    ...[1, 2, 3].map((n) => venda({ id: `S${n}`, grupo_venda: G, dispositivo_id: D, forma_pagamento: "a_receber", total: 1930,
                                    parcela_numero: n, total_parcelas: 3, observacoes: SEC })),
    // parte à vista da 2ª forma (registro auxiliar, já paga na venda). Só nos testes de
    // cascata: numa venda real a 2ª forma é UMA só (à vista OU a receber), nunca mistura.
    ...(comAVista ? [venda({ id: "SV", grupo_venda: G, dispositivo_id: D, forma_pagamento: "pix", total: 100, recebido: true, observacoes: SEC })] : []),
    // NÃO relacionadas — devem ficar intactas
    venda({ id: "OUTRO-GRUPO", grupo_venda: "grupo-x", dispositivo_id: D, forma_pagamento: "a_receber", total: 500, observacoes: SEC }),
    venda({ id: "OUTRO-ITEM", grupo_venda: G, dispositivo_id: "disp-outro", forma_pagamento: "a_receber", total: 300, observacoes: SEC }),
  ],
  contas: [
    ...[1, 2, 3].map((n) => conta({ id: `C${n}`, descricao: `venda_id:S${n}`, valor: 1930 })),
    conta({ id: "C-OUTRO-GRUPO", descricao: "venda_id:OUTRO-GRUPO", valor: 500 }),
    conta({ id: "C-OUTRO-ITEM", descricao: "venda_id:OUTRO-ITEM", valor: 300 }),
    conta({ id: "C-QUALQUER", tipo: "pagar", descricao: "aluguel", valor: 2400 }),
  ],
});
// o reconhecimento extrai o id da venda da conta por regex de UUID (36 chars):
// as fixtures usam ids UUID-like gerados por rótulo.
const UUIDS = {};
const U36 = (rotulo) => {
  if (!UUIDS[rotulo]) {
    const n = Object.keys(UUIDS).length + 1;
    UUIDS[rotulo] = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  }
  return UUIDS[rotulo];
};
const mkWesley = (opts) => {
  const fx = fixtureWesley(opts);
  const idMap = (id) => U36(id);
  fx.vendas.forEach((v) => { v.id = idMap(v.id); });
  fx.contas.forEach((c) => {
    c.id = idMap(c.id);
    const m = c.descricao.match(/^venda_id:(.+)$/);
    if (m) c.descricao = `venda_id:${idMap(m[1])}`;
  });
  return fx;
};
const idv = (r) => U36(r);

// ===========================================================================
secao("[1] Cancelar venda com pagamento duplo, parcelas PENDENTES → cascata");
{
  const db = new FakeDB(mkWesley({ comAVista: true }));
  const principal = db.venda(idv("P"));
  const r = await cancelarSecundariasEmCascataCore(db, principal, { motivo: "cliente desistiu", agora: "2026-09-20T12:00:00Z" });
  console.log(`   resultado: ${JSON.stringify(r)}`);
  check("status = cancelado (cascata completa, nenhuma recebida)", r.status === "cancelado" && r.parcelasRecebidasParaRevisao === 0);
  check("cancelou as 3 parcelas a receber + a parte à vista (4 linhas)", r.secundariasCanceladas === 4);
  check("excluiu as 3 contas a receber pendentes", r.contasExcluidas === 3);
  for (const s of ["S1", "S2", "S3", "SV"]) check(`${s} cancelada`, db.venda(idv(s)).cancelada === true);
  check("motivo/data gravados", db.venda(idv("S1")).motivo_cancelamento === "cliente desistiu" && db.venda(idv("S1")).data_cancelamento === "2026-09-20T12:00:00Z");
  for (const c of ["C1", "C2", "C3"]) check(`conta ${c} removida`, !db.conta(idv(c)));
  check("secundária de OUTRO GRUPO intacta", db.venda(idv("OUTRO-GRUPO")).cancelada === false && !!db.conta(idv("C-OUTRO-GRUPO")));
  check("secundária de OUTRO ITEM (mesmo grupo) intacta", db.venda(idv("OUTRO-ITEM")).cancelada === false && !!db.conta(idv("C-OUTRO-ITEM")));
  check("conta 'pagar' qualquer intacta", !!db.conta(idv("C-QUALQUER")));
  check("linha principal NÃO é alterada pela cascata (quem cancela é cancelarVenda)", db.venda(idv("P")).cancelada === false);

  // Efeito no lucro: principal cancelada + parcelas canceladas → nada sobra
  db.venda(idv("P")).cancelada = true;
  const lucro = lucroRelatorioNovo(db.tabelas.vendas.filter((v) => v.grupo_venda === G && v.dispositivo_id === D));
  check("lucro do grupo após cancelar tudo = 0", near(lucro.lucro, 0) && near(lucro.receita, 0));
}

// ===========================================================================
secao("[2] Cancelar com parcela JÁ RECEBIDA → cancela as PENDENTES; só a recebida fica de fora, sinalizada");
{
  const variantes = [
    ["linha da parcela recebido=true (fluxo normal)", "S1", (fx) => { const s = fx.vendas.find((v) => v.id === idv("S1")); s.recebido = true; s.data_recebimento = "2026-09-10T15:00:00Z"; }],
    ["conta recebida, linha ainda pendente (legado tipo A55)", "S2", (fx) => { const c = fx.contas.find((x) => x.id === idv("C2")); c.status = "recebido"; c.data_pagamento = "2026-08-14"; }],
    ["conta 'pendente' mas com pagamento parcial (valor_pago > 0)", "S3", (fx) => { const c = fx.contas.find((x) => x.id === idv("C3")); c.valor_pago = 500; }],
  ];
  for (const [nome, recebidaId, ajusta] of variantes) {
    const fx = mkWesley({ comAVista: true });
    ajusta(fx);
    const db = new FakeDB(fx);
    const idxRecebida = recebidaId.slice(1);
    const linhaAntes = JSON.stringify(db.venda(idv(recebidaId)));
    const contaAntes = JSON.stringify(db.conta(idv("C" + idxRecebida)));
    const r = await cancelarSecundariasEmCascataCore(db, db.venda(idv("P")), { agora: "2026-09-20T12:00:00Z" });
    console.log(`   ${nome}\n      → ${JSON.stringify(r)}`);
    check(`${nome}: status = cancelado (parcial)`, r.status === "cancelado" && r.parcelasRecebidasParaRevisao === 1);
    check(`${nome}: cancelou as 2 parcelas PENDENTES + a parte à vista (3 linhas) e removeu 2 contas pendentes`, r.secundariasCanceladas === 3 && r.contasExcluidas === 2);
    const pendentes = ["S1", "S2", "S3"].filter((x) => x !== recebidaId);
    for (const pid of pendentes) {
      check(`${nome}: ${pid} (pendente) CANCELADA e conta removida`, db.venda(idv(pid)).cancelada === true && !db.conta(idv("C" + pid.slice(1))));
    }
    check(`${nome}: ${recebidaId} (recebida) NÃO foi tocada (linha idêntica, ativa)`, JSON.stringify(db.venda(idv(recebidaId))) === linhaAntes && db.venda(idv(recebidaId)).cancelada === false);
    check(`${nome}: conta da parcela recebida NÃO foi tocada`, JSON.stringify(db.conta(idv("C" + idxRecebida))) === contaAntes);
    check(`${nome}: nenhuma escrita atinge a parcela recebida nem a conta dela`, db.log.every((l) => !l.ids.includes(idv(recebidaId)) && !l.ids.includes(idv("C" + idxRecebida))));
    check(`${nome}: OUTRO GRUPO / OUTRO ITEM intactos`, db.venda(idv("OUTRO-GRUPO")).cancelada === false && db.venda(idv("OUTRO-ITEM")).cancelada === false && !!db.conta(idv("C-OUTRO-GRUPO")) && !!db.conta(idv("C-OUTRO-ITEM")));
  }
  // parcela recebida sobra sinalizada como "custo não confirmado" quando a principal é cancelada
  {
    const fx = mkWesley({ comAVista: true });
    const s1 = fx.vendas.find((v) => v.id === idv("S1")); s1.recebido = true; s1.data_recebimento = "2026-09-10T15:00:00Z";
    const db = new FakeDB(fx);
    await cancelarSecundariasEmCascataCore(db, db.venda(idv("P")), {});
    db.venda(idv("P")).cancelada = true;
    const lucro = lucroRelatorioNovo(db.tabelas.vendas.filter((v) => v.grupo_venda === G && v.dispositivo_id === D), { [D]: 6720 });
    check("a parcela recebida que sobrou fica FORA do lucro e sinalizada (revisão manual)", near(lucro.lucro, 0) && lucro.naoConfirmadas.length === 1);
  }
  // TODAS as parcelas a prazo recebidas → nada a cancelar (só avisa), sem escrita
  {
    const fx = mkWesley();
    fx.vendas.filter((v) => /^S\d$/.test(Object.keys(UUIDS).find((k) => UUIDS[k] === v.id) || "")).forEach((v) => { v.recebido = true; v.data_recebimento = "2026-09-10T15:00:00Z"; });
    const db = new FakeDB(fx);
    const antes = db.snapshot();
    const r = await cancelarSecundariasEmCascataCore(db, db.venda(idv("P")), {});
    check("todas recebidas → bloqueado_parcela_recebida (3), NENHUMA escrita", r.status === "bloqueado_parcela_recebida" && r.parcelasRecebidas === 3 && db.snapshot() === antes && db.log.length === 0);
  }
  // todas recebidas + parte à vista: só a parte à vista (auxiliar, não recebível) é cancelada
  {
    const fx = mkWesley({ comAVista: true });
    fx.vendas.filter((v) => ["S1", "S2", "S3"].some((k) => UUIDS[k] === v.id)).forEach((v) => { v.recebido = true; v.data_recebimento = "2026-09-10T15:00:00Z"; });
    const db = new FakeDB(fx);
    const r = await cancelarSecundariasEmCascataCore(db, db.venda(idv("P")), {});
    check("todas a prazo recebidas + linha à vista → cancela só a linha à vista e sinaliza as 3 recebidas", r.status === "cancelado" && r.secundariasCanceladas === 1 && r.parcelasRecebidasParaRevisao === 3 && db.venda(idv("SV")).cancelada === true);
  }
  // venda sem pagamento duplo → não faz nada
  const db2 = new FakeDB({ vendas: [venda({ id: "X1", grupo_venda: "g", forma_pagamento: "pix", total: 10 })], contas: [] });
  const r2 = await cancelarSecundariasEmCascataCore(db2, db2.venda("X1"), {});
  check("venda simples sem secundárias → sem_secundarias, sem escrita", r2.status === "sem_secundarias" && db2.log.length === 0);
}

// ===========================================================================
secao("[3] Recebimento de parcela cuja principal foi cancelada/removida → 'custo não confirmado'");
{
  // 3a) principal CANCELADA (caso real 15/07 do Wesley)
  {
    const fx = mkWesley({ principalCancelada: true });
    const db = new FakeDB(fx);
    const contaS1 = db.conta(idv("C1"));
    const r = await propagarStatusContaParaVendaCore(db, { descricao: contaS1.descricao, tipo: "receber", data_pagamento: "2026-09-18" }, "recebido", U);
    console.log(`   principal cancelada → ${JSON.stringify(r)}`);
    check("3a: resultado = custo_nao_confirmado (principal_cancelada)", r?.status === "custo_nao_confirmado" && r.motivo === "principal_cancelada");
    const s1 = db.venda(idv("S1"));
    check("3a: parcela marcada recebida", s1.recebido === true);
    check("3a: data_recebimento ancorada ao dia certo (12h BRT, não meia-noite UTC)", s1.data_recebimento === "2026-09-18T12:00:00-03:00");
    const upd = db.log.find((l) => l.op === "update" && l.tabela === "vendas");
    check("3a: NÃO gravou custo_unitario (nem 0 silencioso)", upd && !("custo_unitario" in upd.payload));
    check("3a: isCustoNaoConfirmado(parcela) = true", isCustoNaoConfirmado(s1) === true);
    check("3a: deveContarSecundarioNoLucro(parcela) = false", deveContarSecundarioNoLucro(s1) === false);
    check("3a: aviso registrado (console.warn)", avisos.some((a) => String(a[0]).includes("custo não confirmado")));
    const lucro = lucroRelatorioNovo([s1], { [D]: 6720 });
    check("3a: parcela FORA do lucro (receita 0, custo 0) e sinalizada", near(lucro.lucro, 0) && lucro.naoConfirmadas.length === 1);
  }
  // 3b) principal REMOVIDA
  {
    const fx = mkWesley(); fx.vendas = fx.vendas.filter((v) => v.id !== idv("P"));
    const db = new FakeDB(fx);
    const r = await reconhecerRecebimentoVendaVinculadaCore(db, idv("S2"), "2026-09-18T12:00:00-03:00", U);
    check("3b: principal removida → custo_nao_confirmado (principal_nao_encontrada)", r.status === "custo_nao_confirmado" && r.motivo === "principal_nao_encontrada");
  }
  // 3c) principal ATIVA com observacoes/cancelada NULL (o neq() do PostgREST antigo descartava essa linha)
  {
    const fx = mkWesley();
    const p = fx.vendas.find((v) => v.id === idv("P")); p.observacoes = null; p.cancelada = null;
    const db = new FakeDB(fx);
    const r = await reconhecerRecebimentoVendaVinculadaCore(db, idv("S1"), "2026-09-18T12:00:00-03:00", U);
    check("3c: principal com observacoes=NULL/cancelada=NULL é encontrada (não vira 'não confirmado' à toa)", r.status === "reconhecido");
    check("3c: fatia gravada = 6720 × (5790/7790) × (1930/5790)", near(db.venda(idv("S1")).custo_unitario, 6720 * (5790 / 7790) * (1930 / 5790), 1e-6), `custo=${db.venda(idv("S1")).custo_unitario}`);
  }
  // 3d) principal sem custo registrado
  {
    const fx = mkWesley(); fx.vendas.find((v) => v.id === idv("P")).custo_unitario = 0;
    const db = new FakeDB(fx);
    const r = await reconhecerRecebimentoVendaVinculadaCore(db, idv("S1"), "2026-09-18T12:00:00-03:00", U);
    check("3d: principal com custo 0 → custo_nao_confirmado (principal_sem_custo)", r.status === "custo_nao_confirmado" && r.motivo === "principal_sem_custo");
  }
  // 3e) ANTES × DEPOIS, com os números reais do Wesley (grupo 15/07: 3 parcelas de 1.930, custo atual do aparelho 6.720)
  {
    const parcelas = [1, 2, 3].map((n) => venda({ id: `o${n}`, dispositivo_id: D, forma_pagamento: "a_receber", total: 1930, recebido: true,
      data_recebimento: "2026-09-18T12:00:00-03:00", parcela_numero: n, total_parcelas: 3, observacoes: SEC, custo_unitario: 0 }));
    const antes = lucroRelatorioAntigo(parcelas, { [D]: 6720 });
    const depois = lucroRelatorioNovo(parcelas, { [D]: 6720 });
    console.log(`   Grupo 15/07 do Wesley (3 parcelas recebidas, custo 0):`);
    console.log(`      ANTES : receita=${brl(antes.receita)} custo=${brl(antes.custo)} lucro=${brl(antes.lucro)}`);
    console.log(`      DEPOIS: receita=${brl(depois.receita)} custo=${brl(depois.custo)} lucro=${brl(depois.lucro)}  (${depois.naoConfirmadas.length} parcelas sinalizadas)`);
    check("ANTES reproduz o prejuízo fantasma de -R$ 14.370", near(antes.lucro, 5790 - 3 * 6720));
    check("DEPOIS: lucro = 0 e as 3 parcelas ficam sinalizadas como não confirmadas", near(depois.lucro, 0) && depois.naoConfirmadas.length === 3);
  }
}

// ===========================================================================
secao("[4] Fallback perigoso do relatório (custo ATUAL do item) não existe mais");
{
  // comportamento
  const parcela = venda({ id: "p", dispositivo_id: D, forma_pagamento: "a_receber", total: 1930, recebido: true, parcela_numero: 1, total_parcelas: 3, observacoes: SEC, custo_unitario: 0 });
  const r = resolverCustoVendaParaLucro(parcela, 6720);
  check("parcela sem custo + custo do item 6.720 → naoConfirmado (NÃO usa 6.720)", r.naoConfirmado === true && r.custo === 0);
  const parcelado = venda({ id: "q", produto_id: "prod", tipo: "produto", forma_pagamento: "a_receber", total: 200, recebido: true, parcela_numero: 3, total_parcelas: 8, custo_unitario: 0 });
  const r2 = resolverCustoVendaParaLucro(parcelado, 50);
  check("parcela 3/8 de venda a prazo sem custo → naoConfirmado (antes: 50 × cada parcela)", r2.naoConfirmado === true && r2.custo === 0);
  const principalDuplo = venda({ id: "r", dispositivo_id: D, forma_pagamento: "pix", total: 7790, valor_segunda_forma: 5790, segunda_forma_pagamento: "a_receber", recebido: true, custo_unitario: 0 });
  check("principal de pagamento duplo a receber sem custo → linha parcial", isVendaLinhaParcial(principalDuplo) === true && resolverCustoVendaParaLucro(principalDuplo, 6720).naoConfirmado === true);
  const zero = resolverCustoVendaParaLucro(parcelado, 0);
  check("item com custo realmente 0 → custo 0, não sinaliza (sem falso positivo)", zero.naoConfirmado === false && zero.custo === 0);
  const simples = venda({ id: "s", dispositivo_id: D, forma_pagamento: "pix", total: 1000, recebido: true, custo_unitario: 0, quantidade: 2 });
  const r3 = resolverCustoVendaParaLucro(simples, 300);
  check("venda simples INTEIRA sem custo salvo mantém a estimativa legada (custo atual × qtd = 600)", !r3.naoConfirmado && r3.custo === 600);
  const comCusto = venda({ id: "t", dispositivo_id: D, forma_pagamento: "pix", total: 1000, recebido: true, custo_unitario: 400 });
  check("venda com custo salvo: idêntico a getVendaCustoTotal", resolverCustoVendaParaLucro(comCusto, 999).custo === getVendaCustoTotal(comCusto));

  // código-fonte: os 2 pontos de useRelatorios usam o resolver e o fallback antigo sumiu
  const src = readFileSync(new URL("../../src/hooks/useRelatorios.ts", import.meta.url), "utf8");
  check("useRelatorios usa resolverCustoVendaParaLucro nos 2 cálculos", (src.match(/resolverCustoVendaParaLucro\(venda,/g) || []).length === 2);
  check("useRelatorios: sumiu 'itemCusto * quantidade' (fallback do lucro por item)", !/itemCusto \* quantidade/.test(src));
  check("useRelatorios: sumiu o fallback 'venda.dispositivos.custo * quantidade' da evolução", !/Number\(venda\.dispositivos\.custo \|\| 0\) \* quantidade/.test(src) && !/Number\(venda\.produtos\.custo \|\| 0\) \* quantidade/.test(src));
}

// ===========================================================================
secao("[5] Todos os caminhos de baixa passam pelo MESMO reconhecimento");
{
  // 5a) função compartilhada, chamada como marcarComoRecebido / conta virtual a chamam (ISO "agora")
  const db = new FakeDB(mkWesley());
  const r = await reconhecerRecebimentoVendaVinculadaCore(db, idv("S1"), "2026-09-20T15:04:05.000Z", U);
  const custoTotal = 6720;
  const fatia = 6720 * (5790 / 7790) * (1930 / 5790);
  check("5a: parcela de pagamento duplo → reconhecido com fatia de custo (marcarComoRecebido/conta virtual)", r.status === "reconhecido" && near(db.venda(idv("S1")).custo_unitario, fatia));
  // receber as 3: Σ custo = custo restante; fecha o lucro total
  await reconhecerRecebimentoVendaVinculadaCore(db, idv("S2"), "2026-09-20T15:04:05.000Z", U);
  await reconhecerRecebimentoVendaVinculadaCore(db, idv("S3"), "2026-09-20T15:04:05.000Z", U);
  const linhas = db.tabelas.vendas.filter((v) => v.grupo_venda === G && v.dispositivo_id === D);
  const lucro = lucroRelatorioNovo(linhas, { [D]: 6720 });
  console.log(`   venda 7.790 / custo 6.720, 3 parcelas recebidas → lucro total ${brl(lucro.lucro)}  (preço − custo = ${brl(7790 - 6720)})`);
  check("5a: fecha: lucro total = preço − custo = R$ 1.070,00 (sem prejuízo fantasma)", near(lucro.lucro, 7790 - 6720));
  check("5a: idempotente (2ª chamada não altera)", (await reconhecerRecebimentoVendaVinculadaCore(db, idv("S1"), "2026-10-01T00:00:00Z", U)).status === "ja_reconhecido" && db.venda(idv("S1")).data_recebimento === "2026-09-20T15:04:05.000Z");

  // 5b) venda a prazo PRIMÁRIA (marcarComoRecebido na tela de Vendas): só recebido + data, sem custo
  const dbp = new FakeDB({ vendas: [venda({ id: U36("PRIM"), forma_pagamento: "a_receber", total: 350, custo_unitario: 170.325, dispositivo_id: D })], contas: [] });
  const rp = await reconhecerRecebimentoVendaVinculadaCore(dbp, U36("PRIM"), "2026-09-20T15:04:05.000Z", U);
  const vp = dbp.venda(U36("PRIM"));
  check("5b: primária a_receber → recebido + data_recebimento, custo intocado", rp.status === "reconhecido" && vp.recebido === true && vp.custo_unitario === 170.325 && vp.data_recebimento === "2026-09-20T15:04:05.000Z");
  // 5c) segurança: outro usuário / não-prazo / inexistente
  check("5c: venda de outro usuário → ignorado (nada escrito)", (await reconhecerRecebimentoVendaVinculadaCore(dbp, U36("PRIM"), "x", "outro-user")).status === "ignorado");
  check("5c: venda inexistente → ignorado", (await reconhecerRecebimentoVendaVinculadaCore(dbp, U36("NAO-EXISTE"), "x", U)).status === "ignorado");

  // 5d) verificações estáticas: os hooks chamam a função compartilhada e sumiram os updates crus
  const vendasHook = readFileSync(new URL("../../src/hooks/useVendas.ts", import.meta.url), "utf8");
  const contasHook = readFileSync(new URL("../../src/hooks/useContas.ts", import.meta.url), "utf8");
  const bloco = (src, ini, fim) => { const a = src.indexOf(ini); const b = src.indexOf(fim, a); return src.slice(a, b); };
  const marcar = bloco(vendasHook, "const marcarComoRecebido", "const editarVenda");
  check("5d: useVendas.marcarComoRecebido chama reconhecerRecebimentoVendaVinculada", /reconhecerRecebimentoVendaVinculada\(/.test(marcar));
  check("5d: useVendas.marcarComoRecebido não faz mais update cru de recebido:true em vendas", !/\.from\("vendas"\)\s*\.update\(\{\s*recebido: true/.test(marcar));
  const atualizar = bloco(contasHook, "const atualizarConta", "const excluirConta");
  check("5d: useContas.atualizarConta (conta virtual) chama reconhecerRecebimentoVendaVinculada", /reconhecerRecebimentoVendaVinculada\(/.test(atualizar));
  check("5d: useContas.atualizarConta sem update cru { recebido: true } em vendas", !/\.update\(\{ recebido: true/.test(atualizar));
  const massa = bloco(contasHook, "const marcarVariasComoPaga", "useEffect(");
  check("5d: useContas.marcarVariasComoPaga (contas virtuais) chama reconhecerRecebimentoVendaVinculada", /reconhecerRecebimentoVendaVinculada\(/.test(massa));
  check("5d: useContas.marcarVariasComoPaga sem update cru { recebido: true } em vendas", !/\.update\(\{ recebido: true/.test(massa));
  check("5d: cancelarVenda chama a cascata", /cancelarSecundariasEmCascata\(/.test(bloco(vendasHook, "const cancelarVenda", "const calcularResumo")));
}

// ===========================================================================
secao("[6] Caso SAMSUNG A55 (08/07): conta 'recebido' desde 17/07, linha da venda ainda pendente");
{
  // números reais: principal 1.190 (pix 930 + 260 a receber), custo 700; parcela 260; conta recebida em 2026-07-17
  const P = U36("A55-P"), S = U36("A55-S"), GA = "g-a55", DA = "disp-a55";
  const db = new FakeDB({
    vendas: [
      venda({ id: P, grupo_venda: GA, dispositivo_id: DA, forma_pagamento: "pix", total: 1190, custo_unitario: 700, recebido: true,
              segunda_forma_pagamento: "a_receber", valor_segunda_forma: 260, observacoes: "SAMSUNG A55 5G", data: "2026-07-08T18:46:00-03:00" }),
      venda({ id: S, grupo_venda: GA, dispositivo_id: DA, forma_pagamento: "a_receber", total: 260, recebido: false, observacoes: SEC, data: "2026-07-08T18:46:00-03:00" }),
    ],
    contas: [conta({ id: U36("A55-C"), descricao: `venda_id:${S}`, status: "recebido", valor: 260, data_pagamento: "2026-07-17" })],
  });
  const linhas = () => db.tabelas.vendas.filter((v) => v.grupo_venda === GA);
  const antes = lucroRelatorioNovo(linhas(), { [DA]: 700 });
  console.log(`   ANTES : receita=${brl(antes.receita)} custo=${brl(antes.custo)} lucro=${brl(antes.lucro)}   (a parcela de R$ 260 nunca entrou)`);
  // a "sincronização" é exatamente o que a baixa da conta agora dispara
  const r = await propagarStatusContaParaVendaCore(db, { descricao: db.conta(U36("A55-C")).descricao, tipo: "receber", data_pagamento: "2026-07-17" }, "recebido", U);
  const depois = lucroRelatorioNovo(linhas(), { [DA]: 700 });
  const s = db.venda(S);
  console.log(`   DEPOIS: receita=${brl(depois.receita)} custo=${brl(depois.custo)} lucro=${brl(depois.lucro)}   parcela: recebido=${s.recebido} data=${s.data_recebimento} custo=${s.custo_unitario.toFixed(4)}`);
  check("resultado = reconhecido", r?.status === "reconhecido");
  check("linha da venda: recebido = true, data_recebimento = 17/07 ao meio-dia de Brasília", s.recebido === true && s.data_recebimento === "2026-07-17T12:00:00-03:00");
  check("fatia de custo = 700 × 260/1190 = R$ 152,94", near(s.custo_unitario, 700 * 260 / 1190, 1e-6));
  check("ANTES: receita 930, lucro 382,94 (só a parte à vista)", near(antes.receita, 930) && near(antes.lucro, 930 - 700 * 930 / 1190, 1e-6));
  check("DEPOIS: receita 1.190 e lucro = preço − custo = R$ 490,00 (fecha, sem gap)", near(depois.receita, 1190) && near(depois.lucro, 490, 1e-6));
  check("competência da parcela = julho (dia 17), não 16", new Date(s.data_recebimento).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === "2026-07-17");
}

// ===========================================================================
secao("[extra] normalizarDataRecebimento");
check("data pura vira 12h de Brasília", normalizarDataRecebimento("2026-09-18") === "2026-09-18T12:00:00-03:00");
check("timestamp completo passa intacto", normalizarDataRecebimento("2026-09-20T15:04:05.000Z") === "2026-09-20T15:04:05.000Z");
check("meia-noite UTC do BUG antigo cairia no dia anterior em Brasília", new Date("2026-09-18").toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === "2026-09-17");

console.warn = _warn;
console.log("\n" + "=".repeat(78));
console.log(falhas === 0 ? `RESULTADO: ${total}/${total} VERIFICAÇÕES PASSARAM ✅` : `RESULTADO: ${falhas} DE ${total} VERIFICAÇÕES FALHARAM ❌`);
console.log("=".repeat(78));
process.exit(falhas === 0 ? 0 : 1);
