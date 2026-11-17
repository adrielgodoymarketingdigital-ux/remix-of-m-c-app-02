// useContas REAL (antes x novo) com Supabase falso. Rodar via run.sh (gera os bundles).
// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals } from "jsr:@std/assert@1";
import { type Linha, SupabaseFalso } from "../supabaseFalso.ts";

// Sem HOOK_BUNDLES (ex.: deno test na pasta toda), os testes aparecem como ignorados.
let DIR: string | undefined;
try {
  DIR = Deno.env.get("HOOK_BUNDLES");
} catch {
  DIR = undefined;
}
const antes = DIR ? await import(`file://${DIR}/antes.mjs`) : null;
const novo = DIR ? await import(`file://${DIR}/novo.mjs`) : null;
const teste = (name: string, fn: () => Promise<void>) => Deno.test({ name, ignore: !DIR, fn });

const g = globalThis as any;
g.window = { dispatchEvent: (e: Event) => g.__eventos.push(e.type) };

type Hook = any;
interface Execucao {
  db: SupabaseFalso;
  toasts: Array<{ title: string; description?: string; variant?: string }>;
  eventos: string[];
  retorno: unknown;
}

const c = (id: string, x: Linha = {}): Linha => ({
  id,
  user_id: "dono",
  empresa_id: null,
  nome: `Conta ${id}`,
  tipo: "pagar",
  valor: 100,
  data: "2026-11-10",
  status: "pendente",
  recorrente: false,
  usa_historico_pagamentos: false,
  valor_pago: 0,
  categoria: null,
  descricao: null,
  fornecedor_id: null,
  created_at: "2026-11-01T12:00:00Z",
  ...x,
});

async function executar(
  versao: any,
  contas: Linha[],
  acao: (h: Hook, lista: Linha[]) => Promise<unknown>,
  opcoes: { lista?: Linha[]; falhar?: (ch: any) => boolean; authUser?: string; target?: string | null } = {},
): Promise<Execucao> {
  const db = new SupabaseFalso({ contas, pagamentos_contas: [] }, opcoes.authUser ?? "dono");
  if (opcoes.falhar) db.falhar(opcoes.falhar);
  g.__sb = db;
  g.__toasts = [];
  g.__eventos = [];
  g.__targetUserId = opcoes.target === undefined ? null : opcoes.target;
  g.__empresaVisao = null;
  const lista = opcoes.lista ?? db.contas();
  g.__reactIdx = 0;
  g.__reactEstados = [lista];
  const h = versao.useContas();
  const retorno = await acao(h, lista);
  return { db, toasts: g.__toasts, eventos: g.__eventos, retorno };
}

const contasNovas = (e: Execucao, idsOrigem: string[]) =>
  e.db.contas().filter((x) => !idsOrigem.includes(String(x.id)));
const semId = (l: Linha) => {
  const { id: _id, ...resto } = l;
  return resto;
};

// ============================================================================
// 1. Conta NÃO recorrente: chamadas, toasts, eventos e banco IDÊNTICOS antes x novo
// ============================================================================
const base = [
  c("a"), // antigo, pagar
  c("b", { tipo: "receber" }), // antigo, receber
  c("n", { usa_historico_pagamentos: true }), // novo, pagar
  c("n2", { usa_historico_pagamentos: true, tipo: "receber" }), // novo, receber
  c("pago", { status: "pago", data_pagamento: "2026-11-05" }),
];
const hoje = "2026-11-17";
const cenariosNaoRecorrentes: Array<[string, (h: Hook, l: Linha[]) => Promise<unknown>, { lista?: Linha[] }?]> = [
  ["marcarComoPaga antigo (pagar)", (h) => h.marcarComoPaga("a", "pagar", "pix")],
  ["marcarComoPaga antigo (receber)", (h) => h.marcarComoPaga("b", "receber")],
  ["marcarComoPaga novo (quitação pelo histórico)", (h) => h.marcarComoPaga("n", "pagar", "dinheiro")],
  ["marcarComoPaga conta já paga", (h) => h.marcarComoPaga("pago", "pagar")],
  ["registrarPagamentoParcial parcial", (h) => h.registrarPagamentoParcial("n", { valor: 30, data: hoje })],
  ["registrarPagamentoParcial que quita", (h) => h.registrarPagamentoParcial("n2", { valor: 100, data: hoje, observacao: "Quitação" })],
  ["marcarVariasComoPaga (novo + antigo, pagar + receber)", (h) => h.marcarVariasComoPaga(["a", "b", "n", "n2"])],
  ["criarConta já paga", (h) => h.criarConta({ nome: "Luz", tipo: "pagar", valor: 80, data: hoje, status: "pago", recorrente: false } as any)],
  ["criarConta com entrada parcial", (h) => h.criarConta({ nome: "Luz", tipo: "pagar", valor: 80, data: hoje, status: "pendente", recorrente: false, valor_pago: 20 } as any)],
  ["criarConta pendente", (h) => h.criarConta({ nome: "Luz", tipo: "pagar", valor: 80, data: hoje, status: "pendente", recorrente: false } as any)],
  ["atualizarConta mudando para pago (edição)", (h) => h.atualizarConta("a", { status: "pago", recorrente: false, nome: "Conta a" } as any)],
  ["atualizarConta mudando para recebido", (h) => h.atualizarConta("b", { status: "recebido" } as any)],
  ["atualizarConta sem mudar status", (h) => h.atualizarConta("a", { nome: "Outro nome" } as any)],
  ["ficha: marcarComoPaga com conta informada (sem lista)", (h, l) => h.marcarComoPaga("n", "pagar", undefined, l.find((x) => x.id === "n") ?? base[2]), { lista: [] }],
  ["ficha: marcarVariasComoPaga com contas informadas", (h) => h.marcarVariasComoPaga(["a", "n"], base as any), { lista: [] }],
];

for (const [nome, acao, opc] of cenariosNaoRecorrentes) {
  teste(`não recorrente idêntico antes x novo: ${nome}`, async () => {
    const x = await executar(antes, base, acao, opc);
    const y = await executar(novo, base, acao, opc);
    assertEquals(y.db.chamadas, x.db.chamadas, "chamadas ao banco");
    assertEquals(y.toasts, x.toasts, "toasts");
    assertEquals(y.eventos, x.eventos, "eventos");
    assertEquals(y.db.tabelas, x.db.tabelas, "banco final");
    assertEquals(y.retorno, x.retorno, "retorno");
    assert(x.db.chamadas.length > 0);
  });
}

// ============================================================================
// 2. Recorrentes
// ============================================================================
const rec = (id: string, x: Linha = {}) => c(id, { recorrente: true, nome: "Aluguel", categoria: "Aluguel", fornecedor_id: "forn-1", ...x });
const ultimoToast = (e: Execucao) => e.toasts[e.toasts.length - 1];

teste("CAUSA no hook real: modelo novo quitado — antes NÃO gerava, novo gera", async () => {
  const contas = [rec("n", { usa_historico_pagamentos: true })];
  const x = await executar(antes, contas, (h) => h.marcarComoPaga("n", "pagar", "pix"));
  const y = await executar(novo, contas, (h) => h.marcarComoPaga("n", "pagar", "pix"));
  assertEquals(contasNovas(x, ["n"]).length, 0, "antes: a próxima não nascia (o defeito relatado)");
  const [p] = contasNovas(y, ["n"]);
  assertEquals(
    [p.data, p.status, p.recorrente, p.usa_historico_pagamentos, p.valor_pago, p.data_pagamento, p.user_id, p.fornecedor_id],
    ["2026-12-10", "pendente", true, true, 0, null, "dono", "forn-1"],
  );
  assertEquals(ultimoToast(y).title, "Conta recorrente gerada");
  assertEquals(y.retorno, true);
});

teste("modelo novo pelo botão Pagar (registrarPagamentoParcial do diálogo) gera; parcial não gera", async () => {
  const contas = [rec("n", { usa_historico_pagamentos: true })];
  const total = await executar(novo, contas, (h) => h.registrarPagamentoParcial("n", { valor: 100, data: "2026-11-17" }));
  assertEquals(contasNovas(total, ["n"]).length, 1);
  const parcial = await executar(novo, contas, (h) => h.registrarPagamentoParcial("n", { valor: 40, data: "2026-11-17" }));
  assertEquals(contasNovas(parcial, ["n"]).length, 0);
  assertEquals(parcial.db.contas()[0].status, "pendente");
  assert(!parcial.toasts.some((t) => t.title === "Conta recorrente gerada"));
});

teste("parcial e depois o resto: gera só na quitação", async () => {
  const contas = [rec("n", { usa_historico_pagamentos: true })];
  const e = await executar(novo, contas, async (h) => {
    await h.registrarPagamentoParcial("n", { valor: 40, data: "2026-11-17" });
    await h.registrarPagamentoParcial("n", { valor: 60, data: "2026-11-18" });
  });
  assertEquals(contasNovas(e, ["n"]).length, 1);
});

teste("modelo antigo: mesmo resultado de antes, agora pela função única", async () => {
  const contas = [rec("a", { empresa_id: "f1", descricao: "sala", compra_estoque: true })];
  const x = await executar(antes, contas, (h) => h.marcarComoPaga("a", "pagar"));
  const y = await executar(novo, contas, (h) => h.marcarComoPaga("a", "pagar"));
  const [px] = contasNovas(x, ["a"]);
  const [py] = contasNovas(y, ["a"]);
  assertEquals(semId(py), semId(px));
  assertEquals([py.empresa_id, py.compra_estoque, py.usa_historico_pagamentos], ["f1", true, false]);
  const insertAntes = x.db.chamadas.find((ch) => ch.ops[0][0] === "insert")!.ops[0][1];
  const insertNovo = y.db.chamadas.find((ch) => ch.ops[0][0] === "insert")!.ops[0][1];
  assertEquals(insertNovo, insertAntes, "payload do insert igual ao de antes");
  assertEquals(ultimoToast(y), ultimoToast(x));
});

teste("várias de uma vez: uma próxima por conta quitada; falha de uma não impede as outras", async () => {
  const contas = [
    rec("n1", { usa_historico_pagamentos: true }),
    rec("n2", { usa_historico_pagamentos: true, nome: "Internet" }),
    rec("a1", { nome: "Contador" }),
    rec("a2", { nome: "Limpeza" }),
    rec("r1", { tipo: "receber", nome: "Mensalidade" }),
    c("x"),
  ];
  const ids = contas.map((k) => String(k.id));
  // Falha uma do modelo novo (Internet) e uma do antigo (Contador, antes de Limpeza).
  const falhar = (ch: any) => ch.ops[0][0] === "insert" && ch.tabela === "contas" && ["Internet", "Contador"].includes(ch.ops[0][1]?.nome);
  const e = await executar(novo, contas, (h) => h.marcarVariasComoPaga(ids), { falhar });
  assertEquals(e.retorno, true);
  assertEquals(contasNovas(e, ids).map((k) => k.nome).sort(), ["Aluguel", "Limpeza", "Mensalidade"]);
  for (const id of ids) assert(["pago", "recebido"].includes(String(e.db.contas().find((k) => k.id === id)!.status)), id);
  const baixa = e.toasts.find((t) => t.title === "Baixa realizada")!;
  assert(baixa.description!.includes("3 conta(s) recorrente(s) gerada(s)"));
  const erro = ultimoToast(e);
  assertEquals(erro.variant, "destructive");
  assert(erro.description!.includes("Internet") && erro.description!.includes("Contador"));
});

teste("já existe a próxima: não duplica", async () => {
  const contas = [rec("a"), rec("prox", { data: "2026-12-10" })];
  const e = await executar(novo, contas, (h) => h.marcarComoPaga("a", "pagar"));
  assertEquals(contasNovas(e, ["a", "prox"]).length, 0);
  assert(!e.toasts.some((t) => t.title === "Conta recorrente gerada"));
});

teste("falha no insert (modelo novo): pagamento preservado, sem toast de sucesso, erro claro", async () => {
  const contas = [rec("n", { usa_historico_pagamentos: true })];
  const falhar = (ch: any) => ch.tabela === "contas" && ch.ops[0][0] === "insert";
  const e = await executar(novo, contas, (h) => h.marcarComoPaga("n", "pagar"), { falhar });
  assertEquals(e.retorno, true);
  assertEquals(e.db.contas()[0].status, "pago");
  assertEquals(e.db.tabelas.pagamentos_contas.length, 1);
  assertEquals(contasNovas(e, ["n"]).length, 0);
  assert(!e.toasts.some((t) => t.title === "Conta recorrente gerada"));
  assertEquals(ultimoToast(e).variant, "destructive");
  assert(ultimoToast(e).description!.includes("O pagamento foi registrado"));
});

teste("falha no insert (modelo antigo): conta paga, sem toast de sucesso (antes mostrava sucesso)", async () => {
  const contas = [rec("a")];
  const falhar = (ch: any) => ch.tabela === "contas" && ch.ops[0][0] === "insert";
  const x = await executar(antes, contas, (h) => h.marcarComoPaga("a", "pagar"), { falhar });
  const y = await executar(novo, contas, (h) => h.marcarComoPaga("a", "pagar"), { falhar });
  assert(x.toasts.some((t) => t.title === "Conta recorrente gerada"), "antes: sucesso mesmo com o insert falhando");
  assert(!y.toasts.some((t) => t.title === "Conta recorrente gerada"));
  assertEquals(y.retorno, true);
  assertEquals(y.db.contas()[0].status, "pago");
  assertEquals(ultimoToast(y).variant, "destructive");
});

teste("clique duplo (ao mesmo tempo e em seguida): uma próxima só", async () => {
  for (const usa of [true, false]) {
    const contas = [rec("k", { usa_historico_pagamentos: usa })];
    const juntos = await executar(novo, contas, (h) => Promise.all([h.marcarComoPaga("k", "pagar"), h.marcarComoPaga("k", "pagar")]));
    assertEquals(contasNovas(juntos, ["k"]).length, 1, `ao mesmo tempo, modelo novo=${usa}`);
    const seguidos = await executar(novo, contas, async (h) => {
      await h.marcarComoPaga("k", "pagar");
      await h.marcarComoPaga("k", "pagar");
    });
    assertEquals(contasNovas(seguidos, ["k"]).length, 1, `em seguida, modelo novo=${usa}`);
  }
});

teste("dia fixo 31: paga 28/02 (série com 31/01) gera 31/03", async () => {
  const contas = [rec("jan", { data: "2027-01-31", status: "pago" }), rec("fev", { data: "2027-02-28", usa_historico_pagamentos: true })];
  const e = await executar(novo, contas, (h) => h.marcarComoPaga("fev", "pagar"));
  assertEquals(contasNovas(e, ["jan", "fev"]).map((k) => k.data), ["2027-03-31"]);
});

teste("criarConta já paga e recorrente gera a próxima; com entrada parcial não", async () => {
  const dados = { nome: "Aluguel", tipo: "pagar", valor: 100, data: "2026-11-10", recorrente: true };
  const pago = await executar(novo, [], (h) => h.criarConta({ ...dados, status: "pago" } as any));
  assertEquals(pago.db.contas().map((k) => [k.data, k.status]), [["2026-11-10", "pago"], ["2026-12-10", "pendente"]]);
  assertEquals(ultimoToast(pago).title, "Conta recorrente gerada");
  const parcial = await executar(novo, [], (h) => h.criarConta({ ...dados, status: "pendente", valor_pago: 30 } as any));
  assertEquals(parcial.db.contas().length, 1);
});

teste("atualizarConta para pago gera; edição de conta já paga não gera", async () => {
  const e = await executar(novo, [rec("a")], (h) => h.atualizarConta("a", { status: "pago", recorrente: true, nome: "Aluguel" } as any));
  assertEquals(contasNovas(e, ["a"]).length, 1);
  const jaPaga = await executar(novo, [rec("a", { status: "pago" })], (h) => h.atualizarConta("a", { status: "pago", recorrente: true, nome: "Aluguel 2" } as any));
  assertEquals(contasNovas(jaPaga, ["a"]).length, 0);
  // Desligar a recorrência na edição: nada a gerar.
  const desligou = await executar(novo, [rec("a")], (h) => h.atualizarConta("a", { status: "pago", recorrente: false } as any));
  assertEquals(contasNovas(desligou, ["a"]).length, 0);
});

teste("funcionário em filial: próxima com user_id do dono (targetUserId) e a mesma filial", async () => {
  const e = await executar(novo, [rec("a", { empresa_id: "filial-1" })], (h) => h.marcarComoPaga("a", "pagar"), {
    authUser: "funcionario",
    target: "dono",
  });
  const [p] = contasNovas(e, ["a"]);
  assertEquals([p.user_id, p.empresa_id], ["dono", "filial-1"]);
});

teste("ficha do fornecedor (sem lista): gera com a conta informada", async () => {
  const conta = rec("n", { usa_historico_pagamentos: true });
  const a = await executar(novo, [conta], (h) => h.marcarComoPaga("n", "pagar", undefined, conta as any), { lista: [] });
  assertEquals(contasNovas(a, ["n"]).length, 1);
  const b = await executar(novo, [conta], (h) => h.registrarPagamentoParcial("n", { valor: 100, data: "2026-11-17" }, conta as any), { lista: [] });
  assertEquals(contasNovas(b, ["n"]).length, 1);
  const c2 = await executar(novo, [conta], (h) => h.marcarVariasComoPaga(["n"], [conta] as any), { lista: [] });
  assertEquals(contasNovas(c2, ["n"]).length, 1);
});
