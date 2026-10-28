// deno test --no-check scripts/testes-situacao-estoque/
// Roda a função real de src/lib/estoque/situacaoEstoque.ts.
import { assertEquals } from "jsr:@std/assert@1";
import {
  descricaoFaixaBaixoPDF,
  LIMITE_PADRAO_LISTA_PRODUTOS,
  LIMITE_PADRAO_PDF_MENOR_ESTOQUE,
  LIMITE_PADRAO_RELATORIO_VENDIDOS,
  limiteEfetivo,
  situacaoEstoque,
} from "../../src/lib/estoque/situacaoEstoque.ts";

const LISTA = LIMITE_PADRAO_LISTA_PRODUTOS;

Deno.test("negativo e zero são fixos, com ou sem limite", () => {
  for (const limite of [undefined, null, 0, 3, 10]) {
    assertEquals(situacaoEstoque(-1, limite, LISTA), "negativo");
    assertEquals(situacaoEstoque(-50, limite, LISTA), "negativo");
    assertEquals(situacaoEstoque(0, limite, LISTA), "sem_estoque");
  }
});

Deno.test("quantidade vazia ou inválida conta como 0", () => {
  assertEquals(situacaoEstoque(null, undefined, LISTA), "sem_estoque");
  assertEquals(situacaoEstoque(undefined, undefined, LISTA), "sem_estoque");
  assertEquals(situacaoEstoque(Number.NaN, undefined, LISTA), "sem_estoque");
});

Deno.test("sem limite: usa o padrão da tela (lista = 4)", () => {
  assertEquals(situacaoEstoque(1, undefined, LISTA), "baixo");
  assertEquals(situacaoEstoque(3, undefined, LISTA), "baixo");
  assertEquals(situacaoEstoque(4, null, LISTA), "baixo");
  assertEquals(situacaoEstoque(5, null, LISTA), "ok");
});

Deno.test("com limite: 'X ou menos' é baixo", () => {
  assertEquals(situacaoEstoque(1, 3, LISTA), "baixo");
  assertEquals(situacaoEstoque(3, 3, LISTA), "baixo");
  assertEquals(situacaoEstoque(4, 3, LISTA), "ok");
  assertEquals(situacaoEstoque(5, 10, LISTA), "baixo");
  assertEquals(situacaoEstoque(11, 10, LISTA), "ok");
});

Deno.test("limite 0 = nunca avisa baixo", () => {
  assertEquals(situacaoEstoque(1, 0, LISTA), "ok");
  assertEquals(situacaoEstoque(4, 0, LISTA), "ok");
  assertEquals(situacaoEstoque(0, 0, LISTA), "sem_estoque");
});

Deno.test("limite inválido cai no padrão da tela", () => {
  assertEquals(situacaoEstoque(4, -1, LISTA), "baixo");
  assertEquals(situacaoEstoque(4, Number.NaN, LISTA), "baixo");
  assertEquals(situacaoEstoque(4, 2.5, LISTA), "baixo");
});

// Contas que existiam nas telas antes da fase 1, copiadas letra por letra.
const antigoLista = (q: number) => ({
  semEstoque: q === 0,
  negativo: q < 0,
  baixo: q > 0 && q < 5,
  saudavel: q >= 5,
});
const antigoPdf = (q: number) => ({ semEstoque: q === 0, baixo: q > 0 && q <= 3 });
const antigoRelatorioVermelho = (q: number) => q < 5;
// Cor da coluna "Qtd" em cada linha do PDF (didParseCell).
const antigoPdfCor = (q: number) => (q === 0 ? "vermelho" : q <= 3 ? "laranja" : "nenhuma");

Deno.test("sem configuração: idêntico às contas antigas de cada tela (-20 a 100)", () => {
  for (let q = -20; q <= 100; q++) {
    const lista = situacaoEstoque(q, undefined, LIMITE_PADRAO_LISTA_PRODUTOS);
    assertEquals(
      {
        semEstoque: lista === "sem_estoque",
        negativo: lista === "negativo",
        baixo: lista === "baixo",
        saudavel: lista === "ok",
      },
      antigoLista(q),
      `lista q=${q}`,
    );

    const pdf = situacaoEstoque(q, undefined, LIMITE_PADRAO_PDF_MENOR_ESTOQUE);
    assertEquals({ semEstoque: pdf === "sem_estoque", baixo: pdf === "baixo" }, antigoPdf(q), `pdf q=${q}`);

    const corNova = pdf === "sem_estoque" ? "vermelho" : pdf === "baixo" || pdf === "negativo" ? "laranja" : "nenhuma";
    assertEquals(corNova, antigoPdfCor(q), `cor da linha do pdf q=${q}`);

    const rel = situacaoEstoque(q, undefined, LIMITE_PADRAO_RELATORIO_VENDIDOS);
    assertEquals(rel !== "ok", antigoRelatorioVermelho(q), `relatório q=${q}`);
  }
});

Deno.test("limite efetivo: configurado válido vence o padrão da tela", () => {
  assertEquals(limiteEfetivo(undefined, 4), 4);
  assertEquals(limiteEfetivo(null, 3), 3);
  assertEquals(limiteEfetivo(0, 4), 0);
  assertEquals(limiteEfetivo(10, 3), 10);
  assertEquals(limiteEfetivo(-1, 3), 3);
});

Deno.test("subtítulo do cartão do PDF", () => {
  assertEquals(descricaoFaixaBaixoPDF(undefined), "quantidade 1 a 3"); // igual a antes
  assertEquals(descricaoFaixaBaixoPDF(null), "quantidade 1 a 3");
  assertEquals(descricaoFaixaBaixoPDF(0), "aviso desligado");
  assertEquals(descricaoFaixaBaixoPDF(1), "quantidade 1");
  assertEquals(descricaoFaixaBaixoPDF(7), "quantidade 1 a 7");
});

Deno.test("limite da loja vale igual nas três telas", () => {
  for (const padrao of [LIMITE_PADRAO_LISTA_PRODUTOS, LIMITE_PADRAO_PDF_MENOR_ESTOQUE, LIMITE_PADRAO_RELATORIO_VENDIDOS]) {
    assertEquals(situacaoEstoque(7, 7, padrao), "baixo");
    assertEquals(situacaoEstoque(8, 7, padrao), "ok");
    assertEquals(situacaoEstoque(1, 0, padrao), "ok");
    assertEquals(situacaoEstoque(0, 0, padrao), "sem_estoque");
    assertEquals(situacaoEstoque(-1, 0, padrao), "negativo");
  }
});
