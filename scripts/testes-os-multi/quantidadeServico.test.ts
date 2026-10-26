// deno test --no-check --no-lock scripts/testes-os-multi/
// Etapa 2 da OS com vários serviços: quantidade e serviço repetido no
// formulário, comissão de valor fixo por unidade e regra de visibilidade.
// Funções reais; só dados fictícios; nada vai à rede.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  chaveLinhaForm,
  definirLinhaForm,
  extrairCamposNovosLinhaServico,
  nomeLinhaForm,
  quantidadeLinhaForm,
  unitariosLinhaForm,
} from "../../src/lib/ordemServico/linhaServicoOS.ts";
import { valorLinhaServico, lucroLinhaServico, custoLinhaServico } from "../../src/lib/ordemServico/totaisPecasOS.ts";
import { calcularComissaoDoItem } from "../../src/lib/ordemServico/comissaoPorTipoServico.ts";
import {
  QUANTIDADE_SERVICO_OS_PARA_TODOS,
  quantidadeServicoOSVisivelPara,
} from "../../src/lib/ordemServico/visibilidadeQuantidadeServico.ts";

let seq = 0;
const novoId = () => `linha-${++seq}`;

// Serviço como vem do CATÁLOGO: `quantidade` é do catálogo (estoque), não da OS.
const FORMATACAO = { id: "srv-formatacao", nome: "Formatação", preco: 50, custo: 5, lucro: 45, quantidade: 10 };
const BATERIA = { id: "srv-bateria", nome: "Troca de bateria", preco: 120, custo: 70, peca_valor: 70, peca_repassada: true, quantidade: 0 };

Deno.test("linha sem linha_os (OS antiga / lojista): quantidade 1, nome e chave de sempre", () => {
  assertEquals(quantidadeLinhaForm(FORMATACAO), 1); // ignora o quantidade=10 do catálogo
  assertEquals(nomeLinhaForm(FORMATACAO), "Formatação");
  assertEquals(chaveLinhaForm(FORMATACAO), "srv-formatacao");
  assertEquals(unitariosLinhaForm(FORMATACAO), { quantidade: 1, precoUnitario: 50, custoUnitario: 5 });
});

Deno.test("nova linha (admin): ganha linha_id e quantidade 1 sem mudar valores", () => {
  const l = definirLinhaForm(FORMATACAO, { quantidade: 1 }, novoId);
  assertEquals(l.preco, 50);
  assertEquals(l.custo, 5);
  assert(l.linha_os?.linha_id);
  assertEquals(l.linha_os, { linha_id: l.linha_os!.linha_id, quantidade: 1, preco_unitario: 50, custo_unitario: 5 });
  assertEquals(valorLinhaServico(l), valorLinhaServico(FORMATACAO));
});

Deno.test("Formatação x3: preço, custo e lucro da linha são 3x o unitário", () => {
  const l = definirLinhaForm(definirLinhaForm(FORMATACAO, { quantidade: 1 }, novoId), { quantidade: 3 }, novoId);
  assertEquals(l.preco, 150);
  assertEquals(l.custo, 15);
  assertEquals(valorLinhaServico(l), 150);
  assertEquals(lucroLinhaServico({ preco: l.preco, custo: l.custo }), 135);
  assertEquals(nomeLinhaForm(l), "3x Formatação");
  assertEquals(unitariosLinhaForm(l), { quantidade: 3, precoUnitario: 50, custoUnitario: 5 });
});

Deno.test("voltar de 3 para 1 restaura os valores unitários", () => {
  const l3 = definirLinhaForm(FORMATACAO, { quantidade: 3 }, novoId);
  const l1 = definirLinhaForm(l3, { quantidade: 1 }, novoId);
  assertEquals([l1.preco, l1.custo], [50, 5]);
  assertEquals(l1.linha_os?.linha_id, l3.linha_os?.linha_id); // mesma linha
});

Deno.test("quantidade inválida (0, negativa, fracionária) vira 1", () => {
  for (const q of [0, -1, 2.5]) {
    assertEquals(definirLinhaForm(FORMATACAO, { quantidade: q }, novoId).linha_os?.quantidade, 1, `q=${q}`);
  }
});

Deno.test("editar preço unitário com quantidade 3 recalcula o total", () => {
  const l = definirLinhaForm(FORMATACAO, { quantidade: 3 }, novoId);
  const e = definirLinhaForm(l, { precoUnitario: 60, custoUnitario: 8 }, novoId);
  assertEquals([e.preco, e.custo], [180, 24]);
  assertEquals(e.linha_os?.preco_unitario, 60);
});

Deno.test("peça repassada x2: mão de obra e peça dobram; lucro = mão de obra", () => {
  const l = definirLinhaForm(BATERIA, { quantidade: 2 }, novoId);
  assertEquals(l.preco, 240);
  assertEquals(l.peca_valor, 140);
  assertEquals(custoLinhaServico(l), 140);
  assertEquals(valorLinhaServico(l), 380); // 2 × (120 + 70)
  assertEquals(lucroLinhaServico(l), 240);
});

Deno.test("centavos: 3 × R$ 33,33 = R$ 99,99 (sem dízima)", () => {
  const l = definirLinhaForm({ id: "x", nome: "X", preco: 33.33, custo: 0 }, { quantidade: 3 }, novoId);
  assertEquals(l.preco, 99.99);
});

Deno.test("serviço repetido: duas linhas do mesmo serviço têm chaves diferentes", () => {
  const a = definirLinhaForm(FORMATACAO, { quantidade: 1 }, novoId);
  const b = definirLinhaForm(FORMATACAO, { quantidade: 1 }, novoId);
  assertEquals(a.id, b.id);
  assertNotEquals(chaveLinhaForm(a), chaveLinhaForm(b));
  // Linha antiga do mesmo serviço (sem linha_id) também não colide.
  assertNotEquals(chaveLinhaForm(FORMATACAO), chaveLinhaForm(a));
});

Deno.test("gravar e reabrir: linha com quantidade volta igual pelo assistente", () => {
  const l = definirLinhaForm(FORMATACAO, { quantidade: 3 }, novoId);
  // Como salvarOrdemServico grava (totais + ...linha_os) e o assistente relê.
  const gravada = { id: l.id, nome: l.nome, preco: l.preco, custo: l.custo, lucro: l.preco - l.custo, ...l.linha_os };
  const reaberta = { ...FORMATACAO, preco: gravada.preco, custo: gravada.custo, linha_os: extrairCamposNovosLinhaServico(gravada) };
  assertEquals(quantidadeLinhaForm(reaberta), 3);
  assertEquals(unitariosLinhaForm(reaberta), { quantidade: 3, precoUnitario: 50, custoUnitario: 5 });
  assertEquals(chaveLinhaForm(reaberta), chaveLinhaForm(l));
});

// ---- Comissão ----------------------------------------------------------
const FIXO_10 = { comissao_tipo: "valor_fixo", comissao_valor: 10 };
const PCT_10 = { comissao_tipo: "porcentagem", comissao_valor: 10 };

Deno.test("comissão de valor fixo é paga por unidade (x3 paga 3x)", () => {
  assertEquals(calcularComissaoDoItem({ preco: 150, custo: 15, quantidade: 3 }, FIXO_10, "faturamento").valor, 30);
  assertEquals(calcularComissaoDoItem({ preco: 150, custo: 15, quantidade: 3 }, FIXO_10, "lucro").valor, 30);
});

Deno.test("comissão de valor fixo sem quantidade (OS antiga) continua 1x", () => {
  assertEquals(calcularComissaoDoItem({ preco: 50, custo: 5 }, FIXO_10, "faturamento").valor, 10);
  for (const q of [0, -2, 1.5, NaN]) {
    assertEquals(calcularComissaoDoItem({ preco: 50, custo: 5, quantidade: q }, FIXO_10, "faturamento").valor, 10, `q=${q}`);
  }
});

Deno.test("comissão %: sobre o total da linha, igual a 3 linhas de 1", () => {
  const x3 = calcularComissaoDoItem({ preco: 150, custo: 15, quantidade: 3 }, PCT_10, "faturamento").valor;
  const uma = calcularComissaoDoItem({ preco: 50, custo: 5 }, PCT_10, "faturamento").valor;
  assertEquals(x3, 15);
  assertEquals(Math.round(x3 * 100), Math.round(uma * 3 * 100));
  assertEquals(calcularComissaoDoItem({ preco: 150, custo: 15, quantidade: 3, custoConfirmado: true }, PCT_10, "lucro").valor, 13.5);
});

// ---- Visibilidade ------------------------------------------------------
Deno.test("visibilidade: liberada a todos pela constante (admin continua vendo)", () => {
  assertEquals(QUANTIDADE_SERVICO_OS_PARA_TODOS, true);
  assertEquals(quantidadeServicoOSVisivelPara({ isAdmin: true }), true);
  assertEquals(quantidadeServicoOSVisivelPara({ isAdmin: false }), true);
});
