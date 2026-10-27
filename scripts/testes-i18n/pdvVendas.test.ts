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

Deno.test("cancelar venda: chaves pt-BR = constantes e aviso de trocaPDV.ts", async () => {
  const { default: vendasPtBR } = await import("../../src/locales/pt-BR/vendas.ts");
  const troca = await import("../../src/lib/vendas/trocaPDV.ts");
  assertEquals(vendasPtBR.cancelar.trocaInteira, troca.MENSAGEM_VENDA_COM_TROCA_INTEIRA);
  assertEquals(vendasPtBR.cancelar.aparelhoJaVendido, troca.MENSAGEM_APARELHO_TROCA_VENDIDO);
  const aviso = troca.avisoDevolucaoNoCancelamento({ valorDevolvido: 800, formaDevolucao: "pix" });
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(800);
  assertEquals(aviso, vendasPtBR.cancelar.avisoDevolucao.replace("{{valor}}", brl).replace("{{forma}}", "Pix"));
});

// Frases que o componente montava em pedaços (JSX/concatenação): a montagem
// antiga, copiada da origin/main, tem de dar o mesmo texto que a chave pt-BR.
const preencher = (texto: string, valores: Record<string, string | number>) =>
  texto.replace(/\{\{(\w+)\}\}/g, (_, k) => String(valores[k])).replace(/<\/?b>/g, "");

Deno.test("compostos de Vendas: montagem antiga = chave pt-BR", async () => {
  const { default: v } = await import("../../src/locales/pt-BR/vendas.ts");
  const data = "26/10/2026", valor = "R$ 150,00";
  // TabelaVendas: cancelar saldo a prazo (texto do <AlertDialogDescription>, sem as tags)
  assertEquals(
    "Tem certeza que deseja cancelar o saldo a prazo" + " " + "de " + data + " " + "no valor de" + " " + valor + '? A OS será marcada como "saldo não recebido" e o lançamento pendente será removido.',
    preencher(v.tabela.cancelarSaldo.comData, { data, valor }),
  );
  assertEquals(
    "Tem certeza que deseja cancelar o saldo a prazo" + " (sem data de vencimento definida)" + " " + "no valor de" + " " + valor + '? A OS será marcada como "saldo não recebido" e o lançamento pendente será removido.',
    preencher(v.tabela.cancelarSaldo.semData, { valor }),
  );
  // DialogCancelarVenda
  for (const q of [0, 1, 2]) {
    const forma = q === 0 ? "zero" : q === 1 ? "one" : "other";
    assertEquals(`Devolver a quantidade vendida (${q}${" "}${q === 1 ? "unidade" : "unidades"}) ao estoque`,
      preencher(v.cancelar[`estornarQuantidade_${forma}` as "estornarQuantidade_one"], { count: q }));
  }
  assertEquals(`Aparelho recebido na troca${": iPhone 11"} (${valor})`, preencher(v.cancelar.aparelhoTrocaComNome, { nome: "iPhone 11", valor }));
  assertEquals(`Aparelho recebido na troca${""} (${valor})`, preencher(v.cancelar.aparelhoTroca, { valor }));
  const msg = v.cancelar.trocaInteira;
  assertEquals(`${msg}: ${`os ${3} itens desta venda serão cancelados juntos`} e a troca será desfeita.`, preencher(v.cancelar.trocaInteiraItens, { mensagem: msg, count: 3 }));
  assertEquals(`${msg}: ${"a venda toda será cancelada"} e a troca será desfeita.`, preencher(v.cancelar.trocaInteiraVenda, { mensagem: msg }));
  // DialogAlterarDataVenda: histórico
  const quando = "26/10/2026 às 10:00";
  assertEquals(`${"Alterado"} em ${quando}`, preencher(v.alterarData.alteradoEm, { quando }));
  assertEquals(`${"Por Ana"} em ${quando}`, preencher(v.alterarData.porEm, { nome: "Ana", quando }));
  assertEquals(` · ${2} itens`, preencher(v.alterarData.historicoItens_other, { count: 2 }));
  assertEquals(` · ${1} caixa(s) ajustado(s)`, preencher(v.alterarData.historicoCaixas_one, { count: 1 }));
  assertEquals(`${"26/10/2026"} às ${"10:00"}`, preencher((await import("../../src/locales/pt-BR/comum.ts")).default.dataHora, { data: "26/10/2026", hora: "10:00" }));
});

Deno.test("PDV: chaves pt-BR = constantes de trocaPDV.ts e nomes da devolução", async () => {
  const { default: pdvPtBR } = await import("../../src/locales/pt-BR/pdv.ts");
  const troca = await import("../../src/lib/vendas/trocaPDV.ts");
  assertEquals(pdvPtBR.pagina.troca.bloqueio, troca.MENSAGEM_TROCA_MAIOR_QUE_ITENS_SEM_PECA);
  // Botões da devolução (NOMES_FORMA_DEVOLUCAO) = Dinheiro (curto) e Pix (variante da venda avulsa).
  assertEquals(troca.NOMES_FORMA_DEVOLUCAO, { dinheiro: comumPtBR.formaPagamento.curto.dinheiro, pix: comumPtBR.formaPagamento.pixAvulsa });
});

Deno.test("useVendas: chaves pt-BR = constantes das libs", async () => {
  const { default: v } = await import("../../src/locales/pt-BR/vendas.ts");
  const { MENSAGEM_CUSTO_NAO_CONFIRMADO } = await import("../../src/lib/vendas/reconhecerSegundaForma.core.ts");
  const { MENSAGEM_EDITAR_VENDA_COM_TROCA } = await import("../../src/lib/vendas/trocaPDV.ts");
  assertEquals({ ...v.avisos.custoMotivo }, { ...MENSAGEM_CUSTO_NAO_CONFIRMADO });
  assertEquals(v.avisos.editarComTroca, MENSAGEM_EDITAR_VENDA_COM_TROCA);
});

Deno.test("compostos dos toasts de useVendas: montagem antiga = chave pt-BR", async () => {
  const { default: v } = await import("../../src/locales/pt-BR/vendas.ts");
  const a = v.avisos;
  for (const n of [1, 2]) {
    assertEquals(`${n === 1 ? "1 caixa fechado foi ajustado" : "2 caixas fechados foram ajustados"}.`, n === 1 ? a.umCaixaAjustado : a.caixasAjustados);
  }
  for (const [itens, estornar] of [[1, true], [3, false]] as const) {
    const antigo = `Venda com troca cancelada por inteiro (${itens} ${itens === 1 ? "item" : "itens"})${estornar ? " e estoque estornado." : "."}`;
    const forma = itens === 1 ? a.canceladaTrocaInteira_one : a.canceladaTrocaInteira_other;
    assertEquals(antigo, preencher(forma, { count: itens }) + (estornar ? a.eEstoqueEstornado : a.ponto));
  }
  for (const contas of [0, 2]) {
    const antigo = `${3} linha(s) do pagamento duplo cancelada(s)${contas > 0 ? ` e ${contas} conta(s) a receber pendente(s) removida(s)` : ""}.`;
    assertEquals(antigo, preencher(a.cascataDescricao, { linhas: 3, contas: contas > 0 ? preencher(a.cascataContas, { contas }) : "" }));
    const antigo2 = `${3} parcela(s) pendente(s) foram canceladas${contas > 0 ? ` (${contas} conta(s) a receber removida(s))` : ""}, mas ${1} parcela(s) da 2ª forma já recebida(s) NÃO foram canceladas — faça o estorno manualmente.`;
    assertEquals(antigo2, preencher(a.cascataParcialDescricao, { pendentes: 3, contas: contas > 0 ? preencher(a.cascataParcialContas, { contas }) : "", recebidas: 1 }));
  }
});
