// deno test --no-check scripts/testes-i18n/pdvVendas.test.ts
// Etapa 5B (PDV e Vendas): o pt-BR de cada texto movido para o i18n tem de
// ser LETRA POR LETRA o que estava escrito no componente.
import { assertEquals } from "jsr:@std/assert@1";
import comumPtBR from "../../src/locales/pt-BR/comum.ts";
import comumEs from "../../src/locales/es/comum.ts";
import { agruparVendasPorFormaPagamento, nomeFormaPagamento, NOMES_FORMA } from "../../src/lib/formaPagamento.ts";

Deno.test("formas de pagamento: variantes de hoje em pt-BR", () => {
  const fp = comumPtBR.formaPagamento;
  // PDV.tsx, PagamentoDuplo.tsx, Vendas.tsx (filtro), DialogFormasPagamentoConfig, lib/formaPagamento.ts
  assertEquals({ ...fp.curto }, {
    dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito: "Crédito",
    credito_parcelado: "Crédito Parcelado", a_receber: "A Receber", a_prazo: "A Receber",
  });
  // TabelaVendas.tsx
  assertEquals({ ...fp.longo }, {
    dinheiro: "Dinheiro", credito: "Cartão de Crédito", credito_parcelado: "Cartão Parcelado", debito: "Cartão de Débito",
    pix: "PIX", a_receber: "A Receber", a_prazo: "A Prazo",
  });
  assertEquals([fp.aReceberAPrazo, fp.pixAvulsa, fp.transferencia, fp.naoInformada], ["A Receber (A Prazo)", "Pix", "Transferência", "Não informada"]);
});

Deno.test("formas de pagamento: um único nome por forma em espanhol", () => {
  const fp = comumEs.formaPagamento;
  assertEquals(fp.curto, fp.longo);
  assertEquals(fp.aReceberAPrazo, fp.curto.a_receber);
  assertEquals(fp.curto.a_prazo, fp.curto.a_receber);
  assertEquals(fp.pixAvulsa, fp.curto.pix);
});

Deno.test("lib/formaPagamento: padrão continua em pt-BR; nomes traduzidos só quando passados", () => {
  assertEquals(nomeFormaPagamento(null), "Não informada");
  assertEquals(nomeFormaPagamento("credito_parcelado"), "Crédito Parcelado");
  assertEquals(nomeFormaPagamento("outro", "Item [forma:Vale]"), "Vale");
  assertEquals(nomeFormaPagamento("xyz"), "xyz");
  assertEquals(NOMES_FORMA.a_prazo, "A Receber");
  assertEquals(nomeFormaPagamento("dinheiro", null, comumEs.formaPagamento), "Efectivo");
  assertEquals(nomeFormaPagamento(undefined, null, comumEs.formaPagamento), "No informada");
  const vendas = [{ forma_pagamento: "pix", total: 10 }, { forma_pagamento: "a_prazo", total: 5 }];
  assertEquals(agruparVendasPorFormaPagamento(vendas).map((b) => b.nome), ["PIX", "A Receber"]);
  assertEquals(agruparVendasPorFormaPagamento(vendas, comumEs.formaPagamento.curto).map((b) => b.nome), ["Pix", "Por cobrar"]);
});
