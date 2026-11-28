// Banco em memória para estornoEstoqueVenda.core.ts (só dados fictícios; nada vai à rede).
// Entende o subconjunto usado: select/update + eq/is/in/or/order + maybeSingle/single + update().select().
// `falhar(tabela, op, payload)` devolve a mensagem de erro para simular falha do banco.
type Linha = Record<string, unknown>;
type Op = "select" | "update";
type Filtro = (r: Linha) => boolean;

export interface Gravacao { tabela: string; payload: Linha; ids: unknown[] }

type Resposta<T> = { data: T; error: { message: string } | null };
interface Consulta {
  select: (colunas?: string) => Consulta;
  update: (p: Linha) => Consulta;
  eq: (c: string, v: unknown) => Consulta;
  is: (c: string, v: unknown) => Consulta;
  in: (c: string, vs: unknown[]) => Consulta;
  or: (expr: string) => Consulta;
  order: (...args: unknown[]) => Consulta;
  maybeSingle: () => Promise<Resposta<Linha | null>>;
  single: () => Promise<Resposta<Linha | null>>;
  then: <T>(ok: (v: Resposta<Linha[] | null>) => T, erro?: (e: unknown) => T) => Promise<T>;
}

const valor = (v: string): unknown => (v === "null" ? null : v === "true" ? true : v === "false" ? false : v);

/** Interpreta "a.is.null,a.eq.false,b.in.(x,y)" (OU entre os termos). */
function filtroOr(expr: string): Filtro {
  const termos: string[] = [];
  let atual = "";
  let nivel = 0;
  for (const ch of expr) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) { termos.push(atual); atual = ""; } else atual += ch;
  }
  if (atual) termos.push(atual);
  const fs = termos.map((t): Filtro => {
    const [col, op, ...resto] = t.split(".");
    const arg = resto.join(".");
    if (op === "is") return (r) => (r[col] ?? null) === valor(arg);
    if (op === "eq") return (r) => r[col] != null && r[col] === valor(arg);
    if (op === "neq") return (r) => r[col] != null && r[col] !== valor(arg);
    if (op === "in") {
      const lista = arg.replace(/^\(|\)$/g, "").split(",");
      return (r) => r[col] != null && lista.includes(String(r[col]));
    }
    throw new Error(`or não suportado: ${t}`);
  });
  return (r) => fs.some((f) => f(r));
}

export function bancoMemoria(
  tabelas: Record<string, Linha[]>,
  falhar: (tabela: string, op: Op, payload: Linha) => string | null = () => null,
) {
  const gravacoes: Gravacao[] = [];
  const from = (tabela: string) => {
    let op: Op = "select";
    let payload: Linha = {};
    const filtros: Filtro[] = [];
    const linhas = () => (tabelas[tabela] ??= []).filter((r) => filtros.every((f) => f(r)));
    const executar = () => {
      const erro = falhar(tabela, op, payload);
      if (erro) return { data: null, error: { message: erro } };
      const alvo = linhas();
      if (op === "update") {
        alvo.forEach((r) => Object.assign(r, payload));
        gravacoes.push({ tabela, payload, ids: alvo.map((r) => r.id) });
      }
      return { data: alvo.map((r) => ({ ...r })), error: null };
    };
    const b: Consulta = {
      select: () => b,
      update: (p: Linha) => ((op = "update"), (payload = p), b),
      eq: (c: string, v: unknown) => (filtros.push((r) => r[c] != null && r[c] === v), b),
      is: (c: string, v: unknown) => (filtros.push((r) => (r[c] ?? null) === v), b),
      in: (c: string, vs: unknown[]) => (filtros.push((r) => r[c] != null && vs.includes(r[c])), b),
      or: (expr: string) => (filtros.push(filtroOr(expr)), b),
      order: () => b,
      maybeSingle: () => {
        const r = executar();
        return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
      },
      single: () => {
        const r = executar();
        if (!r.error && r.data?.length !== 1) return Promise.resolve({ data: null, error: { message: "0 ou várias linhas" } });
        return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
      },
      then: (ok, erro) => Promise.resolve(executar()).then(ok, erro),
    };
    return b;
  };
  return { client: { from }, tabelas, gravacoes };
}
