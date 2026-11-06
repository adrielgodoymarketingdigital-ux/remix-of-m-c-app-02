// deno test --no-check scripts/testes-fornecedores-layout/
// Nomes totalmente fictícios.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  ordenarFornecedoresPorNome,
  proximaOrdemNome,
} from "../../src/components/fornecedores/ordenacaoFornecedores.ts";

const lista = [
  { id: "1", nome: "zeta peças" },
  { id: "2", nome: "Ágata Fictícia" },
  { id: "3", nome: "beta 10" },
  { id: "4", nome: "Beta 2" },
  { id: "5", nome: "alfa" },
];
const ids = (l: { id: string }[]) => l.map((x) => x.id).join(",");

Deno.test("ciclo do clique: padrão → crescente → decrescente → padrão", () => {
  assertEquals(proximaOrdemNome("padrao"), "asc");
  assertEquals(proximaOrdemNome("asc"), "desc");
  assertEquals(proximaOrdemNome("desc"), "padrao");
});

Deno.test("padrão devolve a mesma lista, sem reordenar", () => {
  assertStrictEquals(ordenarFornecedoresPorNome(lista, "padrao"), lista);
});

Deno.test("crescente ignora acento e maiúscula e compara números pelo valor", () => {
  assertEquals(ids(ordenarFornecedoresPorNome(lista, "asc")), "2,5,4,3,1");
});

Deno.test("decrescente é o inverso", () => {
  assertEquals(ids(ordenarFornecedoresPorNome(lista, "desc")), "1,3,4,5,2");
});

Deno.test("não altera a lista original", () => {
  ordenarFornecedoresPorNome(lista, "asc");
  assertEquals(ids(lista), "1,2,3,4,5");
});

Deno.test("nomes iguais mantêm a ordem original; nome vazio vem primeiro", () => {
  const l = [{ id: "a", nome: "Igual" }, { id: "b", nome: "" }, { id: "c", nome: "igual" }];
  assertEquals(ids(ordenarFornecedoresPorNome(l, "asc")), "b,a,c");
});
