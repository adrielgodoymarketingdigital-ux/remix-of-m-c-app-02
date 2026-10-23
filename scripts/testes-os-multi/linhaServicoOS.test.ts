// deno test --no-check --no-lock scripts/testes-os-multi/
// Etapa 1 da OS com vários dispositivos/serviços: funções reais de
// src/lib/ordemServico/linhaServicoOS.ts. Só dados fictícios; nada vai à rede.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  chaveLinhaServico,
  extrairCamposNovosLinhaServico,
  nomeLinhaServico,
  normalizarLinhaServico,
  quantidadeLinhaServico,
} from "../../src/lib/ordemServico/linhaServicoOS.ts";

// Linha como as OS gravam hoje (sem nenhum campo novo).
const LINHA_ANTIGA = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Formatação",
  preco: 50,
  custo: 0,
  lucro: 50,
  custo_confirmado: true,
};

const LINHA_NOVA = {
  ...LINHA_ANTIGA,
  preco: 150,
  lucro: 150,
  linha_id: "linha-a",
  quantidade: 3,
  preco_unitario: 50,
  custo_unitario: 0,
  dispositivo_ref: "disp-2",
};

Deno.test("sem quantidade vale 1", () => {
  assertEquals(quantidadeLinhaServico(LINHA_ANTIGA), 1);
  assertEquals(quantidadeLinhaServico({}), 1);
  assertEquals(quantidadeLinhaServico(null), 1);
  assertEquals(quantidadeLinhaServico(undefined), 1);
});

Deno.test("quantidade inválida vale 1; inteiro ≥ 1 é mantido", () => {
  for (const q of [0, -2, 1.5, NaN, Infinity, "abc", null, true]) {
    assertEquals(quantidadeLinhaServico({ quantidade: q }), 1, `quantidade ${String(q)}`);
  }
  assertEquals(quantidadeLinhaServico({ quantidade: 3 }), 3);
  assertEquals(quantidadeLinhaServico({ quantidade: "4" }), 4);
});

Deno.test("normalizarLinhaServico preenche quantidade sem mexer no resto nem no original", () => {
  const n = normalizarLinhaServico(LINHA_ANTIGA);
  assertEquals(n, { ...LINHA_ANTIGA, quantidade: 1 });
  assertEquals("quantidade" in LINHA_ANTIGA, false);
  assertEquals(normalizarLinhaServico(LINHA_NOVA).quantidade, 3);
  assertEquals(normalizarLinhaServico(LINHA_NOVA).preco, 150);
});

Deno.test("nome: OS antiga sai igual; quantidade > 1 sai como '3x Nome'", () => {
  assertEquals(nomeLinhaServico(LINHA_ANTIGA), "Formatação");
  assertEquals(nomeLinhaServico({ ...LINHA_ANTIGA, quantidade: 1 }), "Formatação");
  assertEquals(nomeLinhaServico(LINHA_NOVA), "3x Formatação");
  assertEquals(nomeLinhaServico({ nome: null }), "");
});

Deno.test("chave: linha_id quando existe, senão o índice", () => {
  assertEquals(chaveLinhaServico(LINHA_NOVA, 0), "linha-a");
  assertEquals(chaveLinhaServico(LINHA_ANTIGA, 2), "2");
  assertEquals(chaveLinhaServico({ linha_id: "" }, 5), "5");
  assertEquals(chaveLinhaServico({ linha_id: 7 }, 1), "1");
  // Mesmo serviço repetido sem linha_id: chaves diferentes por posição.
  const repetidas = [LINHA_ANTIGA, LINHA_ANTIGA].map(chaveLinhaServico);
  assertEquals(new Set(repetidas).size, 2);
});

Deno.test("extrair: linha antiga não tem campos novos (undefined)", () => {
  assertStrictEquals(extrairCamposNovosLinhaServico(LINHA_ANTIGA), undefined);
  assertStrictEquals(extrairCamposNovosLinhaServico(null), undefined);
  assertStrictEquals(extrairCamposNovosLinhaServico("x"), undefined);
  assertStrictEquals(extrairCamposNovosLinhaServico({ ...LINHA_ANTIGA, linha_id: "", dispositivo_ref: "" }), undefined);
});

Deno.test("extrair: linha nova devolve só os campos novos válidos", () => {
  assertEquals(extrairCamposNovosLinhaServico(LINHA_NOVA), {
    linha_id: "linha-a",
    quantidade: 3,
    preco_unitario: 50,
    custo_unitario: 0,
    dispositivo_ref: "disp-2",
  });
  assertEquals(extrairCamposNovosLinhaServico({ quantidade: 0, preco_unitario: "50" }), { quantidade: 1 });
});

// Contrato da ida e volta no assistente: o carregamento guarda
// `linha_os = extrair(linha)` e a gravação faz `{ ...camposDeHoje, ...linha_os }`.
function idaEVoltaAssistente(linha: Record<string, unknown>) {
  const linhaOs = extrairCamposNovosLinhaServico(linha);
  const { id, nome, preco, custo, lucro, custo_confirmado } = linha;
  return { id, nome, preco, custo, lucro, custo_confirmado, ...linhaOs };
}

Deno.test("assistente: OS antiga regravada sai byte a byte igual à de hoje", () => {
  assertEquals(JSON.stringify(idaEVoltaAssistente(LINHA_ANTIGA)), JSON.stringify(LINHA_ANTIGA));
});

Deno.test("assistente: linha nova reaberta e regravada mantém linha_id/quantidade", () => {
  const regravada = idaEVoltaAssistente(LINHA_NOVA);
  assertEquals(regravada.linha_id, "linha-a");
  assertEquals(regravada.quantidade, 3);
  assertEquals(regravada.preco_unitario, 50);
  assertEquals(regravada.dispositivo_ref, "disp-2");
  assertEquals(regravada.preco, 150);
});

Deno.test("total da linha não muda com a quantidade: somas de hoje continuam certas", () => {
  const linhas = [LINHA_ANTIGA, LINHA_NOVA];
  const soma = linhas.reduce((acc, s) => acc + s.preco, 0);
  assertEquals(soma, 200);
});
