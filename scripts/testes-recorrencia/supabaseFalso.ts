// Supabase falso em memória para os testes de recorrência (nunca fala com a rede).
// - Registra cada chamada (tabela + operações encadeadas) para comparar antes/depois.
// - Filtros: eq, neq, in, is, gte, lte, or ("col.eq.x,col.is.null"), not (ignorado), order/limit.
// - Imita o gatilho sync_conta_from_pagamentos (migration 20260907000000): só em
//   conta com usa_historico_pagamentos = true recalcula valor_pago/status/data_pagamento.
// - falhar(fn): devolve { error } para as chamadas em que fn(chamada) = true.

export type Linha = Record<string, unknown>;
export interface Chamada {
  tabela: string;
  ops: Array<[string, ...unknown[]]>;
}

const DEFAULTS: Record<string, Linha> = {
  contas: {
    status: "pendente",
    recorrente: false,
    usa_historico_pagamentos: false,
    compra_estoque: false,
    valor_pago: 0,
    data_pagamento: null,
    empresa_id: null,
    categoria: null,
    descricao: null,
    fornecedor_id: null,
    cliente_id: null,
    os_numero: null,
  },
  pagamentos_contas: { estornado: false },
};

export class SupabaseFalso {
  tabelas: Record<string, Linha[]> = {};
  chamadas: Chamada[] = [];
  private seq = 0;
  private falha: ((c: Chamada) => boolean) | null = null;
  userId: string;

  constructor(dados: Record<string, Linha[]>, userId = "dono") {
    for (const [t, linhas] of Object.entries(dados)) this.tabelas[t] = linhas.map((l) => ({ ...(DEFAULTS[t] ?? {}), ...l }));
    this.userId = userId;
  }

  falhar(fn: (c: Chamada) => boolean) {
    this.falha = fn;
  }

  auth = {
    getUser: async () => {
      this.chamadas.push({ tabela: "auth", ops: [["getUser"]] });
      return { data: { user: { id: this.userId } }, error: null };
    },
    getSession: async () => {
      this.chamadas.push({ tabela: "auth", ops: [["getSession"]] });
      return { data: { session: { user: { id: this.userId } } }, error: null };
    },
  };

  rpc(nome: string, args: unknown) {
    this.chamadas.push({ tabela: "rpc", ops: [["rpc", nome, args]] });
    return Promise.resolve({ data: null, error: null });
  }

  from(tabela: string) {
    const chamada: Chamada = { tabela, ops: [] };
    this.chamadas.push(chamada);
    // deno-lint-ignore no-this-alias
    const db = this;
    const filtros: Array<(l: Linha) => boolean> = [];
    let acao: { tipo: "select" | "insert" | "update" | "delete"; valor?: unknown } = { tipo: "select" };
    let selecionar = false;
    let limite: number | null = null;
    let terminal: "lista" | "maybeSingle" | "single" = "lista";

    const executar = async () => {
      await Promise.resolve(); // deixa outras chamadas intercalarem (clique duplo)
      if (db.falha?.(chamada)) return { data: null, error: { message: "falha simulada" } };
      const linhas = (db.tabelas[tabela] ??= []);
      let resultado: Linha[] = [];
      if (acao.tipo === "insert") {
        const novos = (Array.isArray(acao.valor) ? acao.valor : [acao.valor]) as Linha[];
        for (const n of novos) {
          const linha = { ...(DEFAULTS[tabela] ?? {}), id: `${tabela}-novo-${++db.seq}`, ...n };
          linhas.push(linha);
          resultado.push({ ...linha });
          if (tabela === "pagamentos_contas") db.sincronizarConta(String(linha.conta_id));
        }
      } else {
        const alvo = linhas.filter((l) => filtros.every((f) => f(l)));
        if (acao.tipo === "update") {
          for (const l of alvo) Object.assign(l, acao.valor as Linha);
          if (tabela === "pagamentos_contas") for (const l of alvo) db.sincronizarConta(String(l.conta_id));
        } else if (acao.tipo === "delete") {
          db.tabelas[tabela] = linhas.filter((l) => !alvo.includes(l));
        }
        resultado = alvo.map((l) => ({ ...l }));
      }
      if (limite != null) resultado = resultado.slice(0, limite);
      if (acao.tipo !== "select" && !selecionar) return { data: null, error: null };
      if (terminal === "maybeSingle") return { data: resultado[0] ?? null, error: null };
      if (terminal === "single") {
        return resultado.length === 1 ? { data: resultado[0], error: null } : { data: null, error: { message: "não é uma linha" } };
      }
      return { data: resultado, error: null };
    };

    const col = (l: Linha, c: string) => l[c] ?? null;
    const b: Record<string, unknown> = {
      select(cols?: string) {
        chamada.ops.push(["select", cols]);
        if (acao.tipo === "select") acao = { tipo: "select" };
        else selecionar = true;
        return b;
      },
      insert(v: unknown) {
        chamada.ops.push(["insert", v]);
        acao = { tipo: "insert", valor: v };
        return b;
      },
      update(v: unknown) {
        chamada.ops.push(["update", v]);
        acao = { tipo: "update", valor: v };
        return b;
      },
      delete() {
        chamada.ops.push(["delete"]);
        acao = { tipo: "delete" };
        return b;
      },
      eq(c: string, v: unknown) {
        chamada.ops.push(["eq", c, v]);
        filtros.push((l) => col(l, c) === v);
        return b;
      },
      neq(c: string, v: unknown) {
        chamada.ops.push(["neq", c, v]);
        filtros.push((l) => col(l, c) !== v);
        return b;
      },
      in(c: string, vs: unknown[]) {
        chamada.ops.push(["in", c, vs]);
        filtros.push((l) => vs.includes(col(l, c)));
        return b;
      },
      is(c: string, v: unknown) {
        chamada.ops.push(["is", c, v]);
        filtros.push((l) => col(l, c) === v);
        return b;
      },
      gte(c: string, v: string) {
        chamada.ops.push(["gte", c, v]);
        filtros.push((l) => String(col(l, c)) >= v);
        return b;
      },
      lte(c: string, v: string) {
        chamada.ops.push(["lte", c, v]);
        filtros.push((l) => String(col(l, c)) <= v);
        return b;
      },
      or(expr: string) {
        chamada.ops.push(["or", expr]);
        const partes = expr.split(",").map((p) => {
          const [c, op, ...resto] = p.split(".");
          const v = resto.join(".");
          return (l: Linha) => (op === "is" && v === "null" ? col(l, c) === null : op === "eq" ? String(col(l, c)) === v : false);
        });
        filtros.push((l) => partes.some((f) => f(l)));
        return b;
      },
      not(...a: unknown[]) {
        chamada.ops.push(["not", ...a]);
        return b;
      },
      order(...a: unknown[]) {
        chamada.ops.push(["order", ...a]);
        return b;
      },
      limit(n: number) {
        chamada.ops.push(["limit", n]);
        limite = n;
        return b;
      },
      maybeSingle() {
        chamada.ops.push(["maybeSingle"]);
        terminal = "maybeSingle";
        return executar();
      },
      single() {
        chamada.ops.push(["single"]);
        terminal = "single";
        return executar();
      },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return executar().then(res, rej);
      },
    };
    return b;
  }

  /** sync_conta_from_pagamentos (mesma regra do banco). */
  private sincronizarConta(contaId: string) {
    const conta = (this.tabelas.contas ?? []).find((c) => c.id === contaId);
    if (!conta || conta.usa_historico_pagamentos !== true) return;
    const pags = (this.tabelas.pagamentos_contas ?? []).filter((p) => p.conta_id === contaId && p.estornado !== true);
    const total = pags.reduce((s, p) => s + Number(p.valor), 0);
    const ultima = pags.map((p) => String(p.data_pagamento)).sort().pop() ?? null;
    const quitada = total >= Number(conta.valor) - 0.005;
    conta.valor_pago = total;
    conta.status = quitada ? (conta.tipo === "pagar" ? "pago" : "recebido") : "pendente";
    conta.data_pagamento = quitada ? ultima : null;
  }

  contas() {
    return (this.tabelas.contas ?? []).map((c) => ({ ...c }));
  }
}
