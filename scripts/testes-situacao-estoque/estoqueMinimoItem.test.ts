// deno test --no-check scripts/testes-situacao-estoque/
// Estoque mínimo por item (fase 3): src/lib/estoque/estoqueMinimoItem.ts.
import { assertEquals } from "jsr:@std/assert@1";
import {
  algumItemComMinimo,
  campoInicialEstoqueMinimo,
  estoqueMinimoParaEnviar,
  estoqueMinimoValido,
  limiteDoItem,
} from "../../src/lib/estoque/estoqueMinimoItem.ts";
import {
  LIMITE_PADRAO_LISTA_PRODUTOS,
  LIMITE_PADRAO_PDF_MENOR_ESTOQUE,
  LIMITE_PADRAO_RELATORIO_VENDIDOS,
  situacaoEstoque,
} from "../../src/lib/estoque/situacaoEstoque.ts";

Deno.test("mínimo válido: inteiro de 0 a 1000", () => {
  for (const v of [0, 1, 3, 1000]) assertEquals(estoqueMinimoValido(v), v);
  for (const v of [null, undefined, -1, 1001, 2.5, "3", Number.NaN]) assertEquals(estoqueMinimoValido(v), null, String(v));
});

Deno.test("precedência: item > loja > padrão da tela", () => {
  assertEquals(limiteDoItem(3, 7), 3); // item vence a loja
  assertEquals(limiteDoItem(null, 7), 7); // item nulo usa a loja
  assertEquals(limiteDoItem(undefined, 7), 7); // coluna ausente usa a loja
  assertEquals(limiteDoItem(0, 7), 0); // 0 do item vence (não avisar)
  assertEquals(limiteDoItem(null, null), null); // nada: a tela usa o padrão
  assertEquals(limiteDoItem(undefined, undefined), undefined);
  assertEquals(limiteDoItem(-5, 7), 7); // inválido no item cai na loja
  assertEquals(limiteDoItem(2.5, null), null);
});

Deno.test("situação final nas três telas", () => {
  for (const padrao of [LIMITE_PADRAO_LISTA_PRODUTOS, LIMITE_PADRAO_PDF_MENOR_ESTOQUE, LIMITE_PADRAO_RELATORIO_VENDIDOS]) {
    // item com 3 e loja com 7: o 3 vale
    assertEquals(situacaoEstoque(3, limiteDoItem(3, 7), padrao), "baixo");
    assertEquals(situacaoEstoque(4, limiteDoItem(3, 7), padrao), "ok");
    // item nulo usa a loja (7)
    assertEquals(situacaoEstoque(7, limiteDoItem(null, 7), padrao), "baixo");
    assertEquals(situacaoEstoque(8, limiteDoItem(null, 7), padrao), "ok");
    // item 0: nunca "baixo"; zero e negativo continuam fixos
    assertEquals(situacaoEstoque(1, limiteDoItem(0, 7), padrao), "ok");
    assertEquals(situacaoEstoque(0, limiteDoItem(0, 7), padrao), "sem_estoque");
    assertEquals(situacaoEstoque(-2, limiteDoItem(0, 7), padrao), "negativo");
  }
});

Deno.test("sem configuração e sem coluna: idêntico ao de hoje (-20 a 100)", () => {
  for (let q = -20; q <= 100; q++) {
    for (const padrao of [LIMITE_PADRAO_LISTA_PRODUTOS, LIMITE_PADRAO_PDF_MENOR_ESTOQUE, LIMITE_PADRAO_RELATORIO_VENDIDOS]) {
      assertEquals(situacaoEstoque(q, limiteDoItem(undefined, null), padrao), situacaoEstoque(q, undefined, padrao), `q=${q}`);
      assertEquals(situacaoEstoque(q, limiteDoItem(null, null), padrao), situacaoEstoque(q, undefined, padrao), `q=${q}`);
    }
  }
});

Deno.test("PDF: algum item com mínimo próprio", () => {
  assertEquals(algumItemComMinimo([]), false);
  assertEquals(algumItemComMinimo([{}, { estoque_minimo: null }]), false);
  assertEquals(algumItemComMinimo([{ estoque_minimo: null }, { estoque_minimo: 0 }]), true);
});

Deno.test("campo no cadastro: estado inicial", () => {
  assertEquals(campoInicialEstoqueMinimo(undefined), { texto: "", naoAvisar: false });
  assertEquals(campoInicialEstoqueMinimo(null), { texto: "", naoAvisar: false });
  assertEquals(campoInicialEstoqueMinimo(5), { texto: "5", naoAvisar: false });
  assertEquals(campoInicialEstoqueMinimo(0), { texto: "", naoAvisar: true });
});

Deno.test("envio: sem coluna, a chave nunca vai", () => {
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: false, original: undefined, texto: "5", naoAvisar: false }), { ok: true, campos: {} });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: false, original: 3, texto: "abc", naoAvisar: true }), { ok: true, campos: {} });
});

Deno.test("envio: cadastro novo só manda quando preenchido", () => {
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: undefined, texto: "", naoAvisar: false }), { ok: true, campos: {} });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: undefined, texto: "5", naoAvisar: false }), { ok: true, campos: { estoque_minimo: 5 } });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: undefined, texto: "", naoAvisar: true }), { ok: true, campos: { estoque_minimo: 0 } });
});

Deno.test("envio: edição só manda quando mudou", () => {
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: null, texto: "", naoAvisar: false }), { ok: true, campos: {} });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: 5, texto: "5", naoAvisar: false }), { ok: true, campos: {} });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: 5, texto: "7", naoAvisar: false }), { ok: true, campos: { estoque_minimo: 7 } });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: 5, texto: "", naoAvisar: false }), { ok: true, campos: { estoque_minimo: null } });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: 0, texto: "", naoAvisar: true }), { ok: true, campos: {} });
  assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: 0, texto: "", naoAvisar: false }), { ok: true, campos: { estoque_minimo: null } });
});

Deno.test("envio: valor inválido é recusado", () => {
  for (const texto of ["1001", "-1", "2.5", "abc"]) {
    assertEquals(estoqueMinimoParaEnviar({ colunaExiste: true, original: undefined, texto, naoAvisar: false }), { ok: false }, texto);
  }
});
