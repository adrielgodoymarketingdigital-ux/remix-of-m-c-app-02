// TZ=America/Sao_Paulo deno test --no-check --no-lock scripts/testes-recorrencia/
// gerarProximaRecorrente com Supabase falso (sem rede).
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  avisoDaProximaRecorrente,
  gerarProximaRecorrente,
} from "../../src/lib/contas/gerarProximaRecorrente.ts";
import { type Linha, SupabaseFalso } from "./supabaseFalso.ts";

const conta = (x: Linha = {}): Linha => ({
  id: "c1",
  user_id: "dono",
  empresa_id: null,
  nome: "Aluguel",
  tipo: "pagar",
  valor: 1500,
  data: "2026-11-10",
  status: "pago",
  recorrente: true,
  categoria: "Aluguel",
  descricao: "sala 2",
  fornecedor_id: "forn-1",
  usa_historico_pagamentos: true,
  ...x,
});
const gerar = (db: SupabaseFalso, x: Partial<Parameters<typeof gerarProximaRecorrente>[1]> = {}) =>
  gerarProximaRecorrente(db, { contaId: "c1", recorrenteLocal: true, targetUserId: "dono", ...x });
const novas = (db: SupabaseFalso) => db.contas().filter((c) => c.id !== "c1" && String(c.id).startsWith("contas-novo"));

Deno.test("modelo novo quitado gera a próxima com os campos da origem e o mesmo modelo", async () => {
  const db = new SupabaseFalso({ contas: [conta()] });
  const r = await gerar(db);
  assertEquals(r, { status: "gerada", data: "2026-12-10", ano: 2026, mes: 12 });
  const [n] = novas(db);
  const insert = db.chamadas.find((c) => c.ops[0][0] === "insert")!.ops[0][1];
  assertEquals(insert, {
    nome: "Aluguel", tipo: "pagar", valor: 1500, data: "2026-12-10", status: "pendente", recorrente: true,
    categoria: "Aluguel", descricao: "sala 2", fornecedor_id: "forn-1", empresa_id: null, user_id: "dono",
    usa_historico_pagamentos: true,
  });
  assertEquals([n.valor_pago, n.data_pagamento, n.status], [0, null, "pendente"]);
});

Deno.test("modelo antigo: payload igual ao insert de antes (sem usa_historico_pagamentos), compra_estoque só se true", async () => {
  const db = new SupabaseFalso({ contas: [conta({ usa_historico_pagamentos: false, compra_estoque: true })] });
  await gerar(db);
  const insert = db.chamadas.find((c) => c.ops[0][0] === "insert")!.ops[0][1] as Linha;
  assert(!("usa_historico_pagamentos" in insert));
  assertEquals(insert.compra_estoque, true);
  assertEquals(novas(db)[0].usa_historico_pagamentos, false);
});

Deno.test("não recorrente (local): NENHUMA chamada ao banco", async () => {
  for (const recorrenteLocal of [false, null, undefined]) {
    const db = new SupabaseFalso({ contas: [conta({ recorrente: false })] });
    const r = await gerar(db, { recorrenteLocal });
    assertEquals(r, { status: "ignorada", motivo: "nao_recorrente" });
    assertEquals(db.chamadas, []);
  }
});

Deno.test("já quitada antes / conta virtual: nenhuma chamada", async () => {
  const db = new SupabaseFalso({ contas: [conta()] });
  assertEquals((await gerar(db, { quitadaAntes: true })).status, "ignorada");
  assertEquals((await gerar(db, { contaId: "venda_x" })).status, "ignorada");
  assertEquals(db.chamadas, []);
});

Deno.test("decide pelo status do BANCO: pendente (parcial) não gera, mesmo com recorrente local", async () => {
  const db = new SupabaseFalso({ contas: [conta({ status: "pendente", valor_pago: 500 })] });
  assertEquals(await gerar(db), { status: "ignorada", motivo: "nao_quitada" });
  assertEquals(novas(db), []);
});

Deno.test("banco diz não recorrente: não gera", async () => {
  const db = new SupabaseFalso({ contas: [conta({ recorrente: false })] });
  assertEquals(await gerar(db), { status: "ignorada", motivo: "nao_recorrente" });
});

Deno.test("já existe (inclusive a gerada 1 dia antes pelo código antigo, nome com outra caixa): não insere", async () => {
  for (const existente of [
    { id: "c2", nome: "Aluguel", data: "2026-12-10" },
    { id: "c2", nome: " ALUGUEL ", data: "2026-12-09" },
  ]) {
    const db = new SupabaseFalso({ contas: [conta(), conta({ ...existente, status: "pendente" })] });
    assertEquals(await gerar(db), { status: "ja_existe", data: "2026-12-10" });
    assert(!db.chamadas.some((c) => c.ops[0][0] === "insert"));
  }
});

Deno.test("série de outra filial / outro tipo não bloqueia", async () => {
  const db = new SupabaseFalso({
    contas: [
      conta({ empresa_id: "f1" }),
      conta({ id: "x1", empresa_id: "f2", data: "2026-12-10", status: "pendente" }),
      conta({ id: "x2", empresa_id: "f1", tipo: "receber", data: "2026-12-10", status: "pendente" }),
    ],
  });
  assertEquals((await gerar(db)).status, "gerada");
  assertEquals(novas(db)[0].empresa_id, "f1");
});

Deno.test("dia fixo 31: 28/02 paga (série com 31/01) gera 31/03", async () => {
  const db = new SupabaseFalso({
    contas: [
      conta({ id: "jan", data: "2027-01-31" }),
      conta({ id: "c1", data: "2027-02-28" }),
    ],
  });
  assertEquals((await gerar(db)).status, "gerada");
  assertEquals(novas(db)[0].data, "2027-03-31");
});

Deno.test("dia fixo: datas de outra série com o mesmo dono não interferem", async () => {
  const db = new SupabaseFalso({
    contas: [conta({ id: "outra", nome: "Internet", data: "2027-01-31" }), conta({ id: "c1", data: "2027-02-28" })],
  });
  await gerar(db);
  assertEquals(novas(db)[0].data, "2027-03-28");
});

Deno.test("clique duplo: duas gerações ao mesmo tempo criam UMA próxima", async () => {
  const db = new SupabaseFalso({ contas: [conta()] });
  const [a, b] = await Promise.all([gerar(db), gerar(db)]);
  assertEquals([a.status, b.status].sort(), ["gerada", "ja_existe"]);
  assertEquals(novas(db).length, 1);
  assertEquals((await gerar(db)).status, "ja_existe"); // e de novo depois
  assertEquals(novas(db).length, 1);
});

Deno.test("falha no insert: status erro, nada inserido, sem aviso de sucesso", async () => {
  const db = new SupabaseFalso({ contas: [conta()] });
  db.falhar((c) => c.ops[0][0] === "insert");
  const r = await gerar(db);
  assertEquals(r, { status: "erro", mensagem: "falha simulada" });
  assertEquals(novas(db), []);
  const aviso = avisoDaProximaRecorrente(r, "Aluguel")!;
  assertEquals(aviso.variant, "destructive");
  assert(aviso.title !== "Conta recorrente gerada");
  assert(aviso.description.includes("O pagamento foi registrado"));
});

Deno.test("falha na leitura (conta ou série): erro, sem insert, não lança", async () => {
  for (const qual of [0, 1]) {
    const db = new SupabaseFalso({ contas: [conta()] });
    let n = 0;
    db.falhar(() => n++ === qual);
    assertEquals((await gerar(db)).status, "erro");
    assertEquals(novas(db), []);
  }
});

Deno.test("aviso: sucesso só para gerada; nada para ignorada / ja_existe", () => {
  assertEquals(avisoDaProximaRecorrente({ status: "gerada", data: "2026-12-10", ano: 2026, mes: 12 }, "Aluguel"), {
    title: "Conta recorrente gerada",
    description: 'A próxima parcela de "Aluguel" foi criada para dezembro de 2026.',
  });
  assertEquals(avisoDaProximaRecorrente({ status: "ja_existe", data: "x" }, "A"), null);
  assertEquals(avisoDaProximaRecorrente({ status: "ignorada", motivo: "nao_quitada" }, "A"), null);
});
