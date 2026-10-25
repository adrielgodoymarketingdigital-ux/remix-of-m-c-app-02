// TZ=UTC deno test --no-check scripts/testes-recibo-venda-novo/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-recibo-venda-novo/
// Recibo de venda no layout novo (src/lib/vendas/reciboVendaModelo.ts): o que
// o recibo mostra em cada caso de venda. Dados 100% fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  agruparLinhasVenda,
  type DadosPDVParaRecibo,
  type DadosVendaCarregados,
  entradaDasLinhas,
  entradaDoPDV,
  type EntradaReciboVenda,
  formatarDataHoraRecibo,
  formatarDataRecibo,
  type LinhaVendaRecibo,
  type LojaReciboEntrada,
  linkInstagram,
  linkSite,
  linkWhatsApp,
  montarQrRecibo,
  montarReciboVenda,
  ROTULO_TOTAL_VENDA,
  ROTULO_VALOR_A_PAGAR,
  ROTULO_VALOR_PAGO,
  ajustarTextoTermo,
  urlSegura,
} from "../../src/lib/vendas/reciboVendaModelo.ts";
import { planejarTrocaPorLinha } from "../../src/lib/vendas/trocaPDV.ts";

/** Intl usa espaço não separável depois de "R$". */
const n = (s: string | null | undefined) => (s ?? "").replace(/\u00a0/g, " ");

const LOJA: LojaReciboEntrada = {
  nome_loja: "Loja Exemplo Celulares",
  logo_url: "https://exemplo.test/logo.png",
  cnpj: "00.000.000/0001-00",
  endereco: "Rua Fictícia, 100 - Centro - Cidade Teste/SP",
  telefone: "(11) 3000-0000",
  whatsapp: "(11) 90000-0000",
  email: "contato@exemplo.test",
  site: "www.exemplo.test",
  instagram: "@lojaexemplo",
  facebook: null,
};

const DATA = "2026-10-24T21:55:00.000Z"; // 18:55 em Brasília

const base = (over: Partial<EntradaReciboVenda> = {}): EntradaReciboVenda => ({
  loja: LOJA,
  cliente: { nome: "Cliente Teste", cpf: "000.000.000-00" },
  itens: [{ tipo: "dispositivo", nome: "Apple iPhone 17", quantidade: 1, bruto: 4900, cor: "Preto", capacidadeGb: 256, condicao: "usado", imei: "350000000000001", tempoGarantiaMeses: 3, fotoUrl: "https://exemplo.test/f.jpg" }],
  numeroVenda: "VD-000012",
  data: DATA,
  vendedorNome: "Vendedor Teste",
  descontoManual: 0,
  descontoCupom: 0,
  pagamento: { primeira: { forma: "pix", nome: "PIX" } },
  troca: null,
  ...over,
});

// ── Item único / vários itens ───────────────────────────────────────────────

Deno.test("item único sem troca: TOTAL DA VENDA, forma visível, garantia com 'Valor do produto'", () => {
  const r = montarReciboVenda(base());
  assertEquals(r.faixaTotal.rotulo, ROTULO_TOTAL_VENDA);
  assertEquals(n(r.faixaTotal.valor), "R$ 4.900,00");
  assertEquals(r.tituloItens, "ITENS DA VENDA (1 item)");
  assertEquals(r.itens[0].detalhes, ["Cor: Preto | 256 GB", "Condição: Usado", "IMEI: 350000000000001"]);
  assertEquals(r.itens[0].etiqueta, "Produto vendido");
  assertEquals(n(r.itens[0].valorUnitario), "R$ 4.900,00");
  assertEquals(r.mostrarFotoItens, true);
  assertEquals(r.pagamento.formas.map((f) => [f.nome, f.valor, f.tom]), [["PIX", null, "pago"]]);
  assertEquals(r.resumo.map((l) => l.rotulo), ["Subtotal"]);
  assertEquals(r.troca, null);
  assertEquals(r.titulo.numero, "VD-000012");
  assertEquals(r.titulo.dataHora, "24/10/2026 às 18:55");
  assertEquals(r.situacao.rotulo, "VENDA FINALIZADA");
  assertEquals(r.vendedor, "Vendedor Teste");
  assertEquals(r.assinaturas, { vendedor: "Vendedor Teste", comprador: "Cliente Teste" });
  assertEquals(r.garantias.length, 1);
  assert(n(r.garantias[0].texto).includes("Valor do produto: R$ 4.900,00"));
  assert(!r.garantias[0].texto.includes("Valor pago"));
});

Deno.test("vários itens: aparelho, produto e peça; termo só do aparelho; foto some sem nenhuma", () => {
  const r = montarReciboVenda(base({
    itens: [
      { tipo: "dispositivo", nome: "Samsung A15", quantidade: 1, bruto: 900, imei: "350000000000002", imei2: "350000000000003", tempoGarantiaMeses: 0 },
      { tipo: "produto", nome: "Capinha", quantidade: 2, bruto: 60, sku: "CAP-01" },
      { tipo: "peca", nome: "Tela", quantidade: 1, bruto: 250 },
    ],
  }));
  assertEquals(r.tituloItens, "ITENS DA VENDA (3 itens)");
  assertEquals(r.itens.map((i) => i.numero), [1, 2, 3]);
  assertEquals(r.itens[0].detalhes, ["IMEI: 350000000000002", "IMEI 2: 350000000000003"]);
  assertEquals(r.itens[1].detalhes, ["SKU: CAP-01"]);
  assertEquals(n(r.itens[1].valorUnitario), "R$ 30,00");
  assertEquals(r.itens[1].etiqueta, null);
  assertEquals(r.mostrarFotoItens, false);
  assertEquals(n(r.faixaTotal.valor), "R$ 1.210,00");
  assertEquals(r.garantias.length, 1);
  assertEquals(r.garantias[0].titulo, "TERMO DE VENDA");
  assert(r.garantias[0].texto.includes("SEM GARANTIA CONTRATUAL"));
  assert(r.garantias[0].texto.includes("IMEI: 350000000000002\nIMEI 2: 350000000000003"));
});

// ── Desconto e cupom ────────────────────────────────────────────────────────

Deno.test("desconto e cupom: linhas no resumo e total líquido", () => {
  const r = montarReciboVenda(base({ descontoManual: 100, descontoCupom: 50.5, cupomCodigo: "PROMO10" }));
  assertEquals(r.resumo.map((l) => [l.rotulo, n(l.valor), !!l.negativo]), [
    ["Subtotal", "R$ 4.900,00", false],
    ["Desconto", "R$ 100,00", true],
    ["Cupom (PROMO10)", "R$ 50,50", true],
  ]);
  assertEquals(n(r.faixaTotal.valor), "R$ 4.749,50");
});

// ── Troca ───────────────────────────────────────────────────────────────────

const TROCA = { aparelho: { marca: "Apple", modelo: "iPhone 13 Pro Max", imei: "350000000000009" }, cancelada: false, condicao: "usado", fotoUrl: "https://exemplo.test/t.jpg" };

Deno.test("troca parcial paga em Pix: VALOR PAGO PELO CLIENTE = venda − troca; sem linha repetida", () => {
  const r = montarReciboVenda(base({ troca: { ...TROCA, valorEntrada: 2000 } }));
  assertEquals(r.faixaTotal.rotulo, ROTULO_VALOR_PAGO);
  assertEquals(n(r.faixaTotal.valor), "R$ 2.900,00");
  assertEquals(r.troca!.linhas.map((l) => [l.rotulo, n(l.valor)]), [
    ["Total da venda", "R$ 4.900,00"],
    ["Valor da troca", "R$ 2.000,00"],
    ["Valor pago pelo cliente (PIX)", "R$ 2.900,00"],
  ]);
  assertEquals(r.troca!.condicao, "Usado");
  assertEquals(r.troca!.fotoUrl, "https://exemplo.test/t.jpg");
  assertEquals(r.troca!.aparelhoDescricao, "Apple iPhone 13 Pro Max");
  // Subtotal continua o valor da venda (sem inconsistência com a faixa).
  assertEquals(n(r.resumo[0].valor), "R$ 4.900,00");
  // Termo: preço do produto, não o que o cliente pagou.
  assert(n(r.garantias[0].texto).includes("Valor do produto: R$ 4.900,00"));
});

Deno.test("troca parcial a receber: VALOR A PAGAR e 'Valor a pagar (A Receber)'", () => {
  const r = montarReciboVenda(base({ troca: { ...TROCA, valorEntrada: 2000 }, pagamento: { primeira: { forma: "a_receber", nome: "A Receber", vencimento: "2026-11-10" } } }));
  assertEquals(r.faixaTotal.rotulo, ROTULO_VALOR_A_PAGAR);
  assertEquals(n(r.faixaTotal.valor), "R$ 2.900,00");
  assertEquals(r.troca!.linhas.at(-1)!.rotulo, "Valor a pagar (A Receber)");
  assertEquals(r.pagamento.formas[0].tom, "pendente");
  assertEquals(r.pagamento.formas[0].detalhe, "Vencimento: 10/11/2026");
});

Deno.test("troca cobre tudo: forma Troca, faixa R$ 0,00", () => {
  const r = montarReciboVenda(base({ troca: { ...TROCA, valorEntrada: 4900 }, pagamento: { primeira: { forma: "outro", nome: "Troca" } } }));
  assertEquals(r.faixaTotal.rotulo, ROTULO_VALOR_PAGO);
  assertEquals(n(r.faixaTotal.valor), "R$ 0,00");
  assertEquals(r.pagamento.formas.map((f) => [f.nome, f.tom, f.detalhe]), [["Troca", "troca", "Pago integralmente com o aparelho recebido"]]);
  assertEquals(r.troca!.observacao, "Pago integralmente com o aparelho recebido.");
  assertEquals(r.troca!.linhas.length, 3);
});

Deno.test("troca maior que a venda: diferença devolvida aparece no bloco e no pagamento", () => {
  const r = montarReciboVenda(base({
    itens: [{ tipo: "dispositivo", nome: "iPhone 14", quantidade: 1, bruto: 3700 }],
    troca: { ...TROCA, valorEntrada: 4500, valorDevolvido: 800, formaDevolucao: "pix" },
    pagamento: { primeira: { forma: "outro", nome: "Troca" } },
  }));
  assertEquals(n(r.faixaTotal.valor), "R$ 0,00");
  assertEquals(r.troca!.linhas.map((l) => [l.rotulo, n(l.valor)]), [
    ["Valor do aparelho recebido", "R$ 4.500,00"],
    ["Total da venda", "R$ 3.700,00"],
    ["Valor da troca", "R$ 3.700,00"],
    ["Valor pago pelo cliente", "R$ 0,00"],
    ["Diferença devolvida ao cliente (Pix)", "R$ 800,00"],
  ]);
  assertEquals(n(r.pagamento.observacao), "Diferença devolvida ao cliente (Pix): R$ 800,00");
});

// ── Formas de pagamento ─────────────────────────────────────────────────────

Deno.test("crédito parcelado 3x: '3× de R$ 1.000,00'", () => {
  const r = montarReciboVenda(base({
    itens: [{ tipo: "produto", nome: "Notebook", quantidade: 1, bruto: 3000 }],
    pagamento: { primeira: { forma: "credito_parcelado", nome: "Crédito Parcelado", parcelasCartao: 3 } },
  }));
  assertEquals(r.faixaTotal.rotulo, ROTULO_TOTAL_VENDA);
  assertEquals(n(r.pagamento.formas[0].detalhe), "3× de R$ 1.000,00");
  assertEquals(r.pagamento.formas[0].parcelas, []);
});

Deno.test("crédito parcelado reaberto (banco não guarda o nº de parcelas): só o nome da forma", () => {
  const r = montarReciboVenda(base({ pagamento: { primeira: { forma: "credito_parcelado", nome: "Crédito Parcelado" } } }));
  assertEquals(r.pagamento.formas[0].nome, "Crédito Parcelado");
  assertEquals(r.pagamento.formas[0].detalhe, null);
});

Deno.test("dinheiro, débito, crédito à vista: só o nome", () => {
  for (const [forma, nome] of [["dinheiro", "Dinheiro"], ["debito", "Débito"], ["credito", "Crédito"]]) {
    const r = montarReciboVenda(base({ pagamento: { primeira: { forma, nome } } }));
    assertEquals(r.pagamento.formas.map((f) => [f.nome, f.detalhe, f.tom]), [[nome, null, "pago"]]);
  }
});

Deno.test("pagamento duplo (PDV): as duas formas com valor; soma = total", () => {
  const dados: DadosPDVParaRecibo = {
    itens: [{ id: "i1", tipo: "produto", nome: "Fone", preco: 1000, quantidade: 1 }],
    cliente: null,
    subtotal: 1000,
    descontoManual: 0,
    descontoCupom: 0,
    total: 1000,
    formaPagamento: "pix",
    data: DATA,
    pagamentoDuplo: { valorPrimeira: 600, segundaForma: "credito", valorSegunda: 400 },
  };
  const r = montarReciboVenda(entradaDoPDV(dados, { loja: LOJA }));
  assertEquals(r.pagamento.formas.map((f) => [f.nome, n(f.valor)]), [["PIX", "R$ 600,00"], ["Cartão de Crédito", "R$ 400,00"]]);
  assertEquals(r.faixaTotal.rotulo, ROTULO_TOTAL_VENDA);
});

// ── Linhas do banco (recibo reaberto) ───────────────────────────────────────

let seq = 0;
const linha = (over: Partial<LinhaVendaRecibo>): LinhaVendaRecibo => ({
  id: `v${++seq}`,
  tipo: "dispositivo",
  dispositivo_id: "d1",
  quantidade: 1,
  total: 0,
  forma_pagamento: "pix",
  data: DATA,
  ...over,
});

const carregados = (linhas: LinhaVendaRecibo[], over: Partial<DadosVendaCarregados> = {}): DadosVendaCarregados => ({
  linhas,
  cliente: { nome: "Cliente Teste" },
  produtos: { d1: { marca: "Apple", modelo: "iPhone 15", cor: "Azul", capacidade_gb: 128, condicao: "semi_novo", fotoUrl: "https://exemplo.test/d1.jpg" } },
  troca: null,
  vendedorNome: null,
  ...over,
});

/** Linhas como o PDV grava num "a receber" parcelado (total e desconto por parcela, troca rateada). */
function linhasAReceber(p: { bruto: number; desconto: number; parcelas: number; troca: number; datas?: string[] }): LinhaVendaRecibo[] {
  const trocaPorParcela = p.troca > 0 ? planejarTrocaPorLinha([{ bruto: p.bruto, desconto: p.desconto }], [p.parcelas], p.troca)[0] : null;
  return Array.from({ length: p.parcelas }, (_, k) => linha({
    forma_pagamento: "a_receber",
    total: p.bruto / p.parcelas,
    valor_desconto_manual: p.desconto / p.parcelas,
    parcela_numero: k + 1,
    total_parcelas: p.parcelas,
    data_prevista_recebimento: p.datas?.[k] ?? null,
    ...(trocaPorParcela ? { valor_troca: trocaPorParcela[k] } : {}),
  }));
}

Deno.test("parcelas juntas num item só (antes: 4 'Produto Vendido')", () => {
  const ls = linhasAReceber({ bruto: 4000, desconto: 0, parcelas: 4, troca: 0 });
  const g = agruparLinhasVenda(ls);
  assertEquals(g.itens.length, 1);
  assertEquals(g.itens[0].linhas.map((l) => l.parcela_numero), [1, 2, 3, 4]);
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls), { loja: LOJA }));
  assertEquals(r.itens.length, 1);
  assertEquals(r.itens[0].nome, "Apple iPhone 15");
  assertEquals(r.itens[0].detalhes, ["Cor: Azul | 128 GB", "Condição: Semi Novo"]);
  assertEquals(n(r.itens[0].total), "R$ 4.000,00");
  assertEquals(r.faixaTotal.rotulo, ROTULO_VALOR_A_PAGAR);
  assertEquals(r.pagamento.formas[0].parcelas.map((p) => n(p.valor)), ["R$ 1.000,00", "R$ 1.000,00", "R$ 1.000,00", "R$ 1.000,00"]);
});

Deno.test("a receber 4x com troca, sem desconto: 4 × R$ 750,00 com vencimentos", () => {
  const datas = ["2026-11-24", "2026-12-24", "2027-01-24", "2027-02-24"];
  const ls = linhasAReceber({ bruto: 5000, desconto: 0, parcelas: 4, troca: 2000, datas });
  const troca = { aparelho: null, valorEntrada: 2000, cancelada: false };
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls, { troca }), { loja: LOJA }));
  assertEquals(r.faixaTotal.rotulo, ROTULO_VALOR_A_PAGAR);
  assertEquals(n(r.faixaTotal.valor), "R$ 3.000,00");
  const parcelas = r.pagamento.formas[0].parcelas;
  assertEquals(parcelas.map((p) => n(p.valor)), Array(4).fill("R$ 750,00"));
  assertEquals(parcelas.map((p) => p.vencimento), ["24/11/2026", "24/12/2026", "24/01/2027", "24/02/2027"]);
  assertEquals(r.pagamento.formas[0].detalhe, "4 parcelas");
});

Deno.test("a receber 4x com troca e desconto de R$ 100: 4 × R$ 725,00 (desconto entra)", () => {
  const ls = linhasAReceber({ bruto: 5000, desconto: 100, parcelas: 4, troca: 2000 });
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls, { troca: { aparelho: null, valorEntrada: 2000, cancelada: false } }), { loja: LOJA }));
  assertEquals(n(r.faixaTotal.valor), "R$ 2.900,00");
  assertEquals(r.pagamento.formas[0].parcelas.map((p) => n(p.valor)), Array(4).fill("R$ 725,00"));
  assertEquals(r.resumo.map((l) => [l.rotulo, n(l.valor)]), [["Subtotal", "R$ 5.000,00"], ["Desconto", "R$ 100,00"]]);
});

Deno.test("a receber com troca: valor da conta a receber gravada tem preferência", () => {
  const ls = linhasAReceber({ bruto: 5000, desconto: 0, parcelas: 4, troca: 2000 }).map((l, k) => ({ ...l, valor_conta_receber: k === 0 ? 751 : 749.67 }));
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls, { troca: { aparelho: null, valorEntrada: 2000, cancelada: false } }), { loja: LOJA }));
  assertEquals(r.pagamento.formas[0].parcelas.map((p) => n(p.valor)), ["R$ 751,00", "R$ 749,67", "R$ 749,67", "R$ 749,67"]);
});

Deno.test("a receber sem troca com desconto: parcela = total − desconto da linha", () => {
  const ls = linhasAReceber({ bruto: 1000, desconto: 100, parcelas: 2, troca: 0 });
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls), { loja: LOJA }));
  assertEquals(r.pagamento.formas[0].parcelas.map((p) => n(p.valor)), ["R$ 450,00", "R$ 450,00"]);
  assertEquals(n(r.faixaTotal.valor), "R$ 900,00");
});

Deno.test("dois itens parcelados em 2x: parcelas somadas por número", () => {
  const a = linhasAReceber({ bruto: 1000, desconto: 0, parcelas: 2, troca: 0, datas: ["2026-11-01", "2026-12-01"] });
  const b = linhasAReceber({ bruto: 600, desconto: 0, parcelas: 2, troca: 0, datas: ["2026-11-01", "2026-12-01"] }).map((l) => ({ ...l, tipo: "produto" as const, dispositivo_id: null, produto_id: "p1" }));
  // Ordem do banco intercalada (parcela 1 dos dois, depois parcela 2).
  const r = montarReciboVenda(entradaDasLinhas(carregados([a[0], b[0], a[1], b[1]], { produtos: { d1: { marca: "Apple", modelo: "iPhone 15" }, p1: { nome: "Película" } } }), { loja: LOJA }));
  assertEquals(r.itens.map((i) => [i.nome, n(i.total)]), [["Apple iPhone 15", "R$ 1.000,00"], ["Película", "R$ 600,00"]]);
  assertEquals(r.pagamento.formas[0].parcelas.map((p) => [n(p.valor), p.vencimento]), [["R$ 800,00", "01/11/2026"], ["R$ 800,00", "01/12/2026"]]);
});

Deno.test("mesmo produto em duas linhas sem parcela continua em dois itens", () => {
  const ls = [linha({ total: 100, tipo: "produto", dispositivo_id: null, produto_id: "p1" }), linha({ total: 100, tipo: "produto", dispositivo_id: null, produto_id: "p1" })];
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls, { produtos: { p1: { nome: "Cabo" } } }), { loja: LOJA }));
  assertEquals(r.itens.length, 2);
});

Deno.test("pagamento duplo reaberto: linha secundária ignorada nos itens; 2ª forma a receber 2x com parcelas", () => {
  const principal = linha({ total: 1000, forma_pagamento: "pix", segunda_forma_pagamento: "a_receber", valor_segunda_forma: 400 });
  const sec = [1, 2].map((k) => linha({ total: 200, forma_pagamento: "a_receber", observacoes: "pagamento_duplo_secundario", parcela_numero: k, total_parcelas: 2, data_prevista_recebimento: `2026-1${k}-05` }));
  const r = montarReciboVenda(entradaDasLinhas(carregados([principal, ...sec]), { loja: LOJA }));
  assertEquals(r.itens.length, 1);
  assertEquals(n(r.itens[0].total), "R$ 1.000,00");
  assertEquals(r.pagamento.formas.map((f) => [f.nome, n(f.valor), f.tom]), [["PIX", "R$ 600,00", "pago"], ["A Receber", "R$ 400,00", "pendente"]]);
  assertEquals(r.pagamento.formas[1].parcelas.map((p) => [n(p.valor), p.vencimento]), [["R$ 200,00", "05/11/2026"], ["R$ 200,00", "05/12/2026"]]);
  assertEquals(r.faixaTotal.rotulo, ROTULO_VALOR_A_PAGAR);
});

Deno.test("pagamento duplo com 1ª forma a receber 2x: cada linha traz o bruto inteiro; parcelas = (total − 2ª) ÷ 2", () => {
  const ls = [1, 2].map((k) => linha({ total: 1000, forma_pagamento: "a_receber", segunda_forma_pagamento: "pix", valor_segunda_forma: 400, parcela_numero: k, total_parcelas: 2 }));
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls), { loja: LOJA }));
  assertEquals(n(r.itens[0].total), "R$ 1.000,00");
  assertEquals(r.pagamento.formas[0].parcelas.map((p) => n(p.valor)), ["R$ 300,00", "R$ 300,00"]);
  assertEquals(n(r.pagamento.formas[1].valor), "R$ 400,00");
});

Deno.test("forma customizada vem de [forma:Nome] e o nome do item não leva o sufixo", () => {
  const ls = [linha({ total: 50, tipo: "produto", dispositivo_id: null, produto_id: null, forma_pagamento: "outro", observacoes: "Brinde [forma:Vale Presente]" })];
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls, { produtos: {} }), { loja: LOJA }));
  assertEquals(r.pagamento.formas[0].nome, "Vale Presente");
  assertEquals(r.itens[0].nome, "Brinde");
});

Deno.test("PDV e banco dão o mesmo recibo para a mesma venda com troca", () => {
  const pdv = montarReciboVenda(entradaDoPDV({
    itens: [{ id: "i1", tipo: "dispositivo", nome: "Apple iPhone 15", preco: 5000, quantidade: 1 }],
    cliente: { nome: "Cliente Teste" },
    subtotal: 5000, descontoManual: 100, descontoCupom: 0, total: 2900,
    troca: { aparelho: null, valorEntrada: 2000, cancelada: false },
    formaPagamento: "a_receber", data: DATA,
  }, { loja: LOJA, parcelasReceber: [725, 725, 725, 725].map((valor) => ({ valor, vencimento: null })) }));
  const banco = montarReciboVenda(entradaDasLinhas(carregados(linhasAReceber({ bruto: 5000, desconto: 100, parcelas: 4, troca: 2000 }), { troca: { aparelho: null, valorEntrada: 2000, cancelada: false } }), { loja: LOJA }));
  assertEquals(pdv.faixaTotal, banco.faixaTotal);
  assertEquals(pdv.resumo, banco.resumo);
  assertEquals(pdv.troca!.linhas, banco.troca!.linhas);
  assertEquals(pdv.pagamento.formas[0].parcelas, banco.pagamento.formas[0].parcelas);
});

// ── Cancelada, cliente ──────────────────────────────────────────────────────

Deno.test("venda cancelada: selo, motivo, faixa marcada e troca cancelada", () => {
  const ls = [linha({ total: 4900, cancelada: true, data_cancelamento: "2026-10-25T13:00:00Z", motivo_cancelamento: "Desistência" })];
  const r = montarReciboVenda(entradaDasLinhas(carregados(ls, { troca: { aparelho: null, valorEntrada: 1000, cancelada: false } }), { loja: LOJA }));
  assertEquals(r.situacao, { tipo: "cancelada", rotulo: "VENDA CANCELADA", frase: "Cancelada em 25/10/2026 · Motivo: Desistência" });
  assertEquals(r.faixaTotal.cancelada, true);
  assertEquals(r.troca!.titulo, "TROCA DE APARELHO (CANCELADA)");
});

Deno.test("sem cliente: Consumidor Final, sem CPF; assinatura 'Comprador'; sem vendedor usa a loja", () => {
  const r = montarReciboVenda(base({ cliente: null, vendedorNome: null }));
  assertEquals(r.cliente, { nome: "Consumidor Final", cpf: null, telefone: null, endereco: null, consumidorFinal: true });
  assertEquals(r.assinaturas, { vendedor: "Loja Exemplo Celulares", comprador: "Comprador" });
  assertEquals(r.vendedor, null);
  assert(r.garantias[0].texto.includes("Nome: Cliente"));
});

// ── Loja: QR, contatos, sem logo ────────────────────────────────────────────

Deno.test("QR: Instagram > site > catálogo > Facebook > WhatsApp; sem nenhum, sem QR", () => {
  const vazio: LojaReciboEntrada = { nome_loja: "X" };
  assertEquals(montarQrRecibo({ ...vazio, instagram: "@loja.x", site: "x.test" })?.url, "https://instagram.com/loja.x");
  assertEquals(montarQrRecibo({ ...vazio, site: "x.test", facebook: "lojax" })?.origem, "site");
  assertEquals(montarQrRecibo({ ...vazio, catalogo_ativo: true, catalogo_slug: "loja-x", facebook: "lojax" }, "https://appmec.in")?.url, "https://appmec.in/c/loja-x");
  assertEquals(montarQrRecibo({ ...vazio, catalogo_ativo: false, catalogo_slug: "loja-x", facebook: "lojax" })?.url, "https://facebook.com/lojax");
  assertEquals(montarQrRecibo({ ...vazio, whatsapp: "(11) 90000-0000" })?.url, "https://wa.me/5511900000000");
  assertEquals(montarQrRecibo(vazio), null);
  assertEquals(montarQrRecibo({ ...vazio, instagram: "@x", whatsapp: "11900000000" })?.redes, ["instagram", "whatsapp"]);
});

Deno.test("links: normalização e só http(s)", () => {
  assertEquals(linkInstagram("https://www.instagram.com/lojax/?hl=pt"), { url: "https://instagram.com/lojax", usuario: "@lojax" });
  assertEquals(linkInstagram("lojax"), { url: "https://instagram.com/lojax", usuario: "@lojax" });
  assertEquals(linkInstagram("<script>alert(1)</script>"), null);
  assertEquals(linkSite("javascript:alert(1)"), null);
  assertEquals(linkSite("https://loja.test/"), { url: "https://loja.test/", texto: "loja.test" });
  assertEquals(urlSegura("data:text/html,<b>x</b>"), null);
  assertEquals(linkWhatsApp("123"), null);
});

Deno.test("sem logo, sem redes, sem site e sem WhatsApp: sem QR, contatos só com dado", () => {
  const r = montarReciboVenda(base({ loja: { nome_loja: "Loja Simples", telefone: "(11) 3000-0000" } }));
  assertEquals(r.cabecalho.logoUrl, null);
  assertEquals(r.qr, null);
  assertEquals(r.cabecalho.contatos, [{ tipo: "telefone", texto: "(11) 3000-0000" }]);
  assertEquals(r.rodape.contatos, []);
  assertEquals(r.loja.cnpj, null);
});

Deno.test("WhatsApp igual ao telefone não repete no cabeçalho; vira o QR quando é o único dado", () => {
  const r = montarReciboVenda(base({ loja: { nome_loja: "Loja Simples", telefone: "(11) 3000-0000", whatsapp: "11 3000-0000" } }));
  assertEquals(r.cabecalho.contatos, [{ tipo: "telefone", texto: "(11) 3000-0000" }]);
  assertEquals(r.rodape.contatos, [{ tipo: "whatsapp", texto: "11 3000-0000" }]);
  assertEquals(r.qr?.url, "https://wa.me/551130000000");
  assertEquals(r.qr?.legenda, "FALE CONOSCO NO WHATSAPP");
});

Deno.test("endereço montado das partes quando o campo endereço está vazio", () => {
  const r = montarReciboVenda(base({ loja: { nome_loja: "L", logradouro: "Rua A", numero: "10", bairro: "Centro", cidade: "Cidade", estado: "SP", cep: "00000-000" } }));
  assertEquals(r.cabecalho.contatos[0], { tipo: "endereco", texto: "Rua A, 10 - Centro - Cidade/SP - CEP: 00000-000" });
});

// ── Garantia ────────────────────────────────────────────────────────────────

Deno.test("garantia com meses: prazo no termo e bloco dos 90 dias removido", () => {
  const r = montarReciboVenda(base({ itens: [{ tipo: "dispositivo", nome: "iPhone", quantidade: 1, bruto: 1000, tempoGarantiaMeses: 12 }] }));
  assertEquals(r.garantias[0].titulo, "TERMO DE GARANTIA");
  assert(r.garantias[0].texto.includes("2. GARANTIA CONTRATUAL (1 ano)"));
  assert(r.garantias[0].texto.includes("Garantia de 1 ano a partir da data desta venda"));
  assert(!r.garantias[0].texto.includes("1. GARANTIA LEGAL"));
});

Deno.test("garantia: modelo escolhido no item e texto da loja com 'Valor pago:' vira 'Valor do produto:'", () => {
  const termo = {
    modelos: [{ id: "m1", secoes_com_garantia: [{ visivel: true, conteudo: "MODELO M1 {{garantia_meses}}" }], secoes_sem_garantia: [{ visivel: true, conteudo: "M1 SEM" }, { visivel: false, conteudo: "OCULTA" }] }],
    config: { modo: "livre" as const, termo_sem_garantia: "Loja {{loja}} — Valor pago: {{valor}}" },
  };
  const comModelo = montarReciboVenda(base({ termo, itens: [{ tipo: "dispositivo", nome: "A", quantidade: 1, bruto: 10, tempoGarantiaMeses: 6, modeloTermoId: "m1" }] }));
  assertEquals(comModelo.garantias[0].texto, "MODELO M1 6 meses");
  const semModelo = montarReciboVenda(base({ termo, itens: [{ tipo: "dispositivo", nome: "A", quantidade: 1, bruto: 10 }] }));
  assertEquals(n(semModelo.garantias[0].texto), "Loja Loja Exemplo Celulares — Valor do produto: R$ 10,00");
  assertEquals(ajustarTextoTermo("VALOR PAGO:  {{valor}}"), "Valor do produto:  {{valor}}");
  // Texto salvo pela loja com "{{garantia_meses}} meses" (16 de 19 lojas com termo próprio).
  assertEquals(ajustarTextoTermo("GARANTIA ({{garantia_meses}} meses) e {{garantia_meses}} meses a partir"), "GARANTIA ({{garantia_meses}}) e {{garantia_meses}} a partir");
});

// ── Escape e datas ──────────────────────────────────────────────────────────

Deno.test("textos ficam crus (quem desenha escapa): nada de &lt; duplicado", () => {
  const r = montarReciboVenda(base({ loja: { ...LOJA, nome_loja: "Loja <b>&</b>" }, cliente: { nome: "<img src=x onerror=alert(1)>" } }));
  assertEquals(r.cabecalho.nomeLoja, "Loja <b>&</b>");
  assertEquals(r.cliente.nome, "<img src=x onerror=alert(1)>");
  assert(!JSON.stringify(r).includes("&lt;"));
});

Deno.test("datas no horário de Brasília em qualquer fuso; DATE puro sem deslocar o dia", () => {
  assertEquals(formatarDataHoraRecibo("2026-10-25T02:30:00Z"), "24/10/2026 às 23:30");
  assertEquals(formatarDataRecibo("2026-11-01"), "01/11/2026");
  assertEquals(formatarDataRecibo(null), null);
  assertEquals(formatarDataHoraRecibo("inválida"), "");
});
