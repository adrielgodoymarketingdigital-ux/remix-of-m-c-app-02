// deno test --no-check scripts/testes-whatsapp-ao-finalizar/
// Roda a função real de src/lib/ordemServico/whatsappAoFinalizar.ts.
import { assertEquals } from "jsr:@std/assert@1";
import { deveOferecerWhatsAppAoFinalizar } from "../../src/lib/ordemServico/whatsappAoFinalizar.ts";

const base = { novoStatus: "finalizado", statusAnterior: "em_andamento", emLote: false, mudou: true };

Deno.test("finalizado normal abre", () => {
  assertEquals(deveOferecerWhatsAppAoFinalizar(base), true);
});

Deno.test("statusAnterior desconhecido ainda abre", () => {
  assertEquals(deveOferecerWhatsAppAoFinalizar({ ...base, statusAnterior: undefined }), true);
  assertEquals(deveOferecerWhatsAppAoFinalizar({ ...base, statusAnterior: null }), true);
});

Deno.test("já era finalizado não abre", () => {
  assertEquals(deveOferecerWhatsAppAoFinalizar({ ...base, statusAnterior: "finalizado" }), false);
});

Deno.test("lote não abre", () => {
  assertEquals(deveOferecerWhatsAppAoFinalizar({ ...base, emLote: true }), false);
});

Deno.test("falha ao atualizar não abre", () => {
  assertEquals(deveOferecerWhatsAppAoFinalizar({ ...base, mudou: false }), false);
});

Deno.test("outros status não abrem", () => {
  for (const novoStatus of ["entregue", "garantia", "aguardando_retirada", "cancelada", "pendente", "Finalizado", ""]) {
    assertEquals(deveOferecerWhatsAppAoFinalizar({ ...base, novoStatus }), false, novoStatus);
  }
});
