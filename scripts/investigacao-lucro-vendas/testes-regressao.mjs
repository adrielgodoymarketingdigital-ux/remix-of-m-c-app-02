/**
 * Testes de regressão da correção (opção b) do bug "lucro diminui ao fazer vendas".
 *
 * Roda contra as FUNÇÕES REAIS do app (src/lib/vendasFinanceiras.ts e
 * src/lib/vendas/rateioSegundaForma.ts — ambas puras, sem dependência de rede).
 * As fixtures usam números REAIS da conta livio.bruno14@gmail.com (VD-000088,
 * VD-000094, VD-000099) e vendas simples reais do mesmo período.
 *
 *   node scripts/investigacao-lucro-vendas/testes-regressao.mjs
 */
import {
  getVendaReceitaLiquida,
  getVendaCustoTotal,
  calcularFracaoCustoReconhecidaAgora,
  distribuirCustoParcelasGrupo,
  isPagamentoDuploSecundario,
  deveContarSecundarioNoLucro,
  shouldIncludeVendaInFinancialTotals,
} from "../../src/lib/vendasFinanceiras.ts";
import { calcularCustoUnitarioParcelaSecundaria } from "../../src/lib/vendas/rateioSegundaForma.ts";

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------
const brl = (n) => (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toFixed(2);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
let falhas = 0;
const check = (nome, cond, detalhe = "") => {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`   [${ok ? "PASS" : "FALHA"}] ${nome}${detalhe ? "  — " + detalhe : ""}`);
};

/** Custo "antigo" (antes da correção): custo_unitario * quantidade, sem diferimento. */
const custoAntigo = (v) => Number(v.custo_unitario || 0) * Number(v.quantidade || 1);

/**
 * Lucro de um conjunto de linhas sob a regra ANTIGA — reproduz o pipeline real
 * dos calculadores (useRelatorios/Dashboard/serieHistorica) ANTES da correção:
 *  1. gate financeiro: shouldIncludeVendaInFinancialTotals (a_receber só se recebido)
 *  2. exclui TODA linha 'pagamento_duplo_secundario'
 *  3. receita = getVendaReceitaLiquida (não foi tocado)  |  custo = custo_unitario * quantidade
 */
const lucroRegraAntiga = (linhas) =>
  linhas
    .filter((v) => shouldIncludeVendaInFinancialTotals(v))
    .filter((v) => v.observacoes !== "pagamento_duplo_secundario")
    .reduce((acc, v) => acc + (getVendaReceitaLiquida(v) - custoAntigo(v)), 0);

/**
 * Lucro sob a regra NOVA — mesmo pipeline, com as 2 mudanças:
 *  1. gate financeiro (idêntico)
 *  2. exclui secundária só quando !deveContarSecundarioNoLucro
 *  3. custo = getVendaCustoTotal (com diferimento proporcional)
 */
const lucroRegraNova = (linhas) =>
  linhas
    .filter((v) => shouldIncludeVendaInFinancialTotals(v))
    .filter((v) => !(isPagamentoDuploSecundario(v) && !deveContarSecundarioNoLucro(v)))
    .reduce((acc, v) => acc + (getVendaReceitaLiquida(v) - getVendaCustoTotal(v)), 0);

/**
 * Simula o backfill que reconhecerRecebimentoVendaVinculada faz ao marcar cada
 * parcela como recebida: grava custo_unitario (fatia) e recebido=true.
 */
const receberParcelas = (principal, secundarias, dataRecebimento) => {
  const soma = secundarias.reduce((a, s) => a + Number(s.total || 0), 0);
  return secundarias.map((s) => ({
    ...s,
    recebido: true,
    data_recebimento: dataRecebimento,
    custo_unitario: calcularCustoUnitarioParcelaSecundaria(
      principal,
      Number(s.total || 0),
      soma,
      Number(s.quantidade || 1),
    ),
  }));
};

// ---------------------------------------------------------------------------
// FIXTURES — números reais
// ---------------------------------------------------------------------------

// vendas simples à vista (reais)
const VENDAS_SIMPLES = [
  { nome: "VD-000017 Galaxy A07",  tipo: "dispositivo", forma_pagamento: "pix",      total: 650,  custo_unitario: 500,  quantidade: 1, recebido: true, observacoes: "Samsung GALAXY A07" },
  { nome: "VD-000018 iPhone 14",   tipo: "dispositivo", forma_pagamento: "dinheiro", total: 2450, custo_unitario: 2050, quantidade: 1, recebido: true, observacoes: "Apple iPhone 14 256G" },
  { nome: "VD-000067 Boombox 4",   tipo: "produto",     forma_pagamento: "dinheiro", total: 2500, custo_unitario: 1979, quantidade: 1, recebido: true, observacoes: "Boombox 4 Laranja" },
  { nome: "VD-000082 c/ desconto", tipo: "dispositivo", forma_pagamento: "pix",      total: 2350, valor_desconto_manual: 150, custo_unitario: 1710, quantidade: 1, recebido: true, observacoes: "Apple iPhone 12 Pro 256G" },
];

// pagamento duplo SEM a_receber (2ª forma = crédito à vista) — VD-000043 real
const DUPLO_A_VISTA_PRINCIPAL = {
  nome: "VD-000043 principal", tipo: "produto", forma_pagamento: "dinheiro",
  total: 2500, custo_unitario: 2330, quantidade: 1, recebido: true,
  segunda_forma_pagamento: "credito", valor_segunda_forma: 1000,
  grupo_venda: "g43", observacoes: "Boombox 4 azul",
};
const DUPLO_A_VISTA_SECUNDARIA = {
  nome: "VD-000043 secundária", tipo: "produto", forma_pagamento: "credito",
  total: 1000, custo_unitario: 0, quantidade: 1, recebido: true,
  grupo_venda: "g43", observacoes: "pagamento_duplo_secundario",
};

// venda a_receber PRIMÁRIA (fora de pagamento duplo) — VD-000027 real
const AR_PRIMARIA_PENDENTE = {
  nome: "VD-000027 a_receber", tipo: "dispositivo", forma_pagamento: "a_receber",
  total: 350, custo_unitario: 170.325, quantidade: 1, recebido: false,
  observacoes: "INFINIX SMART 10 64G",
};

// pagamento duplo COM 2ª forma a_receber — os 3 casos reais do livio
const casoDuplo = (nome, total, custo, vsf, nParcelas) => {
  const principal = {
    nome: `${nome} principal`, tipo: "dispositivo", forma_pagamento: "pix",
    total, custo_unitario: custo, quantidade: 1, recebido: true,
    segunda_forma_pagamento: "a_receber", valor_segunda_forma: vsf,
    grupo_venda: nome, observacoes: nome,
    dispositivo_id: `dev_${nome}`,
  };
  const parcela = vsf / nParcelas;
  const secundarias = Array.from({ length: nParcelas }, (_, i) => ({
    nome: `${nome} parcela ${i + 1}/${nParcelas}`, tipo: "dispositivo",
    forma_pagamento: "a_receber", total: parcela, custo_unitario: 0, quantidade: 1,
    recebido: false, parcela_numero: i + 1, total_parcelas: nParcelas,
    grupo_venda: nome, observacoes: "pagamento_duplo_secundario",
    dispositivo_id: `dev_${nome}`, data: "2026-08-27",
  }));
  return { principal, secundarias, naive: total - custo };
};

const VD88 = casoDuplo("VD-000088", 4860, 3950, 1860, 3);
const VD94 = casoDuplo("VD-000094", 3000, 1966.5, 2500, 1);
const VD99 = casoDuplo("VD-000099", 4600, 3990, 1600, 1);

// ===========================================================================
console.log("=".repeat(78));
console.log("TESTES DE REGRESSÃO — correção pagamento duplo / 2ª forma a receber");
console.log("=".repeat(78));

// --- TESTE 1 -------------------------------------------------------------------
console.log("\n[1] Venda simples à vista (produto/dispositivo) — lucro NÃO muda\n");
for (const v of VENDAS_SIMPLES) {
  const antigo = getVendaReceitaLiquida(v) - custoAntigo(v);
  const novo = getVendaReceitaLiquida(v) - getVendaCustoTotal(v);
  console.log(`   ${v.nome.padEnd(26)} antigo=${brl(antigo).padStart(11)}   novo=${brl(novo).padStart(11)}`);
  check(`${v.nome}: lucro idêntico`, near(antigo, novo));
  check(`${v.nome}: fração custo = 1`, calcularFracaoCustoReconhecidaAgora(v) === 1);
}

// --- TESTE 2 -----------------------------------------------------------------
console.log("\n[2] Venda a_receber PRIMÁRIA não recebida → não conta; ao receber, conta\n");
{
  const pend = AR_PRIMARIA_PENDENTE;
  check("pendente: excluída dos totais (antigo e novo)", shouldIncludeVendaInFinancialTotals(pend) === false);
  const lucroPend = lucroRegraNova([pend]);
  console.log(`   pendente  → lucro reconhecido = ${brl(lucroPend)}`);
  check("pendente: contribui 0", near(lucroPend, 0));

  // §3.1: ao marcar a conta como recebida, o hook seta recebido=true + data_recebimento
  const recebida = { ...pend, recebido: true, data_recebimento: "2026-09-05" };
  const lucroReceb = getVendaReceitaLiquida(recebida) - getVendaCustoTotal(recebida);
  console.log(`   recebida  → receita=${brl(getVendaReceitaLiquida(recebida))}  custo=${brl(getVendaCustoTotal(recebida))}  lucro=${brl(lucroReceb)}`);
  check("recebida: lucro = preço − custo", near(lucroReceb, 350 - 170.325));
  check("recebida: entra nos totais", shouldIncludeVendaInFinancialTotals(recebida) === true);
}

// --- TESTE 3 ---------------------------------------------------------------
console.log("\n[3] Pagamento duplo SEM a_receber (pix/dinheiro/cartão) — lucro NÃO muda\n");
{
  const linhas = [DUPLO_A_VISTA_PRINCIPAL, DUPLO_A_VISTA_SECUNDARIA];
  const antigo = lucroRegraAntiga(linhas);
  const novo = lucroRegraNova(linhas);
  console.log(`   VD-000043 (2500 dinheiro + 1000 crédito, custo 2330)`);
  console.log(`   antigo=${brl(antigo)}   novo=${brl(novo)}`);
  check("lucro idêntico ao antigo", near(antigo, novo));
  check("lucro = 2500 − 2330", near(novo, 170));
  check("secundária de crédito NÃO conta (evita duplicar receita)", deveContarSecundarioNoLucro(DUPLO_A_VISTA_SECUNDARIA) === false);
}

// --- TESTE 4 --------------------------------------------------------------
console.log("\n[4] Pagamento duplo pix + a_receber, parcelas NÃO pagas\n");
for (const c of [VD88, VD94, VD99]) {
  const linhas = [c.principal, ...c.secundarias];
  const antigo = lucroRegraAntiga(linhas);
  const novo = lucroRegraNova(linhas);
  const fr = calcularFracaoCustoReconhecidaAgora(c.principal);
  console.log(`   ${c.principal.nome.padEnd(22)} total=${brl(c.principal.total)} custo=${brl(c.principal.custo_unitario)} vsf=${brl(c.principal.valor_segunda_forma)}`);
  console.log(`      ANTIGO (bug):  lucro do período = ${brl(antigo)}   ← negativo`);
  console.log(`      NOVO:          lucro do período = ${brl(novo)}   (fração custo reconhecida = ${(fr * 100).toFixed(2)}%)`);
  check(`${c.principal.nome}: bug antigo era negativo`, antigo < 0);
  check(`${c.principal.nome}: novo é positivo`, novo > 0);
  const receitaAgora = c.principal.total - c.principal.valor_segunda_forma;
  const custoAgora = c.principal.custo_unitario * fr;
  check(`${c.principal.nome}: novo = receita_parcial − custo_proporcional`, near(novo, receitaAgora - custoAgora));
  check(`${c.principal.nome}: parcelas pendentes contribuem 0`, near(lucroRegraNova(c.secundarias), 0));
}

// --- TESTE 5 --------------------------------------------------------------
console.log("\n[5] Mesma venda, parcelas PAGAS no mês seguinte — soma dos 2 meses = preço − custo\n");
for (const c of [VD88, VD94, VD99]) {
  const secRecebidas = receberParcelas(c.principal, c.secundarias, "2026-09-10");
  const mesVenda = lucroRegraNova([c.principal, ...c.secundarias]); // parcelas ainda pendentes
  const mesPagamento = lucroRegraNova(secRecebidas);               // só as parcelas, já recebidas
  const total = mesVenda + mesPagamento;
  console.log(`   ${c.principal.nome.padEnd(22)} mês da venda=${brl(mesVenda)}   mês do pagamento=${brl(mesPagamento)}   soma=${brl(total)}   (preço−custo=${brl(c.naive)})`);
  check(`${c.principal.nome}: mês do pagamento > 0`, mesPagamento > 0);
  check(`${c.principal.nome}: soma dos 2 meses = preço − custo`, near(total, c.naive, 1e-6));
  for (const s of secRecebidas) {
    check(`${s.nome}: entra no lucro (deveContar)`, deveContarSecundarioNoLucro(s) === true);
  }
}

// --- TESTE 6 --------------------------------------------------------------
console.log("\n[6] Despagar a parcela (reverter) → volta ao estado do teste 4\n");
for (const c of [VD88]) {
  const secRecebidas = receberParcelas(c.principal, c.secundarias, "2026-09-10");
  // reverter = o que reverterRecebimentoVendaVinculada faz: recebido=false, custo_unitario=0, data_recebimento=null
  const secRevertidas = secRecebidas.map((s) => ({ ...s, recebido: false, data_recebimento: null, custo_unitario: 0 }));
  const antesReverter = lucroRegraNova([c.principal, ...secRecebidas]);
  const depoisReverter = lucroRegraNova([c.principal, ...secRevertidas]);
  const teste4 = lucroRegraNova([c.principal, ...c.secundarias]);
  console.log(`   ${c.principal.nome}  com parcelas pagas=${brl(antesReverter)}   após reverter=${brl(depoisReverter)}   (teste 4=${brl(teste4)})`);
  check("após reverter, lucro = estado do teste 4", near(depoisReverter, teste4));
  check("parcelas revertidas contribuem 0", near(lucroRegraNova(secRevertidas), 0));
}

// --- TESTE 7 -------------------------------------------------------------
console.log("\n[7] GAP ZERADO — sem perda nem sobra de custo por arredondamento\n");
const casos7 = [
  VD88, VD94, VD99,
  // sintético "nasty rounding": custo que não divide bem, muitas parcelas
  casoDuplo("SINT-1", 1000, 333.33, 777, 7),
  casoDuplo("SINT-2", 987.65, 543.21, 611.11, 9),
  casoDuplo("SINT-3", 4999.99, 4321.01, 3210.99, 11),
];
for (const c of casos7) {
  const p = c.principal;
  const receitaBase = p.total - Number(p.valor_desconto_manual || 0) - Number(p.valor_desconto_cupom || 0);
  const custoTotal = p.custo_unitario * p.quantidade;

  // custo reconhecido AGORA na principal
  const custoPrincipalAgora = getVendaCustoTotal(p);

  // custo reconhecido em cada parcela (backfill real)
  const secRecebidas = receberParcelas(p, c.secundarias, "2026-09-10");
  const custoParcelas = secRecebidas.reduce((a, s) => a + getVendaCustoTotal(s), 0);

  const somaCusto = custoPrincipalAgora + custoParcelas;
  const driftCusto = somaCusto - custoTotal;

  // receita reconhecida total
  const receitaPrincipalAgora = getVendaReceitaLiquida(p);
  const receitaParcelas = secRecebidas.reduce((a, s) => a + getVendaReceitaLiquida(s), 0);
  const somaReceita = receitaPrincipalAgora + receitaParcelas;

  // lucro total (todos os meses)
  const lucroTotal = lucroRegraNova([p, ...secRecebidas]);
  const gapLucro = lucroTotal - c.naive;

  console.log(`   ${p.nome.padEnd(12)} custo: ${custoPrincipalAgora.toFixed(6)} + ${custoParcelas.toFixed(6)} = ${somaCusto.toFixed(6)}  (alvo ${custoTotal.toFixed(6)}, drift ${driftCusto.toExponential(2)})`);
  console.log(`   ${" ".repeat(12)} receita reconhecida total = ${somaReceita.toFixed(6)}  (alvo ${receitaBase.toFixed(6)})`);
  console.log(`   ${" ".repeat(12)} lucro total = ${lucroTotal.toFixed(6)}  (preço−custo ${c.naive.toFixed(6)}, GAP ${gapLucro.toExponential(2)})`);
  check(`${p.nome}: Σ custo reconhecido = custo total (drift < 1e-6)`, near(somaCusto, custoTotal, 1e-6));
  check(`${p.nome}: Σ receita reconhecida = receita base (drift < 1e-6)`, near(somaReceita, receitaBase, 1e-6));
  check(`${p.nome}: GAP de lucro = 0 (< 1e-6)`, near(gapLucro, 0, 1e-6));
}

// --- EXTRA: distribuirCustoParcelasGrupo não re-media secundárias ----------
console.log("\n[extra] distribuirCustoParcelasGrupo ignora linhas secundárias (não re-media custo)\n");
{
  const principal = { grupo_venda: "gx", forma_pagamento: "pix", total: 1000, custo_unitario: 600, quantidade: 1, observacoes: "item" };
  const sec1 = { grupo_venda: "gx", forma_pagamento: "a_receber", total_parcelas: 2, parcela_numero: 1, custo_unitario: 300, quantidade: 1, recebido: true, observacoes: "pagamento_duplo_secundario" };
  const sec2 = { grupo_venda: "gx", forma_pagamento: "a_receber", total_parcelas: 2, parcela_numero: 2, custo_unitario: 700, quantidade: 1, recebido: true, observacoes: "pagamento_duplo_secundario" };
  const out = distribuirCustoParcelasGrupo([principal, sec1, sec2]);
  const c1 = out.find((v) => v.parcela_numero === 1).custo_unitario;
  const c2 = out.find((v) => v.parcela_numero === 2).custo_unitario;
  const pc = out.find((v) => !v.parcela_numero).custo_unitario;
  console.log(`   custo_unitario após distribuir: principal=${pc}  sec1=${c1}  sec2=${c2}  (esperado 600 / 300 / 700)`);
  check("secundárias mantêm custo_unitario individual (não vira 500/500)", c1 === 300 && c2 === 700);
  check("principal intacta", pc === 600);
}

// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(78));
console.log(falhas === 0 ? "RESULTADO: TODOS OS TESTES PASSARAM ✅" : `RESULTADO: ${falhas} VERIFICAÇÃO(ÕES) FALHARAM ❌`);
console.log("=".repeat(78));
process.exit(falhas === 0 ? 0 : 1);
