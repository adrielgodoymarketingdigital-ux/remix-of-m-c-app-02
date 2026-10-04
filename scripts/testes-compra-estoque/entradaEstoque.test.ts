// deno test --no-check scripts/testes-compra-estoque/
// Roda as funções reais de src/lib/estoque/montarEntradaEstoque.ts (tela Repor
// Estoque → parâmetros da RPC registrar_entrada_estoque).
import { assertEquals } from "jsr:@std/assert@1";
import {
  calcularPreviaEntrada,
  mensagemSucessoEntrada,
  montarEntradaEstoque,
  traduzirErroEntradaEstoque,
} from "../../src/lib/estoque/montarEntradaEstoque.ts";

const BASE = { tipo: "produto" as const, itemId: "item-1" };
// Intl usa espaço não separável depois do "R$".
const semNbsp = (s: string) => s.replace(/ /g, " ");

// ---------------------------------------------------------------------------
// montarEntradaEstoque: casos válidos
// ---------------------------------------------------------------------------
Deno.test("só quantidade: parâmetros neutros (soma estoque, sem custo, sem conta)", () => {
  const r = montarEntradaEstoque({ ...BASE, quantidade: "9" });
  assertEquals(r.ok, true);
  assertEquals(r.params, {
    p_item_tipo: "produto",
    p_item_id: "item-1",
    p_quantidade: 9,
    p_custo_unitario: null,
    p_fornecedor_id: null,
    p_gerar_conta: false,
    p_pago: false,
    p_forma_pagamento: null,
    p_observacao: null,
    p_atualizar_custo_medio: false,
  });
});

Deno.test("custo com vírgula + média + conta paga com forma + fornecedor + observação", () => {
  const r = montarEntradaEstoque({
    ...BASE,
    tipo: "peca",
    quantidade: 3,
    custoUnitario: "12,50",
    fornecedorId: "forn-1",
    atualizarCustoMedio: true,
    gerarConta: true,
    pago: true,
    formaPagamento: "pix",
    observacao: "  NF 1234  ",
  });
  assertEquals(r.ok, true);
  assertEquals(r.params?.p_item_tipo, "peca");
  assertEquals(r.params?.p_custo_unitario, 12.5);
  assertEquals(r.params?.p_fornecedor_id, "forn-1");
  assertEquals(r.params?.p_atualizar_custo_medio, true);
  assertEquals(r.params?.p_gerar_conta, true);
  assertEquals(r.params?.p_pago, true);
  assertEquals(r.params?.p_forma_pagamento, "pix");
  assertEquals(r.params?.p_observacao, "NF 1234");
});

Deno.test("conta a pagar (não paga): forma de pagamento é descartada", () => {
  const r = montarEntradaEstoque({ ...BASE, quantidade: 2, custoUnitario: 10, gerarConta: true, pago: false, formaPagamento: "pix" });
  assertEquals(r.ok, true);
  assertEquals(r.params?.p_pago, false);
  assertEquals(r.params?.p_forma_pagamento, null);
});

Deno.test("fornecedor 'nenhum' ou vazio vira null; custo vazio vira null", () => {
  assertEquals(montarEntradaEstoque({ ...BASE, quantidade: 1, fornecedorId: "nenhum" }).params?.p_fornecedor_id, null);
  assertEquals(montarEntradaEstoque({ ...BASE, quantidade: 1, fornecedorId: "  " }).params?.p_fornecedor_id, null);
  assertEquals(montarEntradaEstoque({ ...BASE, quantidade: 1, custoUnitario: "" }).params?.p_custo_unitario, null);
});

Deno.test("custo zero é aceito (com média), mas não gera conta", () => {
  const r = montarEntradaEstoque({ ...BASE, quantidade: 1, custoUnitario: "0", atualizarCustoMedio: true });
  assertEquals(r.ok, true);
  assertEquals(r.params?.p_custo_unitario, 0);
  assertEquals(montarEntradaEstoque({ ...BASE, quantidade: 1, custoUnitario: 0, gerarConta: true }).ok, false);
});

// ---------------------------------------------------------------------------
// montarEntradaEstoque: casos inválidos
// ---------------------------------------------------------------------------
Deno.test("quantidade 0, negativa, fracionada, vazia ou texto: inválida", () => {
  for (const q of [0, "0", -3, "2.5", "2,5", "", "abc"]) {
    const r = montarEntradaEstoque({ ...BASE, quantidade: q });
    assertEquals(r.ok, false, `quantidade ${JSON.stringify(q)}`);
    assertEquals(r.erro, "Informe uma quantidade inteira maior que zero.");
  }
});

Deno.test("custo negativo: inválido", () => {
  const r = montarEntradaEstoque({ ...BASE, quantidade: 1, custoUnitario: "-1" });
  assertEquals(r, { ok: false, erro: "O custo unitário não pode ser negativo." });
});

Deno.test("custo texto: inválido", () => {
  assertEquals(montarEntradaEstoque({ ...BASE, quantidade: 1, custoUnitario: "abc" }), { ok: false, erro: "Custo unitário inválido." });
});

Deno.test("gerar conta sem custo: inválido", () => {
  const r = montarEntradaEstoque({ ...BASE, quantidade: 1, gerarConta: true });
  assertEquals(r, { ok: false, erro: "Para lançar em Contas a Pagar, informe um custo unitário maior que zero." });
});

Deno.test("pago sem gerar conta: inválido", () => {
  const r = montarEntradaEstoque({ ...BASE, quantidade: 1, custoUnitario: 10, pago: true });
  assertEquals(r, { ok: false, erro: "\"Já paguei\" só vale quando a compra é lançada em Contas a Pagar." });
});

Deno.test("média sem custo: inválido", () => {
  const r = montarEntradaEstoque({ ...BASE, quantidade: 1, atualizarCustoMedio: true });
  assertEquals(r, { ok: false, erro: "Para atualizar o custo pela média, informe o custo unitário." });
});

Deno.test("observação acima de 500 caracteres: inválida", () => {
  assertEquals(montarEntradaEstoque({ ...BASE, quantidade: 1, observacao: "x".repeat(501) }).ok, false);
  assertEquals(montarEntradaEstoque({ ...BASE, quantidade: 1, observacao: "x".repeat(500) }).ok, true);
});

// ---------------------------------------------------------------------------
// Prévia (mesma regra da RPC)
// ---------------------------------------------------------------------------
Deno.test("prévia: 6 un. a R$ 35 + 3 un. a R$ 12,50 = R$ 27,50; total R$ 37,50", () => {
  const p = calcularPreviaEntrada({ quantidadeAtual: 6, custoAtual: 35, quantidade: 3, custoUnitario: 12.5, atualizarCustoMedio: true });
  assertEquals(p, { quantidadeFinal: 9, totalCompra: 37.5, custoAtual: 35, custoNovo: 27.5 });
});

Deno.test("prévia: estoque negativo usa o custo novo", () => {
  const p = calcularPreviaEntrada({ quantidadeAtual: -2, custoAtual: 35, quantidade: 3, custoUnitario: 12.5, atualizarCustoMedio: true });
  assertEquals(p.custoNovo, 12.5);
  assertEquals(p.quantidadeFinal, 1);
});

Deno.test("prévia: custo atual zero usa o custo novo", () => {
  assertEquals(calcularPreviaEntrada({ quantidadeAtual: 6, custoAtual: 0, quantidade: 3, custoUnitario: 12.5, atualizarCustoMedio: true }).custoNovo, 12.5);
  assertEquals(calcularPreviaEntrada({ quantidadeAtual: 6, custoAtual: null, quantidade: 3, custoUnitario: 12.5, atualizarCustoMedio: true }).custoNovo, 12.5);
});

Deno.test("prévia: sem média mantém o custo; sem custo não há total", () => {
  const semMedia = calcularPreviaEntrada({ quantidadeAtual: 6, custoAtual: 35, quantidade: 3, custoUnitario: 12.5, atualizarCustoMedio: false });
  assertEquals(semMedia.custoNovo, 35);
  assertEquals(semMedia.totalCompra, 37.5);
  const semCusto = calcularPreviaEntrada({ quantidadeAtual: 6, custoAtual: 35, quantidade: 3, custoUnitario: null, atualizarCustoMedio: false });
  assertEquals(semCusto, { quantidadeFinal: 9, totalCompra: null, custoAtual: 35, custoNovo: 35 });
});

Deno.test("prévia: total em centavos, sem erro de float (3 × 0,10 = 0,30)", () => {
  assertEquals(calcularPreviaEntrada({ quantidadeAtual: 0, custoAtual: 0, quantidade: 3, custoUnitario: 0.1, atualizarCustoMedio: false }).totalCompra, 0.3);
});

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------
Deno.test("mensagem de sucesso completa", () => {
  const m = mensagemSucessoEntrada({
    quantidade: 3, quantidadeFinal: 9, atualizouCusto: true, custoAnterior: 35, custoFinal: 27.5,
    contaGerada: true, valorConta: 37.5, pago: true,
  });
  assertEquals(semNbsp(m), "Entrada registrada: 3 un. (estoque: 9) | custo atualizado de R$ 35,00 para R$ 27,50 | conta de R$ 37,50 lançada (paga)");
});

Deno.test("mensagem de sucesso só com quantidade (não expõe custo)", () => {
  const m = mensagemSucessoEntrada({
    quantidade: 9, quantidadeFinal: 15, atualizouCusto: false, custoAnterior: 35, custoFinal: 35,
    contaGerada: false, valorConta: null, pago: false,
  });
  assertEquals(m, "Entrada registrada: 9 un. (estoque: 15)");
});

Deno.test("mensagem: conta a pagar e custo mantido", () => {
  const m = mensagemSucessoEntrada({
    quantidade: 2, quantidadeFinal: 2, atualizouCusto: true, custoAnterior: 10, custoFinal: 10,
    contaGerada: true, valorConta: 20, pago: false,
  });
  assertEquals(semNbsp(m), "Entrada registrada: 2 un. (estoque: 2) | custo mantido em R$ 10,00 | conta de R$ 20,00 lançada (a pagar)");
});

Deno.test("erros da RPC em português", () => {
  assertEquals(traduzirErroEntradaEstoque({ code: "42501", message: "Item não encontrado ou sem acesso" }), "Você não tem acesso a este item, ou ele foi excluído.");
  assertEquals(traduzirErroEntradaEstoque({ code: "22023", message: "A quantidade deve ser maior que zero" }), "Informe uma quantidade inteira maior que zero.");
  assertEquals(traduzirErroEntradaEstoque({ code: "22023", message: "Para lançar a compra em Contas a Pagar, informe o custo unitário" }), "Para lançar em Contas a Pagar, informe um custo unitário maior que zero.");
  assertEquals(traduzirErroEntradaEstoque({ code: "22023", message: "O custo unitário não pode ser negativo" }), "O custo unitário não pode ser negativo.");
  assertEquals(traduzirErroEntradaEstoque({ code: "PGRST202", message: "Could not find the function public.registrar_entrada_estoque" }), "A reposição com custo ainda não está disponível no banco. Avise o suporte.");
  assertEquals(traduzirErroEntradaEstoque({ code: "42501", message: "Usuário não autenticado" }), "Sua sessão expirou. Entre novamente.");
  assertEquals(traduzirErroEntradaEstoque({ message: "Failed to fetch" }), "Não foi possível registrar a entrada de estoque. Tente novamente.");
  assertEquals(traduzirErroEntradaEstoque(null), "Não foi possível registrar a entrada de estoque. Tente novamente.");
});
