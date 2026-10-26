// deno test --no-check scripts/testes-recibo-venda-novo/
// Regra única de quem recebe o recibo de venda novo (hoje: liberado a todos).
import { assertEquals } from "jsr:@std/assert@1";
import { RECIBO_VENDA_NOVO_PARA_TODOS, reciboVendaNovoVisivelPara } from "../../src/lib/vendas/visibilidadeReciboNovo.ts";

Deno.test("recibo novo: liberado a todos (admin ou não)", () => {
  assertEquals(RECIBO_VENDA_NOVO_PARA_TODOS, true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: true }), true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false }), true);
});
