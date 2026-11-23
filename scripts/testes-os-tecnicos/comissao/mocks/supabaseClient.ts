// Supabase falso com banco em memória (globalThis.__bancoFalso). Entende os
// filtros que os hooks de comissão usam: eq, neq, is, in, gte, lte,
// not(col,"is",null), or("a.is.null,a.neq.x"), order, single/maybeSingle.
// Devolve as linhas inteiras (ignora a lista de colunas do select). Sem rede.
type Linha = Record<string, unknown>;
type Filtro = (l: Linha) => boolean;
const g = globalThis as unknown as { __bancoFalso?: Record<string, Linha[]>; __consultas?: string[] };
g.__bancoFalso ??= {};
g.__consultas ??= [];

const cmp = (a: unknown, b: unknown) => String(a ?? "").localeCompare(String(b ?? ""));

function condicaoOr(expr: string): Filtro {
  const partes = expr.split(",").map((p) => {
    const [col, op, ...resto] = p.split(".");
    const val = resto.join(".");
    if (op === "is" && val === "null") return (l: Linha) => l[col] == null;
    if (op === "neq") return (l: Linha) => l[col] != null && String(l[col]) !== val;
    if (op === "eq") return (l: Linha) => String(l[col]) === val;
    throw new Error(`or() não suportado: ${p}`);
  });
  return (l) => partes.some((f) => f(l));
}

function consulta(tabela: string) {
  const filtros: Filtro[] = [];
  let ordem: { col: string; asc: boolean } | null = null;
  let unico = false;
  const desc: string[] = [tabela];
  const q = {
    select: (..._a: unknown[]) => q,
    eq: (c: string, v: unknown) => { desc.push(`eq ${c}`); filtros.push((l) => l[c] === v); return q; },
    neq: (c: string, v: unknown) => { filtros.push((l) => l[c] != null && l[c] !== v); return q; },
    is: (c: string, v: unknown) => { filtros.push((l) => (v === null ? l[c] == null : l[c] === v)); return q; },
    in: (c: string, vs: unknown[]) => { desc.push(`in ${c}`); filtros.push((l) => vs.includes(l[c])); return q; },
    gte: (c: string, v: string) => { filtros.push((l) => l[c] != null && cmp(l[c], v) >= 0); return q; },
    lte: (c: string, v: string) => { filtros.push((l) => l[c] != null && cmp(l[c], v) <= 0); return q; },
    not: (c: string, op: string, v: unknown) => {
      if (op !== "is" || v !== null) throw new Error("not() não suportado");
      filtros.push((l) => l[c] != null); return q;
    },
    or: (expr: string) => { desc.push(`or`); filtros.push(condicaoOr(expr)); return q; },
    order: (col: string, o?: { ascending?: boolean }) => { ordem = { col, asc: o?.ascending !== false }; return q; },
    maybeSingle: () => { unico = true; return q; },
    single: () => { unico = true; return q; },
    then: (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => {
      g.__consultas!.push(desc.join(" "));
      let linhas = (g.__bancoFalso![tabela] || []).filter((l) => filtros.every((f) => f(l)));
      if (ordem) {
        const { col, asc } = ordem;
        linhas = [...linhas].sort((a, b) => (asc ? cmp(a[col], b[col]) : cmp(b[col], a[col])));
      }
      const copia = JSON.parse(JSON.stringify(linhas));
      return Promise.resolve({ data: unico ? (copia[0] ?? null) : copia, error: null }).then(ok, falha);
    },
  };
  return q;
}

export const supabase = {
  from: (tabela: string) => consulta(tabela),
  auth: { getUser: async () => ({ data: { user: { id: "dono-1" } }, error: null }) },
};
