// deno test --no-check scripts/testes-pedidos-layout/
import { assertEquals } from "jsr:@std/assert@1";
import { resumoItensLista } from "../../src/lib/pedidos/listaComprasDesktop.ts";

const itens = (comprados: number, pendentes: number) => [
  ...Array.from({ length: comprados }, () => ({ concluido: true })),
  ...Array.from({ length: pendentes }, () => ({ concluido: false })),
];

Deno.test("resumo: lista vazia = tudo zero (sem divisão por zero)", () => {
  assertEquals(resumoItensLista([]), { total: 0, pendentes: 0, comprados: 0, percentualComprado: 0 });
});

Deno.test("resumo: conta pendentes e comprados", () => {
  assertEquals(resumoItensLista(itens(1, 2)), { total: 3, pendentes: 2, comprados: 1, percentualComprado: 33 });
  assertEquals(resumoItensLista(itens(0, 4)).percentualComprado, 0);
  assertEquals(resumoItensLista(itens(4, 0)).percentualComprado, 100);
});

Deno.test("resumo: só chega a 100% com tudo comprado (arredonda para baixo)", () => {
  assertEquals(resumoItensLista(itens(199, 1)).percentualComprado, 99);
  assertEquals(resumoItensLista(itens(2, 1)).percentualComprado, 66);
});
