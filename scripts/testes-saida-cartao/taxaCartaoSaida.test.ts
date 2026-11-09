// deno test -A scripts/testes-saida-cartao/
// Dados totalmente fictícios.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  bandeiraEscolhida,
  CATEGORIA_TAXA_CARTAO,
  dadosPagamentoDaSaida,
  ehFormaCartao,
  jaTemContaTaxa,
  montarContaTaxaCartao,
  mostraParcelas,
  motivoSemTaxaAntesDaConsulta,
  OPCOES_PARCELAS,
  parcelasIniciais,
  parcelasPadraoDaForma,
  rotuloParcela,
  taxaDaSaida,
  type TaxaBandeira,
  valorRecebidoAgora,
} from "../../src/lib/ordemServico/taxaCartaoSaida.ts";

// Cópia de referência do calcularTaxa do useTaxasCartao (a trava abaixo confere o hook).
const calcularTaxa = (
  taxaCartao: TaxaBandeira,
  formaPagamento: string,
  numeroParcelas?: number,
  valorTotal?: number,
) => {
  let percentual = 0;
  if (formaPagamento === "debito") percentual = taxaCartao.taxa_debito;
  else if (formaPagamento === "credito") percentual = taxaCartao.taxa_credito;
  else if (formaPagamento === "credito_parcelado" && numeroParcelas) {
    const key = String(numeroParcelas);
    percentual = taxaCartao.taxas_parcelado[key] ?? taxaCartao.taxa_credito;
  }
  const valor = valorTotal ? (valorTotal * percentual) / 100 : 0;
  return { percentual, valor };
};

Deno.test("trava: o calcularTaxa do hook continua com a mesma conta da cópia de referência", async () => {
  const fonte = await Deno.readTextFile(new URL("../../src/hooks/useTaxasCartao.ts", import.meta.url));
  for (const trecho of [
    'formaPagamento === "debito"',
    "percentual = taxaCartao.taxa_debito;",
    'formaPagamento === "credito"',
    "percentual = taxaCartao.taxa_credito;",
    'formaPagamento === "credito_parcelado" && numeroParcelas',
    "percentual = taxaCartao.taxas_parcelado[key] ?? taxaCartao.taxa_credito;",
    "const valor = valorTotal ? (valorTotal * percentual) / 100 : 0;",
  ]) assertStringIncludes(fonte, trecho);
});

const VISA: TaxaBandeira = {
  id: "b-visa", bandeira: "Visa Fictícia", taxa_debito: 1.5, taxa_credito: 3,
  taxas_parcelado: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i + 2), 4 + i * 0.5])),
};
const ZERO: TaxaBandeira = { id: "b-zero", bandeira: "Zero Fictícia", taxa_debito: 0, taxa_credito: 0, taxas_parcelado: {} };
const SO_CREDITO: TaxaBandeira = { id: "b-cred", bandeira: "Só Crédito", taxa_debito: 1, taxa_credito: 2.5, taxas_parcelado: { "3": 5 } };
const TAXAS = [VISA, ZERO, SO_CREDITO];

const base = (extra: Partial<Parameters<typeof taxaDaSaida>[0]> = {}) =>
  taxaDaSaida({ forma: "debito", taxasAtivas: TAXAS, bandeiraId: VISA.id, parcelas: 2, base: 200, saldoAPrazo: false, calcularTaxa, ...extra });

Deno.test("formas de cartão", () => {
  for (const f of ["debito", "credito", "credito_parcelado"]) assert(ehFormaCartao(f));
  for (const f of ["dinheiro", "pix", "a_prazo", "", null, undefined, "a_receber"]) assert(!ehFormaCartao(f));
});

Deno.test("base da taxa: sem entrada = total; com entrada = saldo; entrada maior que o total = 0", () => {
  assertEquals(valorRecebidoAgora(300, 0), 300);
  assertEquals(valorRecebidoAgora(300, null), 300);
  assertEquals(valorRecebidoAgora(300, 100), 200);
  assertEquals(valorRecebidoAgora(300, 300), 0);
  assertEquals(valorRecebidoAgora(300, 400), 0);
  assertEquals(valorRecebidoAgora(null, 0), 0);
});

Deno.test("taxa por forma usa a forma escolhida agora e a base recebida agora", () => {
  assertEquals(base({ forma: "debito" }), { taxa: VISA, percentual: 1.5, valor: 3 });
  assertEquals(base({ forma: "credito" }), { taxa: VISA, percentual: 3, valor: 6 });
  // com entrada de 100 numa OS de 300, a base é 200 (não 300)
  assertEquals(base({ forma: "credito", base: valorRecebidoAgora(300, 100) }).valor, 6);
});

Deno.test("crédito parcelado 1x a 12x: 1x cai na taxa de crédito; 2x a 12x na tabela", () => {
  for (const n of OPCOES_PARCELAS) {
    const r = base({ forma: "credito_parcelado", parcelas: n });
    const esperado = n === 1 ? 3 : 4 + (n - 2) * 0.5;
    assertEquals(r.percentual, esperado, `${n}x`);
    assertEquals(r.valor, (200 * esperado) / 100, `${n}x`);
  }
  // parcela sem taxa própria cai na taxa de crédito
  assertEquals(base({ forma: "credito_parcelado", bandeiraId: SO_CREDITO.id, parcelas: 7 }).percentual, 2.5);
  assertEquals(base({ forma: "credito_parcelado", bandeiraId: SO_CREDITO.id, parcelas: 3 }).percentual, 5);
});

Deno.test("parcelas não contam fora do crédito parcelado", () => {
  assertEquals(base({ forma: "credito", parcelas: 12 }).percentual, 3);
  assertEquals(base({ forma: "debito", parcelas: 12 }).percentual, 1.5);
});

Deno.test("sem taxa: bandeira ausente, 'nenhuma', inexistente, forma sem cartão, saldo a prazo, base zero, taxa zero", () => {
  assertEquals(base({ bandeiraId: "" }).valor, 0);
  assertEquals(base({ bandeiraId: "nenhuma" }).valor, 0);
  assertEquals(base({ bandeiraId: "apagada" }).taxa, null);
  assertEquals(base({ taxasAtivas: [] }).valor, 0);
  assertEquals(base({ forma: "dinheiro" }).valor, 0);
  assertEquals(base({ forma: "pix" }).valor, 0);
  assertEquals(base({ forma: "a_prazo" }).valor, 0);
  assertEquals(base({ saldoAPrazo: true }).valor, 0);
  assertEquals(base({ base: 0 }).valor, 0);
  assertEquals(base({ bandeiraId: ZERO.id, forma: "credito" }), { taxa: ZERO, percentual: 0, valor: 0 });
});

Deno.test("bandeiraEscolhida", () => {
  assertEquals(bandeiraEscolhida(TAXAS, VISA.id), VISA);
  assertEquals(bandeiraEscolhida(TAXAS, "nenhuma"), null);
  assertEquals(bandeiraEscolhida(TAXAS, ""), null);
  assertEquals(bandeiraEscolhida(TAXAS, null), null);
});

Deno.test("motivo de não lançar (antes da consulta de duplicidade)", () => {
  assertEquals(motivoSemTaxaAntesDaConsulta("dinheiro", VISA, false, 5), "forma_nao_cartao");
  assertEquals(motivoSemTaxaAntesDaConsulta("credito", null, false, 5), "sem_bandeira");
  assertEquals(motivoSemTaxaAntesDaConsulta("credito", VISA, true, 5), "saldo_a_prazo");
  assertEquals(motivoSemTaxaAntesDaConsulta("credito", VISA, false, 0), "taxa_zero");
  assertEquals(motivoSemTaxaAntesDaConsulta("credito_parcelado", VISA, false, 0.01), null);
});

Deno.test("duplicidade: só conta 'Taxa de Cartão' da mesma OS", () => {
  assert(!jaTemContaTaxa([], "12"));
  assert(!jaTemContaTaxa(null, "12"));
  assert(!jaTemContaTaxa([{ categoria: "Serviços", os_numero: "12" }], "12"));
  assert(!jaTemContaTaxa([{ categoria: CATEGORIA_TAXA_CARTAO, os_numero: "123" }], "12"));
  assert(jaTemContaTaxa([{ categoria: "Serviços", os_numero: "12" }, { categoria: CATEGORIA_TAXA_CARTAO, os_numero: "12" }], "12"));
});

Deno.test("parcelas iniciais: as gravadas (1 a 12) ou 2", () => {
  assertEquals(parcelasIniciais(5), 5);
  assertEquals(parcelasIniciais(1), 1);
  assertEquals(parcelasIniciais(12), 12);
  for (const x of [undefined, null, 0, 13, 2.5, "abc", -1]) assertEquals(parcelasIniciais(x), 2);
});

Deno.test("rótulo das parcelas usa o valor recebido agora", () => {
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  assertEquals(rotuloParcela(1, 100, fmt), "1x de R$ 100,00");
  assertEquals(rotuloParcela(3, 100, fmt), "3x de R$ 33,33");
  assertEquals(rotuloParcela(12, 1200, fmt), "12x de R$ 100,00");
});

Deno.test("parcelas aparecem só no crédito e no crédito parcelado", () => {
  assert(mostraParcelas("credito"));
  assert(mostraParcelas("credito_parcelado"));
  for (const f of ["debito", "dinheiro", "pix", "a_prazo", "", null, undefined]) assert(!mostraParcelas(f));
});

Deno.test("padrão do seletor: crédito começa em 1x; crédito parcelado nas gravadas (ou 2)", () => {
  assertEquals(parcelasPadraoDaForma("credito", 2), 1);
  assertEquals(parcelasPadraoDaForma("credito", 6), 1);
  assertEquals(parcelasPadraoDaForma("credito", undefined), 1);
  assertEquals(parcelasPadraoDaForma("credito_parcelado", 6), 6);
  assertEquals(parcelasPadraoDaForma("credito_parcelado", undefined), 2);
});

Deno.test("crédito com parcelas: taxa continua a de crédito à vista", () => {
  for (const n of OPCOES_PARCELAS) {
    assertEquals(base({ forma: "credito", parcelas: n }), { taxa: VISA, percentual: 3, valor: 6 }, `${n}x`);
  }
});

Deno.test("dados_pagamento: crédito grava as parcelas e mantém a forma credito", () => {
  assertEquals(dadosPagamentoDaSaida({ forma: "credito", parcelas: 2, total: 50 }, "credito", 1), { forma: "credito", parcelas: 1, total: 50 });
  assertEquals(dadosPagamentoDaSaida(undefined, "credito", 5), { forma: "credito", parcelas: 5 });
});

Deno.test("dados_pagamento: outras formas não mudam parcelas (nem criam a chave)", () => {
  const antigo = { forma: "credito_parcelado", parcelas: 4, total: 300, entrada: 0 };
  for (const f of ["dinheiro", "pix", "debito", "a_prazo"]) {
    const r = dadosPagamentoDaSaida(antigo, f, 9);
    assertEquals(r, { ...antigo, forma: f }, f);
  }
  const semParcelas = dadosPagamentoDaSaida({ forma: "pix", total: 10 }, "dinheiro", 9);
  assert(!("parcelas" in semParcelas));
  // OS antiga sem dados_pagamento: igual ao comportamento atual ({ forma })
  assertEquals(dadosPagamentoDaSaida(undefined, "dinheiro", 9), { forma: "dinheiro" });
  assertEquals(JSON.stringify(dadosPagamentoDaSaida(undefined, "", 9)), JSON.stringify({ forma: undefined }));
  // sem forma escolhida mantém a anterior
  assertEquals(dadosPagamentoDaSaida(antigo, "", 9), antigo);
});

Deno.test("dados_pagamento: crédito parcelado grava as parcelas escolhidas", () => {
  assertEquals(dadosPagamentoDaSaida({ forma: "dinheiro", parcelas: 2, total: 50 }, "credito_parcelado", 6), {
    forma: "credito_parcelado", parcelas: 6, total: 50,
  });
  assertEquals(dadosPagamentoDaSaida(null, "credito_parcelado", 1), { forma: "credito_parcelado", parcelas: 1 });
});

Deno.test("conta de taxa no mesmo formato da criação, com a data no caixa", () => {
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  assertEquals(
    montarContaTaxaCartao({
      bandeira: "Visa Fictícia", numeroOS: "77", percentual: 3, valorTaxa: 6, base: 200,
      dataCaixa: "2026-11-05", userId: "u-1", empresaId: "e-1", formatar: fmt,
    }),
    {
      nome: "Taxa Cartão Visa Fictícia - OS 77",
      tipo: "pagar",
      valor: 6,
      data: "2026-11-05",
      status: "pago",
      recorrente: false,
      categoria: "Taxa de Cartão",
      descricao: "Taxa 3% da bandeira Visa Fictícia sobre OS 77 (R$ 200,00)",
      os_numero: "77",
      user_id: "u-1",
      empresa_id: "e-1",
    },
  );
});

Deno.test("trava: descrição continua legível pelo relatório (regex de useRelatorios)", () => {
  const c = montarContaTaxaCartao({
    bandeira: "Master Card", numeroOS: "9", percentual: 2.5, valorTaxa: 1, base: 40,
    dataCaixa: "2026-11-09", userId: "u", empresaId: null, formatar: String,
  });
  assertEquals(c.descricao.match(/bandeira\s+(.+?)\s+sobre/i)?.[1], "Master Card");
});
