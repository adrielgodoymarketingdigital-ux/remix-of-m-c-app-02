// TZ=UTC deno test --no-check scripts/testes-troca-pdv/
// bloqueioEditarVendaComTroca (src/lib/vendas/trocaPDV.ts): "Editar venda" não
// refaz a troca nem as contas a receber; antes (24/10/2026) mudar o valor de
// uma venda com troca regravava a conta com o total cheio.
import { assertEquals } from "jsr:@std/assert@1";
import { MENSAGEM_EDITAR_VENDA_COM_TROCA, bloqueioEditarVendaComTroca } from "../../src/lib/vendas/trocaPDV.ts";

Deno.test("venda com troca: mudar valor ou forma é bloqueado", () => {
  assertEquals(bloqueioEditarVendaComTroca({ temTroca: true, mudaValor: true, mudaForma: false }), MENSAGEM_EDITAR_VENDA_COM_TROCA);
  assertEquals(bloqueioEditarVendaComTroca({ temTroca: true, mudaValor: false, mudaForma: true }), MENSAGEM_EDITAR_VENDA_COM_TROCA);
  assertEquals(MENSAGEM_EDITAR_VENDA_COM_TROCA, "Venda com troca: cancele e refaça");
});

Deno.test("venda com troca: outras mudanças (data prevista, nome) passam", () => {
  assertEquals(bloqueioEditarVendaComTroca({ temTroca: true, mudaValor: false, mudaForma: false }), null);
});

Deno.test("venda sem troca: edita como sempre", () => {
  assertEquals(bloqueioEditarVendaComTroca({ temTroca: false, mudaValor: true, mudaForma: true }), null);
});
