// Supabase falso: registra cada chamada (tabela + métodos + argumentos) em
// globalThis.__supabaseFalso e responde pelo `responder` do teste. Sem rede.
type Op = [string, unknown[]];
export interface ChamadaFalsa { alvo: string; ops: Op[] }
interface EstadoFalso {
  chamadas: ChamadaFalsa[];
  responder: (c: ChamadaFalsa) => { data: unknown; error: unknown };
}
const g = globalThis as unknown as { __supabaseFalso?: EstadoFalso };
g.__supabaseFalso ??= { chamadas: [], responder: () => ({ data: null, error: null }) };
const estado = () => g.__supabaseFalso!;

function construtor(alvo: string, opsIniciais: Op[] = []): unknown {
  const c: ChamadaFalsa = { alvo, ops: [...opsIniciais] };
  estado().chamadas.push(c);
  const proxy: unknown = new Proxy({}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
          Promise.resolve().then(() => estado().responder(c)).then(ok, falha);
      }
      return (...args: unknown[]) => {
        c.ops.push([String(prop), args]);
        return proxy;
      };
    },
  });
  return proxy;
}

export const supabase = {
  from: (tabela: string) => construtor(tabela),
  rpc: (nome: string, args?: unknown) => construtor(`rpc:${nome}`, [["rpc", [args]]]),
  auth: {
    getUser: async () => ({ data: { user: { id: "dono-1", email: "x@exemplo.local" } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: "dono-1" } } }, error: null }),
  },
  storage: {
    from: (bucket: string) => ({
      remove: (caminhos: unknown) => construtor(`storage:${bucket}`, [["remove", [caminhos]]]),
    }),
  },
  functions: {
    invoke: (nome: string, opts?: unknown) => construtor(`fn:${nome}`, [["invoke", [opts]]]),
  },
};
