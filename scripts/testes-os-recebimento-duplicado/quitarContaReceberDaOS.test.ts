// node --test scripts/testes-os-recebimento-duplicado/quitarContaReceberDaOS.test.ts
// Baixa da conta a receber da OS na entrega: nunca cria a 2ª conta de uma OS
// já recebida em Contas. Banco falso em memória, dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quitarContaReceberDaOSCore,
  lerContaDaOSCore,
  planejarQuitacaoContaOS,
  escolherContaDaOS,
  mapaStatusContaPorOS,
  padraoNomeContaOS,
  type ClienteBancoLike,
  type ContaReceberOSLinha,
  type ParametrosQuitacaoOS,
} from "../../src/lib/ordemServico/quitarContaReceberDaOS.core.ts";

type Linha = Record<string, unknown>;

/** ILIKE do Postgres → RegExp (com \% e \_ escapados). */
function ilikeParaRegex(padrao: string): RegExp {
  let re = "";
  for (let i = 0; i < padrao.length; i++) {
    const c = padrao[i];
    if (c === "\\" && i + 1 < padrao.length) {
      re += padrao[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (c === "%") re += ".*";
    else if (c === "_") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "is");
}

function criarBanco(contasIniciais: Linha[], pagamentosIniciais: Linha[] = []) {
  const tabelas: Record<string, Linha[]> = {
    contas: contasIniciais.map((c) => ({ ...c })),
    pagamentos_contas: pagamentosIniciais.map((p) => ({ estornado: false, ...p })),
  };
  let seq = 0;

  // Réplica de sync_conta_from_pagamentos (migration 20260907000000).
  const sincronizar = (contaId: unknown) => {
    const conta = tabelas.contas.find((c) => c.id === contaId);
    if (!conta || !conta.usa_historico_pagamentos) return;
    const pags = tabelas.pagamentos_contas.filter((p) => p.conta_id === contaId && !p.estornado);
    const total = pags.reduce((a, p) => a + Number(p.valor), 0);
    const ultima = pags.map((p) => String(p.data_pagamento)).sort().pop() ?? null;
    const quitou = total >= Number(conta.valor) - 0.005;
    conta.valor_pago = total;
    conta.status = quitou ? "recebido" : "pendente";
    conta.data_pagamento = quitou ? ultima : null;
  };

  const cliente = {
    from(tabela: string) {
      const filtros: Array<(l: Linha) => boolean> = [];
      let operacao: { tipo: "select" } | { tipo: "update"; dados: Linha } = { tipo: "select" };
      const construtor = {
        select() { operacao = { tipo: "select" }; return construtor; },
        update(dados: Linha) { operacao = { tipo: "update", dados }; return construtor; },
        insert(dados: Linha) {
          const linha = { id: `novo-${++seq}`, created_at: `2026-11-07T00:00:${String(seq).padStart(2, "0")}Z`, estornado: false, ...dados };
          tabelas[tabela].push(linha);
          if (tabela === "pagamentos_contas") sincronizar(linha.conta_id);
          return Promise.resolve({ data: null, error: null });
        },
        eq(col: string, v: unknown) { filtros.push((l) => l[col] === v); return construtor; },
        is(col: string, v: unknown) { filtros.push((l) => (l[col] ?? null) === v); return construtor; },
        ilike(col: string, padrao: string) {
          const re = ilikeParaRegex(padrao);
          filtros.push((l) => re.test(String(l[col] ?? "")));
          return construtor;
        },
        then(ok: (r: { data: Linha[] | null; error: null }) => unknown, falha?: (e: unknown) => unknown) {
          const alvo = tabelas[tabela].filter((l) => filtros.every((f) => f(l)));
          if (operacao.tipo === "update") {
            for (const l of alvo) Object.assign(l, operacao.dados);
            return Promise.resolve({ data: null, error: null }).then(ok, falha);
          }
          return Promise.resolve({ data: alvo.map((l) => ({ ...l })), error: null }).then(ok, falha);
        },
      };
      return construtor;
    },
  } as unknown as ClienteBancoLike;

  return { cliente, tabelas };
}

const USER = "u-teste";

const conta = (c: Partial<Linha> & { id: string }): Linha => ({
  user_id: USER,
  empresa_id: null,
  tipo: "receber",
  usa_historico_pagamentos: false,
  valor_pago: null,
  created_at: "2026-11-01T10:00:00Z",
  ...c,
});

const params = (numeroOS: string, extra: Partial<ParametrosQuitacaoOS> = {}): ParametrosQuitacaoOS => ({
  userId: USER,
  numeroOS,
  modo: "quitar",
  dataRecebimento: "2026-11-07",
  formaPagamento: "pix",
  camposConta: { data: "2026-11-07" },
  novaConta: {
    nome: `OS ${numeroOS} - Cliente Teste`,
    tipo: "receber",
    valor: 300,
    status: "recebido",
    os_numero: numeroOS,
    user_id: USER,
    data: "2026-11-07",
    data_pagamento: "2026-11-07",
  },
  ...extra,
});

const contasDaOS = (tabelas: Record<string, Linha[]>, n: string) =>
  tabelas.contas.filter((c) => c.os_numero === n && c.tipo === "receber");

test("A: conta já recebida em Contas + Entregue → não duplica nem altera", async () => {
  const original = conta({ id: "c1", os_numero: "9001", nome: "OS 9001 - Cliente Teste", valor: 300, status: "recebido", data: "2026-11-03", data_pagamento: "2026-11-03" });
  const { cliente, tabelas } = criarBanco([original]);
  const r = await quitarContaReceberDaOSCore(cliente, params("9001"));
  assert.deepEqual(r, { status: "ja_quitada", contaId: "c1" });
  assert.equal(contasDaOS(tabelas, "9001").length, 1);
  assert.deepEqual(tabelas.contas[0], original, "a data do recebimento real não pode mudar");
});

test("A': conta recebida pelo modelo novo (histórico) + Entregue → não registra outro pagamento", async () => {
  const { cliente, tabelas } = criarBanco(
    [conta({ id: "c1", os_numero: "9001", valor: 300, valor_pago: 300, status: "recebido", usa_historico_pagamentos: true })],
    [{ id: "p1", conta_id: "c1", valor: 300, data_pagamento: "2026-11-03" }],
  );
  const r = await quitarContaReceberDaOSCore(cliente, params("9001"));
  assert.equal(r.status, "ja_quitada");
  assert.equal(tabelas.pagamentos_contas.length, 1);
  assert.equal(tabelas.contas.length, 1);
});

test("A'': 'pago' legado em conta a receber vale como quitada", async () => {
  const { cliente, tabelas } = criarBanco([conta({ id: "c1", os_numero: "9001", valor: 300, status: "pago" })]);
  assert.equal((await quitarContaReceberDaOSCore(cliente, params("9001"))).status, "ja_quitada");
  assert.equal(tabelas.contas.length, 1);
});

test("B: conta antiga sem os_numero 'OS N - …' já recebida → reconhece e não insere", async () => {
  const { cliente, tabelas } = criarBanco([conta({ id: "c1", os_numero: null, nome: "OS 9002 - Cliente Teste", valor: 500, status: "recebido" })]);
  const r = await quitarContaReceberDaOSCore(cliente, params("9002"));
  assert.deepEqual(r, { status: "ja_quitada", contaId: "c1" });
  assert.equal(tabelas.contas.length, 1);
});

test("B': conta antiga sem os_numero pendente → é a que recebe a baixa", async () => {
  const { cliente, tabelas } = criarBanco([conta({ id: "c1", os_numero: null, nome: "os 9002 - Cliente Teste", valor: 500, status: "pendente" })]);
  const r = await quitarContaReceberDaOSCore(cliente, params("9002"));
  assert.deepEqual(r, { status: "quitada", contaId: "c1" });
  assert.equal(tabelas.contas.length, 1);
  assert.equal(tabelas.contas[0].status, "recebido");
  assert.equal(tabelas.contas[0].data_pagamento, "2026-11-07");
  assert.equal(tabelas.contas[0].data, "2026-11-07");
});

test("C: Entregue sem recebimento prévio (pendente, modelo antigo) → 1 conta recebida", async () => {
  const { cliente, tabelas } = criarBanco([conta({ id: "c1", os_numero: "9003", valor: 200, status: "pendente" })]);
  const r = await quitarContaReceberDaOSCore(cliente, params("9003"));
  assert.deepEqual(r, { status: "quitada", contaId: "c1" });
  const contas = contasDaOS(tabelas, "9003");
  assert.equal(contas.length, 1);
  assert.equal(contas[0].status, "recebido");
});

test("C': OS sem conta nenhuma → insere exatamente uma, como antes", async () => {
  const { cliente, tabelas } = criarBanco([]);
  const r = await quitarContaReceberDaOSCore(cliente, params("9004"));
  assert.deepEqual(r, { status: "inserida" });
  assert.equal(contasDaOS(tabelas, "9004").length, 1);
  // repetir a entrega não cria a 2ª
  assert.equal((await quitarContaReceberDaOSCore(cliente, params("9004"))).status, "ja_quitada");
  assert.equal(contasDaOS(tabelas, "9004").length, 1);
});

test("D: entregar a OS 12 não toca a conta pendente da OS 123 (nem da 1200)", async () => {
  const { cliente, tabelas } = criarBanco([
    conta({ id: "c123", os_numero: null, nome: "OS 123 - Cliente Teste", valor: 900, status: "pendente" }),
    conta({ id: "c1200", os_numero: null, nome: "OS 1200 - Cliente Teste", valor: 50, status: "pendente" }),
  ]);
  const r = await quitarContaReceberDaOSCore(cliente, params("12"));
  assert.deepEqual(r, { status: "inserida" });
  assert.equal(tabelas.contas.find((c) => c.id === "c123")?.status, "pendente");
  assert.equal(tabelas.contas.find((c) => c.id === "c1200")?.status, "pendente");
});

test("D': fallback por nome ignora conta COM os_numero de outra OS", async () => {
  const { cliente, tabelas } = criarBanco([conta({ id: "x", os_numero: "77", nome: "OS 12 - nome reaproveitado", valor: 10, status: "pendente" })]);
  assert.equal((await quitarContaReceberDaOSCore(cliente, params("12"))).status, "inserida");
  assert.equal(tabelas.contas.find((c) => c.id === "x")?.status, "pendente");
});

test("padrão do nome escapa % e _ do número", () => {
  assert.equal(padraoNomeContaOS("12"), "OS 12 -%");
  assert.equal(padraoNomeContaOS("1_2%"), "OS 1\\_2\\% -%");
  assert.ok(!ilikeParaRegex(padraoNomeContaOS("1_2")).test("OS 1x2 - Cliente"));
});

test("pendente com histórico de pagamentos → registra o saldo e o trigger fecha a conta", async () => {
  const { cliente, tabelas } = criarBanco(
    [conta({ id: "c1", os_numero: "9005", valor: 300, valor_pago: 100, status: "pendente", usa_historico_pagamentos: true, empresa_id: "emp-1" })],
    [{ id: "p-entrada", conta_id: "c1", valor: 100, data_pagamento: "2026-11-01" }],
  );
  const r = await quitarContaReceberDaOSCore(cliente, params("9005", { camposConta: { data: "2026-11-07", forma_pagamento: "pix", status: "recebido" } }));
  assert.deepEqual(r, { status: "pagamento_registrado", contaId: "c1", quitou: true });
  const novo = tabelas.pagamentos_contas.find((p) => p.id !== "p-entrada");
  assert.ok(novo);
  assert.equal(novo.valor, 200);
  assert.equal(novo.forma_pagamento, "pix");
  assert.equal(novo.data_pagamento, "2026-11-07");
  assert.equal(novo.empresa_id, "emp-1");
  assert.equal(novo.observacao, "Quitação");
  const c = tabelas.contas[0];
  assert.equal(c.status, "recebido");
  assert.equal(c.valor_pago, 300);
  assert.equal(c.data_pagamento, "2026-11-07");
  assert.equal(c.data, "2026-11-07", "campos extras gravados");
  assert.equal(c.forma_pagamento, "pix");
  assert.equal(tabelas.contas.length, 1);
});

test("histórico com saldo zerado mas status pendente → não registra pagamento de 0", async () => {
  const { cliente, tabelas } = criarBanco([conta({ id: "c1", os_numero: "9006", valor: 300, valor_pago: 300, status: "pendente", usa_historico_pagamentos: true })]);
  assert.equal((await quitarContaReceberDaOSCore(cliente, params("9006"))).status, "ja_quitada");
  assert.equal(tabelas.pagamentos_contas.length, 0);
  assert.equal(tabelas.contas.length, 1);
});

test("duplicadas já existentes: recebida + pendente → nada; nenhuma 3ª conta", async () => {
  const { cliente, tabelas } = criarBanco([
    conta({ id: "orig", os_numero: "9007", valor: 300, status: "recebido", created_at: "2026-11-01T10:00:00Z" }),
    conta({ id: "dup", os_numero: "9007", valor: 300, status: "pendente", created_at: "2026-11-02T10:00:00Z" }),
  ]);
  assert.deepEqual(await quitarContaReceberDaOSCore(cliente, params("9007")), { status: "ja_quitada", contaId: "orig" });
  assert.equal(contasDaOS(tabelas, "9007").length, 2);
  assert.equal(tabelas.contas.find((c) => c.id === "dup")?.status, "pendente");
});

test("duplicadas pendentes → baixa só na mais antiga", async () => {
  const { cliente, tabelas } = criarBanco([
    conta({ id: "nova", os_numero: "9008", valor: 300, status: "pendente", created_at: "2026-11-05T10:00:00Z" }),
    conta({ id: "velha", os_numero: "9008", valor: 300, status: "pendente", created_at: "2026-11-01T10:00:00Z" }),
  ]);
  assert.deepEqual(await quitarContaReceberDaOSCore(cliente, params("9008")), { status: "quitada", contaId: "velha" });
  assert.equal(tabelas.contas.find((c) => c.id === "nova")?.status, "pendente");
});

test("manter_pendente (saldo a prazo): conta recebida → nada; pendente → atualiza; nenhuma → insere", async () => {
  const camposConta = { valor: 200, valor_pago: 100, status: "pendente", data_vencimento: "2026-12-01", forma_pagamento: "pix" };
  const novaConta = { nome: "OS 9009 - Cliente Teste", tipo: "receber", valor: 200, status: "pendente", os_numero: "9009", user_id: USER };

  const b1 = criarBanco([conta({ id: "c1", os_numero: "9009", valor: 300, status: "recebido" })]);
  assert.equal((await quitarContaReceberDaOSCore(b1.cliente, params("9009", { modo: "manter_pendente", camposConta, novaConta }))).status, "ja_quitada");
  assert.equal(b1.tabelas.contas.length, 1);
  assert.equal(b1.tabelas.contas[0].status, "recebido");

  const b2 = criarBanco([conta({ id: "c1", os_numero: "9009", valor: 300, status: "pendente" })]);
  assert.deepEqual(await quitarContaReceberDaOSCore(b2.cliente, params("9009", { modo: "manter_pendente", camposConta, novaConta })), { status: "pendente_atualizada", contaId: "c1" });
  assert.equal(b2.tabelas.contas[0].data_vencimento, "2026-12-01");
  assert.equal(b2.tabelas.pagamentos_contas.length, 0);

  const b3 = criarBanco([]);
  assert.equal((await quitarContaReceberDaOSCore(b3.cliente, params("9009", { modo: "manter_pendente", camposConta, novaConta }))).status, "inserida");
  assert.equal(b3.tabelas.contas.length, 1);
});

test("conta de outra loja com o mesmo número não é tocada", async () => {
  const { cliente, tabelas } = criarBanco([conta({ id: "outra", user_id: "u-outra", os_numero: "9010", valor: 300, status: "pendente" })]);
  assert.equal((await quitarContaReceberDaOSCore(cliente, params("9010"))).status, "inserida");
  assert.equal(tabelas.contas.find((c) => c.id === "outra")?.status, "pendente");
});

test("lerContaDaOS / escolherContaDaOS: quitada mais antiga, senão a mais antiga", async () => {
  const { cliente } = criarBanco([
    conta({ id: "pend-velha", os_numero: "9011", status: "pendente", created_at: "2026-10-01T00:00:00Z" }),
    conta({ id: "rec-nova", os_numero: "9011", status: "recebido", created_at: "2026-11-01T00:00:00Z" }),
    conta({ id: "rec-velha", os_numero: "9011", status: "recebido", created_at: "2026-10-15T00:00:00Z" }),
  ]);
  assert.deepEqual(await lerContaDaOSCore(cliente, USER, "9011"), { id: "rec-velha", status: "recebido" });
  assert.equal(await lerContaDaOSCore(cliente, USER, "nao-existe"), null);
  assert.equal(
    escolherContaDaOS([
      { id: "b", status: "pendente", created_at: "2026-11-02" },
      { id: "a", status: "pendente", created_at: "2026-11-01" },
    ])?.id,
    "a",
  );
});

test("mapaStatusContaPorOS: com duplicadas vence a quitada, em qualquer ordem", () => {
  const linhas = [
    { os_numero: "1", status: "recebido" },
    { os_numero: "1", status: "pendente" },
    { os_numero: "2", status: "pendente" },
    { os_numero: "2", status: "recebido" },
    { os_numero: "3", status: "pendente" },
    { os_numero: null, status: "recebido" },
  ];
  const m = mapaStatusContaPorOS(linhas);
  assert.equal(m.get("1"), "recebido");
  assert.equal(m.get("2"), "recebido");
  assert.equal(m.get("3"), "pendente");
  assert.equal(m.size, 3);
});

test("planejar: pendente sem os_numero só vale se nenhuma conta tiver o os_numero", () => {
  const comNumero: ContaReceberOSLinha = { id: "n", status: "pendente", valor: 1, valor_pago: 0, usa_historico_pagamentos: false, created_at: "2026-11-02", user_id: USER, empresa_id: null, os_numero: "5" };
  const porNome: ContaReceberOSLinha = { ...comNumero, id: "nome", os_numero: null, nome: "OS 5 - x", status: "recebido" };
  assert.deepEqual(planejarQuitacaoContaOS([comNumero], [porNome], "5", "quitar"), { acao: "quitar_direto", contaId: "n" });
  assert.deepEqual(planejarQuitacaoContaOS([], [porNome], "5", "quitar"), { acao: "nada", motivo: "ja_quitada", contaId: "nome" });
});
