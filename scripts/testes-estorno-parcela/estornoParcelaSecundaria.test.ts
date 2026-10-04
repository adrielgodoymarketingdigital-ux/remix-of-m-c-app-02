// deno test --no-check scripts/testes-estorno-parcela/
// Roda as funções reais de src/lib/vendas/estornoParcelaSecundaria.core.ts contra
// o banco em memória das edge functions. Caso real: Andystts25 (out/2026) — parcela
// do iPhone XS recebida, venda principal cancelada, conta a receber excluída.
import { assertEquals } from "jsr:@std/assert@1";
import { bancoFake } from "../../supabase/functions/_shared/testes/bancoFake.ts";
import {
  cancelarParcelaDaContaExcluidaCore,
  estornarParcelaSecundariaCore,
  gruposComPrincipalAtivaCore,
  vendaIdDaDescricao,
} from "../../src/lib/vendas/estornoParcelaSecundaria.core.ts";

type Linha = Record<string, unknown>;
const U = "b6994be0-faa7-461d-8775-1b91d73592da";
const SEC = "11111111-1111-4111-8111-111111111111";
const AGORA = "2026-10-04T15:00:00.000Z";

function banco(extra: Linha[] = []) {
  const tabelas: Record<string, Linha[]> = {
    vendas: [
      { id: "principal-1", user_id: U, grupo_venda: "g1", observacoes: null, cancelada: true, deleted_at: "2026-10-01T00:00:00Z" },
      { id: SEC, user_id: U, grupo_venda: "g1", observacoes: "pagamento_duplo_secundario", recebido: true, cancelada: false, deleted_at: null, total: 850, custo_unitario: 0 },
      ...extra,
    ],
  };
  return { tabelas, db: bancoFake(tabelas) };
}
const linha = (t: Record<string, Linha[]>, id: string) => t.vendas.find((v) => v.id === id)!;

Deno.test("estornar pelo aviso: cancela a parcela secundária órfã", async () => {
  const { tabelas, db } = banco();
  const r = await estornarParcelaSecundariaCore(db, { vendaId: SEC, userId: U }, AGORA);
  assertEquals(r, { ok: true });
  assertEquals(linha(tabelas, SEC).cancelada, true);
  assertEquals(linha(tabelas, SEC).data_cancelamento, AGORA);
});

Deno.test("estornar não mexe em venda comum (não secundária) nem em linha de outro usuário", async () => {
  const { tabelas, db } = banco([{ id: "comum", user_id: U, observacoes: null, cancelada: false, deleted_at: null }]);
  assertEquals((await estornarParcelaSecundariaCore(db, { vendaId: "comum", userId: U }, AGORA)).ok, false);
  assertEquals(linha(tabelas, "comum").cancelada, false);
  assertEquals((await estornarParcelaSecundariaCore(db, { vendaId: SEC, userId: "outro-usuario" }, AGORA)).ok, false);
  assertEquals(linha(tabelas, SEC).cancelada, false);
});

Deno.test("estornar parcela já cancelada devolve erro, sem regravar", async () => {
  const { tabelas, db } = banco();
  linha(tabelas, SEC).cancelada = true;
  const r = await estornarParcelaSecundariaCore(db, { vendaId: SEC, userId: U }, AGORA);
  assertEquals(r.ok, false);
  assertEquals(linha(tabelas, SEC).data_cancelamento, undefined);
});

Deno.test("excluir conta a receber da parcela cancela a parcela junto", async () => {
  const { tabelas, db } = banco();
  const r = await cancelarParcelaDaContaExcluidaCore(db, { descricao: `Parcela 2/2 — venda_id:${SEC}`, userId: U }, AGORA);
  assertEquals(r, { status: "parcela_cancelada", vendaId: SEC });
  assertEquals(linha(tabelas, SEC).cancelada, true);
});

Deno.test("excluir conta sem venda_id ou de venda comum não cancela nada", async () => {
  const comumId = "22222222-2222-4222-8222-222222222222";
  const { tabelas, db } = banco([{ id: comumId, user_id: U, observacoes: null, cancelada: false, deleted_at: null }]);
  assertEquals(await cancelarParcelaDaContaExcluidaCore(db, { descricao: "Aluguel", userId: U }, AGORA), { status: "sem_parcela" });
  assertEquals(await cancelarParcelaDaContaExcluidaCore(db, { descricao: `venda_id:${comumId}`, userId: U }, AGORA), { status: "sem_parcela" });
  assertEquals(linha(tabelas, comumId).cancelada, false);
  assertEquals(linha(tabelas, SEC).cancelada, false);
});

Deno.test("botão Estornar só aparece quando a venda principal não está ativa", async () => {
  const { db } = banco([
    { id: "principal-2", user_id: U, grupo_venda: "g2", observacoes: null, cancelada: false, deleted_at: null },
    { id: "sec-2", user_id: U, grupo_venda: "g2", observacoes: "pagamento_duplo_secundario", cancelada: false, deleted_at: null },
  ]);
  const ativos = await gruposComPrincipalAtivaCore(db, U, ["g1", "g2"]);
  assertEquals([...ativos], ["g2"]); // g1: principal cancelada/excluída → pode estornar; g2: principal ativa → confirmar custo
});

Deno.test("venda_id da descrição da conta", () => {
  assertEquals(vendaIdDaDescricao(`Recebimento venda_id:${SEC} (2ª forma)`), SEC);
  assertEquals(vendaIdDaDescricao("sem vínculo"), null);
  assertEquals(vendaIdDaDescricao(null), null);
});
