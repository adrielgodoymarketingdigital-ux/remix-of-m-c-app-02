// deno test --no-check scripts/testes-recibo-venda-novo/
// Regra única de quem recebe o recibo de venda novo (hoje: só admin do MecApp).
import { assertEquals } from "jsr:@std/assert@1";
import { reciboVendaNovoVisivelPara } from "../../src/lib/vendas/visibilidadeReciboNovo.ts";

Deno.test("recibo novo: só admin", () => {
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: true }), true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false }), false);
});
