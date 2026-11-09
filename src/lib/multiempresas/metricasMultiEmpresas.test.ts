// TZ=America/Sao_Paulo node --test src/lib/multiempresas/metricasMultiEmpresas.test.ts
// Métricas da tela Multi Empresas: conta ANTIGA × NOVA (um caso por linha da
// tabela do diagnóstico) e PARIDADE com o Dashboard. Dados fictícios, sem banco.
process.env.TZ = "America/Sao_Paulo"; // o Dashboard roda no navegador em Brasília
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularMetricasLegado,
  calcularMetricasLoja,
  janelaBrasilia,
  janelaLegado,
  STATUS_OS_FATURAVEL_METRICAS,
  type DadosLoja,
  type OSMetrica,
  type VendaMetrica,
} from "../../../supabase/functions/get-filiais-metricas/calculoMetricas.ts";
import type { LojaLeitura } from "../../../supabase/functions/get-filiais-metricas/lojas.ts";
import {
  deveContarSecundarioNoLucro,
  distribuirCustoParcelasGrupo,
  getFinancialQueryDateBounds,
  getValorFaturavelOS,
  getVendaReceitaLiquida,
  isPagamentoDuploSecundario,
  isVendaInFinancialPeriod,
} from "../vendasFinanceiras.ts";

const MATRIZ: LojaLeitura = { id: "emp-matriz", tipo: "matriz" };
const FILIAL: LojaLeitura = { id: "emp-filial", tipo: "filial" };
const INI = "2026-11-01";
const FIM = "2026-11-30";
const NOVA = janelaBrasilia(INI, FIM);
const ANTIGA = janelaLegado(INI, FIM);

// Horários em Brasília (UTC-3) convertidos para o ISO que o banco devolve.
const br = (dia: string, hora = "12:00") => new Date(`${dia}T${hora}:00-03:00`).toISOString();

let seq = 0;
const venda = (p: Partial<VendaMetrica>): VendaMetrica => ({
  id: `v${++seq}`, empresa_id: MATRIZ.id, tipo: "produto", peca_id: null, produto_id: "p1",
  data: br("2026-11-10"), forma_pagamento: "pix", recebido: true, cancelada: false, total: 100,
  valor_desconto_manual: 0, valor_desconto_cupom: 0, quantidade: 1, custo_unitario: 40, observacoes: null,
  deleted_at: null, ...p,
});
const os = (p: Partial<OSMetrica>): OSMetrica => ({
  id: `o${++seq}`, empresa_id: MATRIZ.id, numero_os: `N${seq}`, total: 200, status: "entregue", is_teste: false,
  created_at: br("2026-11-05"), data_saida: br("2026-11-06"), deleted_at: null, forma_pagamento: "pix", avarias: null, ...p,
});
const dados = (p: Partial<DadosLoja>): DadosLoja => ({
  vendas: [], os: [], statusContaPorOS: {}, servicosAvulsos: [], vendasAvulsas: [], ...p,
});
const nova = (d: DadosLoja, loja = MATRIZ) => calcularMetricasLoja(d, NOVA, loja);
const antiga = (d: DadosLoja, loja = MATRIZ) => calcularMetricasLegado(d, ANTIGA, loja);

test("ambiente no fuso de Brasília (paridade com o navegador)", () => {
  assert.equal(new Date(2026, 10, 1).getTimezoneOffset(), 180);
});

test("lista de status faturáveis = a do Dashboard na main", () => {
  assert.deepEqual([...STATUS_OS_FATURAVEL_METRICAS], ["finalizado", "entregue", "garantia"]);
});

// ── Conta antiga × nova: um caso por linha da tabela ──────────────────────

test("a receber/a prazo não recebida: antes contava, agora não", () => {
  const d = dados({ vendas: [venda({ forma_pagamento: "a_receber", recebido: false })] });
  assert.equal(antiga(d).faturamento_vendas, 100);
  assert.equal(nova(d).faturamento_vendas, 0);
});

test("parcela recebida no mês, de venda de mês anterior: antes não contava, agora conta", () => {
  const d = dados({ vendas: [venda({ forma_pagamento: "a_receber", recebido: true, data: br("2026-10-20"), data_recebimento: "2026-11-15" })] });
  assert.equal(antiga(d).faturamento_vendas, 0);
  assert.equal(nova(d).faturamento_vendas, 100);
});

test("venda cancelada: fora nas duas", () => {
  const d = dados({ vendas: [venda({ cancelada: true })] });
  assert.equal(antiga(d).faturamento_vendas, 0);
  assert.equal(nova(d).faturamento_vendas, 0);
});

test("venda apagada: antes contava, agora não", () => {
  const d = dados({ vendas: [venda({ deleted_at: br("2026-11-11") })] });
  assert.equal(antiga(d).faturamento_vendas, 100);
  assert.equal(nova(d).faturamento_vendas, 0);
});

test("pagamento duplo, secundário a receber já recebido: antes fora, agora conta", () => {
  const sec = venda({ observacoes: "pagamento_duplo_secundario", forma_pagamento: "a_receber", recebido: true, data_recebimento: "2026-11-12", total: 30, custo_unitario: 10 });
  const secAVista = venda({ observacoes: "pagamento_duplo_secundario", forma_pagamento: "pix", total: 30 });
  const d = dados({ vendas: [sec, secAVista] });
  assert.equal(antiga(d).faturamento_vendas, 0);
  assert.equal(nova(d).faturamento_vendas, 30); // a parte à vista nunca entra
});

test("pagamento duplo, principal com 2ª forma ainda a receber: antes total cheio, agora desconta a 2ª", () => {
  const d = dados({ vendas: [venda({ total: 100, segunda_forma_pagamento: "a_receber", valor_segunda_forma: 40 })] });
  assert.equal(antiga(d).faturamento_vendas, 100);
  assert.equal(nova(d).faturamento_vendas, 60);
});

test("cartão parcelado (uma linha por parcela, mesma data): dá igual", () => {
  const parcelas = [1, 2, 3].map((n) => venda({ forma_pagamento: "credito_parcelado", total: 50, parcela_numero: n, total_parcelas: 3, grupo_venda: "g1" }));
  const d = dados({ vendas: parcelas });
  assert.equal(antiga(d).faturamento_vendas, 150);
  assert.equal(nova(d).faturamento_vendas, 150);
});

test("peça e item usado na OS: fora nas duas", () => {
  const d = dados({ vendas: [venda({ peca_id: "x" }), venda({ observacoes: "Tela utilizado na OS 12" })] });
  assert.equal(antiga(d).faturamento_vendas, 0);
  assert.equal(nova(d).faturamento_vendas, 0);
});

test("OS em garantia: antes fora, agora conta", () => {
  const d = dados({ os: [os({ status: "garantia" })] });
  assert.equal(antiga(d).faturamento_os, 0);
  assert.equal(nova(d).faturamento_os, 200);
});

test("OS conta no mês da entrega, não no da criação", () => {
  const criadaAntesEntregueAgora = os({ created_at: br("2026-10-25"), data_saida: br("2026-11-03") });
  const criadaAgoraEntregueDepois = os({ created_at: br("2026-11-28"), data_saida: br("2026-12-02") });
  const d = dados({ os: [criadaAntesEntregueAgora, criadaAgoraEntregueDepois] });
  assert.equal(antiga(d).faturamento_os, 200); // só a criada em novembro
  assert.equal(nova(d).faturamento_os, 200); // só a entregue em novembro
  assert.equal(nova(dados({ os: [criadaAntesEntregueAgora] })).faturamento_os, 200);
  assert.equal(antiga(dados({ os: [criadaAntesEntregueAgora] })).faturamento_os, 0);
});

test("valor da OS: a prazo pendente = 0; com entrada e saldo pendente = só a entrada", () => {
  const aPrazo = os({ numero_os: "AP", avarias: { dados_pagamento: { forma: "a_prazo", entrada: 0 } } });
  const comEntrada = os({ numero_os: "CE", avarias: { dados_pagamento: { forma: "pix", entrada: 50 } } });
  const d = dados({ os: [aPrazo, comEntrada], statusContaPorOS: { AP: "pendente", CE: "pendente" } });
  assert.equal(antiga(d).faturamento_os, 400);
  assert.equal(nova(d).faturamento_os, 50);
});

test("serviço avulso e venda avulsa: antes fora, agora entram; venda avulsa só na matriz", () => {
  const d = dados({
    servicosAvulsos: [
      { empresa_id: null, preco: 80, status: "finalizado", created_at: br("2026-11-09") },
      { empresa_id: FILIAL.id, preco: 70, status: "entregue", created_at: br("2026-11-09") },
      { empresa_id: MATRIZ.id, preco: 999, status: "em_andamento", created_at: br("2026-11-09") },
    ],
    vendasAvulsas: [{ valor: 25, created_at: br("2026-11-09"), deleted_at: null }, { valor: 5, created_at: br("2026-11-09"), deleted_at: br("2026-11-10") }],
  });
  assert.equal(antiga(d).faturamento_mes, 0);
  assert.equal(nova(d, MATRIZ).faturamento_avulsos, 80 + 25); // sem loja = matriz
  assert.equal(nova(d, FILIAL).faturamento_avulsos, 70); // venda avulsa nunca na filial
});

test("fuso: dias de Brasília, não UTC", () => {
  const noiteUltimoDia = venda({ data: br("2026-11-30", "22:00") }); // 01:00 UTC de 01/12
  const noiteVespera = venda({ data: br("2026-10-31", "22:00") }); // 01:00 UTC de 01/11
  const d = dados({ vendas: [noiteUltimoDia, noiteVespera] });
  assert.equal(antiga(d).vendas_mes, 1);
  assert.equal(antiga(d).faturamento_vendas, 100); // contava a véspera, perdia o último dia
  assert.equal(nova(d).vendas_mes, 1);
  const soUltimoDia = dados({ vendas: [noiteUltimoDia] });
  assert.equal(nova(soUltimoDia).faturamento_vendas, 100);
  assert.equal(antiga(soUltimoDia).faturamento_vendas, 0);
});

test("OS de teste: fora só da contagem (como o Dashboard)", () => {
  const d = dados({ os: [os({ is_teste: true }), os({})] });
  assert.equal(antiga(d).os_mes, 2);
  assert.equal(nova(d).os_mes, 1);
  assert.equal(nova(d).faturamento_os, 400);
  assert.equal(nova(d).os_faturadas, 2);
});

test("regra de loja da F1: filial não vê sem loja; matriz vê; nada em duas lojas", () => {
  const d = dados({ vendas: [venda({ empresa_id: null }), venda({ empresa_id: FILIAL.id, total: 7 })] });
  assert.equal(nova(d, MATRIZ).faturamento_vendas, 100);
  assert.equal(nova(d, FILIAL).faturamento_vendas, 7);
});

// ── Paridade com o Dashboard (Dashboard.tsx → loadMetrics) ────────────────

/** Composição das funções de src/lib exatamente como o loadMetrics do Dashboard. */
function faturamentoDashboard(d: DadosLoja, inicio: Date, fim: Date, loja: LojaLeitura) {
  const daLoja = (e: string | null) => (loja.tipo === "matriz" ? e === loja.id || e === null : e === loja.id);
  const inicioISO = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 0, 0, 0, 0).toISOString();
  const fimISO = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate(), 23, 59, 59, 999).toISOString();
  const entre = (v: string | null | undefined, a: string, b: string) => !!v && Date.parse(v) >= Date.parse(a) && Date.parse(v) <= Date.parse(b);
  // OS: .in(status) + (data_saida no período) ou (sem data_saida e created_at no período), sem apagadas.
  const ordens = d.os.filter((o) => daLoja(o.empresa_id) && !o.deleted_at
    && ["finalizado", "entregue", "garantia"].includes(o.status ?? "")
    && (o.data_saida ? entre(o.data_saida, inicioISO, fimISO) : entre(o.created_at, inicioISO, fimISO)));
  const fatOS = ordens.reduce((s, o) => s + getValorFaturavelOS(o, d.statusContaPorOS[o.numero_os ?? ""]), 0);
  // Vendas: cancelada = false, sem apagadas, pré-filtro de datas e depois isVendaInFinancialPeriod.
  const { queryInicio, queryFim } = getFinancialQueryDateBounds(inicio, fim);
  const excluirItemOS = (v: VendaMetrica) => !!v.peca_id
    || (typeof v.observacoes === "string" && v.observacoes.includes("utilizado na OS"))
    || (isPagamentoDuploSecundario(v) && !deveContarSecundarioNoLucro(v));
  const preFiltro = (v: VendaMetrica) => {
    const dia = (x?: string | null) => (x ? x.slice(0, 10) : "");
    return (dia(v.data) >= (queryInicio as string) && dia(v.data) <= (queryFim as string))
      || (!!v.data_recebimento && dia(v.data_recebimento) >= (queryInicio as string) && dia(v.data_recebimento) <= (queryFim as string));
  };
  const vendas = distribuirCustoParcelasGrupo(
    d.vendas.filter((v) => daLoja(v.empresa_id) && v.cancelada === false && !v.deleted_at && preFiltro(v) && !excluirItemOS(v)),
  ).filter((v) => isVendaInFinancialPeriod(v, inicio, fim));
  const fatVendas = vendas.reduce((s, v) => s + getVendaReceitaLiquida(v), 0);
  // Avulsos: status da lista, created_at no período (o Dashboard soma venda avulsa em QUALQUER loja).
  const avulsoIniISO = inicio.toISOString();
  const servicos = d.servicosAvulsos.filter((a) => daLoja(a.empresa_id) && ["finalizado", "entregue", "garantia"].includes(a.status ?? "")
    && entre(a.created_at, avulsoIniISO, fimISO)).reduce((s, a) => s + Number(a.preco || 0), 0);
  const vendasAvulsas = d.vendasAvulsas.filter((a) => !a.deleted_at && entre(a.created_at, avulsoIniISO, fimISO))
    .reduce((s, a) => s + Number(a.valor || 0), 0);
  return { fatOS, fatVendas, servicos, vendasAvulsas, total: fatOS + fatVendas + servicos + vendasAvulsas };
}

function cenarioMisto(): DadosLoja {
  return dados({
    vendas: [
      venda({}),
      venda({ empresa_id: null, total: 55, valor_desconto_manual: 5 }),
      venda({ empresa_id: FILIAL.id, total: 300 }),
      venda({ forma_pagamento: "a_receber", recebido: false, total: 90 }),
      venda({ forma_pagamento: "a_receber", recebido: true, data: br("2026-10-20"), data_recebimento: "2026-11-15", total: 45 }),
      venda({ forma_pagamento: "a_prazo", recebido: true, data: br("2026-11-20"), data_recebimento: "2026-12-03", total: 33 }),
      venda({ deleted_at: br("2026-11-11"), total: 1000 }),
      venda({ cancelada: true, total: 1000 }),
      venda({ observacoes: "pagamento_duplo_secundario", forma_pagamento: "a_receber", recebido: true, data_recebimento: "2026-11-12", total: 30, custo_unitario: 10 }),
      venda({ observacoes: "pagamento_duplo_secundario", forma_pagamento: "pix", total: 30 }),
      venda({ total: 100, segunda_forma_pagamento: "a_receber", valor_segunda_forma: 40, tipo: "dispositivo", produto_id: "d1" }),
      ...[1, 2, 3].map((n) => venda({ forma_pagamento: "credito_parcelado", total: 50, parcela_numero: n, total_parcelas: 3, grupo_venda: "g1" })),
      venda({ peca_id: "x" }),
      venda({ data: br("2026-11-30", "22:00"), total: 11 }),
      venda({ data: br("2026-10-31", "22:00"), total: 13 }),
      venda({ empresa_id: FILIAL.id, data: br("2026-11-01", "00:30"), total: 17 }),
    ],
    os: [
      os({ numero_os: "A" }),
      os({ numero_os: "B", status: "garantia", empresa_id: null }),
      os({ numero_os: "C", created_at: br("2026-10-25"), data_saida: br("2026-11-03") }),
      os({ numero_os: "D", created_at: br("2026-11-28"), data_saida: br("2026-12-02") }),
      os({ numero_os: "E", status: "finalizado", data_saida: null, created_at: br("2026-11-15") }),
      os({ numero_os: "F", avarias: { dados_pagamento: { forma: "a_prazo", entrada: 0 } } }),
      os({ numero_os: "G", avarias: { dados_pagamento: { forma: "pix", entrada: 50 } } }),
      os({ numero_os: "H", status: "em_andamento" }),
      os({ numero_os: "I", is_teste: true }),
      os({ numero_os: "J", deleted_at: br("2026-11-07") }),
      os({ numero_os: "K", empresa_id: FILIAL.id, total: 120 }),
    ],
    statusContaPorOS: { F: "pendente", G: "pendente", A: "recebido" },
    servicosAvulsos: [
      { empresa_id: null, preco: 80, status: "finalizado", created_at: br("2026-11-09") },
      { empresa_id: FILIAL.id, preco: 70, status: "entregue", created_at: br("2026-11-09") },
      { empresa_id: MATRIZ.id, preco: 999, status: "em_andamento", created_at: br("2026-11-09") },
    ],
    vendasAvulsas: [{ valor: 25, created_at: br("2026-11-09"), deleted_at: null }],
  });
}

test("PARIDADE: matriz igual ao Dashboard com a matriz escolhida", () => {
  const d = cenarioMisto();
  const esperado = faturamentoDashboard(d, new Date(2026, 10, 1), new Date(2026, 10, 30), MATRIZ);
  const r = nova(d, MATRIZ);
  assert.equal(r.faturamento_os, esperado.fatOS);
  assert.equal(r.faturamento_vendas, esperado.fatVendas);
  assert.equal(r.faturamento_avulsos, esperado.servicos + esperado.vendasAvulsas);
  assert.equal(r.faturamento_mes, esperado.total);
});

test("PARIDADE: filial igual ao Dashboard com a filial escolhida (menos a venda avulsa, que fica só na matriz)", () => {
  const d = cenarioMisto();
  const esperado = faturamentoDashboard(d, new Date(2026, 10, 1), new Date(2026, 10, 30), FILIAL);
  const r = nova(d, FILIAL);
  assert.equal(r.faturamento_os, esperado.fatOS);
  assert.equal(r.faturamento_vendas, esperado.fatVendas);
  assert.equal(r.faturamento_avulsos, esperado.servicos);
  assert.equal(r.faturamento_mes, esperado.total - esperado.vendasAvulsas);
});

test("PARIDADE: matriz + filial = total do dono, com cada registro uma vez só", () => {
  const d = cenarioMisto();
  const m = nova(d, MATRIZ);
  const f = nova(d, FILIAL);
  const dashM = faturamentoDashboard(d, new Date(2026, 10, 1), new Date(2026, 10, 30), MATRIZ);
  const dashF = faturamentoDashboard(d, new Date(2026, 10, 1), new Date(2026, 10, 30), FILIAL);
  assert.equal(m.faturamento_mes + f.faturamento_mes, dashM.total + dashF.total - dashF.vendasAvulsas);
});

test("ticket médio de OS: faturamento de OS ÷ OS faturadas", () => {
  const r = nova(cenarioMisto(), MATRIZ);
  assert.ok(r.os_faturadas > 0);
  // OS em andamento, de outro mês, apagada e da filial ficam fora das faturadas.
  assert.equal(r.os_faturadas, ["A", "B", "C", "E", "F", "G", "I"].length);
});

test("período padrão (sem datas): mês atual de Brasília até hoje", () => {
  const agora = new Date("2026-12-01T02:00:00Z"); // 30/11 23:00 em Brasília
  const j = janelaBrasilia(null, null, agora);
  assert.equal(j.inicioDia, "2026-11-01");
  assert.equal(j.fimDia, "2026-11-30");
  assert.equal(j.inicioISO, "2026-11-01T03:00:00.000Z");
  assert.equal(j.fimISO, "2026-12-01T02:59:59.999Z");
});
