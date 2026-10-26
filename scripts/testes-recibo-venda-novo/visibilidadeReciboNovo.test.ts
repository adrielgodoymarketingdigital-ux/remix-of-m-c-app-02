// deno test --no-check scripts/testes-recibo-venda-novo/
// Regra única de quem recebe o recibo de venda novo (hoje: só admin do MecApp — freio de emergência).
import { assertEquals } from "jsr:@std/assert@1";
import { RECIBO_VENDA_NOVO_PARA_TODOS, reciboVendaNovoVisivelPara } from "../../src/lib/vendas/visibilidadeReciboNovo.ts";

Deno.test("recibo novo: só admin (freio de emergência)", () => {
  assertEquals(RECIBO_VENDA_NOVO_PARA_TODOS, false);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: true }), true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false }), false);
});
