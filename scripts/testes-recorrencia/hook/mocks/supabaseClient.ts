// deno-lint-ignore-file no-explicit-any
// Encaminha tudo para o Supabase falso do cenário atual (globalThis.__sb).
export const supabase: any = new Proxy({}, {
  get(_alvo, chave) {
    const sb = (globalThis as any).__sb;
    const v = sb[chave];
    return typeof v === "function" ? v.bind(sb) : v;
  },
});
