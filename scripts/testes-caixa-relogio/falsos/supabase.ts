// Supabase FALSO, só em memória e sem rede. Dados fictícios.
type Linha = Record<string, any>;
const DataReal = Date;

export const servidor = {
  agoraMs: 0,
  rpc: "ok" as "ok" | "ausente" | "erro" | "trava",
  chamadasRpc: 0,
  gatilho: false,
  tabelas: {} as Record<string, Linha[]>,
  escritas: [] as { tabela: string; corpo: Linha; afetadas: number }[],
  consultas: [] as { tabela: string; filtros: [string, string, unknown][] }[],
  antesDeAtualizar: null as null | (() => void),
};

const tempo = (v: unknown) => DataReal.parse(String(v));
const passaNoOu = (l: Linha, expr: string) => expr.split(",").some((parte) => {
  const [col, op, ...resto] = parte.split(".");
  const valor = resto.join(".");
  if (op === "is") return (l[col] ?? null) === null;
  return String(l[col]) === valor;
});

class Consulta {
  private filtros: ((l: Linha) => boolean)[] = [];
  private descritos: [string, string, unknown][] = [];
  private corpo: Linha | null = null;
  private modo: "lista" | "uma" | "talvez" = "lista";
  constructor(private tabela: string) {}
  select() { return this; }
  order() { return this; }
  limit() { return this; }
  update(corpo: Linha) { this.corpo = corpo; return this; }
  single() { this.modo = "uma"; return this; }
  maybeSingle() { this.modo = "talvez"; return this; }
  private add(col: string, op: string, v: unknown, f: (l: Linha) => boolean) { this.descritos.push([col, op, v]); this.filtros.push(f); return this; }
  eq(c: string, v: unknown) { return this.add(c, "eq", v, (l) => l[c] === v); }
  is(c: string, v: unknown) { return this.add(c, "is", v, (l) => (l[c] ?? null) === v); }
  in(c: string, v: unknown[]) { return this.add(c, "in", v, (l) => v.includes(l[c])); }
  gte(c: string, v: unknown) { return this.add(c, "gte", v, (l) => l[c] != null && tempo(l[c]) >= tempo(v)); }
  lte(c: string, v: unknown) { return this.add(c, "lte", v, (l) => l[c] != null && tempo(l[c]) <= tempo(v)); }
  gt(c: string, v: number) { return this.add(c, "gt", v, (l) => Number(l[c]) > v); }
  or(e: string) { return this.add("*", "or", e, (l) => passaNoOu(l, e)); }
  then<R>(ok: (r: { data: any; error: any }) => R) {
    const base = servidor.tabelas[this.tabela] ?? [];
    if (this.corpo) {
      servidor.antesDeAtualizar?.();
      const alvo = base.filter((l) => this.filtros.every((f) => f(l)));
      for (const l of alvo) {
        const fechando = servidor.gatilho && this.tabela === "caixas" && l.status === "aberto" && this.corpo.status === "fechado";
        Object.assign(l, this.corpo, fechando ? { data_fechamento: new DataReal(servidor.agoraMs).toISOString() } : {});
      }
      servidor.escritas.push({ tabela: this.tabela, corpo: { ...this.corpo }, afetadas: alvo.length });
      return Promise.resolve(ok({ data: alvo.map((l) => ({ ...l })), error: null }));
    }
    servidor.consultas.push({ tabela: this.tabela, filtros: this.descritos });
    const linhas = base.filter((l) => this.filtros.every((f) => f(l))).map((l) => ({ ...l }));
    const data = this.modo === "lista" ? linhas : (linhas[0] ?? null);
    return Promise.resolve(ok({ data, error: this.modo === "uma" && !linhas[0] ? { code: "PGRST116" } : null }));
  }
}

export const supabase = {
  from: (tabela: string) => new Consulta(tabela),
  auth: { getUser: async () => ({ data: { user: { id: "dono" } } }) },
  rpc: (funcao: string) => {
    servidor.chamadasRpc++;
    if (funcao !== "agora_servidor") throw new Error("rpc inesperada");
    if (servidor.rpc === "erro") throw new Error("sem internet");
    if (servidor.rpc === "trava") return new Promise(() => undefined);
    if (servidor.rpc === "ausente") return Promise.resolve({ data: null, error: { code: "PGRST202", message: "função não encontrada" } });
    return Promise.resolve({ data: new DataReal(servidor.agoraMs).toISOString(), error: null });
  },
};
