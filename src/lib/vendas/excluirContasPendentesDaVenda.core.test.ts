// node --test src/lib/vendas/excluirContasPendentesDaVenda.core.test.ts
// Contas a receber da venda cancelada, com banco FALSO (sem rede, nada é gravado).
import { test } from "node:test";
import assert from "node:assert/strict";
import { excluirContasPendentesDaVendaCore } from "./excluirContasPendentesDaVenda.core.ts";
import type { ClienteBancoLike } from "./reconhecerSegundaForma.core.ts";

type Linha = Record<string, unknown>;
interface Opcoes {
  /** O DELETE devolve erro (RLS, rede). */
  erroNoDelete?: boolean;
  /** Antes do DELETE, simula baixa feita ao mesmo tempo nesta conta. */
  baixaConcorrente?: string;
}
interface Chamada { op: "select" | "delete"; filtros: string[]; ids: string[] }

const U = "user-1";
const OUTRO = "user-2";
const V1 = "11111111-1111-1111-1111-111111111111";
const V2 = "22222222-2222-2222-2222-222222222222";
const V3 = "33333333-3333-3333-3333-333333333333";

const conta = (id: string, vendaId: string, extra: Linha = {}): Linha => ({
  id, user_id: U, tipo: "receber", descricao: `venda_id:${vendaId}`, status: "pendente", valor_pago: 0, ...extra,
});

/** Subset do supabase-js usado: select/delete + eq/in + select após delete. NULL nunca casa. */
function bancoFalso(contas: Linha[], o: Opcoes = {}) {
  const chamadas: Chamada[] = [];
  const client = {
    from(tabela: string) {
      assert.equal(tabela, "contas");
      let op: "select" | "delete" = "select";
      const filtros: Array<(r: Linha) => boolean> = [];
      const nomes: string[] = [];
      const qb = {
        select() { return qb; },
        delete() { op = "delete"; return qb; },
        eq(c: string, v: unknown) { nomes.push(`${c}=${String(v)}`); filtros.push((r) => r[c] != null && r[c] === v); return qb; },
        in(c: string, arr: unknown[]) { nomes.push(`${c} in`); filtros.push((r) => r[c] != null && arr.includes(r[c])); return qb; },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
          return Promise.resolve().then(() => {
            if (op === "delete" && o.baixaConcorrente) {
              const alvo = contas.find((c) => c.id === o.baixaConcorrente);
              if (alvo) Object.assign(alvo, { valor_pago: 10 });
            }
            const alvo = contas.filter((r) => filtros.every((f) => f(r)));
            chamadas.push({ op, filtros: nomes, ids: alvo.map((r) => String(r.id)) });
            if (op === "delete") {
              if (o.erroNoDelete) return { data: null, error: { message: "permission denied" } };
              for (const r of alvo) contas.splice(contas.indexOf(r), 1);
            }
            return { data: alvo.map((r) => ({ ...r })), error: null };
          }).then(res, rej);
        },
      };
      return qb;
    },
  };
  return { client: client as unknown as ClienteBancoLike, chamadas, contas };
}

test("só pendente: apaga a conta da linha cancelada", async () => {
  const b = bancoFalso([conta("c1", V1), conta("c-outra-venda", V2)]);
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  assert.deepEqual(r, { status: "ok", excluidas: 1, preservadasRecebidas: 0 });
  assert.deepEqual(b.contas.map((c) => c.id), ["c-outra-venda"]);
});

test("DELETE repete status=pendente, valor_pago=0, tipo e user_id", async () => {
  const b = bancoFalso([conta("c1", V1)]);
  await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  const del = b.chamadas.find((c) => c.op === "delete");
  assert.ok(del);
  for (const f of ["status=pendente", "valor_pago=0", "tipo=receber", `user_id=${U}`, "id in"]) {
    assert.ok(del.filtros.includes(f), `faltou filtro ${f}`);
  }
});

test("recebida: não apaga e conta como preservada", async () => {
  const b = bancoFalso([conta("c1", V1, { status: "recebido", valor_pago: 100 })]);
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  assert.deepEqual(r, { status: "ok", excluidas: 0, preservadasRecebidas: 1 });
  assert.equal(b.contas.length, 1);
  assert.equal(b.chamadas.some((c) => c.op === "delete"), false);
});

test("paga (status 'pago') também fica", async () => {
  const b = bancoFalso([conta("c1", V1, { status: "pago" })]);
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  assert.deepEqual(r, { status: "ok", excluidas: 0, preservadasRecebidas: 1 });
  assert.equal(b.contas.length, 1);
});

test("parcial (pendente com valor_pago > 0): não apaga, preserva o histórico", async () => {
  const b = bancoFalso([conta("c1", V1, { valor_pago: "30.00" })]);
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  assert.deepEqual(r, { status: "ok", excluidas: 0, preservadasRecebidas: 1 });
  assert.equal(b.contas.length, 1);
});

test("sem conta: nada a fazer, sem DELETE", async () => {
  const b = bancoFalso([conta("c-outra", V2)]);
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  assert.deepEqual(r, { status: "ok", excluidas: 0, preservadasRecebidas: 0 });
  assert.equal(b.chamadas.some((c) => c.op === "delete"), false);
  assert.equal(b.contas.length, 1);
});

test("sem ids ou sem usuário: não consulta o banco", async () => {
  const b = bancoFalso([conta("c1", V1)]);
  assert.deepEqual(await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [], userId: U }), { status: "ok", excluidas: 0, preservadasRecebidas: 0 });
  assert.deepEqual(await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: null }), { status: "ok", excluidas: 0, preservadasRecebidas: 0 });
  assert.equal(b.chamadas.length, 0);
});

test("troca com várias linhas: apaga as pendentes, preserva a recebida", async () => {
  const b = bancoFalso([
    conta("c1", V1),
    conta("c2", V2, { status: "recebido", valor_pago: 50 }),
    conta("c3", V3),
  ]);
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1, V2, V3], userId: U });
  assert.deepEqual(r, { status: "ok", excluidas: 2, preservadasRecebidas: 1 });
  assert.deepEqual(b.contas.map((c) => c.id), ["c2"]);
});

test("troca no laço (uma chamada por linha, como no cancelarVenda) dá o mesmo resultado", async () => {
  const b = bancoFalso([conta("c1", V1), conta("c2", V2, { valor_pago: 5 }), conta("c3", V3)]);
  let excluidas = 0;
  let preservadas = 0;
  for (const id of [V1, V2, V3]) {
    const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [id], userId: U });
    assert.equal(r.status, "ok");
    excluidas += r.excluidas;
    preservadas += r.preservadasRecebidas;
  }
  assert.equal(excluidas, 2);
  assert.equal(preservadas, 1);
  assert.deepEqual(b.contas.map((c) => c.id), ["c2"]);
});

test("erro no DELETE: devolve erro e não apaga nada", async () => {
  const b = bancoFalso([conta("c1", V1), conta("c2", V1, { status: "recebido", valor_pago: 10 })], { erroNoDelete: true });
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  assert.deepEqual(r, { status: "erro", mensagem: "permission denied", excluidas: 0, preservadasRecebidas: 1 });
  assert.equal(b.contas.length, 2);
});

test("baixa concorrente entre leitura e DELETE: a conta fica e vira aviso de erro", async () => {
  const b = bancoFalso([conta("c1", V1), conta("c2", V1)], { baixaConcorrente: "c2" });
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  assert.equal(r.status, "erro");
  assert.equal(r.excluidas, 1);
  assert.deepEqual(b.contas.map((c) => c.id), ["c2"]);
});

test("ignora conta a pagar, de outro usuário e valor_pago nulo", async () => {
  const b = bancoFalso([
    conta("c-pagar", V1, { tipo: "pagar" }),
    conta("c-outro", V1, { user_id: OUTRO }),
    conta("c-nulo", V1, { valor_pago: null }),
  ]);
  const r = await excluirContasPendentesDaVendaCore(b.client, { vendaIds: [V1], userId: U });
  // c-nulo não tem valor_pago = 0: fica (conta como preservada, não apaga às cegas).
  assert.deepEqual(r, { status: "ok", excluidas: 0, preservadasRecebidas: 1 });
  assert.equal(b.contas.length, 3);
});
