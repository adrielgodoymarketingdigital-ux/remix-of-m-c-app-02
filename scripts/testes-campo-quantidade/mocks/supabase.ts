// Supabase falso: qualquer cadeia de chamadas resolve com { data: null, error: null }.
const resultado = { data: null, error: null };
function cadeia(): unknown {
  const fn = () => proxy;
  const proxy: unknown = new Proxy(fn, {
    get(_t, prop) {
      if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
      return () => proxy;
    },
    apply() { return proxy; },
  });
  return proxy;
}
export const supabase = {
  from: () => cadeia(),
  rpc: () => cadeia(),
  storage: { from: () => cadeia() },
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "u1" } } } }),
    getUser: async () => ({ data: { user: { id: "u1" } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
